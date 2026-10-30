import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  daSignPayload,
  daVerifyPayload,
  extractIntentCode,
  formatIntentCode,
  generateIntentCode,
  normalizeDonation,
  timingSafeEqualText,
} from "./donationalerts";

describe("intent codes", () => {
  test("generated codes are KL + 8 unambiguous characters", () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateIntentCode();
      assert.match(code, /^KL[0-9A-HJKMNP-TV-Z]{8}$/);
      assert.equal(formatIntentCode(code).length, 12);
    }
  });

  test("formatIntentCode groups the code for display", () => {
    assert.equal(formatIntentCode("KLABCD2345"), "KL-ABCD-2345");
    assert.equal(formatIntentCode("KL-ABCD-2345"), "KL-ABCD-2345");
    assert.equal(formatIntentCode("kl abcd 2345"), "KL-ABCD-2345");
  });

  test("extractIntentCode finds the code in donation messages", () => {
    const code = "KL4T9XMNPQ";
    assert.equal(extractIntentCode(`Top-up ${formatIntentCode(code)}`), code);
    assert.equal(extractIntentCode(`kl-4t9x-mnpq thanks`), code);
    assert.equal(extractIntentCode(`KL 4T9X MNPQ`), code);
    assert.equal(extractIntentCode("no code here"), null);
    assert.equal(extractIntentCode(""), null);
    assert.equal(extractIntentCode(null), null);
    assert.equal(extractIntentCode("KL-ABCD-EFGI"), null);
  });
});

describe("normalizeDonation", () => {
  test("parses a websocket donation payload", () => {
    const donation = normalizeDonation({
      id: 987654321,
      name: "Ada",
      message: "KL-ABCD-2345",
      amount: 300.5,
      currency: "rub",
      recipient: { user_id: 42 },
      created_at: "2026-10-30T12:00:00Z",
    });
    assert.ok(donation);
    assert.equal(donation.donationId, "987654321");
    assert.equal(donation.amountMinor, 30050);
    assert.equal(donation.currency, "RUB");
    assert.equal(donation.message, "KL-ABCD-2345");
    assert.equal(donation.donorName, "Ada");
    assert.equal(donation.recipientId, "42");
    assert.equal(donation.createdAt.toISOString(), "2026-10-30T12:00:00.000Z");
  });

  test("accepts comma-separated string amounts", () => {
    const donation = normalizeDonation({ id: "1", amount: "99,99", currency: "RUB" });
    assert.equal(donation?.amountMinor, 9999);
  });

  test("rejects malformed payloads", () => {
    assert.equal(normalizeDonation(null), null);
    assert.equal(normalizeDonation({}), null);
    assert.equal(normalizeDonation({ id: "abc", amount: 10, currency: "RUB" }), null);
    assert.equal(normalizeDonation({ id: 1, amount: 0, currency: "RUB" }), null);
    assert.equal(normalizeDonation({ id: 1, amount: -5, currency: "RUB" }), null);
    assert.equal(normalizeDonation({ id: 1, amount: 10 }), null);
  });

  test("caps stored message and donor text", () => {
    const donation = normalizeDonation({
      id: "2",
      amount: 10,
      currency: "RUB",
      message: "x".repeat(900),
      name: "y".repeat(200),
    });
    assert.equal(donation?.message?.length, 500);
    assert.equal(donation?.donorName?.length, 80);
  });
});

describe("listener payload signatures", () => {
  const secret = "test-ingest-secret";
  const body = JSON.stringify({ id: 1, amount: 300, currency: "RUB" });
  const now = () => Math.floor(Date.now() / 1000);

  test("accepts a freshly signed payload", () => {
    const ts = String(now());
    const signature = daSignPayload(secret, Number(ts), body);
    assert.equal(daVerifyPayload(secret, ts, body, signature), true);
  });

  test("rejects tampered body, wrong secret and stale timestamps", () => {
    const ts = String(now());
    const signature = daSignPayload(secret, Number(ts), body);
    assert.equal(daVerifyPayload(secret, ts, `${body} `, signature), false);
    assert.equal(daVerifyPayload("other-secret", ts, body, signature), false);
    assert.equal(daVerifyPayload(secret, String(now() - 400), body, daSignPayload(secret, Number(ts) - 400, body)), false);
    assert.equal(daVerifyPayload(secret, "abc", body, signature), false);
    assert.equal(daVerifyPayload(secret, ts, body, "not-hex"), false);
    assert.equal(daVerifyPayload("", ts, body, signature), false);
  });

  test("timingSafeEqualText compares texts exactly", () => {
    assert.equal(timingSafeEqualText("abc", "abc"), true);
    assert.equal(timingSafeEqualText("abc", "abd"), false);
    assert.equal(timingSafeEqualText("abc", "ab"), false);
  });
});
