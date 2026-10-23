import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateAchievements } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (user) {
    try {
      await evaluateAchievements(user.id);
    } catch (error) {
      console.error("Failed to evaluate achievements in frames route:", error);
    }
  }
  const [owned, equipped] = await Promise.all([
    user ? db.userFrame.findMany({ where: { userId: user.id }, select: { frameId: true } }) : [],
    user ? db.user.findUnique({
      where: { id: user.id },
      select: { equippedAvatarFrameId: true, equippedNameFrameId: true },
    }) : null,
  ]);
  return NextResponse.json({
    ownedIds: owned.map((item) => item.frameId),
    equipped: {
      avatar: equipped?.equippedAvatarFrameId ?? null,
      name: equipped?.equippedNameFrameId ?? null,
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
