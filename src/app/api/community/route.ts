import { after, NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCommunityPostImageUrl } from "@/lib/r2";
import { COMMUNITY_CATEGORIES } from "@/lib/community";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { awardXpInTransaction, getXpTotals, levelFromXp } from "@/lib/xp";
import { evaluateAchievements } from "@/lib/achievements";
import { isVerifiedByFollowerCount } from "@/lib/verification";

const USER_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  accentColor: true,
  role: true,
} as const;

const POST_INCLUDE = {
  user: { select: USER_FIELDS },
  anime: { select: { id: true, slug: true, title: true, coverImage: true } },
  _count: { select: { likes: true, comments: true, awards: true } },
} as const;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const tab = params.get("tab") || "latest";
  const category = params.get("category");
  const animeId = params.get("animeId");
  const cursor = params.get("cursor");
  const limit = Math.min(30, Math.max(1, Number(params.get("limit")) || 20));
  const user = await getCurrentUser();

  if (!["latest", "top", "following"].includes(tab)) {
    return NextResponse.json({ error: "Invalid feed" }, { status: 400 });
  }
  if (category && !COMMUNITY_CATEGORIES.includes(category as (typeof COMMUNITY_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (tab === "following" && !user) {
    return NextResponse.json({ posts: [], nextCursor: null });
  }

  const followed = user && tab === "following"
    ? await db.follow.findMany({ where: { followerId: user.id }, select: { followedId: true } })
    : [];
  const followingIds = followed.map((item) => item.followedId);
  if (tab === "following" && followingIds.length === 0) {
    return NextResponse.json({ posts: [], nextCursor: null });
  }

  const records = await db.post.findMany({
    where: {
      hidden: false,
      ...(category ? { category } : {}),
      ...(animeId ? { animeId } : {}),
      ...(tab === "following" ? { userId: { in: followingIds } } : {}),
    },
    orderBy: tab === "top"
      ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }]
      : [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: POST_INCLUDE,
  });
  const hasMore = records.length > limit;
  const posts = records.slice(0, limit);
  const postIds = posts.map((post) => post.id);
  const [liked, bookmarked] = user && postIds.length
    ? await Promise.all([
        db.postLike.findMany({ where: { userId: user.id, postId: { in: postIds } }, select: { postId: true } }),
        db.postBookmark.findMany({ where: { userId: user.id, postId: { in: postIds } }, select: { postId: true } }),
      ])
    : [[], []];
  const likedIds = new Set(liked.map((row) => row.postId));
  const bookmarkedIds = new Set(bookmarked.map((row) => row.postId));
  const authors = [...new Set(posts.map((post) => post.userId))];
  const followedAuthors = user && authors.length
    ? await db.follow.findMany({
        where: { followerId: user.id, followedId: { in: authors } },
        select: { followedId: true },
      })
    : [];
  const followedIds = new Set(followedAuthors.map((row) => row.followedId));
  const xpTotals = await getXpTotals(authors);
  const followerCounts = authors.length
    ? await db.follow.groupBy({
        by: ["followedId"],
        where: { followedId: { in: authors } },
        _count: { _all: true },
      })
    : [];
  const followerCountByAuthor = new Map(followerCounts.map((row) => [row.followedId, row._count._all]));

  return NextResponse.json({
    posts: posts.map((post) => ({
      ...post,
      type: post.category,
      isSpoiler: post.spoiler,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      awardCount: post._count.awards,
      liked: likedIds.has(post.id),
      bookmarked: bookmarkedIds.has(post.id),
      user: {
        ...post.user,
        isVerified: isVerifiedByFollowerCount(followerCountByAuthor.get(post.userId) ?? 0),
        level: levelFromXp(xpTotals.get(post.userId) ?? 0).level,
        following: followedIds.has(post.userId),
      },
    })),
    nextCursor: hasMore ? posts[posts.length - 1]?.id ?? null : null,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to post" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  if (!rateLimit(`community-post:${user.id}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: "Posting too quickly. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? sanitizeText(body.content, 1000) : "";
  const category = typeof body.category === "string" ? body.category : "Discussions";
  const rating = body.rating === undefined || body.rating === null ? null : Number(body.rating);
  const animeId = typeof body.animeId === "string" && body.animeId ? body.animeId : null;
  const imageUrl = typeof body.imageUrl === "string" && isCommunityPostImageUrl(body.imageUrl)
    ? body.imageUrl
    : null;

  if (!content) return NextResponse.json({ error: "Post content is required" }, { status: 400 });
  if (!COMMUNITY_CATEGORIES.includes(category as (typeof COMMUNITY_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) {
    return NextResponse.json({ error: "Rating must be between 1 and 10" }, { status: 400 });
  }
  if (category === "Reviews" && rating === null) {
    return NextResponse.json({ error: "Reviews require a rating from 1 to 10" }, { status: 400 });
  }
  if (body.imageUrl && !imageUrl) return NextResponse.json({ error: "Invalid post image" }, { status: 400 });

  const created = await db.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        userId: user.id,
        content,
        category,
        rating,
        spoiler: body.spoiler === true,
        animeId,
        imageUrl,
      },
      include: POST_INCLUDE,
    });
    const xpAward = await awardXpInTransaction(tx, user.id, "post", post.id);
    const xpTotal = xpAward?.xpTotal ?? Math.max(
      0,
      (await tx.xpEvent.aggregate({ where: { userId: user.id }, _sum: { amount: true } }))._sum.amount ?? 0,
    );
    return { post, xpTotal };
  });
  const followerCount = await db.follow.count({ where: { followedId: user.id } });
  after(async () => {
    try {
      await evaluateAchievements(user.id);
    } catch (error) {
      console.error("Community post achievement evaluation failed", {
        postId: created.post.id,
        userId: user.id,
        error,
      });
    }
  });

  return NextResponse.json({
    post: {
      ...created.post,
      type: created.post.category,
      isSpoiler: created.post.spoiler,
      likeCount: 0,
      commentCount: 0,
      awardCount: 0,
      liked: false,
      bookmarked: false,
      user: {
        ...created.post.user,
        isVerified: isVerifiedByFollowerCount(followerCount),
        level: levelFromXp(created.xpTotal).level,
        following: false,
      },
    },
  }, { status: 201 });
}
