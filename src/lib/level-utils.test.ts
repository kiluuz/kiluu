import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateBadges, calculateLevel } from "./level-utils";
import { xpForLevel } from "./xp";

test("level title follows the highest reached Japanese title milestone", () => {
  assert.equal(calculateLevel(xpForLevel(2)).titleJa, "見習い");
  assert.equal(calculateLevel(xpForLevel(5)).titleJa, "生徒");
  assert.equal(calculateLevel(xpForLevel(11)).titleJa, "剣士");
  assert.equal(calculateLevel(xpForLevel(100)).titleJa, "無限");
});

test("level badge shows the Japanese title without duplicating the numeric level", () => {
  const levelInfo = calculateLevel(xpForLevel(2));
  const badges = calculateBadges({
    isCreator: false,
    createdAnimes: 0,
    purchasedAnimes: 0,
    levelInfo,
  });

  assert.deepEqual(badges.map(({ id, label }) => ({ id, label })), [
    { id: "level_title", label: "見習い" },
  ]);
});

test("creator accounts get no viewer level title badge", () => {
  const levelInfo = calculateLevel(xpForLevel(2));
  const badges = calculateBadges({
    isCreator: true,
    createdAnimes: 2,
    purchasedAnimes: 0,
    levelInfo,
  });

  assert.deepEqual(badges.map(({ id }) => id), ["creator"]);
  assert.equal(calculateBadges({ isCreator: true, createdAnimes: 0, purchasedAnimes: 0, levelInfo }).length, 0);
});
