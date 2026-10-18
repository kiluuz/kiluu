import assert from "node:assert/strict";
import { test } from "node:test";
import {
  averageRating,
  canFollowProfile,
  canViewProfile,
  parseProfilePrivacy,
} from "@/lib/profile-privacy";

test("profile visibility honors owner, follower-only, and private settings", () => {
  const followersOnly = parseProfilePrivacy(JSON.stringify({ profileVisibility: "followers" }));
  const privateProfile = parseProfilePrivacy(JSON.stringify({ profileVisibility: "private" }));

  assert.equal(canViewProfile(followersOnly, true, false), true);
  assert.equal(canViewProfile(followersOnly, false, true), true);
  assert.equal(canViewProfile(followersOnly, false, false), false);
  assert.equal(canViewProfile(privateProfile, false, true), false);
  assert.equal(canViewProfile(privateProfile, true, false), true);
});

test("privacy defaults are public but explicit collection and follow restrictions apply", () => {
  const privacy = parseProfilePrivacy(JSON.stringify({ showCollection: false, allowFollows: false }));
  assert.equal(privacy.showCollection, false);
  assert.equal(canFollowProfile(privacy, false), false);
  assert.equal(canFollowProfile(privacy, true), false);
  assert.equal(parseProfilePrivacy("{bad").showActivity, true);
});

test("community rating average is real and empty ratings remain empty", () => {
  assert.equal(averageRating([]), null);
  assert.equal(averageRating([6, 8, 9]), 23 / 3);
});
