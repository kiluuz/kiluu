export type Role = "CREATOR" | "VIEWER";

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
  createdAt: string;
  stats: {
    purchaseCount: number;
    postCount: number;
    watchSeconds: number;
    followers: number;
    following: number;
    exchangeUnlocked: boolean;
  };
  favoriteAnimes: { id: string; slug: string; title: string; coverImage: string; rating: number; year: number }[];
  favoriteUsers: UserMini[];
  followersList: UserMini[];
  recentAnimes: { id: string; slug: string; title: string; coverImage: string; rating: number }[];
  isFollowing: boolean;
  isMe: boolean;
}

export interface UserMini {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accentColor: string;
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
