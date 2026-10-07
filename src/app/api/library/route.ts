import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/library - user owned animes + favorites + stats
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [purchases, favorites, progressStats] = await Promise.all([
    db.purchase.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        anime: {
          include: { _count: { select: { episodes: true } } },
        },
      },
    }),
    db.favoriteAnime.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        anime: {
          include: { _count: { select: { episodes: true } } },
        },
      },
    }),
    db.watchProgress.findMany({
      where: { userId: user.id },
      include: { anime: { select: { title: true } }, episode: { select: { duration: true } } },
    }),
  ]);

  const totalWatchSeconds = progressStats.reduce((acc, p) => acc + Math.min(p.position, p.duration || p.position), 0);
  const completedCount = progressStats.filter((p) => p.completed).length;

  return NextResponse.json({
    owned: purchases.map((p) => ({
      id: p.anime.id,
      slug: p.anime.slug,
      title: p.anime.title,
      coverImage: p.anime.coverImage,
      rating: p.anime.rating,
      year: p.anime.year,
      type: p.anime.type,
      genres: p.anime.genres.split(",").filter(Boolean),
      isFree: p.anime.isFree,
      price: p.anime.price,
      episodeCount: p.anime._count.episodes,
      purchasedAt: p.createdAt,
    })),
    favorites: favorites.map((p) => ({
      id: p.anime.id,
      slug: p.anime.slug,
      title: p.anime.title,
      coverImage: p.anime.coverImage,
      rating: p.anime.rating,
      year: p.anime.year,
      type: p.anime.type,
      genres: p.anime.genres.split(",").filter(Boolean),
      isFree: p.anime.isFree,
      price: p.anime.price,
      episodeCount: p.anime._count.episodes,
    })),
    stats: {
      purchaseCount: purchases.length,
      totalWatchSeconds,
      completedEpisodes: completedCount,
      exchangeUnlocked: purchases.length >= 20,
      credits: user.credits,
    },
  });
}
