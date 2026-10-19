export type Role = "CREATOR" | "VIEWER" | "ADMIN";

export interface SocialLinks {
  telegram?: string;
  instagram?: string;
  youtube?: string;
  x?: string;
}

export interface ShowcaseConfig {
  topFive: string[]; // anime ids in rank order
  pinnedPostId: string | null;
  genres: string[];
  achievementIds: string[]; // max 6
  order: string[]; // section order
  hidden: Record<string, boolean>; // section id -> hidden
}

export interface PrivacyConfig {
  showWatchTime: boolean;
  showFavorites: boolean;
  showActivity: boolean;
  showCollection: boolean;
  showFollowers: boolean;
  allowFollows: boolean;
  profileVisibility: "everyone" | "followers" | "private";
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: Role;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  accentColor: string;
  credits: number;
  onboardingDone: boolean;
  createdAt: string;
  telegramLinked?: boolean;
  // customization
  pronouns: string | null;
  tagline: string | null;
  country: string | null;
  timezone: string | null;
  socialLinks: string | null;
  statusEmoji: string | null;
  statusText: string | null;
  accentTo: string | null;
  avatarFrame: string | null;
  bannerPreset: string | null;
  showcase: string | null;
  privacy: string | null;
  /** owned animes count — powers the Exchange "20+" badge + lock (may lag after purchases) */
  ownedCount?: number;
  level?: number;
  xp?: number;
  xpToNext?: number;
  dailyStreak?: number;
  badges?: { id: string; label: string; color: string; glow?: boolean }[];
}

export interface AnimeSummary {
  id: string;
  slug: string;
  title: string;
  coverImage: string;
  bannerImage?: string | null;
  rating: number;
  year: number;
  type: string;
  genres: string[];
  isFree: boolean;
  price: number;
  description?: string;
  episodeCount?: number;
  owned?: boolean;
  studio?: string | null;
  status?: string;
  trending?: number;
  featured?: boolean;
  creator?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  source?: string;
}

export interface AnimeVersionCard {
  id: string;
  kind: string;
  price: number;
  status: string;
  episodeCount: number;
  sales: number;
  label: string;
  owned: boolean;
}

export interface EpisodeItem {
  id: string;
  animeId: string;
  number: number;
  title: string;
  description: string | null;
  videoUrl: string;
  streamId?: string | null;
  hlsKey?: string | null;
  duration: number;
  progress: { position: number; duration: number; completed: boolean } | null;
}

export interface AnimeDetail extends AnimeSummary {
  altTitle: string | null;
  purchaseCount: number;
  collectorCount: number;
  favoriteCount: number;
  catalogRating: number;
  communityRating: number | null;
  ratingCount: number;
  myRating: number | null;
  favorited: boolean;
  owned: boolean;
  releaseDate: string | null;
  creator: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string;
    role: string;
    isVerified?: boolean;
  } | null;
  versions?: AnimeVersionCard[];
}

export interface HomeData {
  featured: AnimeSummary[];
  trending: AnimeSummary[];
  newReleases: AnimeSummary[];
  topRated: AnimeSummary[];
  freeAnimes: AnimeSummary[];
  continueWatching: ContinueWatchingItem[];
  genres: string[];
}

export interface ContinueWatchingItem {
  animeId: string;
  animeTitle: string;
  coverImage: string;
  bannerImage: string | null;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  position: number;
  duration: number;
}

export type PostType =
  | "Theories"
  | "Reviews"
  | "Discussions"
  | "Memes"
  | "Fan Art"
  | "Recommendations"
  | "UZ Dubbing"
  | "Watch Parties";

export interface CommunityPost {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt?: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string;
    role: string;
    isVerified?: boolean;
    level?: number;
    following?: boolean;
    badges?: { id: string; label: string; color: string; glow?: boolean }[];
  };
  anime: { id: string; slug: string; title: string; coverImage: string; genres?: string[]; rating?: number; episodeCount?: number } | null;
  likeCount: number;
  commentCount: number;
  awardCount: number;
  liked: boolean;
  bookmarked: boolean;
  category: PostType;
  spoiler: boolean;
  rating: number | null;
  type?: PostType;
  isSpoiler?: boolean;
  poll?: {
    options: { id: string; text: string; votes: number }[];
    totalVotes: number;
    userVotedId?: string;
  };
  reactions?: {
    fire: number;
    heart: number;
    laugh: number;
    mindBlown: number;
    sad: number;
    userReaction?: "fire" | "heart" | "laugh" | "mindBlown" | "sad" | null;
  };
  hashtags?: string[];
}

export interface CommentItem {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string;
    role: string;
    level?: number;
    badge?: string;
  };
  likeCount?: number;
  liked?: boolean;
  replyCount?: number;
}

export interface CommunityStats {
  online: number;
  postsToday: number;
  trending: { id: string; slug: string; title: string; coverImage: string; posts: number; likes: number }[];
  contributors: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string;
    postCount: number;
    likeCount: number;
    level: number;
  }[];
  watchParties: { id: string; code: string; name: string; title: string; coverImage: string; watching: number }[];
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  isVerified?: boolean;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  accentColor: string;
  accentTo: string | null;
  avatarFrame: string | null;
  createdAt: string;
  // identity
  pronouns: string | null;
  tagline: string | null;
  country: string | null;
  timezone: string | null;
  socialLinks: Record<string, string>;
  statusEmoji: string | null;
  statusText: string | null;
  showcase: ShowcaseConfig;
  privacy?: PrivacyConfig;
  stats: {
    purchaseCount: number | null;
    postCount: number | null;
    watchSeconds: number | null;
    followers: number | null;
    following: number | null;
    favoriteCount: number | null;
    exchangeUnlocked?: boolean;
    giftsSent?: number;
    level?: number;
    xp?: number;
    xpToNext?: number;
    badges?: { id: string; label: string; color: string; glow?: boolean }[];
  };
  achievements: {
    id: string;
    emoji: string;
    name: string;
    desc: string;
    rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
    current: number;
    target: number;
    earned: boolean;
    secret: boolean;
    unlockedAt: string | null;
  }[];
  currentlyWatching: {
    anime: AnimeSummary;
    episode: { id: string; number: number; title: string };
    position: number;
    duration: number;
    updatedAt: string;
  } | null;
  favoriteAnimes: AnimeSummary[];
  favoriteUsers: UserMini[];
  followersList: UserMini[];
  ownedAnimes: AnimeSummary[];
  posts: {
    id: string;
    content: string;
    imageUrl: string | null;
    createdAt: string;
    updatedAt?: string;
    anime: { id: string; slug: string; title: string; coverImage: string } | null;
    likeCount: number;
    commentCount: number;
    liked: boolean;
  }[];
  isFollowing: boolean;
  canFollow: boolean;
  isMe: boolean;
}

export interface UserMini {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accentColor: string;
  accentTo?: string | null;
  role?: string;
}

export interface ExchangeOfferItem {
  id: string;
  anime: {
    id: string;
    slug: string;
    title: string;
    coverImage: string;
    rating: number;
    year: number;
    type: string;
    price: number;
    genres?: string;
  };
  user: UserMini;
  wantedNote: string | null;
  proposalCount: number;
  createdAt: string;
  isMine: boolean;
}

export interface ExchangeProposalItem {
  id: string;
  offerId: string;
  status: string;
  message: string | null;
  createdAt: string;
  offer: {
    id: string;
    anime: { id: string; slug: string; title: string; coverImage: string; rating: number; year: number; type: string; price: number };
    user: UserMini;
  };
  proposer: UserMini;
  anime: { id: string; slug: string; title: string; coverImage: string; rating: number; year: number; type: string; price: number };
}

export interface CreditPackage {
  id: string;
  name?: string;
  credits: number;
  starsPrice?: number;
  priceUsd?: number;
  bonus: number;
  popular: boolean;
}

export interface CreditTx {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

export interface ScheduleItem extends AnimeSummary {
  airDay: number; // 0=Sun..6=Sat
  airTime: string; // "18:30"
  episodeCount: number;
}

export interface DubJobItem {
  id: string;
  animeSlug: string;
  animeTitle: string;
  coverImage: string;
  episodeNumber: number;
  episodeTitle: string;
  duration: number;
  targetLang: string;
  voice: string;
  status: string;
  pricePaid: number;
  createdAt: string;
}

export interface EpisodeOption {
  id: string;
  number: number;
  title: string;
  duration: number;
  dubbed: boolean;
}

export type ViewName =
  | "home"
  | "browse"
  | "detail"
  | "watch"
  | "library"
  | "community"
  | "watch-together"
  | "credits"
  | "gifts"
  | "exchange"
  | "user-profile"
  | "studio"
  | "settings"
  | "login"
  | "schedule"
  | "dubbing"
  | "bot-admin";

export interface View {
  name: ViewName;
  animeId?: string;
  episodeId?: string;
  username?: string;
  filters?: Record<string, string>;
}
