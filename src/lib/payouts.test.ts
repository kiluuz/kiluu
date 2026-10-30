import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { maskPayoutDetails, payoutAmountMinor, payoutMinMinor, payoutRate, revealPayoutDetails, PAYOUT_METHODS } from "./payouts";
import { sealJson } from "./sealed";

function withEnv<T>(values: Record<string, string | undefined>, fn: () => T): T {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    return fn();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

describe("payout math", () => {
  test("uses the documented defaults", () => {
    withEnv({ PAYOUT_RATE: undefined, PAYOUT_MIN_RUB: undefined }, () => {
      assert.equal(payoutRate(), 0.3);
      assert.equal(payoutMinMinor(), 10_000);
      assert.equal(payoutAmountMinor(1000), 30_000);
    });
  });

  test("clamps the configured rate", () => {
    withEnv({ PAYOUT_RATE: "0" }, () => assert.equal(payoutRate(), 0.01));
    withEnv({ PAYOUT_RATE: "500" }, () => assert.equal(payoutRate(), 100));
    withEnv({ PAYOUT_RATE: "nope" }, () => assert.equal(payoutRate(), 0.3));
  });

  test("falls back to 100 RUB minimum for invalid values", () => {
    withEnv({ PAYOUT_MIN_RUB: "-5" }, () => assert.equal(payoutMinMinor(), 10_000));
    withEnv({ PAYOUT_MIN_RUB: "250" }, () => assert.equal(payoutMinMinor(), 25_000));
  });

  test("ships the expected payout methods", () => {
    assert.deepEqual([...PAYOUT_METHODS], ["uzcard", "humo", "payme", "click", "bank", "other"]);
  });
});

describe("payout details sealing", () => {
  test("masks all but the last four characters", () => {
    withEnv({ DONATIONALERTS_TOKEN_KEY: randomBytes(32).toString("base64") }, () => {
      const sealed = sealJson({ account: "8600123456789012" });
      assert.equal(revealPayoutDetails(sealed), "8600123456789012");
      assert.match(maskPayoutDetails(sealed), /^•+9012$/);
      assert.equal(maskPayoutDetails("garbage"), "••••");
    });
  });
});
