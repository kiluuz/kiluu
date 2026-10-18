import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCommunityNotification } from "@/lib/community";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to follow users" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  if (!rateLimit(`community-follow:${user.id}`, 60, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many follow changes. Please try again later." }, { status: 429 });
  }
  const { id: followedId } = await params;
  if (followedId === user.id) return NextResponse.json({ error: "You cannot follow yourself" }, { status: 400 });

  const result = await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id: followedId }, select: { id: true } });
    if (!target) return null;
    const existing = await tx.follow.findUnique({
      where: { followerId_followedId: { followerId: user.id, followedId } },
    });
    if (existing) {
      await tx.follow.delete({ where: { id: existing.id } });
      return false;
    }
    await tx.follow.create({ data: { followerId: user.id, followedId } });
    await createCommunityNotification(
      tx,
      followedId,
      user.id,
      "FOLLOW",
      "New follower",
      `${user.displayName || user.username} followed you`,
      { userId: user.id }
    );
    return true;
  });
  if (result === null) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ following: result });
}
