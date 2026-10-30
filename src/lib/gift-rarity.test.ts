import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  GIFT_RARITIES,
  collectibleRarity,
  giftRarity,
  giftRarityRank,
  giftRarityRankById,
  giftSerialNumber,
} from "./gift-rarity";

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

describe("collectible rarity", () => {
  test("falls back to the price tier when quality signals are missing", () => {
    assert.equal(collectibleRarity({ price: 100 }).id, "common");
    assert.equal(collectibleRarity({ price: 250 }).id, "rare");
    assert.equal(collectibleRarity({ price: 400 }).id, "epic");
    assert.equal(collectibleRarity({ price: 550 }).id, "legendary");
  });

  test("boosts one tier for medium quality signals", () => {
    assert.equal(collectibleRarity({ price: 100, rating: 8 }).id, "rare");
    assert.equal(collectibleRarity({ price: 100, speakerCount: 6 }).id, "rare");
    assert.equal(collectibleRarity({ price: 100, teamReputation: 65 }).id, "rare");
  });

  test("boosts two tiers for high quality signals", () => {
    assert.equal(collectibleRarity({ price: 100, rating: 9 }).id, "epic");
    assert.equal(collectibleRarity({ price: 100, speakerCount: 12 }).id, "epic");
    assert.equal(collectibleRarity({ price: 100, teamReputation: 85 }).id, "epic");
  });

  test("combines boosts and caps at legendary", () => {
    const stacked = collectibleRarity({
      price: 250,
      rating: 9.5,
      speakerCount: 14,
      teamReputation: 90,
    });
    assert.equal(stacked.id, "legendary");
    assert.equal(stacked.stars, 5);

    assert.equal(
      collectibleRarity({ price: 550, rating: 10, speakerCount: 20, teamReputation: 100 }).id,
      "legendary"
    );
  });

  test("ignores null and out-of-range signals", () => {
    assert.equal(
      collectibleRarity({ price: 100, rating: null, speakerCount: null, teamReputation: null }).id,
      "common"
    );
    assert.equal(collectibleRarity({ price: 100, rating: -5, speakerCount: -2 }).id, "common");
    assert.equal(collectibleRarity({ price: 100, teamReputation: 500 }).id, "epic");
  });

  test("ranks stored rarity ids, falling back to price", () => {
    assert.equal(giftRarityRankById("legendary", 100), 0);
    assert.equal(giftRarityRankById("epic", 100), 1);
    assert.equal(giftRarityRankById("unknown", 250), giftRarityRank(250));
  });
});
