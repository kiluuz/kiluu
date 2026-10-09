export type Role = "CREATOR" | "VIEWER";

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
  creator?: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

export interface EpisodeItem {
  id: string;
  animeId: string;
  number: number;
  title: string;
  description: string | null;
  videoUrl: string;
  duration: number;
  progress: { position: number; duration: number; completed: boolean } | null;
}

export interface AnimeDetail extends AnimeSummary {
  altTitle: string | null;
  purchaseCount: number;
  favoriteCount: number;
  favorited: boolean;
  owned: boolean;
  creator: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string;
    role: string;
  } | null;
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

export interface CommunityPost {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string;
    role: string;
  };
  anime: { id: string; slug: string; title: string; coverImage: string } | null;
  likeCount: number;
  commentCount: number;
  liked: boolean;
}

export interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    accentColor: string;
    role: string;
  };
}

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
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
    purchaseCount: number;
    postCount: number;
    watchSeconds: number | null;
    followers: number;
    following: number;
    favoriteCount: number;
    exchangeUnlocked: boolean;
  };
  achievements: { id: string; current: number; target: number }[];
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
    anime: { id: string; slug: string; title: string; coverImage: string } | null;
    likeCount: number;
    commentCount: number;
    liked: boolean;
  }[];
  isFollowing: boolean;
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
  credits: number;
  priceUsd: number;
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

export type ViewName =
  | "home"
  | "browse"
  | "detail"
  | "watch"
  | "library"
  | "community"
  | "watch-together"
  | "credits"
  | "exchange"
  | "user-profile"
  | "studio"
  | "settings";

export interface View {
  name: ViewName;
  animeId?: string;
  episodeId?: string;
  username?: string;
  filters?: Record<string, string>;
}
