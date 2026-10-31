import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let tempDir: string;
let db: import("@prisma/client").PrismaClient;
let sendGift: typeof import("./gifts").sendGift;
let senderId: string;
let recipientId: string;
let animeId: string;
let firstGiftId: string;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-gift-send-test-"));
  const databaseUrl = `file:${path.join(tempDir, "gifts.db")}`;
  execFileSync(
    path.resolve("node_modules/.bin/prisma"),
    ["db", "push", "--schema", "prisma/schema.test.prisma", "--skip-generate"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" }
  );
  process.env.DATABASE_URL = databaseUrl;

  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient();
  await db.$connect();

  const sender = await db.user.create({
    data: {
      email: "gift-sender@example.test",
      username: "gift-sender",
      password: "test-hash",
      credits: 1000,
    },
  });
  const recipient = await db.user.create({
    data: {
      email: "gift-recipient@example.test",
      username: "gift-recipient",
      password: "test-hash",
    },
  });
  const anime = await db.anime.create({
    data: {
      slug: "gift-test-anime",
      title: "Gift Test Anime",
      description: "A catalog entry used to verify server-side gift pricing.",
      coverImage: "https://example.test/gift-cover.jpg",
      genres: "Action,Drama",
      year: 2026,
      price: 500,
    },
  });
  await db.animeVersion.create({
    data: { animeId: anime.id, kind: "official", price: 500, status: "published" },
  });

  senderId = sender.id;
  recipientId = recipient.id;
  animeId = anime.id;
  ({ sendGift } = await import("./gifts"));
});

after(async () => {
  await db?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("charges the server-side catalog price and ignores any client-supplied price", async () => {
  const payload = {
    senderId,
    recipientUsername: "gift-recipient",
    animeId,
    idempotencyKey: "gift-price-test",
    message: "Enjoy the show",
    // A tampered client could try to send a price — sendGift must ignore it.
    price: 1,
  };
  const gift = await sendGift(payload);
  firstGiftId = gift.id;

  assert.equal(gift.pricePaid, 500);
  assert.equal(gift.status, "PENDING");
  assert.equal(gift.recipientId, recipientId);
  assert.equal(gift.message, "Enjoy the show");

  const sender = await db.user.findUniqueOrThrow({ where: { id: senderId } });
  // 1000 starting credits − 500 gift price + one 10-credit level-up reward.
  assert.equal(sender.credits, 510);

  const charge = await db.creditTransaction.findUnique({ where: { idempotencyKey: "gift-price-test" } });
  assert.equal(charge?.amount, -500);
  assert.equal(charge?.type, "GIFT");

  const notification = await db.notification.findFirst({
    where: { userId: recipientId, type: "gift_received" },
  });
  assert.ok(notification, "recipient should be notified about the gift");
});

test("rejects a gift when the sender cannot cover the catalog price", async () => {
  const broke = await db.user.create({
    data: {
      email: "gift-broke@example.test",
      username: "gift-broke",
      password: "test-hash",
      credits: 120,
    },
  });

  await assert.rejects(
    () =>
      sendGift({
        senderId: broke.id,
        recipientUsername: "gift-recipient",
        animeId,
        idempotencyKey: "gift-broke-test",
      }),
    (error: { code?: string; need?: number }) => error.code === "INSUFFICIENT" && error.need === 380
  );

  const unchanged = await db.user.findUniqueOrThrow({ where: { id: broke.id } });
  assert.equal(unchanged.credits, 120);
  assert.equal(await db.gift.findUnique({ where: { idempotencyKey: "gift-broke-test" } }), null);
});

test("repeating the same idempotency key never charges twice", async () => {
  const again = await sendGift({
    senderId,
    recipientUsername: "gift-recipient",
    animeId,
    idempotencyKey: "gift-price-test",
  });

  assert.equal(again.id, firstGiftId);
  const sender = await db.user.findUniqueOrThrow({ where: { id: senderId } });
  assert.equal(sender.credits, 510);
  assert.equal(await db.gift.count({ where: { idempotencyKey: "gift-price-test" } }), 1);
});
