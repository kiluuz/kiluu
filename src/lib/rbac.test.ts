import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { canonicalRole, clientRole, isAdmin, isCreator, parseOnboardingRole } from "./rbac";

describe("rbac", () => {
  test("canonical lowercase", () => {
    assert.equal(canonicalRole("ADMIN"), "admin");
    assert.equal(canonicalRole("CREATOR"), "creator");
    assert.equal(canonicalRole("VIEWER"), "user");
  });

  test("clientRole maps for UI", () => {
    assert.equal(clientRole("admin"), "ADMIN");
    assert.equal(clientRole("creator"), "CREATOR");
    assert.equal(clientRole("user"), "VIEWER");
  });

  test("onboarding cannot self-promote to admin", () => {
    assert.equal(parseOnboardingRole("admin"), null);
    assert.equal(parseOnboardingRole("CREATOR"), "creator");
    assert.equal(parseOnboardingRole("VIEWER"), "user");
  });

  test("isAdmin env telegram ids", () => {
    const user = { id: "u1", role: "user", telegramId: "999" };
    assert.equal(isAdmin(user), false);
    assert.equal(isAdmin(user, { adminTelegramIds: ["999"] }), true);
    assert.equal(isAdmin({ id: "u2", role: "admin", telegramId: null }), true);
  });

  test("creators include admins", () => {
    assert.equal(isCreator({ role: "creator" }), true);
    assert.equal(isCreator({ role: "admin" }), true);
    assert.equal(isCreator({ role: "user" }), false);
  });
});
