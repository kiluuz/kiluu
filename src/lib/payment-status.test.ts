import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { paymentsMaintenance } from "./payment-status";

function withEnv<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.PAYMENTS_MAINTENANCE;
  if (value === undefined) delete process.env.PAYMENTS_MAINTENANCE;
  else process.env.PAYMENTS_MAINTENANCE = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.PAYMENTS_MAINTENANCE;
    else process.env.PAYMENTS_MAINTENANCE = previous;
  }
}

describe("payment maintenance flag", () => {
  test("is on by default so top-ups stay paused", () => {
    withEnv(undefined, () => assert.equal(paymentsMaintenance(), true));
    withEnv("", () => assert.equal(paymentsMaintenance(), true));
  });

  test("turns off only for explicit false values", () => {
    for (const value of ["0", "false", "OFF", " no "]) {
      withEnv(value, () => assert.equal(paymentsMaintenance(), false));
    }
  });

  test("keeps maintenance on for true-looking or unknown values", () => {
    for (const value of ["1", "true", "yes", "maintenance"]) {
      withEnv(value, () => assert.equal(paymentsMaintenance(), true));
    }
  });
});
