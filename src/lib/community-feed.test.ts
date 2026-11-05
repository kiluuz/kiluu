import assert from "node:assert/strict";
import { test } from "node:test";
import { VIEWER_STATE_HOLD_MS, holdViewerState, mergeFeedPage } from "@/lib/community-feed";

type Post = {
  id: string;
  liked: boolean;
  bookmarked: boolean;
  likeCount: number;
  commentCount: number;
  user: { following?: boolean };
};

function post(id: string, over: Partial<Post> = {}): Post {
  return { id, liked: false, bookmarked: false, likeCount: 0, commentCount: 0, user: {}, ...over };
}

test("a feed poll that predates a like cannot revert the viewer's own reaction", () => {
  const now = 1_000_000;
  const holds = new Map<string, number>();
  holdViewerState(holds, "p1", now);

  const local = [post("p1", { liked: true, likeCount: 6, commentCount: 9 })];
  // The poll's snapshot was read before the like committed, so it still says un-liked.
  const incoming = [post("p1", { liked: false, likeCount: 5, commentCount: 11 })];

  const [merged] = mergeFeedPage(incoming, local, holds, now);
  assert.equal(merged.liked, true, "the tap must survive a stale poll");
  assert.equal(merged.likeCount, 6);
  assert.equal(merged.commentCount, 11, "everything else still comes from the server");
});

test("the hold expires so the server stays authoritative", () => {
  const now = 1_000_000;
  const holds = new Map([[ "p1", now - 1 ]]);
  const local = [post("p1", { liked: true, likeCount: 6 })];
  const incoming = [post("p1", { liked: false, likeCount: 5 })];

  const [merged] = mergeFeedPage(incoming, local, holds, now);
  assert.equal(merged.liked, false);
  assert.equal(merged.likeCount, 5);
});

test("posts the viewer never tapped merge straight from the server", () => {
  const holds = new Map<string, number>();
  const local = [post("p1", { liked: true, likeCount: 6 }), post("p2", { liked: true, likeCount: 2 })];
  const incoming = [post("p2", { liked: false, likeCount: 40 })];

  const merged = mergeFeedPage(incoming, local, holds, 1_000);
  assert.deepEqual(merged.map((item) => [item.id, item.liked, item.likeCount]), [["p2", false, 40], ["p1", true, 6]]);
});

test("paging keeps loaded posts that the next poll no longer returns", () => {
  const holds = new Map<string, number>();
  const local = [post("p1"), post("p2", { liked: true, likeCount: 3 }), post("p3")];
  const incoming = [post("p1"), post("p2", { liked: true, likeCount: 3 })];

  const merged = mergeFeedPage(incoming, local, holds, 1_000);
  assert.deepEqual(merged.map((item) => item.id), ["p1", "p2", "p3"]);
});

test("a held post keeps the locally followed author instead of a stale poll answer", () => {
  const now = 5_000;
  const holds = new Map<string, number>();
  holdViewerState(holds, "p1", now);

  const local = [post("p1", { user: { following: true } })];
  const incoming = [post("p1", { commentCount: 4, user: { following: false } })];

  const [merged] = mergeFeedPage(incoming, local, holds, now);
  assert.deepEqual(merged.user, { following: true });
  assert.equal(merged.commentCount, 4);
});

test("a held post without a local follow answer does not invent one", () => {
  const now = 5_000;
  const holds = new Map<string, number>();
  holdViewerState(holds, "p1", now);

  const [merged] = mergeFeedPage([post("p1", { user: { following: false } })], [post("p1")], holds, now);
  assert.equal(merged.user.following, false);
});

test("holding restarts the window from the moment of the last confirmed tap", () => {
  const now = 9_000;
  const holds = new Map<string, number>();
  holdViewerState(holds, "p1", now - VIEWER_STATE_HOLD_MS);
  assert.equal(holds.get("p1"), now);
  holdViewerState(holds, "p1", now);
  assert.equal(holds.get("p1"), now + VIEWER_STATE_HOLD_MS);
});
