import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canFollowProfile, parseProfilePrivacy } from "@/lib/profile-privacy";
import { evaluateAchievements } from "@/lib/achievements";

// POST /api/users/[username]/favorite - follow a profile
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const { username } = await params;
  const target = await db.user.findUnique({ where: { username } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const privacy = parseProfilePrivacy(target.privacy);
  if (target.id === me.id) {
    return NextResponse.json({ error: "You cannot favorite yourself" }, { status: 400 });
  }

  const existing = await db.follow.findUnique({
    where: { followerId_followedId: { followerId: me.id, followedId: target.id } },
  });

  if (!existing) {
    if (!canFollowProfile(privacy, false)) {
      return NextResponse.json({ error: "This user does not allow follows" }, { status: 403 });
    }
  }
  await db.follow.upsert({
    where: { followerId_followedId: { followerId: me.id, followedId: target.id } },
    create: { followerId: me.id, followedId: target.id },
    update: {},
  });
  if (!existing) await evaluateAchievements(target.id);
  return NextResponse.json({ following: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });
  const { username } = await params;
  const target = await db.user.findUnique({ where: { username }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === me.id) return NextResponse.json({ error: "You cannot unfollow yourself" }, { status: 400 });

  const removed = await db.follow.deleteMany({
    where: { followerId: me.id, followedId: target.id },
  });
  if (removed.count > 0) await evaluateAchievements(target.id);
  return NextResponse.json({ following: false });
}
