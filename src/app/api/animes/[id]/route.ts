import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/animes/[id] - anime detail with episodes + ownership
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  const anime = await db.anime.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      episodes: { orderBy: { number: "asc" } },
      creator: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, role: true } },
      _count: { select: { purchases: true, favorites: true } },
    },
  });

  if (!anime) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }

  let owned = anime.isFree;
  let favorited = false;
  let progressMap: Record<string, { position: number; duration: number; completed: boolean }> = {};

  if (user) {
    const purchase = await db.purchase.findUnique({
      where: { userId_animeId: { userId: user.id, animeId: anime.id } },
    });
    if (purchase) owned = true;

    const fav = await db.favoriteAnime.findUnique({
      where: { userId_animeId: { userId: user.id, animeId: anime.id } },
    });
    favorited = !!fav;

    const progress = await db.watchProgress.findMany({
      where: { userId: user.id, animeId: anime.id },
    });
    progressMap = Object.fromEntries(
      progress.map((p) => [p.episodeId, { position: p.position, duration: p.duration, completed: p.completed }])
    );
  }

  const related = await db.anime.findMany({
    where: {
      id: { not: anime.id },
      OR: anime.genres.split(",").filter(Boolean).map((g) => ({ genres: { contains: g } })),
    },
    take: 6,
    orderBy: { rating: "desc" },
    select: { id: true, slug: true, title: true, coverImage: true, rating: true, isFree: true, price: true, year: true, type: true, genres: true },
  });

  return NextResponse.json({
    anime: {
      ...anime,
      genres: anime.genres.split(",").filter(Boolean),
      owned,
      favorited,
      purchaseCount: anime._count.purchases,
      favoriteCount: anime._count.favorites,
    },
    episodes: anime.episodes.map((e) => ({
      ...e,
      progress: progressMap[e.id] || null,
    })),
    related,
  });
}
