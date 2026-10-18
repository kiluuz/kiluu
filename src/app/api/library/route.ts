import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/library - user owned animes + favorites + stats
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [purchases, favorites, progressStats, orderRows, ledger] = await Promise.all([
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
    db.order.findMany({
      where: { site_user_id: user.id, status: { in: ["COMPLETED", "PAID_PENDING_GRANT"] } },
      orderBy: { createdAt: "desc" },
      select: { anime_slug: true, createdAt: true },
    }),
    db.creditTransaction.aggregate({
      where: { userId: user.id },
      _sum: { amount: true },
    }),
  ]);

  const watchEvents = await db.watchEvent.aggregate({
    where: { userId: user.id },
    _sum: { seconds: true },
  });
  const totalWatchSeconds = watchEvents._sum.seconds ?? 0;
  const completedCount = progressStats.filter((p) => p.completed).length;
  const orderAnimes = orderRows.length
    ? await db.anime.findMany({
        where: { slug: { in: orderRows.map((order) => order.anime_slug) } },
        include: { _count: { select: { episodes: true } } },
      })
    : [];
  const animeBySlug = new Map(orderAnimes.map((anime) => [anime.slug, anime]));
  const ownedItems = new Map<string, (typeof purchases)[number]["anime"]>(
    purchases.map((purchase) => [purchase.anime.id, purchase.anime])
  );
  for (const anime of orderAnimes) ownedItems.set(anime.id, anime);
  const owned = [...ownedItems.values()];
  const starsPurchases = orderRows.flatMap((order) => {
    const anime = animeBySlug.get(order.anime_slug);
    return anime ? [{ anime, purchasedAt: order.createdAt }] : [];
  });

  return NextResponse.json({
    owned: owned.map((anime) => ({
      id: anime.id,
      slug: anime.slug,
      title: anime.title,
      coverImage: anime.coverImage,
      rating: anime.rating,
      year: anime.year,
      type: anime.type,
      genres: anime.genres.split(",").filter(Boolean),
      isFree: anime.isFree,
      price: anime.price,
      episodeCount: anime._count.episodes,
      purchasedAt: purchases.find((purchase) => purchase.anime.id === anime.id)?.createdAt ??
        orderRows.find((order) => order.anime_slug === anime.slug)?.createdAt,
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
      purchaseCount: owned.length,
      totalWatchSeconds,
      completedEpisodes: completedCount,
      exchangeUnlocked: owned.length >= 20,
      credits: ledger._sum.amount ?? 0,
    },
    starsPurchases: starsPurchases.map(({ anime, purchasedAt }) => ({
      id: anime.id,
      slug: anime.slug,
      title: anime.title,
      coverImage: anime.coverImage,
      rating: anime.rating,
      year: anime.year,
      type: anime.type,
      genres: anime.genres.split(",").filter(Boolean),
      isFree: anime.isFree,
      price: anime.price,
      episodeCount: anime._count.episodes,
      purchasedAt,
    })),
  });
}
