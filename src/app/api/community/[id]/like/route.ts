import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCommunityNotification } from "@/lib/community";
import { rateLimit } from "@/lib/rate-limit";
import { awardXpInTransaction } from "@/lib/xp";
import { evaluateAchievements } from "@/lib/achievements";
import { emitEvent } from "@/lib/events";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to like" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  if (!rateLimit(`community-like:${user.id}`, 120, 10 * 60_000)) {
    return NextResponse.json({ error: "Too many reactions. Please try again later." }, { status: 429 });
  }
  const { id } = await params;
  const result = await db.$transaction(async (tx) => {
    const post = await tx.post.findFirst({ where: { id, hidden: false } });
    if (!post) return null;
    const existing = await tx.postLike.findUnique({
      where: { userId_postId: { userId: user.id, postId: id } },
    });
    const liked = !existing;
    if (existing) {
      await tx.postLike.delete({ where: { id: existing.id } });
    } else {
      await tx.postLike.create({ data: { userId: user.id, postId: id } });
      if (post.userId !== user.id) {
        await awardXpInTransaction(tx, post.userId, "like_received", `${id}:${user.id}`);
      }
      await createCommunityNotification(tx, post.userId, user.id, "LIKE", "Post liked", `${user.displayName || user.username} liked your post`, { postId: id });
    }
    return {
      liked,
      authorId: post.userId,
      likeCount: await tx.postLike.count({ where: { postId: id } }),
    };
  });
  if (!result) return NextResponse.json({ error: "Post not found" }, { status: 404 });
  if (result.authorId !== user.id) {
    await evaluateAchievements(result.authorId);
  }
  if (result.liked) {
    await emitEvent(user, "like_given", { postId: id, authorId: result.authorId });
  }
  return NextResponse.json({ liked: result.liked, likeCount: result.likeCount });
}
