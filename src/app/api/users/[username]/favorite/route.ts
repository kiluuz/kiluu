import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/users/[username]/favorite - toggle favorite user
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const { username } = await params;
  const target = await db.user.findUnique({ where: { username } });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === me.id) {
    return NextResponse.json({ error: "You cannot favorite yourself" }, { status: 400 });
  }

  const existing = await db.favoriteUser.findUnique({
    where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
  });

  if (existing) {
    await db.favoriteUser.delete({ where: { id: existing.id } });
    return NextResponse.json({ following: false });
  } else {
    await db.favoriteUser.create({ data: { followerId: me.id, followingId: target.id } });
    return NextResponse.json({ following: true });
  }
}
