import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false });

  // Neon DB tejamkorligi: agar oxirgi 45 soniyada yangilangan bo'lsa, qayta yozmaymiz
  if (user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 45_000) {
    return NextResponse.json({ ok: true, cached: true });
  }

  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userIdsParam = searchParams.get("userIds");
  if (!userIdsParam) return NextResponse.json({ onlineUserIds: [] });

  const ids = userIdsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ onlineUserIds: [] });

  // 3 daqiqa ichida faol bo'lganlar online hisoblanadi
  const cutoff = new Date(Date.now() - 3 * 60_000);
  const activeUsers = await db.user.findMany({
    where: {
      id: { in: ids.slice(0, 100) },
      lastSeenAt: { gte: cutoff },
    },
    select: { id: true },
  });

  return NextResponse.json({
    onlineUserIds: activeUsers.map((u) => u.id),
  });
}
