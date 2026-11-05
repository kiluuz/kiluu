/**
 * The community feed refreshes itself every few seconds, and a refresh that was
 * requested before a reaction was written back still carries the pre-tap snapshot.
 * Merging that snapshot over the list visibly un-likes the post the viewer just
 * tapped — and because the like endpoint toggles, the next tap then really deletes
 * it. A short hold keeps the viewer's own reaction authoritative until the poll has
 * certainly seen the write.
 */
export const VIEWER_STATE_HOLD_MS = 8_000;

export interface ViewerHeldPost {
  id: string;
  liked: boolean;
  bookmarked: boolean;
  likeCount: number;
  user: { following?: boolean };
}

export type ViewerStateHolds = Map<string, number>;

export function holdViewerState(holds: ViewerStateHolds, postId: string, now = Date.now()): void {
  holds.set(postId, now + VIEWER_STATE_HOLD_MS);
}

export function mergeFeedPage<T extends ViewerHeldPost>(
  incoming: T[],
  previous: T[],
  holds: ViewerStateHolds,
  now = Date.now()
): T[] {
  const localById = new Map(previous.map((post) => [post.id, post] as const));
  const incomingIds = new Set(incoming.map((post) => post.id));
  const merged = incoming.map((post) => {
    const heldUntil = holds.get(post.id);
    const local = localById.get(post.id);
    if (!heldUntil || heldUntil <= now || !local) return post;
    return {
      ...post,
      liked: local.liked,
      bookmarked: local.bookmarked,
      likeCount: local.likeCount,
      user: local.user.following === undefined ? post.user : { ...post.user, following: local.user.following },
    };
  });
  return [...merged, ...previous.filter((post) => !incomingIds.has(post.id))];
}
