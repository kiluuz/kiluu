import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const BOT_API_URL = process.env.ANIME_BOT_API_URL;
const BOT_API_KEY = process.env.ANIME_BOT_API_KEY;

// POST /api/notify/[animeId] — subscribe to release notification
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ animeId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { animeId } = await params;

  const anime = await db.anime.findUnique({ where: { id: animeId }, select: { id: true, title: true } });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });

  await db.animeNotify.upsert({
    where: { userId_animeId: { userId: user.id, animeId } },
    create: { userId: user.id, animeId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

// DELETE /api/notify/[animeId] — unsubscribe
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ animeId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { animeId } = await params;

  await db.animeNotify.deleteMany({ where: { userId: user.id, animeId } });

  return NextResponse.json({ ok: true });
}

// GET /api/notify/[animeId] — check subscription status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ animeId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ subscribed: false });

  const { animeId } = await params;

  const row = await db.animeNotify.findUnique({
    where: { userId_animeId: { userId: user.id, animeId } },
  });

  return NextResponse.json({ subscribed: !!row });
}
