import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { giftExpiryDate } from "./gifts";

describe("gift expiry", () => {
  test("defaults to 14 days", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const exp = giftExpiryDate(from);
    const days = (exp.getTime() - from.getTime()) / 86400000;
    assert.equal(days, 14);
  });
});
