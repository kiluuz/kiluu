// src/lib/chat.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  signChatJwt,
  globalRoomId,
  clubRoomId,
  animeRoomId,
  clubLevelFromXp,
  chatRateLimit,
  EXTRA_CLUB_COST_CREDITS,
} from "./chat";

test("signChatJwt produces valid HS256 JWT format", async () => {
  const token = await signChatJwt({
    userId: "test-user-123",
    roomId: "global",
    role: "member",
    level: 10,
  });

  assert.ok(typeof token === "string");
  const parts = token.split(".");
  assert.equal(parts.length, 3, "JWT must contain 3 parts (header.payload.signature)");

  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  assert.equal(payload.userId, "test-user-123");
  assert.equal(payload.roomId, "global");
  assert.equal(payload.role, "member");
  assert.equal(payload.level, 10);
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
});

test("room ID helper formats", () => {
  assert.equal(globalRoomId(), "global");
  assert.equal(clubRoomId("clb_123"), "club:clb_123");
  assert.equal(animeRoomId("anm_456"), "anime:anm_456");
});

test("clubLevelFromXp calculates level progression within 1-20 bounds", () => {
  assert.equal(clubLevelFromXp(0), 1);
  assert.equal(clubLevelFromXp(100), 1);
  assert.equal(clubLevelFromXp(500), 3);
  assert.equal(clubLevelFromXp(5000), 7);
  assert.equal(clubLevelFromXp(50_000), 20);
  assert.equal(clubLevelFromXp(999_999), 20, "Should clamp at level 20 max");
});

test("chatRateLimit throttles burst messages to 5 per 10s window", () => {
  const testUser = `rate_test_${Date.now()}`;
  const testRoom = "global";

  // First 5 should succeed
  for (let i = 0; i < 5; i++) {
    assert.equal(chatRateLimit(testUser, testRoom), true, `Message ${i + 1} should be allowed`);
  }

  // 6th message should be blocked
  assert.equal(chatRateLimit(testUser, testRoom), false, "6th message should be blocked by rate limit");
});

test("EXTRA_CLUB_COST_CREDITS equals 200", () => {
  assert.equal(EXTRA_CLUB_COST_CREDITS, 200);
});
