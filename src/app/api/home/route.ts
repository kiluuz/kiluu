import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { unstable_cache } from "next/cache";
import { rankAnimeByFavoriteGenres } from "@/lib/anime-preferences";

// ─── Cached public home data (60 s revalidation, tag: "home") ────────────────
const getCachedHomeData = unstable_cache(
  async () => {
    const live = { hidden: false, moderationStatus: "APPROVED" as const };
    const [featured, trending, newReleases, topRated, freeAnimes, allGenres] =
      await Promise.all([
        db.anime.findMany({
          where: { ...live, featured: true },
          orderBy: { trending: "desc" },
          take: 5,
        }),
        db.anime.findMany({
          where: live,
          orderBy: { trending: "desc" },
          take: 12,
        }),
        db.anime.findMany({
          where: live,
          orderBy: { year: "desc" },
          take: 12,
        }),
        db.anime.findMany({
          where: live,
          orderBy: { rating: "desc" },
          take: 10,
        }),
        db.anime.findMany({
          where: { ...live, isFree: true },
          orderBy: { rating: "desc" },
          take: 12,
        }),
        db.anime.findMany({ where: live, select: { genres: true } }),
      ]);

    const genreSet = new Set<string>();
    allGenres
      .forEach((a) =>
        a.genres
          .split(",")
          .filter(Boolean)
          .forEach((g) => genreSet.add(g))
      );

    const homeFeatured = featured.length > 0 ? featured : trending.slice(0, 5);

    type AnimeRow = (typeof trending)[number];
    const mapAnime = (a: AnimeRow, recommended = false) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      coverImage: a.coverImage,
      bannerImage: a.bannerImage,
      featured: a.featured,
      recommended,
      rating: a.rating,
      year: a.year,
      type: a.type,
      genres: a.genres.split(",").filter(Boolean),
      isFree: a.isFree,
      price: a.price,
      description: a.description,
      source: a.source,
      creator: null as { username: string; displayName: string | null } | null,
    });

    return {
      featured: homeFeatured.map((anime) => mapAnime(anime)),
      trending: trending.map((anime) => mapAnime(anime)),
      newReleases: newReleases.map((anime) => mapAnime(anime)),
      topRated: topRated.map((anime) => mapAnime(anime)),
      freeAnimes: freeAnimes.map((anime) => mapAnime(anime)),
      genres: Array.from(genreSet).sort(),
    };
  },
  ["home-public"],
  { revalidate: 60, tags: ["home"] }
);

// GET /api/home - hero + rows for home page
export async function GET() {
  const user = await getCurrentUser();

  // Public data is cached; user-specific data (continueWatching, owned) is not
  const publicData = await getCachedHomeData();

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

  let ownedIds = new Set<string>();
  let personalizedFeatured: typeof publicData.featured = [];

  if (user) {
    const favoriteGenres = user.favoriteGenres.split(",").map((genre) => genre.trim()).filter(Boolean);
    const [progress, purchases, recommendations] = await Promise.all([
      db.watchProgress.findMany({
        where: { userId: user.id, completed: false, position: { gt: 10 } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          anime: {
            select: { id: true, title: true, coverImage: true, bannerImage: true },
          },
          episode: { select: { id: true, number: true, title: true } },
        },
      }),
      db.purchase.findMany({
        where: { userId: user.id },
        select: { animeId: true },
      }),
      favoriteGenres.length
        ? db.anime.findMany({
            where: {
              hidden: false,
              moderationStatus: "APPROVED",
              OR: favoriteGenres.map((genre) => ({
                genres: { contains: genre, mode: "insensitive" },
              })),
            },
            orderBy: [{ trending: "desc" }, { rating: "desc" }],
            take: 20,
          })
        : Promise.resolve([]),
    ]);

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

    ownedIds = new Set(purchases.map((p) => p.animeId));

    personalizedFeatured = rankAnimeByFavoriteGenres(recommendations, favoriteGenres)
      .slice(0, 5)
      .map((anime) => ({
        id: anime.id,
        slug: anime.slug,
        title: anime.title,
        coverImage: anime.coverImage,
        bannerImage: anime.bannerImage,
        featured: anime.featured,
        recommended: true,
        rating: anime.rating,
        year: anime.year,
        type: anime.type,
        genres: anime.genres.split(",").filter(Boolean),
        isFree: anime.isFree,
        price: anime.price,
        description: anime.description,
        source: anime.source,
        creator: null as { username: string; displayName: string | null } | null,
      }));
  }

  // Merge owned status into cached data (fast — just a Set lookup)
  const withOwned = (items: (typeof publicData.featured)) =>
    items.map((a) => ({ ...a, owned: ownedIds.has(a.id) }));
  const hasPersonalizedFeatured = personalizedFeatured.length > 0;

  return NextResponse.json({
    featured: withOwned(hasPersonalizedFeatured ? personalizedFeatured : publicData.featured),
    trending: withOwned(publicData.trending),
    newReleases: withOwned(publicData.newReleases),
    topRated: withOwned(publicData.topRated),
    freeAnimes: withOwned(publicData.freeAnimes),
    continueWatching,
    genres: publicData.genres,
    personalized: hasPersonalizedFeatured,
  });
}
