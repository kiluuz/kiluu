import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isVerifiedByFollowerCount } from "./verification";

describe("isVerifiedByFollowerCount", () => {
  it("requires at least 1,000 followers", () => {
    assert.equal(isVerifiedByFollowerCount(999), false);
    assert.equal(isVerifiedByFollowerCount(1_000), true);
    assert.equal(isVerifiedByFollowerCount(1_001), true);
  });
});
