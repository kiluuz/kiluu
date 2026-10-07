import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/animes/[id]/favorite - toggle favorite anime
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  const { id } = await params;
  const anime = await db.anime.findFirst({ where: { OR: [{ id }, { slug: id }] } });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });

  const existing = await db.favoriteAnime.findUnique({
    where: { userId_animeId: { userId: user.id, animeId: anime.id } },
  });

  if (existing) {
    await db.favoriteAnime.delete({ where: { id: existing.id } });
    return NextResponse.json({ favorited: false });
  } else {
    await db.favoriteAnime.create({ data: { userId: user.id, animeId: anime.id } });
    return NextResponse.json({ favorited: true });
  }
}
