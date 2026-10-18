export interface ProfilePrivacy {
  showWatchTime: boolean;
  showFavorites: boolean;
  showActivity: boolean;
  showCollection: boolean;
  showFollowers: boolean;
  allowFollows: boolean;
  profileVisibility: "everyone" | "followers" | "private";
}

export const DEFAULT_PROFILE_PRIVACY: ProfilePrivacy = {
  showWatchTime: true,
  showFavorites: true,
  showActivity: true,
  showCollection: true,
  showFollowers: true,
  allowFollows: true,
  profileVisibility: "everyone",
};

export function parseProfilePrivacy(raw: string | null | undefined): ProfilePrivacy {
  if (!raw) return DEFAULT_PROFILE_PRIVACY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return DEFAULT_PROFILE_PRIVACY;
    const value = parsed as Record<string, unknown>;
    const visibility = value.profileVisibility;
    return {
      showWatchTime: value.showWatchTime !== false,
      showFavorites: value.showFavorites !== false,
      showActivity: value.showActivity !== false,
      showCollection: value.showCollection !== false,
      showFollowers: value.showFollowers !== false,
      allowFollows: value.allowFollows !== false,
      profileVisibility: visibility === "followers" || visibility === "private" ? visibility : "everyone",
    };
  } catch {
    return DEFAULT_PROFILE_PRIVACY;
  }
}

export function canViewProfile(privacy: ProfilePrivacy, isOwner: boolean, isFollower: boolean): boolean {
  if (isOwner || privacy.profileVisibility === "everyone") return true;
  if (privacy.profileVisibility === "followers") return isFollower;
  return false;
}

export function canFollowProfile(privacy: ProfilePrivacy, isOwner: boolean): boolean {
  return !isOwner && privacy.allowFollows;
}

export function averageRating(ratings: number[]): number | null {
  if (!ratings.length) return null;
  return ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
}
