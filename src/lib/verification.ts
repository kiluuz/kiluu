export const VERIFIED_FOLLOWER_THRESHOLD = 1_000;

export function isVerifiedByFollowerCount(followerCount: number): boolean {
  return followerCount >= VERIFIED_FOLLOWER_THRESHOLD;
}
