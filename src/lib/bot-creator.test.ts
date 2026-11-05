import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let tempDir: string;
let db: import("@prisma/client").PrismaClient;
type NextRequest = import("next/server").NextRequest;
let createRequest: (body: unknown, apiKey?: string) => NextRequest;
let getRequest: (query: string, key?: string) => NextRequest;
let postCreatorContent: (request: NextRequest) => Promise<Response>;
let getCreatorContent: (request: NextRequest) => Promise<Response>;
let creatorId: string;
let telegramId: string;
let viewerId: string;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-bot-creator-test-"));
  const databaseUrl = `file:${path.join(tempDir, "creator.db")}`;
  execFileSync(path.resolve("node_modules/.bin/prisma"), [
    "db",
    "push",
    "--schema",
    "prisma/schema.test.prisma",
    "--skip-generate",
  ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  process.env.DATABASE_URL = databaseUrl;
  process.env.ANIME_BOT_API_KEY = "creator-test-secret";
  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient();
  await db.$connect();
  const creator = await db.user.create({
    data: {
      email: "creator-bot@example.test",
      username: "creator-bot",
      password: "test-hash",
      role: "creator",
      telegramId: "9001001",
    },
  });
  const viewer = await db.user.create({
    data: {
      email: "viewer-bot@example.test",
      username: "viewer-bot",
      password: "test-hash",
      telegramId: "9001002",
    },
  });
  creatorId = creator.id;
  telegramId = creator.telegramId!;
  viewerId = viewer.id;

  const routes = await import("@/app/api/bot/creator-content/route");
  postCreatorContent = routes.POST;
  getCreatorContent = routes.GET;
  const { NextRequest } = await import("next/server");
  createRequest = (body, apiKey = "creator-test-secret") => new NextRequest("http://localhost/api/bot/creator-content", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });
  getRequest = (query, key = "creator-test-secret") => new NextRequest(`http://localhost/api/bot/creator-content?${query}`, {
    headers: key ? { "x-api-key": key } : {},
  });
});

after(async () => {
  await db?.$disconnect();
  delete process.env.ANIME_BOT_API_KEY;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("bot creator API requires linked Telegram identity and Creator role", async () => {
  const forbiddenViewer = await postCreatorContent(createRequest({
    site_user_id: viewerId,
    telegram_id: "9001002",
    action: "create_anime",
    upload_key: "photo-unique-viewer",
    title: "Viewer Upload Attempt",
    description: "A sufficiently long synopsis for the viewer role rejection test.",
    cover_image: "https://bot.example/poster/pending?v=poster-2",
    genres: ["Action"],
    year: 2026,
    status: "ONGOING",
    type: "TV",
    is_free: true,
    price: 0,
  }));
  assert.equal(forbiddenViewer.status, 403);

  const badLink = await getCreatorContent(getRequest(
    new URLSearchParams({ site_user_id: creatorId, telegram_id: "wrong-id" }).toString(),
  ));
  assert.equal(badLink.status, 403);

  const unauthorized = await getCreatorContent(getRequest(
    new URLSearchParams({ site_user_id: creatorId, telegram_id: telegramId }).toString(),
    "",
  ));
  assert.equal(unauthorized.status, 401);
});

test("a linked creator can edit only the card fields the bot sends", async () => {
  const editor = await db.user.create({
    data: {
      email: "card-editor@example.test",
      username: "card-editor",
      password: "test-hash",
      role: "creator",
      telegramId: "9001010",
    },
  });
  const posterLink = "https://i.pinimg.com/originals/5f/3a/kakero.jpg";
  const createResponse = await postCreatorContent(createRequest({
    site_user_id: editor.id,
    telegram_id: editor.telegramId!,
    action: "create_anime",
    upload_key: "link-poster-creator-test",
    title: "Kakero Card",
    description: "A sufficiently long synopsis for the link based poster card test.",
    cover_image: posterLink,
    genres: ["Drama", "Romance"],
    year: 2024,
    status: "ONGOING",
    type: "TV",
    is_free: false,
    price: 100,
  }));
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json();
  const stored = await db.anime.findUniqueOrThrow({ where: { id: created.anime.id } });
  assert.equal(stored.coverImage, posterLink, "an external poster link is stored as-is");
  assert.doesNotMatch(stored.coverImage, /\/poster\//, "the bot poster route is not used for link posters");

  const update = (fields: Record<string, unknown>) => postCreatorContent(createRequest({
    site_user_id: editor.id,
    telegram_id: editor.telegramId!,
    action: "update_anime",
    slug: created.anime.slug,
    ...fields,
  }));

  const emptyUpdate = await update({});
  assert.equal(emptyUpdate.status, 400);
  assert.equal((await emptyUpdate.json()).error, "No fields to update");

  const cheapUpdate = await update({ is_free: false, price: 5 });
  assert.equal(cheapUpdate.status, 400);

  const badCover = await update({ cover_image: "ftp://files.example/kakero.jpg" });
  assert.equal(badCover.status, 400);

  const newCover = "https://cdn.example.net/art/kakero-v2.jpg";
  const edited = await update({ title: "Kakero Card (2-fasl)", cover_image: newCover, price: 150 });
  assert.equal(edited.status, 200);
  const body = await edited.json();
  assert.equal(body.anime.slug, created.anime.slug, "editing never rewrites the slug");
  assert.equal(body.anime.episode_count, 0);
  const afterEdit = await db.anime.findUniqueOrThrow({ where: { id: created.anime.id } });
  assert.equal(afterEdit.title, "Kakero Card (2-fasl)");
  assert.equal(afterEdit.coverImage, newCover);
  assert.equal(afterEdit.bannerImage, newCover, "a banner copied from the old poster follows the new poster");
  assert.equal(afterEdit.price, 150);
  assert.equal(afterEdit.description, stored.description, "fields the bot did not send stay untouched");
  assert.equal(afterEdit.genres, "Drama,Romance");
  assert.equal(afterEdit.year, 2024);
  assert.equal(afterEdit.hidden, true);
  assert.equal(afterEdit.moderationStatus, "PENDING");
  assert.equal(await db.animeVersion.count({ where: { animeId: created.anime.id, kind: "creator", price: 150 } }), 1,
    "the sale price buyers are charged lives on the creator version");

  await db.anime.update({ where: { id: created.anime.id }, data: { bannerImage: "https://cdn.example.net/hero-only.jpg" } });
  const coverOnly = await update({ cover_image: "https://cdn.example.net/art/kakero-v3.jpg" });
  assert.equal(coverOnly.status, 200);
  const withOwnBanner = await db.anime.findUniqueOrThrow({ where: { id: created.anime.id } });
  assert.equal(withOwnBanner.bannerImage, "https://cdn.example.net/hero-only.jpg", "a separately chosen banner is kept");

  const madeFree = await update({ is_free: true });
  assert.equal(madeFree.status, 200);
  const freeAnime = await db.anime.findUniqueOrThrow({ where: { id: created.anime.id } });
  assert.equal(freeAnime.isFree, true);
  assert.equal(freeAnime.price, 0);
  assert.equal(await db.animeVersion.count({ where: { animeId: created.anime.id, kind: "creator", price: 0 } }), 1);
});

test("the bot cannot edit another creator's card or a card it does not own", async () => {
  const owner = await db.user.create({
    data: {
      email: "card-owner@example.test",
      username: "card-owner",
      password: "test-hash",
      role: "creator",
      telegramId: "9001011",
    },
  });
  const outsider = await db.user.create({
    data: {
      email: "outsider-creator@example.test",
      username: "outsider-creator",
      password: "test-hash",
      role: "creator",
      telegramId: "9001009",
    },
  });
  const owned = await postCreatorContent(createRequest({
    site_user_id: owner.id,
    telegram_id: owner.telegramId!,
    action: "create_anime",
    upload_key: "owned-card-edit-test",
    title: "Owned Card",
    description: "A sufficiently long synopsis for the card ownership guard test.",
    cover_image: "https://cdn.example.net/art/owned.jpg",
    genres: ["Action"],
    year: 2025,
    status: "ONGOING",
    type: "TV",
    is_free: true,
    price: 0,
  }));
  assert.equal(owned.status, 201);
  const slug = (await owned.json()).anime.slug as string;
  const edit = (identity: Record<string, string>) => postCreatorContent(createRequest({
    ...identity,
    action: "update_anime",
    slug,
    title: "Rewritten By Force",
  }));

  assert.equal((await edit({ site_user_id: outsider.id, telegram_id: outsider.telegramId! })).status, 404);
  assert.equal((await edit({ site_user_id: viewerId, telegram_id: "9001002" })).status, 403);
  assert.equal((await edit({ site_user_id: owner.id, telegram_id: "wrong-telegram" })).status, 403);

  const unknownSlug = await postCreatorContent(createRequest({
    site_user_id: owner.id,
    telegram_id: owner.telegramId!,
    action: "update_anime",
    slug: "anime-that-does-not-exist",
    title: "Ghost Card",
  }));
  assert.equal(unknownSlug.status, 404);

  const wrongKey = await postCreatorContent(createRequest({
    site_user_id: owner.id,
    telegram_id: owner.telegramId!,
    action: "update_anime",
    slug,
    title: "Nope",
  }, "wrong-api-key"));
  assert.equal(wrongKey.status, 401);

  const untouched = await db.anime.findUniqueOrThrow({ where: { slug }, select: { title: true, coverImage: true } });
  assert.equal(untouched.title, "Owned Card");
  assert.equal(untouched.coverImage, "https://cdn.example.net/art/owned.jpg");
});

test("creator anime and Telegram episodes persist only in the linked creator collection", async () => {
  const animeResponse = await postCreatorContent(createRequest({
    site_user_id: creatorId,
    telegram_id: telegramId,
    action: "create_anime",
    upload_key: "photo-unique-creator-test",
    title: "Creator Uploaded Anime",
    description: "A sufficiently long synopsis for the creator uploaded test anime.",
    cover_image: "https://bot.example/poster/pending?v=poster-1",
    genres: ["Action", "Drama"],
    year: 2026,
    status: "ONGOING",
    type: "TV",
    is_free: false,
    price: 100,
  }));
  assert.equal(animeResponse.status, 201);
  const created = await animeResponse.json();
  assert.equal(created.pending, true);
  assert.match(created.anime.slug, /^creator-uploaded-anime-[a-f0-9]{10}$/);
  const storedAnime = await db.anime.findUniqueOrThrow({ where: { id: created.anime.id } });
  assert.equal(storedAnime.coverImage, `https://bot.example/poster/${created.anime.slug}?v=poster-1`);
  assert.equal(storedAnime.hidden, true);
  assert.equal(storedAnime.moderationStatus, "PENDING");

  const repeatedAnimeResponse = await postCreatorContent(createRequest({
    site_user_id: creatorId,
    telegram_id: telegramId,
    action: "create_anime",
    upload_key: "photo-unique-creator-test",
    title: "Creator Uploaded Anime",
    description: "A sufficiently long synopsis for the creator uploaded test anime.",
    cover_image: "https://bot.example/poster/pending?v=poster-1",
    genres: ["Action", "Drama"],
    year: 2026,
    status: "ONGOING",
    type: "TV",
    is_free: false,
    price: 100,
  }));
  assert.equal(repeatedAnimeResponse.status, 200);
  assert.equal((await repeatedAnimeResponse.json()).anime.id, created.anime.id);

  const episodeRequest = () => createRequest({
    site_user_id: creatorId,
    telegram_id: telegramId,
    action: "create_episode",
    slug: created.anime.slug,
    number: 1,
    title: "First episode",
    telegram_message_id: 8001001,
    duration: 1200,
  });
  const episodeResponse = await postCreatorContent(episodeRequest());
  assert.equal(episodeResponse.status, 201);
  const episode = await episodeResponse.json();
  assert.equal(episode.episode.number, 1);
  assert.equal(episode.released, true, "first episode must release the anime from hiding");
  const releasedAnime = await db.anime.findUniqueOrThrow({ where: { id: created.anime.id } });
  assert.equal(releasedAnime.hidden, false);
  assert.equal(releasedAnime.moderationStatus, "APPROVED");
  assert.equal(await db.episode.count({
    where: { animeId: created.anime.id, telegramMessageId: "8001001", videoUrl: { endsWith: "/stream/8001001" } },
  }), 1);

  const duplicateEpisodeResponse = await postCreatorContent(episodeRequest());
  assert.equal(duplicateEpisodeResponse.status, 409);

  const ownList = await getCreatorContent(getRequest(
    new URLSearchParams({ site_user_id: creatorId, telegram_id: telegramId }).toString(),
  ));
  assert.equal(ownList.status, 200);
  const listed = await ownList.json();
  assert.equal(listed.animes.length, 1);
  assert.equal(listed.animes[0].slug, created.anime.slug);
  assert.equal(listed.animes[0].episode_count, 1);

  const otherCreator = await db.user.create({
    data: {
      email: "other-creator@example.test",
      username: "other-creator",
      password: "test-hash",
      role: "creator",
      telegramId: "9001003",
    },
  });
  const otherList = await getCreatorContent(getRequest(
    new URLSearchParams({ site_user_id: otherCreator.id, telegram_id: "9001003" }).toString(),
  ));
  assert.equal((await otherList.json()).animes.length, 0);
  const otherEpisode = await postCreatorContent(createRequest({
    site_user_id: otherCreator.id,
    telegram_id: "9001003",
    action: "create_episode",
    slug: created.anime.slug,
    number: 2,
    title: "Unauthorized episode",
    telegram_message_id: 8001002,
    duration: 900,
  }));
  assert.equal(otherEpisode.status, 404);
});
