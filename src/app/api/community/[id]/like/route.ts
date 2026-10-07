import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/community/[id]/like - toggle like
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to like" }, { status: 401 });

  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const existing = await db.postLike.findUnique({
    where: { userId_postId: { userId: user.id, postId: id } },
  });

  if (existing) {
    await db.postLike.delete({ where: { id: existing.id } });
    const count = await db.postLike.count({ where: { postId: id } });
    return NextResponse.json({ liked: false, likeCount: count });
  } else {
    await db.postLike.create({ data: { userId: user.id, postId: id } });
    const count = await db.postLike.count({ where: { postId: id } });
    return NextResponse.json({ liked: true, likeCount: count });
  }
}
