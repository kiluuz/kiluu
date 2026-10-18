import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { userOwnsVersion } from "./owns";

describe("ownership helper shape", () => {
  test("exports userOwnsVersion", () => {
    assert.equal(typeof userOwnsVersion, "function");
  });
});
