import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewProfile, parseProfilePrivacy } from "@/lib/profile-privacy";
import { getUserAchievementStates } from "@/lib/achievements";
import { getXpTotal, levelFromXp } from "@/lib/xp";
import { Prisma } from "@prisma/client";
import { sqlTable } from "@/lib/sql-table";
import { isVerifiedByFollowerCount } from "@/lib/verification";

const ANIME_CARD = {
  id: true, slug: true, title: true, coverImage: true, bannerImage: true,
  rating: true, year: true, type: true, genres: true, isFree: true, price: true, status: true,
} as const;

const USER_MINI = {
  id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, accentTo: true, role: true,
  avatarFrame: true, equippedAvatarFrameId: true, equippedNameFrameId: true,
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

  const privacy = parseProfilePrivacy(user.privacy);
  const existingFollow = me && !isMe
    ? await db.follow.findUnique({
        where: { followerId_followedId: { followerId: me.id, followedId: user.id } },
        select: { id: true },
      })
    : null;
  const isFollowing = Boolean(existingFollow);
  if (!canViewProfile(privacy, isMe, isFollowing)) {
    return NextResponse.json({ error: "Profile is private" }, { status: 404 });
  }

  if (req.nextUrl.searchParams.get("view") === "card") {
    const [stats] = await db.$queryRaw<Array<{
      purchaseCount: bigint | number;
      postCount: bigint | number;
      watchSeconds: bigint | number | null;
      followers: bigint | number;
      following: bigint | number;
      favoriteCount: bigint | number;
      xp: bigint | number | null;
    }>>(Prisma.sql`
      SELECT
        (
          SELECT COUNT(*) FROM (
            SELECT "animeId" FROM ${sqlTable("Purchase")} WHERE "userId" = ${user.id}
            UNION
            SELECT a."id"
            FROM ${sqlTable("Order")} o
            JOIN ${sqlTable("Anime")} a ON a."slug" = o."anime_slug"
            WHERE o."site_user_id" = ${user.id}
              AND o."status" IN ('COMPLETED', 'PAID_PENDING_GRANT')
          ) owned_anime
        ) AS "purchaseCount",
        (SELECT COUNT(*) FROM ${sqlTable("Post")} WHERE "userId" = ${user.id} AND "hidden" = false) AS "postCount",
        (SELECT COALESCE(SUM("seconds"), 0) FROM ${sqlTable("watch_events")} WHERE "userId" = ${user.id}) AS "watchSeconds",
        (SELECT COUNT(*) FROM ${sqlTable("Follow")} WHERE "followedId" = ${user.id}) AS "followers",
        (SELECT COUNT(*) FROM ${sqlTable("Follow")} WHERE "followerId" = ${user.id}) AS "following",
        (SELECT COUNT(*) FROM ${sqlTable("FavoriteAnime")} WHERE "userId" = ${user.id}) AS "favoriteCount",
        (SELECT COALESCE(SUM("amount"), 0) FROM ${sqlTable("XpEvent")} WHERE "userId" = ${user.id}) AS "xp"
    `);
    const xpTotal = Number(stats.xp ?? 0);
    const levelInfo = levelFromXp(xpTotal);
    const count = (value: bigint | number) => Number(value);
    const isOnline = Boolean(user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 3 * 60_000);

    return NextResponse.json({
      profile: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        isVerified: isVerifiedByFollowerCount(count(stats.followers)),
        avatarUrl: user.avatarUrl || null,
        bannerUrl: user.bannerUrl || null,
        bannerPreset: user.bannerPreset || null,
        bio: user.bio,
        accentColor: user.accentColor,
        accentTo: user.accentTo || null,
        avatarFrame: user.avatarFrame || null,
        equippedAvatarFrameId: user.equippedAvatarFrameId,
        equippedNameFrameId: user.equippedNameFrameId,
        createdAt: user.createdAt,
        isOnline,
        lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
        pronouns: user.pronouns || null,
        tagline: user.tagline || null,
        country: user.country || null,
        timezone: user.timezone || null,
        socialLinks: safeParse<Record<string, string>>(user.socialLinks, {}),
        statusEmoji: user.statusEmoji || null,
        statusText: user.statusText || null,
        showcase: {
          topFive: [],
          pinnedPostId: null,
          genres: [],
          achievementIds: [],
          order: [],
          hidden: {},
        },
        privacy: isMe ? privacy : undefined,
        canFollow: privacy.allowFollows,
        stats: {
          purchaseCount: privacy.showCollection || isMe ? count(stats.purchaseCount) : null,
          postCount: privacy.showActivity || isMe ? count(stats.postCount) : null,
          watchSeconds: privacy.showWatchTime || isMe ? count(stats.watchSeconds ?? 0) : null,
          followers: privacy.showFollowers || isMe ? count(stats.followers) : null,
          following: privacy.showFollowers || isMe ? count(stats.following) : null,
          favoriteCount: privacy.showFavorites || isMe ? count(stats.favoriteCount) : null,
          level: levelInfo.level,
          xp: xpTotal,
          xpToNext: Math.max(0, levelInfo.nextLevelXp - xpTotal),
        },
        achievements: [],
        currentlyWatching: null,
        favoriteAnimes: [],
        favoriteUsers: [],
        followersList: [],
        ownedAnimes: [],
        posts: [],
        isFollowing,
        isMe,
      },
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const showcase = safeParse(user.showcase, {
    topFive: [] as string[], pinnedPostId: null as string | null,
    genres: [] as string[], achievementIds: [] as string[],
    order: ["topFive", "currentlyWatching", "favorites", "collection", "activity", "achievements"] as string[],
    hidden: {} as Record<string, boolean>,
  });

  const [
    favoriteAnimesRows, favoriteUsersRows, followersRows,
    ownedRows, orderRows, postCount, postsRows, latestProgress, favoriteUserCount, followerCount,
  ] = await Promise.all([
    db.favoriteAnime.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { anime: { select: ANIME_CARD } },
    }),
    db.follow.findMany({
      where: { followerId: user.id },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { followed: { select: USER_MINI } },
    }),
    db.follow.findMany({
      where: { followedId: user.id },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { follower: { select: USER_MINI } },
    }),
    db.purchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { anime: { select: ANIME_CARD } },
    }),
    db.order.findMany({
      where: { site_user_id: user.id, status: { in: ["COMPLETED", "PAID_PENDING_GRANT"] } },
      select: { anime_slug: true },
    }),
    db.post.count({ where: { userId: user.id, hidden: false } }),
    db.post.findMany({
      where: { userId: user.id, hidden: false },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        anime: { select: { id: true, slug: true, title: true, coverImage: true } },
        _count: { select: { likes: true, comments: true } },
      },
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
    db.follow.count({ where: { followerId: user.id } }),
    db.follow.count({ where: { followedId: user.id } }),
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

  const watchEventStats = await db.watchEvent.aggregate({
    where: { userId: user.id },
    _sum: { seconds: true },
  });
  const watchSeconds = watchEventStats._sum.seconds ?? 0;

  const favoriteAnimes = favoriteAnimesRows.map((f) => f.anime);
  const orderedAnimes = orderRows.length
    ? await db.anime.findMany({
        where: { slug: { in: orderRows.map((order) => order.anime_slug) } },
        select: ANIME_CARD,
      })
    : [];
  const ownedAnimes = [...new Map(
    [...ownedRows.map((purchase) => purchase.anime), ...orderedAnimes].map((anime) => [anime.id, anime])
  ).values()];
  const purchaseCount = ownedAnimes.length;

  const { calculateBadges, calculateLevel } = await import("@/lib/level-utils");
  const createdAnimesCount = await db.anime.count({ where: { creatorId: user.id } });
  const totalPurchases = purchaseCount;
  const [xpTotal, achievements] = await Promise.all([
    getXpTotal(user.id),
    getUserAchievementStates(user.id),
  ]);
  const levelInfo = calculateLevel(xpTotal);
  const badges = calculateBadges({
    isCreator: user.role === "CREATOR",
    createdAnimes: createdAnimesCount,
    purchasedAnimes: totalPurchases,
    levelInfo,
  });

  const stats = {
    purchaseCount: totalPurchases, postCount, watchSeconds,
    followers: followerCount, following: favoriteUserCount,
    favoriteCount: favoriteAnimes.length,
    giftsSent: await db.gift.count({ where: { senderId: user.id, status: { in: ["PENDING", "CLAIMED"] } } }),
    level: levelInfo.level,
    xp: xpTotal,
    xpToNext: Math.max(0, levelInfo.nextLevelXp - xpTotal),
    badges,
  };

  const currentlyWatching = latestProgress && latestProgress.anime && latestProgress.episode ? {
    anime: latestProgress.anime,
    episode: latestProgress.episode,
    position: latestProgress.position,
    duration: latestProgress.duration,
    updatedAt: latestProgress.updatedAt.toISOString(),
  } : null;

  const isOnline = Boolean(user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 3 * 60_000);

  return NextResponse.json({
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isVerified: isVerifiedByFollowerCount(followerCount),
      avatarUrl: user.avatarUrl || null,
      bannerUrl: user.bannerUrl || null,
      bio: user.bio,
      accentColor: user.accentColor,
      accentTo: user.accentTo || null,
      avatarFrame: user.avatarFrame || null,
      equippedAvatarFrameId: user.equippedAvatarFrameId,
      equippedNameFrameId: user.equippedNameFrameId,
      createdAt: user.createdAt,
      isOnline,
      lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
      // identity
      pronouns: user.pronouns || null,
      tagline: user.tagline || null,
      country: user.country || null,
      timezone: user.timezone || null,
      socialLinks: safeParse<Record<string, string>>(user.socialLinks, {}),
      statusEmoji: user.statusEmoji || null,
      statusText: user.statusText || null,
      showcase,
      bannerPreset: user.bannerPreset || null,
      favoriteGenres: isMe
        ? (user.favoriteGenres || "").split(",").filter(Boolean)
        : undefined,
      privacy: isMe ? privacy : undefined,
      canFollow: privacy.allowFollows,
      stats: {
        ...stats,
        purchaseCount: privacy.showCollection || isMe ? stats.purchaseCount : null,
        postCount: privacy.showActivity || isMe ? stats.postCount : null,
        watchSeconds: privacy.showWatchTime || isMe ? stats.watchSeconds : null,
        followers: privacy.showFollowers || isMe ? stats.followers : null,
        following: privacy.showFollowers || isMe ? stats.following : null,
        favoriteCount: privacy.showFavorites || isMe ? stats.favoriteCount : null,
      },
      achievements,
      currentlyWatching: privacy.showWatchTime || isMe ? currentlyWatching : null,
      favoriteAnimes: privacy.showFavorites || isMe ? favoriteAnimes : [],
      favoriteUsers: privacy.showFollowers || isMe ? favoriteUsersRows.map((f) => f.followed) : [],
      followersList: privacy.showFollowers || isMe ? followersRows.map((f) => f.follower) : [],
      ownedAnimes: privacy.showCollection || isMe ? ownedAnimes : [],
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
