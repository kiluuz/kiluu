import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { db } from "@/lib/db";
import { isCommunityPostImageUrl } from "@/lib/r2";
import { canDeleteCommunityPost, COMMUNITY_CATEGORIES } from "@/lib/community";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { getXpTotal, levelFromXp } from "@/lib/xp";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await db.post.findFirst({
    where: { id, hidden: false },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          accentColor: true,
          role: true,
        },
      },
      anime: { select: { id: true, slug: true, title: true, coverImage: true } },
      _count: { select: { likes: true, comments: true, awards: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  const xpTotal = await getXpTotal(post.userId);
  const viewer = await getCurrentUser();
  const [liked, bookmarked, following] = viewer && viewer.id !== post.userId
    ? await Promise.all([
        db.postLike.count({ where: { userId: viewer.id, postId: id } }),
        db.postBookmark.count({ where: { userId: viewer.id, postId: id } }),
        db.follow.count({ where: { followerId: viewer.id, followedId: post.userId } }),
      ])
    : [0, 0, 0];
  return NextResponse.json({
    post: {
      ...post,
      type: post.category,
      isSpoiler: post.spoiler,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      awardCount: post._count.awards,
      liked: liked > 0,
      bookmarked: bookmarked > 0,
      user: {
        ...post.user,
        level: levelFromXp(xpTotal).level,
        following: following > 0,
      },
    },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (post.userId !== user.id) return NextResponse.json({ error: "You can only edit your own posts" }, { status: 403 });
  if (!rateLimit(`community-edit:${user.id}`, 20, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many edits. Please try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const content = typeof body.content === "string" ? sanitizeText(body.content, 1000) : post.content;
  const category = typeof body.category === "string" ? body.category : post.category;
  const rating = body.rating === null ? null : body.rating === undefined ? post.rating : Number(body.rating);
  const imageUrl = body.imageUrl === null ? null : typeof body.imageUrl === "string" ? body.imageUrl : undefined;
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
  if (body.imageUrl !== undefined && body.imageUrl !== null &&
      (typeof body.imageUrl !== "string" || !isCommunityPostImageUrl(body.imageUrl))) {
    return NextResponse.json({ error: "Invalid post image" }, { status: 400 });
  }
  const updated = await db.post.update({
    where: { id },
    data: {
      content,
      category,
      rating,
      spoiler: typeof body.spoiler === "boolean" ? body.spoiler : post.spoiler,
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    },
  });
  return NextResponse.json({ post: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id }, select: { id: true, userId: true } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (!canDeleteCommunityPost(post.userId, user.id, isAdminUser(user))) {
    return NextResponse.json({ error: "You can only delete your own posts" }, { status: 403 });
  }
  await db.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
