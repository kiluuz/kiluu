import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { NextRequest } from "next/server";
import type { Prisma, PrismaClient, User } from "@prisma/client";

const TEST_SECRET = "test-mobile-bridge-secret-0123456789";

let tempDir: string;
let client: PrismaClient;
let verifyRoute: typeof import("@/app/api/auth/verify-email/route");
let grantRoute: typeof import("@/app/api/internal/credits/grant/route");
let deleteRoute: typeof import("@/app/api/internal/account/delete/route");

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-internal-test-"));
  const databaseUrl = `file:${path.join(tempDir, "internal.db")}`;
  execFileSync(path.resolve("node_modules/.bin/prisma"), [
    "db",
    "push",
    "--schema",
    "prisma/schema.test.prisma",
    "--skip-generate",
  ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  process.env.DATABASE_URL = databaseUrl;
  process.env.MOBILE_BRIDGE_SECRET = TEST_SECRET;

  const [{ PrismaClient }, verify, grant, remove] = await Promise.all([
    import("@prisma/client"),
    import("@/app/api/auth/verify-email/route"),
    import("@/app/api/internal/credits/grant/route"),
    import("@/app/api/internal/account/delete/route"),
  ]);
  client = new PrismaClient();
  await client.$connect();
  verifyRoute = verify;
  grantRoute = grant;
  deleteRoute = remove;
});

after(async () => {
  await client?.$disconnect();
  delete process.env.MOBILE_BRIDGE_SECRET;
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

let sequence = 0;

function nextEmail() {
  sequence += 1;
  return `bridge-user-${sequence}@example.test`;
}

async function createUser(overrides: Partial<Prisma.UserUncheckedCreateInput> = {}): Promise<User> {
  sequence += 1;
  return client.user.create({
    data: {
      email: `bridge-user-${sequence}@example.test`,
      username: `bridge-user-${sequence}`,
      password: "test-hash",
      ...overrides,
    },
  });
}

function post(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

function internalPost(url: string, body: unknown, secret: string | null = TEST_SECRET) {
  const headers: Record<string, string> = {};
  if (secret !== null) headers["x-internal-secret"] = secret;
  return post(url, body, headers);
}

function verifyRequest(email: string, code: string, ip: string) {
  return post("/api/auth/verify-email", { email, code }, { "x-forwarded-for": ip });
}

test("verify-email consumes a valid code once and only then creates a session", async () => {
  const user = await createUser({
    email: nextEmail(),
    verifyCode: "246810",
    verifyCodeExp: new Date(Date.now() + 5 * 60_000),
  });

  const res = await verifyRoute.POST(verifyRequest(user.email, "246810", "198.51.100.1"));
  assert.equal(res.status, 200);
  assert.match(res.headers.get("set-cookie") ?? "", /aniverse_session=[a-f0-9]{64}/);

  const stored = await client.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.equal(stored.emailVerified, true);
  assert.equal(stored.verifyCode, null);
  assert.equal(stored.verifyCodeExp, null);
  assert.equal(await client.session.count({ where: { userId: user.id } }), 1);

  // Replay: the code is gone, so no second session may be minted.
  const replay = await verifyRoute.POST(verifyRequest(user.email, "246810", "198.51.100.2"));
  assert.equal(replay.status, 409);
  assert.equal(replay.headers.get("set-cookie"), null);
  assert.equal(await client.session.count({ where: { userId: user.id } }), 1);
});

test("verify-email never signs in an already-verified account", async () => {
  const user = await createUser({
    email: nextEmail(),
    emailVerified: true,
    verifyCode: null,
    verifyCodeExp: null,
  });

  const res = await verifyRoute.POST(verifyRequest(user.email, "123456", "198.51.100.3"));
  assert.equal(res.status, 409);
  assert.equal(res.headers.get("set-cookie"), null);
  assert.equal(await client.session.count({ where: { userId: user.id } }), 0);
});

test("verify-email rejects expired and wrong codes without creating a session", async () => {
  const expired = await createUser({
    email: nextEmail(),
    verifyCode: "135790",
    verifyCodeExp: new Date(Date.now() - 60_000),
  });
  const expiredRes = await verifyRoute.POST(
    verifyRequest(expired.email, "135790", "198.51.100.4"),
  );
  assert.equal(expiredRes.status, 400);
  assert.equal(expiredRes.headers.get("set-cookie"), null);
  assert.equal(await client.session.count({ where: { userId: expired.id } }), 0);

  const wrong = await createUser({
    email: nextEmail(),
    verifyCode: "112233",
    verifyCodeExp: new Date(Date.now() + 5 * 60_000),
  });
  const wrongRes = await verifyRoute.POST(verifyRequest(wrong.email, "332211", "198.51.100.5"));
  assert.equal(wrongRes.status, 400);
  assert.equal(wrongRes.headers.get("set-cookie"), null);
  assert.equal(
    (await client.user.findUniqueOrThrow({ where: { id: wrong.id } })).verifyCode,
    "112233",
  );
  assert.equal(await client.session.count({ where: { userId: wrong.id } }), 0);
});

test("verify-email rate-limits attempts per email across many IPs", async () => {
  const user = await createUser({
    email: nextEmail(),
    verifyCode: "445566",
    verifyCodeExp: new Date(Date.now() + 5 * 60_000),
  });

  for (let i = 0; i < 10; i += 1) {
    const res = await verifyRoute.POST(
      verifyRequest(user.email, "000000", `203.0.113.${i + 1}`),
    );
    assert.equal(res.status, 400);
  }
  const blocked = await verifyRoute.POST(
    verifyRequest(user.email, "445566", "203.0.113.250"),
  );
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("set-cookie"), null);
  assert.equal(await client.session.count({ where: { userId: user.id } }), 0);
});

test("credits grant is secret-gated and credits the ledger exactly once", async () => {
  const user = await createUser({ email: nextEmail() });
  const body = {
    userId: user.id,
    orderId: "GPA.3344-5566-7788",
    amount: 250,
    description: "1200 credits pack",
    source: "google_play",
  };

  const forbidden = await grantRoute.POST(
    internalPost("/api/internal/credits/grant", body, "wrong-secret"),
  );
  assert.equal(forbidden.status, 403);

  const first = await grantRoute.POST(internalPost("/api/internal/credits/grant", body));
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    ok: true,
    duplicate: false,
    userId: user.id,
    orderId: body.orderId,
    amount: 250,
    balance: 250,
  });

  const duplicate = await grantRoute.POST(internalPost("/api/internal/credits/grant", body));
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), {
    ok: true,
    duplicate: true,
    userId: user.id,
    orderId: body.orderId,
    amount: 250,
    balance: 250,
  });

  assert.equal((await client.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 250);
  const ledger = await client.creditTransaction.findMany({ where: { userId: user.id } });
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].type, "TOPUP");
  assert.equal(ledger[0].amount, 250);
  assert.equal(ledger[0].refType, "google_play");
  assert.equal(ledger[0].refId, body.orderId);
  assert.equal(ledger[0].idempotencyKey, `mobile-order:${body.orderId}`);

  // Same order id with a different payload is a conflict, not a second credit.
  const conflict = await grantRoute.POST(
    internalPost("/api/internal/credits/grant", { ...body, amount: 999 }),
  );
  assert.equal(conflict.status, 409);
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: user.id } })).credits, 250);
});

test("credits grant rejects unknown and deleted users", async () => {
  const missing = await grantRoute.POST(
    internalPost("/api/internal/credits/grant", {
      userId: "missing-user",
      orderId: "order-missing",
      amount: 10,
    }),
  );
  assert.equal(missing.status, 404);

  const deleted = await createUser({ email: nextEmail(), deletedAt: new Date() });
  const res = await grantRoute.POST(
    internalPost("/api/internal/credits/grant", {
      userId: deleted.id,
      orderId: "order-deleted",
      amount: 10,
    }),
  );
  assert.equal(res.status, 404);
});

test("internal routes answer 503 when the bridge secret is not configured", async () => {
  process.env.MOBILE_BRIDGE_SECRET = "";
  try {
    const grant = await grantRoute.POST(
      internalPost("/api/internal/credits/grant", {
        userId: "any",
        orderId: "any",
        amount: 1,
      }),
    );
    assert.equal(grant.status, 503);

    const removal = await deleteRoute.POST(
      internalPost("/api/internal/account/delete", { userId: "any" }),
    );
    assert.equal(removal.status, 503);
  } finally {
    process.env.MOBILE_BRIDGE_SECRET = TEST_SECRET;
  }
});

test("account delete anonymizes the profile, revokes access and is idempotent", async () => {
  const user = await createUser({
    email: nextEmail(),
    displayName: "Real Name",
    bio: "personal bio",
    avatarUrl: "https://example.test/avatar.png",
    telegramId: "777000111",
    telegramUsername: "real_handle",
    socialLinks: JSON.stringify({ instagram: "real" }),
    referralCode: "REALCODE",
    credits: 75,
  });
  await client.session.create({
    data: { token: "session-token-1", userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
  });
  await client.telegramLinkToken.create({
    data: { token: "link-token-1", userId: user.id, expiresAt: new Date(Date.now() + 60_000) },
  });
  await client.notification.create({
    data: { userId: user.id, type: "test", title: "Hi", body: "Personal" },
  });
  await client.scheduleSubscription.create({
    data: { userId: user.id, anilistId: 1, title: "Show" },
  });

  const forbidden = await deleteRoute.POST(
    internalPost("/api/internal/account/delete", { userId: user.id }, null),
  );
  assert.equal(forbidden.status, 403);

  const res = await deleteRoute.POST(
    internalPost("/api/internal/account/delete", { userId: user.id, reason: "user request" }),
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, userId: user.id, alreadyDeleted: false });

  const stored = await client.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.notEqual(stored.deletedAt, null);
  assert.equal(stored.email, `deleted-${user.id}@deleted.invalid`);
  assert.equal(stored.username, `deleted_${user.id}`);
  assert.equal(stored.displayName, "Deleted user");
  assert.equal(stored.bio, null);
  assert.equal(stored.avatarUrl, null);
  assert.equal(stored.telegramId, null);
  assert.equal(stored.telegramUsername, null);
  assert.equal(stored.socialLinks, null);
  assert.equal(stored.referralCode, null);
  assert.equal(stored.credits, 75);

  assert.equal(await client.session.count({ where: { userId: user.id } }), 0);
  assert.equal(await client.telegramLinkToken.count({ where: { userId: user.id } }), 0);
  assert.equal(await client.notification.count({ where: { userId: user.id } }), 0);
  assert.equal(await client.scheduleSubscription.count({ where: { userId: user.id } }), 0);

  const again = await deleteRoute.POST(
    internalPost("/api/internal/account/delete", { userId: user.id }),
  );
  assert.equal(again.status, 200);
  assert.deepEqual(await again.json(), { ok: true, userId: user.id, alreadyDeleted: true });

  const unknown = await deleteRoute.POST(
    internalPost("/api/internal/account/delete", { userId: "never-existed" }),
  );
  assert.equal(unknown.status, 200);
  assert.deepEqual(await unknown.json(), {
    ok: true,
    userId: "never-existed",
    alreadyDeleted: true,
  });
});
