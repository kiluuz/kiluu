import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const ANIME_CARD = {
  id: true, slug: true, title: true, coverImage: true, bannerImage: true,
  rating: true, year: true, type: true, genres: true, isFree: true, price: true, status: true,
} as const;

const USER_MINI = {
  id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, accentTo: true, role: true,
} as const;

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// GET /api/users/[username] — full Discord-style profile
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const me = await getCurrentUser();

  const user = await db.user.findUnique({ where: { username } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isMe = me ? me.id === user.id : false;

  const privacy = safeParse(user.privacy, {
    showWatchTime: true, showFavorites: true, showActivity: true,
    allowFollows: true, profileVisibility: "everyone",
  } as { showWatchTime: boolean; showFavorites: boolean; showActivity: boolean; allowFollows: boolean; profileVisibility: string });

  const showcase = safeParse(user.showcase, {
    topFive: [] as string[], pinnedPostId: null as string | null,
    genres: [] as string[], achievementIds: [] as string[],
    order: ["topFive", "currentlyWatching", "favorites", "collection", "activity", "achievements"] as string[],
    hidden: {} as Record<string, boolean>,
  });

  const [
    purchaseCount, favoriteAnimesRows, favoriteUsersRows, followersRows,
    ownedRows, postCount, postsRows, progressRows, latestProgress, favoriteUserCount, followerCount,
  ] = await Promise.all([
    db.purchase.count({ where: { userId: user.id } }),
    db.favoriteAnime.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { anime: { select: ANIME_CARD } },
    }),
    db.favoriteUser.findMany({
      where: { followerId: user.id },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { following: { select: USER_MINI } },
    }),
    db.favoriteUser.findMany({
      where: { followingId: user.id },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { follower: { select: USER_MINI } },
    }),
    db.purchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { anime: { select: ANIME_CARD } },
    }),
    db.post.count({ where: { userId: user.id } }),
    db.post.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        anime: { select: { id: true, slug: true, title: true, coverImage: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    db.watchProgress.findMany({
      where: { userId: user.id },
      select: { position: true, duration: true },
    }),
    // currently watching = most recent uncompleted progress
    db.watchProgress.findFirst({
      where: { userId: user.id, completed: false },
      orderBy: { updatedAt: "desc" },
      include: {
        anime: { select: ANIME_CARD },
        episode: { select: { id: true, number: true, title: true } },
      },
    }),
    db.favoriteUser.count({ where: { followerId: user.id } }),
    db.favoriteUser.count({ where: { followingId: user.id } }),
  ]);

  // my like state on their posts
  let myLikedPostIds: string[] = [];
  if (me && postsRows.length) {
    const likes = await db.postLike.findMany({
      where: { userId: me.id, postId: { in: postsRows.map((p) => p.id) } },
      select: { postId: true },
    });
    myLikedPostIds = likes.map((l) => l.postId);
  }

  const watchSeconds = progressRows.reduce(
    (acc, p) => acc + Math.min(p.position, p.duration || p.position), 0
  );

  let isFollowing = false;
  if (me) {
    const rel = await db.favoriteUser.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: user.id } },
    });
    isFollowing = !!rel;
  }

  const favoriteAnimes = favoriteAnimesRows.map((f) => f.anime);
  const ownedAnimes = ownedRows.map((p) => p.anime);

  // ---- Achievements (computed from real stats) ----
  const stats = {
    purchaseCount, postCount, watchSeconds,
    followers: followerCount, following: favoriteUserCount,
    favoriteCount: favoriteAnimes.length,
    exchangeUnlocked: purchaseCount >= 20,
  };
  const achievements = [
    { id: "join", current: 1, target: 1 },
    { id: "first", current: Math.min(purchaseCount, 1), target: 1 },
    { id: "collector", current: Math.min(purchaseCount, 10), target: 10 },
    { id: "exchange", current: Math.min(purchaseCount, 20), target: 20 },
    { id: "critic", current: Math.min(Math.floor(watchSeconds / 36000), 10), target: 10 },
    { id: "marathon", current: Math.min(Math.floor(watchSeconds / 180000), 50), target: 50 },
    { id: "voice", current: Math.min(postCount, 5), target: 5 },
    { id: "social", current: Math.min(followerCount, 5), target: 5 },
    { id: "trendsetter", current: Math.min(followerCount, 20), target: 20 },
    { id: "curator", current: Math.min(favoriteAnimes.length, 10), target: 10 },
    { id: "creator", current: user.role === "CREATOR" ? 1 : 0, target: 1 },
  ];

  const currentlyWatching = latestProgress && latestProgress.anime && latestProgress.episode ? {
    anime: latestProgress.anime,
    episode: latestProgress.episode,
    position: latestProgress.position,
    duration: latestProgress.duration,
    updatedAt: latestProgress.updatedAt.toISOString(),
  } : null;

  return NextResponse.json({
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl || null,
      bannerUrl: user.bannerUrl || null,
      bio: user.bio,
      accentColor: user.accentColor,
      accentTo: user.accentTo || null,
      avatarFrame: user.avatarFrame || null,
      createdAt: user.createdAt,
      // identity
      pronouns: user.pronouns || null,
      tagline: user.tagline || null,
      country: user.country || null,
      timezone: user.timezone || null,
      socialLinks: safeParse<Record<string, string>>(user.socialLinks, {}),
      statusEmoji: user.statusEmoji || null,
      statusText: user.statusText || null,
      showcase,
      privacy: isMe ? privacy : undefined,
      stats,
      achievements,
      currentlyWatching,
      favoriteAnimes: privacy.showFavorites || isMe ? favoriteAnimes : [],
      favoriteUsers: favoriteUsersRows.map((f) => f.following),
      followersList: followersRows.map((f) => f.follower),
      ownedAnimes,
      posts: privacy.showActivity || isMe ? postsRows.map((p) => ({
        id: p.id,
        content: p.content,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt,
        anime: p.anime,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        liked: myLikedPostIds.includes(p.id),
      })) : [],
      watchSeconds: privacy.showWatchTime || isMe ? watchSeconds : null,
      isFollowing,
      isMe,
    },
  });
}
