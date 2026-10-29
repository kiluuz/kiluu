import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { GIFT_RARITIES, giftRarity, giftRarityRank, giftSerialNumber } from "./gift-rarity";

describe("gift rarity", () => {
  test("maps exact price thresholds to the right tier", () => {
    assert.equal(giftRarity(0).id, "common");
    assert.equal(giftRarity(249).id, "common");
    assert.equal(giftRarity(250).id, "rare");
    assert.equal(giftRarity(399).id, "rare");
    assert.equal(giftRarity(400).id, "epic");
    assert.equal(giftRarity(549).id, "epic");
    assert.equal(giftRarity(550).id, "legendary");
    assert.equal(giftRarity(1200).id, "legendary");
  });

  test("uses the documented colors and star counts", () => {
    assert.deepEqual(
      GIFT_RARITIES.map((rarity) => [rarity.id, rarity.color, rarity.stars]),
      [
        ["legendary", "#ffc46b", 5],
        ["epic", "#c77dff", 4],
        ["rare", "#4dd0ff", 3],
        ["common", "#9be7d0", 2],
      ]
    );
  });

  test("ranks rarer tiers first for collection sorting", () => {
    assert.ok(giftRarityRank(550) < giftRarityRank(400));
    assert.ok(giftRarityRank(400) < giftRarityRank(250));
    assert.ok(giftRarityRank(250) < giftRarityRank(100));
  });

  test("derives a stable four-digit serial from the gift id", () => {
    const first = giftSerialNumber("clx-gift-abc123");
    assert.equal(first, giftSerialNumber("clx-gift-abc123"));
    assert.match(first, /^No\. [1-9]\d{3}$/);
    assert.notEqual(first, giftSerialNumber("clx-gift-xyz987"));
  });
});
