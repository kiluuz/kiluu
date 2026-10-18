import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let tempDir: string;
let db: import("@prisma/client").PrismaClient;
type NextRequest = import("next/server").NextRequest;
let createRequest: (body: unknown) => NextRequest;
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
  createRequest = (body) => new NextRequest("http://localhost/api/bot/creator-content", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": "creator-test-secret" },
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
  assert.equal(await db.episode.count({
    where: { animeId: created.anime.id, telegramMessageId: "8001001", videoUrl: "telegram" },
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
