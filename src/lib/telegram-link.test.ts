import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let tempDir: string;
let db: import("@prisma/client").PrismaClient;
let issueLinkToken: typeof import("./telegram-link").issueLinkToken;
let consumeLinkToken: typeof import("./telegram-link").consumeLinkToken;
let unlinkTelegramAccount: typeof import("./telegram-link").unlinkTelegramAccount;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-telegram-link-test-"));
  const databaseUrl = `file:${path.join(tempDir, "links.db")}`;
  execFileSync(
    path.resolve("node_modules/.bin/prisma"),
    ["db", "push", "--schema", "prisma/schema.test.prisma", "--skip-generate"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" }
  );
  process.env.DATABASE_URL = databaseUrl;

  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient();
  await db.$connect();

  const link = await import("./telegram-link");
  issueLinkToken = link.issueLinkToken;
  consumeLinkToken = link.consumeLinkToken;
  unlinkTelegramAccount = link.unlinkTelegramAccount;
});

after(async () => {
  await db?.$disconnect();
  await rm(tempDir, { recursive: true, force: true });
});

async function makeUser(email: string, username: string) {
  return db.user.create({ data: { email, username, password: "test-hash" } });
}

async function expectRefused(token: string, telegramId: string, code: "expired" | "unknown") {
  const result = await consumeLinkToken({ token, telegramId });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, code);
}

test("binding a link moves the Telegram account to the site profile that owns the link", async () => {
  const oldOwner = await makeUser("link-old-owner@example.test", "link-old-owner");
  const newOwner = await makeUser("link-new-owner@example.test", "link-new-owner");
  await db.user.update({ where: { id: oldOwner.id }, data: { telegramId: "111", telegramUsername: "shared" } });

  const issued = await issueLinkToken(newOwner.id);
  const result = await consumeLinkToken({ token: issued.token, telegramId: "111", telegramUsername: "shared" });

  assert.deepEqual(result, { ok: true, userId: newOwner.id });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: newOwner.id } })).telegramId, "111");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: oldOwner.id } })).telegramId, null);
});

test("a live link can be re-used to switch Telegram accounts without charging the user a dead end", async () => {
  const user = await makeUser("link-switch@example.test", "link-switch");
  const issued = await issueLinkToken(user.id);

  const first = await consumeLinkToken({ token: issued.token, telegramId: "222", telegramUsername: "first" });
  assert.equal(first.ok, true);

  const again = await consumeLinkToken({ token: issued.token, telegramId: "333", telegramUsername: "second" });
  assert.deepEqual(again, { ok: true, userId: user.id });
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).telegramId, "333");
});

test("only the newest link stays live for an account", async () => {
  const user = await makeUser("link-latest@example.test", "link-latest");
  const stale = await issueLinkToken(user.id);
  const fresh = await issueLinkToken(user.id);

  assert.equal((await consumeLinkToken({ token: stale.token, telegramId: "444" })).ok, false);
  await expectRefused(stale.token, "444", "unknown");
  assert.equal((await consumeLinkToken({ token: fresh.token, telegramId: "444" })).ok, true);
});

test("an expired or unknown link reports why instead of a generic failure", async () => {
  const user = await makeUser("link-expired@example.test", "link-expired");
  const issued = await issueLinkToken(user.id);
  await db.telegramLinkToken.update({
    where: { id: (await db.telegramLinkToken.findUniqueOrThrow({ where: { token: issued.token } })).id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  await expectRefused(issued.token, "555", "expired");
  await expectRefused("never-issued-token", "555", "unknown");
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: user.id } })).telegramId, null);
});

test("unlinking releases the Telegram binding and every link still in flight", async () => {
  const user = await makeUser("link-unlink@example.test", "link-unlink");
  const issued = await issueLinkToken(user.id);
  await consumeLinkToken({ token: issued.token, telegramId: "666", telegramUsername: "old-account" });

  assert.equal(await unlinkTelegramAccount(user.id), true);
  const released = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(released.telegramId, null);
  assert.equal(released.telegramUsername, null);
  assert.equal(await db.telegramLinkToken.count({ where: { userId: user.id } }), 0);

  // The button stays safe to press when nothing is bound.
  assert.equal(await unlinkTelegramAccount(user.id), false);
});
