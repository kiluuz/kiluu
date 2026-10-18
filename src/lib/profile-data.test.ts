import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { watchDeltaSeconds } from "@/lib/watch-time";

let tempDir: string;
let db: import("@prisma/client").PrismaClient;
let userId: string;
let animeId: string;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-profile-test-"));
  const databaseUrl = `file:${path.join(tempDir, "profile.db")}`;
  execFileSync(path.resolve("node_modules/.bin/prisma"), [
    "db",
    "push",
    "--schema",
    "prisma/schema.test.prisma",
    "--skip-generate",
  ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient();
  await db.$connect();
  const user = await db.user.create({
    data: { email: "profile@example.test", username: "profile-user", password: "test-hash" },
  });
  const anime = await db.anime.create({
    data: {
      slug: "profile-test-anime",
      title: "Profile Test Anime",
      description: "A test title",
      coverImage: "/test.jpg",
      genres: "Action,Fantasy",
      year: 2026,
    },
  });
  userId = user.id;
  animeId = anime.id;
});

after(async () => {
  await db?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("profile customization saves and persists for public profile reads", async () => {
  const privacy = JSON.stringify({
    showWatchTime: false,
    showFavorites: true,
    showActivity: true,
    showCollection: false,
    showFollowers: false,
    allowFollows: true,
    profileVisibility: "followers",
  });
  const showcase = JSON.stringify({
    topFive: [animeId],
    genres: ["Action"],
    order: ["topFive", "favorites"],
    hidden: { favorites: true },
  });
  await db.user.update({
    where: { id: userId },
    data: {
      displayName: "Saved profile",
      bio: "**Hello**",
      accentColor: "#102030",
      pronouns: "they/them",
      privacy,
      showcase,
    },
  });
  const profile = await db.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(profile.displayName, "Saved profile");
  assert.equal(profile.bio, "**Hello**");
  assert.equal(profile.accentColor, "#102030");
  assert.equal(profile.privacy, privacy);
  assert.equal(profile.showcase, showcase);
});

test("anime rating aggregate and watch event totals reflect persisted records", async () => {
  await db.animeRating.create({ data: { userId, animeId, rating: 8 } });
  const other = await db.user.create({
    data: { email: "second@example.test", username: "second-user", password: "test-hash" },
  });
  await db.animeRating.create({ data: { userId: other.id, animeId, rating: 6 } });
  const ratings = await db.animeRating.aggregate({
    where: { animeId },
    _avg: { rating: true },
    _count: { _all: true },
  });
  assert.equal(ratings._avg.rating, 7);
  assert.equal(ratings._count._all, 2);

  const episode = await db.episode.create({
    data: {
      animeId,
      number: 1,
      title: "Episode 1",
      videoUrl: "test",
      duration: 120,
    },
  });
  await db.watchEvent.create({
    data: { userId, animeId, episodeId: episode.id, seconds: 34 },
  });
  const watched = await db.watchEvent.aggregate({ where: { userId }, _sum: { seconds: true } });
  assert.equal(watched._sum.seconds, 34);
  assert.equal(watchDeltaSeconds(10, 45), 35);
  assert.equal(watchDeltaSeconds(45, 10), 0);
  assert.equal(watchDeltaSeconds(10, 1000), 120);
});
