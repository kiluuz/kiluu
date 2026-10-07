import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/users/[username] - public profile (Discord style data)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const me = await getCurrentUser();

  const user = await db.user.findUnique({
    where: { username },
    include: {
      _count: { select: { posts: true } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [purchaseCount, favoriteAnimes, favoriteUsers, followers, recentPurchases, postCount] = await Promise.all([
    db.purchase.count({ where: { userId: user.id } }),
    db.favoriteAnime.findMany({
      where: { userId: user.id },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true, year: true } } },
    }),
    db.favoriteUser.findMany({
      where: { followerId: user.id },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { following: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true } } },
    }),
    db.favoriteUser.findMany({
      where: { followingId: user.id },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { follower: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true } } },
    }),
    db.purchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true } } },
    }),
    db.post.count({ where: { userId: user.id } }),
  ]);

  // Watch time
  const progress = await db.watchProgress.findMany({
    where: { userId: user.id },
    select: { position: true, duration: true },
  });
  const watchSeconds = progress.reduce((acc, p) => acc + Math.min(p.position, p.duration || p.position), 0);

  let isFollowing = false;
  if (me) {
    const rel = await db.favoriteUser.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: user.id } },
    });
    isFollowing = !!rel;
  }

  return NextResponse.json({
    profile: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      accentColor: user.accentColor,
      createdAt: user.createdAt,
      stats: {
        purchaseCount,
        postCount,
        watchSeconds,
        followers: followers.length,
        following: favoriteUsers.length,
        exchangeUnlocked: purchaseCount >= 20,
      },
      favoriteAnimes: favoriteAnimes.map((f) => f.anime),
      favoriteUsers: favoriteUsers.map((f) => f.following),
      followersList: followers.map((f) => f.follower),
      recentAnimes: recentPurchases.map((p) => p.anime),
      isFollowing,
      isMe: me ? me.id === user.id : false,
    },
  });
}
