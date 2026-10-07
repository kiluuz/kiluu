import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/community - feed of posts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") || "trending";
  const animeId = searchParams.get("animeId") || "";

  const where: Record<string, unknown> = {};
  if (animeId) where.animeId = animeId;

  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (tab === "top") orderBy = { createdAt: "desc" };

  let posts = await db.post.findMany({
    where,
    orderBy,
    take: 50,
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, role: true } },
      anime: { select: { id: true, slug: true, title: true, coverImage: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (tab === "top") {
    posts = posts.sort((a, b) => b._count.likes - a._count.likes);
  }

  const user = await getCurrentUser();
  let likedPostIds = new Set<string>();
  if (user) {
    const likes = await db.postLike.findMany({ where: { userId: user.id }, select: { postId: true } });
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      content: p.content,
      imageUrl: p.imageUrl,
      createdAt: p.createdAt,
      user: p.user,
      anime: p.anime,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      liked: likedPostIds.has(p.id),
    })),
  });
}

// POST /api/community - create a post
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to post" }, { status: 401 });

  try {
    const { content, animeId } = await req.json();
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json({ error: "Post content is required" }, { status: 400 });
    }
    if (content.length > 1000) {
      return NextResponse.json({ error: "Post must be under 1000 characters" }, { status: 400 });
    }

    const post = await db.post.create({
      data: {
        userId: user.id,
        content: content.trim(),
        animeId: animeId || null,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, role: true } },
        anime: { select: { id: true, slug: true, title: true, coverImage: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });

    return NextResponse.json({
      post: {
        id: post.id,
        content: post.content,
        imageUrl: post.imageUrl,
        createdAt: post.createdAt,
        user: post.user,
        anime: post.anime,
        likeCount: 0,
        commentCount: 0,
        liked: false,
      },
    }, { status: 201 });
  } catch (e) {
    console.error("create post error", e);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
