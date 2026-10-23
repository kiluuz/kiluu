import { NextResponse } from "next/server";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isCreator } from "@/lib/rbac";
import { getXpTotal } from "@/lib/xp";
import { calculateBadges, calculateLevel } from "@/lib/level-utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [nativePurchases, allBotOrders, createdAnimes, xpTotal] = await Promise.all([
    db.purchase.count({ where: { userId: user.id } }),
    db.order.count({ where: { site_user_id: user.id, status: { notIn: ["PENDING", "REFUNDED"] } } }),
    db.anime.count({ where: { creatorId: user.id } }),
    getXpTotal(user.id),
  ]);

  const totalPurchases = nativePurchases + allBotOrders;
  const levelInfo = calculateLevel(xpTotal);
  const badges = calculateBadges({
    isCreator: isCreator(user),
    createdAnimes,
    purchasedAnimes: totalPurchases,
    levelInfo,
  });

  return NextResponse.json({
    user: {
      ...toPublicUser(user),
      ownedCount: totalPurchases,
      level: levelInfo.level,
      xp: levelInfo.intoLevel,
      xpToNext: Math.max(0, levelInfo.nextLevelXp - levelInfo.xp),
      badges,
    },
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
