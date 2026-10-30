import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewProfile, parseProfilePrivacy } from "@/lib/profile-privacy";
import { getUserAchievementStates } from "@/lib/achievements";
import { getXpTotal, levelFromXp } from "@/lib/xp";
import { Prisma } from "@prisma/client";
import { sqlTable } from "@/lib/sql-table";
import { isVerifiedByFollowerCount } from "@/lib/verification";
import { giftRarityRankById, collectibleRarity } from "@/lib/gift-rarity";
import { animeDubSignals, dubTeamTitle } from "@/lib/dub-teams";
import { canonicalRole, clientRole } from "@/lib/rbac";

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
    const isCreatorCard = canonicalRole(user.role) === "creator";
    const createdCardCount = isCreatorCard
      ? await db.anime.count({ where: { creatorId: user.id, hidden: false } })
      : 0;
    const isOnline = Boolean(user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 3 * 60_000);

    return NextResponse.json({
      profile: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: clientRole(user.role),
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
        pronouns: isCreatorCard ? null : user.pronouns || null,
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
          purchaseCount: isCreatorCard ? createdCardCount : privacy.showCollection || isMe ? count(stats.purchaseCount) : null,
          postCount: privacy.showActivity || isMe ? count(stats.postCount) : null,
          watchSeconds: isCreatorCard ? null : privacy.showWatchTime || isMe ? count(stats.watchSeconds ?? 0) : null,
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
        receivedGifts: [],
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
    favoriteAnimesRows,
    ownedRows, orderRows, postCount, postsRows, latestProgress, favoriteUserCount, followerCount,
  ] = await Promise.all([
    db.favoriteAnime.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { anime: { select: ANIME_CARD } },
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
  const isCreatorAccount = canonicalRole(user.role) === "creator";
  const createdAnimesCount = await db.anime.count({ where: { creatorId: user.id } });
  const totalPurchases = purchaseCount;
  const [xpTotal, achievements] = await Promise.all([
    getXpTotal(user.id),
    getUserAchievementStates(user.id),
  ]);
  const levelInfo = calculateLevel(xpTotal);
  const badges = calculateBadges({
    isCreator: isCreatorAccount,
    createdAnimes: createdAnimesCount,
    purchasedAnimes: totalPurchases,
    levelInfo,
  });

  const createdAnimesRows = isCreatorAccount
    ? await db.anime.findMany({
        where: { creatorId: user.id, hidden: false },
        orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
        take: 60,
        select: ANIME_CARD,
      })
    : [];
  const createdVisibleCount = isCreatorAccount
    ? await db.anime.count({ where: { creatorId: user.id, hidden: false } })
    : 0;

  const stats = {
    purchaseCount: isCreatorAccount ? createdVisibleCount : totalPurchases,
    postCount,
    watchSeconds: isCreatorAccount ? null : watchSeconds,
    followers: followerCount,
    following: favoriteUserCount,
    favoriteCount: isCreatorAccount ? null : favoriteAnimes.length,
    giftsSent: isCreatorAccount ? 0 : await db.gift.count({ where: { senderId: user.id, status: { in: ["PENDING", "CLAIMED"] } } }),
    level: levelInfo.level,
    xp: xpTotal,
    xpToNext: Math.max(0, levelInfo.nextLevelXp - xpTotal),
    badges,
  };

  const ownedTeam = isCreatorAccount
    ? await db.dubTeam.findFirst({
        where: { ownerId: user.id, status: "active" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          avatarUrl: true,
          reputation: true,
          verified: true,
          _count: { select: { members: true } },
        },
      })
    : null;
  const teamMembers = ownedTeam
    ? await db.dubTeamMember.findMany({
        where: { teamId: ownedTeam.id },
        orderBy: { createdAt: "asc" },
        take: 60,
        select: { id: true, name: true, role: true, user: { select: USER_MINI } },
      })
    : [];

  const currentlyWatching = latestProgress && latestProgress.anime && latestProgress.episode ? {
    anime: latestProgress.anime,
    episode: latestProgress.episode,
    position: latestProgress.position,
    duration: latestProgress.duration,
    updatedAt: latestProgress.updatedAt.toISOString(),
  } : null;

  const isOnline = Boolean(user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 3 * 60_000);

  const receivedGiftRows = !isCreatorAccount && (privacy.showCollection || isMe)
    ? await db.gift.findMany({
        where: {
          status: "CLAIMED",
          OR: [
            { recipientId: user.id },
            { recipientUsername: user.username.toLowerCase() },
          ],
        },
        include: {
          anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true } },
          sender: { select: { username: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 60,
      })
    : [];
  const receivedSignals = await animeDubSignals([...new Set(receivedGiftRows.map((gift) => gift.animeId))]);
  const receivedGifts = receivedGiftRows
    .map((gift) => ({
      gift,
      rarity: collectibleRarity({
        price: gift.pricePaid,
        rating: gift.anime.rating,
        speakerCount: receivedSignals.get(gift.animeId)?.speakerCount,
        teamReputation: receivedSignals.get(gift.animeId)?.teamReputation,
      }).id,
    }))
    .sort((a, b) => giftRarityRankById(a.rarity, a.gift.pricePaid) - giftRarityRankById(b.rarity, b.gift.pricePaid) || b.gift.createdAt.getTime() - a.gift.createdAt.getTime())
    .slice(0, 30)
    .map(({ gift, rarity }) => ({
      id: gift.id,
      pricePaid: gift.pricePaid,
      message: gift.message,
      createdAt: gift.createdAt.toISOString(),
      claimedAt: gift.claimedAt?.toISOString() ?? null,
      rarity,
      anime: gift.anime,
      sender: gift.sender,
    }));

  const dubMembership = await db.dubTeamMember.findFirst({
    where: { userId: user.id, team: { status: "active" } },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          avatarUrl: true,
          reputation: true,
          verified: true,
          owner: { select: { username: true } },
          _count: { select: { members: true } },
        },
      },
    },
  });

  return NextResponse.json({
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: clientRole(user.role),
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
      pronouns: isCreatorAccount ? null : user.pronouns || null,
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
        purchaseCount: isCreatorAccount || privacy.showCollection || isMe ? stats.purchaseCount : null,
        postCount: privacy.showActivity || isMe ? stats.postCount : null,
        watchSeconds: isCreatorAccount ? null : privacy.showWatchTime || isMe ? stats.watchSeconds : null,
        followers: privacy.showFollowers || isMe ? stats.followers : null,
        following: privacy.showFollowers || isMe ? stats.following : null,
        favoriteCount: privacy.showFavorites || isMe ? stats.favoriteCount : null,
      },
      achievements,
      currentlyWatching: isCreatorAccount ? null : privacy.showWatchTime || isMe ? currentlyWatching : null,
      favoriteAnimes: isCreatorAccount ? [] : privacy.showFavorites || isMe ? favoriteAnimes : [],
      favoriteUsers: [],
      followersList: [],
      ownedAnimes: isCreatorAccount
        ? createdAnimesRows
        : privacy.showCollection || isMe ? ownedAnimes : [],
      createdAnimes: createdAnimesRows,
      teamMembers,
      receivedGifts,
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
      watchSeconds: isCreatorAccount ? null : privacy.showWatchTime || isMe ? watchSeconds : null,
      dubTeam: ownedTeam
        ? {
            id: ownedTeam.id,
            name: ownedTeam.name,
            slug: ownedTeam.slug,
            avatarUrl: ownedTeam.avatarUrl,
            reputation: ownedTeam.reputation,
            verified: ownedTeam.verified,
            memberCount: ownedTeam._count.members + 1,
            role: "owner",
            title: dubTeamTitle(ownedTeam.reputation, ownedTeam.verified),
            ownerUsername: user.username,
            isOwner: true,
          }
        : dubMembership
          ? {
              id: dubMembership.team.id,
              name: dubMembership.team.name,
              slug: dubMembership.team.slug,
              avatarUrl: dubMembership.team.avatarUrl,
              reputation: dubMembership.team.reputation,
              verified: dubMembership.team.verified,
              memberCount: dubMembership.team._count.members,
              role: dubMembership.role,
              title: dubTeamTitle(dubMembership.team.reputation, dubMembership.team.verified),
              ownerUsername: dubMembership.team.owner?.username ?? null,
              isOwner: false,
            }
          : null,
      isFollowing,
      isMe,
    },
  });
}
