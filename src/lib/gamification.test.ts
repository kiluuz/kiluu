import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

let tempDir: string;
let client: PrismaClient;
let awardXp: typeof import("@/lib/xp").awardXp;
let getXpTotal: typeof import("@/lib/xp").getXpTotal;
let levelFromXp: typeof import("@/lib/xp").levelFromXp;
let xpForLevel: typeof import("@/lib/xp").xpForLevel;
let evaluateAchievements: typeof import("@/lib/achievements").evaluateAchievements;
let getUserAchievementStates: typeof import("@/lib/achievements").getUserAchievementStates;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-gamification-test-"));
  const databaseUrl = `file:${path.join(tempDir, "gamification.db")}`;
  execFileSync(path.resolve("node_modules/.bin/prisma"), [
    "db",
    "push",
    "--schema",
    "prisma/schema.test.prisma",
    "--skip-generate",
  ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  process.env.DATABASE_URL = databaseUrl;
  const [{ PrismaClient }, xp, achievements] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/xp"),
    import("@/lib/achievements"),
  ]);
  client = new PrismaClient();
  await client.$connect();
  awardXp = xp.awardXp;
  getXpTotal = xp.getXpTotal;
  levelFromXp = xp.levelFromXp;
  xpForLevel = xp.xpForLevel;
  evaluateAchievements = achievements.evaluateAchievements;
  getUserAchievementStates = achievements.getUserAchievementStates;
});

after(async () => {
  await client?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("XP threshold curve has consistent boundaries", () => {
  assert.equal(xpForLevel(1), 0);
  assert.ok(xpForLevel(2) > 0);
  assert.equal(levelFromXp(-10).level, 1);
  for (const level of [2, 5, 10, 25, 50, 100]) {
    assert.equal(levelFromXp(xpForLevel(level)).level, level);
    assert.equal(levelFromXp(xpForLevel(level) - 1).level, level - 1);
  }
});

test("XP events are idempotent and level-up notification is emitted once", async () => {
  const user = await client.user.create({
    data: { email: "xp-user@example.test", username: "xp-user", password: "test-hash" },
  });
  const xpAmount = xpForLevel(2);
  const first = await awardXp(user.id, "purchase", "purchase-xp-event", xpAmount);
  const replay = await awardXp(user.id, "purchase", "purchase-xp-event", xpAmount);

  assert.equal(first?.level, 2);
  assert.equal(replay, null);
  assert.equal(await getXpTotal(user.id), xpAmount);
  assert.equal(await client.xpEvent.count({ where: { userId: user.id } }), 1);
  assert.equal(await client.notification.count({ where: { userId: user.id, type: "LEVEL_UP" } }), 1);
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 10);
  assert.equal(await client.creditTransaction.count({ where: { userId: user.id, type: "LEVEL_REWARD" } }), 1);
});

test("achievement progress, seasonal and secret unlocks are persisted idempotently", async () => {
  const user = await client.user.create({
    data: { email: "achievement-user@example.test", username: "aba", password: "test-hash" },
  });
  const anime1 = await client.anime.create({
    data: {
      slug: "gamification-a",
      title: "Gamification A",
      description: "",
      coverImage: "",
      genres: "Action",
      year: 2026,
    },
  });
  const anime2 = await client.anime.create({
    data: {
      slug: "gamification-b",
      title: "Gamification B",
      description: "",
      coverImage: "",
      genres: "Fantasy",
      year: 2026,
    },
  });
  await client.purchase.createMany({
    data: [
      { userId: user.id, animeId: anime1.id, pricePaid: 100 },
      { userId: user.id, animeId: anime2.id, pricePaid: 100 },
    ],
  });
  const set = await client.animeSet.create({
    data: {
      code: "test-set",
      name: "Test Set",
      bonusCredits: 50,
      items: { create: [{ animeId: anime1.id }, { animeId: anime2.id }] },
    },
  });
  await client.xpEvent.create({
    data: {
      userId: user.id,
      reason: "post",
      amount: 25,
      refId: "spooky-event-activity",
      createdAt: new Date("2026-10-23T12:00:00.000Z"),
    },
  });

  await evaluateAchievements(user.id);
  // 50 credits from the anime set bonus plus one 10-credit level-up reward.
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 60);
  assert.equal(await client.creditTransaction.count({
    where: { userId: user.id, idempotencyKey: `anime-set-bonus:${user.id}:${set.id}` },
  }), 1);
  const collector = await client.userAchievement.findUniqueOrThrow({
    where: { userId_achievementId: { userId: user.id, achievementId: "collector_i" } },
  });
  assert.equal(collector.progress, 2);
  assert.equal(collector.target, 10);
  assert.equal(collector.unlockedAt, null);
  assert.ok((await client.userAchievement.findUniqueOrThrow({
    where: { userId_achievementId: { userId: user.id, achievementId: "spooky_2026" } },
  })).unlockedAt);
  assert.ok((await client.userAchievement.findUniqueOrThrow({
    where: { userId_achievementId: { userId: user.id, achievementId: "secret_palindrome" } },
  })).unlockedAt);

  const beforeXp = await client.xpEvent.count({ where: { userId: user.id, reason: "achievement" } });
  const beforeNotifications = await client.notification.count({ where: { userId: user.id, type: "ACHIEVEMENT" } });
  await evaluateAchievements(user.id);
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 60);
  assert.equal(await client.xpEvent.count({ where: { userId: user.id, reason: "achievement" } }), beforeXp);
  assert.equal(await client.notification.count({ where: { userId: user.id, type: "ACHIEVEMENT" } }), beforeNotifications);

  const states = await getUserAchievementStates(user.id);
  const hidden = states.find((state) => state.id === "secret_owl");
  assert.equal(hidden?.name, "Secret achievement");
  assert.equal(hidden?.current, 0);
  const revealed = states.find((state) => state.id === "secret_palindrome");
  assert.equal(revealed?.name, "Mirror Name");
  assert.equal(revealed?.desc, "Have a username that reads the same backward.");
});
