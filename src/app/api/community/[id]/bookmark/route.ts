import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to bookmark" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  const { id } = await params;
  const result = await db.$transaction(async (tx) => {
    const post = await tx.post.findFirst({ where: { id, hidden: false }, select: { id: true } });
    if (!post) return null;
    const existing = await tx.postBookmark.findUnique({
      where: { userId_postId: { userId: user.id, postId: id } },
    });
    if (existing) {
      await tx.postBookmark.delete({ where: { id: existing.id } });
      return false;
    }
    await tx.postBookmark.create({ data: { userId: user.id, postId: id } });
    return true;
  });
  if (result === null) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  return NextResponse.json({ bookmarked: result });
}
