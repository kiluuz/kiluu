import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { evaluateAchievements } from "@/lib/achievements";

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const pending = await db.anime.findMany({
    where: { moderationStatus: "PENDING" },
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { username: true, displayName: true } },
      _count: { select: { episodes: true } },
    },
  });
  const reports = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ pending, reports });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { animeId, action, reason } = (await req.json()) as {
    animeId?: string;
    action?: string;
    reason?: string;
  };
  if (!animeId || !action) return NextResponse.json({ error: "animeId and action required" }, { status: 400 });
  const anime = await db.anime.findUnique({ where: { id: animeId } });
  if (!anime) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (action === "approve") {
    await db.$transaction([
      db.anime.update({
        where: { id: animeId },
        data: { moderationStatus: "APPROVED", hidden: false },
      }),
      db.animeVersion.updateMany({
        where: { animeId },
        data: { status: "published" },
      }),
    ]);
    if (anime.creatorId) await evaluateAchievements(anime.creatorId);
    return NextResponse.json({ ok: true, status: "APPROVED" });
  }
  if (action === "reject") {
    await db.$transaction([
      db.anime.update({
        where: { id: animeId },
        data: { moderationStatus: "REJECTED", hidden: true },
      }),
      db.animeVersion.updateMany({ where: { animeId }, data: { status: "rejected" } }),
    ]);
    return NextResponse.json({ ok: true, status: "REJECTED", reason: reason || null });
  }
  if (action === "takedown") {
    await db.$transaction([
      db.anime.update({
        where: { id: animeId },
        data: { moderationStatus: "TAKEDOWN", hidden: true },
      }),
      db.animeVersion.updateMany({ where: { animeId }, data: { status: "takedown" } }),
    ]);
    return NextResponse.json({ ok: true, status: "TAKEDOWN" });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
