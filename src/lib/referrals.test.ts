import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import type { PrismaClient } from "@prisma/client";

let tempDir: string;
let client: PrismaClient;
let referrals: typeof import("@/lib/referrals");

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-referral-test-"));
  const databaseUrl = `file:${path.join(tempDir, "referral.db")}`;
  execFileSync(path.resolve("node_modules/.bin/prisma"), [
    "db",
    "push",
    "--schema",
    "prisma/schema.test.prisma",
    "--skip-generate",
  ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  process.env.DATABASE_URL = databaseUrl;
  const [{ PrismaClient }, refs] = await Promise.all([
    import("@prisma/client"),
    import("@/lib/referrals"),
  ]);
  client = new PrismaClient();
  await client.$connect();
  referrals = refs;
});

after(async () => {
  await client?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

let sequence = 0;

async function createUser(prefix: string, referralCode?: string) {
  sequence += 1;
  return client.user.create({
    data: {
      email: `${prefix}-${sequence}@example.test`,
      username: `${prefix}-${sequence}`,
      password: "test-hash",
      referralCode: referralCode ?? null,
    },
  });
}

async function createAnime() {
  sequence += 1;
  return client.anime.create({
    data: {
      slug: `referral-anime-${sequence}`,
      title: `Referral Anime ${sequence}`,
      description: "",
      coverImage: "",
      genres: "Action",
      year: 2026,
    },
  });
}

async function createWatchEvent(userId: string) {
  const anime = await createAnime();
  const episode = await client.episode.create({
    data: {
      animeId: anime.id,
      number: 1,
      title: "Episode 1",
      videoUrl: "https://example.test/episode.mp4",
    },
  });
  await client.watchEvent.create({
    data: { userId, animeId: anime.id, episodeId: episode.id, seconds: 60 },
  });
}

async function creditsOf(userId: string) {
  return (await client.user.findUniqueOrThrow({ where: { id: userId } })).credits;
}

test("a referral rewards both sides on the first watch without Telegram linking", async () => {
  const referrer = await createUser("ref-owner", "REF-WATCH");
  const referred = await createUser("ref-friend");

  const bound = await referrals.bindReferralOnRegistration(referred.id, "REF-WATCH");
  assert.equal(bound.success, true);

  assert.deepEqual(await referrals.checkAndQualifyReferral(referred.id), {
    qualified: false,
    rewarded: false,
  });
  assert.equal(await creditsOf(referrer.id), 0);

  await createWatchEvent(referred.id);

  assert.deepEqual(await referrals.checkAndQualifyReferral(referred.id), {
    qualified: true,
    rewarded: true,
  });
  assert.equal(await creditsOf(referrer.id), 10);
  assert.equal(await creditsOf(referred.id), 5);
  assert.equal((await client.xpEvent.findFirstOrThrow({
    where: { userId: referrer.id, reason: "referral_bonus" },
  })).amount, 100);
  assert.equal((await client.xpEvent.findFirstOrThrow({
    where: { userId: referred.id, reason: "referral_welcome" },
  })).amount, 50);

  // Idempotent: a second qualifying event must not pay twice.
  assert.deepEqual(await referrals.checkAndQualifyReferral(referred.id), {
    qualified: false,
    rewarded: false,
  });
  assert.equal(await creditsOf(referrer.id), 10);
  assert.equal(await creditsOf(referred.id), 5);
});

test("opening the referral page re-checks pending referrals and pays them", async () => {
  const referrer = await createUser("ref-lazy-owner", "REF-LAZY");
  const referred = await createUser("ref-lazy-friend");
  await referrals.bindReferralOnRegistration(referred.id, "REF-LAZY");

  const anime = await createAnime();
  await client.purchase.create({
    data: { userId: referred.id, animeId: anime.id, pricePaid: 0 },
  });

  const stats = await referrals.getReferralStats(referrer.id);
  assert.equal(stats.totalInvited, 1);
  assert.equal(stats.qualifiedCount, 1);
  assert.equal(stats.rewards[0]?.status, "rewarded");
  assert.equal(await creditsOf(referrer.id), 10);
  assert.equal(await creditsOf(referred.id), 5);
});

test("a suspicious referral is declined without paying rewards", async () => {
  const referrer = await createUser("ref-suspicious-owner", "REF-SUSPICIOUS");
  const referred = await createUser("ref-suspicious-friend");
  await referrals.bindReferralOnRegistration(referred.id, "REF-SUSPICIOUS");
  await client.referral.update({
    where: { referredId: referred.id },
    data: { isSuspicious: true },
  });
  await createWatchEvent(referred.id);

  assert.deepEqual(await referrals.checkAndQualifyReferral(referred.id), {
    qualified: false,
    rewarded: false,
  });
  assert.equal((await client.referral.findUniqueOrThrow({
    where: { referredId: referred.id },
  })).status, "declined");
  assert.equal(await creditsOf(referrer.id), 0);
  assert.equal(await creditsOf(referred.id), 0);
});
