import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/home - hero + rows for home page
export async function GET() {
  const user = await getCurrentUser();

  const [featured, trending, newReleases, topRated, freeAnimes, allGenres] = await Promise.all([
    db.anime.findMany({ where: { featured: true }, orderBy: { trending: "desc" }, take: 5 }),
    db.anime.findMany({ orderBy: { trending: "desc" }, take: 12 }),
    db.anime.findMany({ orderBy: { year: "desc" }, take: 12 }),
    db.anime.findMany({ orderBy: { rating: "desc" }, take: 10 }),
    db.anime.findMany({ where: { isFree: true }, orderBy: { rating: "desc" }, take: 12 }),
    db.anime.findMany({ select: { genres: true } }),
  ]);

  let continueWatching: Array<{
    animeId: string;
    animeTitle: string;
    coverImage: string;
    bannerImage: string | null;
    episodeId: string;
    episodeNumber: number;
    episodeTitle: string;
    position: number;
    duration: number;
  }> = [];

  if (user) {
    const progress = await db.watchProgress.findMany({
      where: { userId: user.id, completed: false, position: { gt: 10 } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        anime: { select: { id: true, title: true, coverImage: true, bannerImage: true } },
        episode: { select: { id: true, number: true, title: true } },
      },
    });
    continueWatching = progress.map((p) => ({
      animeId: p.anime.id,
      animeTitle: p.anime.title,
      coverImage: p.anime.coverImage,
      bannerImage: p.anime.bannerImage,
      episodeId: p.episode.id,
      episodeNumber: p.episode.number,
      episodeTitle: p.episode.title,
      position: p.position,
      duration: p.duration,
    }));
  }

  const genreSet = new Set<string>();
  allGenres.forEach((a) => a.genres.split(",").filter(Boolean).forEach((g) => genreSet.add(g)));

  const mapAnime = (a: (typeof trending)[number]) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    coverImage: a.coverImage,
    bannerImage: a.bannerImage,
    rating: a.rating,
    year: a.year,
    type: a.type,
    genres: a.genres.split(",").filter(Boolean),
    isFree: a.isFree,
    price: a.price,
    description: a.description,
  });

  return NextResponse.json({
    featured: featured.map(mapAnime),
    trending: trending.map(mapAnime),
    newReleases: newReleases.map(mapAnime),
    topRated: topRated.map(mapAnime),
    freeAnimes: freeAnimes.map(mapAnime),
    continueWatching,
    genres: Array.from(genreSet).sort(),
  });
}
