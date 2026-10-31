import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { LEVEL_UP_CREDITS, levelUpCredits } from "./xp";

describe("level-up credit reward", () => {
  test("is exactly 10 credits per level", () => {
    assert.equal(LEVEL_UP_CREDITS, 10);
    assert.equal(levelUpCredits(1, 2), 10);
    assert.equal(levelUpCredits(9, 10), 10);
    assert.equal(levelUpCredits(99, 100), 10);
  });

  test("pays every level when several are crossed at once", () => {
    assert.equal(levelUpCredits(1, 100), 990);
    assert.equal(levelUpCredits(4, 7), 30);
  });

  test("pays nothing without a level gain", () => {
    assert.equal(levelUpCredits(10, 10), 0);
    assert.equal(levelUpCredits(10, 4), 0);
    assert.equal(levelUpCredits(Number.NaN, 5), 0);
  });
});
