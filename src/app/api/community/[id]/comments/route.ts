import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/community/[id]/comments
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const comments = await db.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, role: true } },
    },
  });
  return NextResponse.json({ comments });
}

// POST /api/community/[id]/comments - add comment
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to comment" }, { status: 401 });

  try {
    const { id } = await params;
    const { content } = await req.json();
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
    }
    if (content.length > 500) {
      return NextResponse.json({ error: "Comment must be under 500 characters" }, { status: 400 });
    }

    const post = await db.post.findUnique({ where: { id } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const comment = await db.comment.create({
      data: { userId: user.id, postId: id, content: content.trim() },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, role: true } },
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    console.error("comment error", e);
    return NextResponse.json({ error: "Failed to comment" }, { status: 500 });
  }
}
