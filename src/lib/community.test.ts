import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { awardCommunityPost, canDeleteCommunityPost } from "@/lib/community";

let client: import("@prisma/client").PrismaClient;
let tempDir: string;
let authorId: string;
let supporterId: string;
let postId: string;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-community-test-"));
  const databaseUrl = `file:${path.join(tempDir, "community.db")}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  execFileSync(path.resolve("node_modules/.bin/prisma"), [
    "db",
    "push",
    "--schema",
    "prisma/schema.test.prisma",
    "--skip-generate",
  ], { cwd: process.cwd(), env, stdio: "pipe" });
  process.env.DATABASE_URL = databaseUrl;
  const { PrismaClient } = await import("@prisma/client");
  client = new PrismaClient();
  await client.$connect();

  const author = await client.user.create({
    data: { email: "author@community.test", username: "author", password: "test-hash" },
  });
  const supporter = await client.user.create({
    data: { email: "supporter@community.test", username: "supporter", password: "test-hash", credits: 10 },
  });
  authorId = author.id;
  supporterId = supporter.id;
  const post = await client.post.create({
    data: { userId: authorId, content: "A real post", category: "Discussions" },
  });
  postId = post.id;
});

after(async () => {
  await client?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("post, like, comment, and reply persist in the database", async () => {
  await client.postLike.create({ data: { userId: supporterId, postId } });
  const comment = await client.comment.create({
    data: { userId: supporterId, postId, content: "First comment" },
  });
  const reply = await client.comment.create({
    data: { userId: authorId, postId, parentId: comment.id, content: "A real reply" },
  });

  assert.equal(await client.post.count({ where: { id: postId, userId: authorId } }), 1);
  assert.equal(await client.postLike.count({ where: { userId: supporterId, postId } }), 1);
  assert.equal(await client.comment.count({ where: { postId } }), 2);
  assert.equal((await client.comment.findUniqueOrThrow({ where: { id: reply.id } })).parentId, comment.id);
});

test("post deletion is limited to its owner unless the requester is an admin", () => {
  assert.equal(canDeleteCommunityPost(authorId, authorId, false), true);
  assert.equal(canDeleteCommunityPost(authorId, supporterId, false), false);
  assert.equal(canDeleteCommunityPost(authorId, supporterId, true), true);
});

test("award atomically debits credits, credits the author, records ledger entries, and is idempotent", async () => {
  const awardKey = "community-award-test-key";
  const first = await client.$transaction((tx) => awardCommunityPost(tx, {
    userId: supporterId,
    actorName: "supporter",
    postId,
    idempotencyKey: awardKey,
    cost: 10,
    authorSharePercent: 70,
  }));
  if ("error" in first) assert.fail(`Award failed: ${first.error}`);
  assert.equal(first.award.cost, 10);
  assert.equal(first.award.authorShare, 7);

  const replay = await client.$transaction((tx) => awardCommunityPost(tx, {
    userId: supporterId,
    actorName: "supporter",
    postId,
    idempotencyKey: awardKey,
    cost: 10,
    authorSharePercent: 70,
  }));
  assert.ok("award" in replay && replay.replay);
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: supporterId } })).credits, 0);
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: authorId } })).credits, 7);
  assert.deepEqual(
    (await client.creditTransaction.findMany({ where: { refId: first.award.id }, orderBy: { amount: "asc" } }))
      .map((entry) => entry.amount),
    [-10, 7]
  );
  assert.equal(await client.notification.count({ where: { userId: authorId, type: "AWARD" } }), 1);
});

test("insufficient award credits leave both balances and ledger unchanged", async () => {
  const beforeLedger = await client.creditTransaction.count();
  const result = await client.$transaction((tx) => awardCommunityPost(tx, {
    userId: supporterId,
    actorName: "supporter",
    postId,
    idempotencyKey: "community-award-insufficient",
    cost: 10,
    authorSharePercent: 70,
  }));
  assert.deepEqual(result, { error: "INSUFFICIENT_CREDITS" });
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: supporterId } })).credits, 0);
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: authorId } })).credits, 7);
  assert.equal(await client.creditTransaction.count(), beforeLedger);
});
