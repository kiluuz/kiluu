import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { unstable_cache } from "next/cache";

// Cache the public schedule list (no user data) for 5 minutes
const getCachedSchedule = unstable_cache(
  async () => {
    const animes = await db.anime.findMany({
      where: { status: "ONGOING", airDay: { not: null } },
      orderBy: [{ airTime: "asc" }],
      include: {
        _count: { select: { episodes: true } },
        creator: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    });

    return animes.map((a) => ({
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
      episodeCount: a._count.episodes,
      airDay: a.airDay as number,
      airTime: a.airTime as string,
      creator: a.creator,
    }));
  },
  ["schedule-public"],
  { revalidate: 300, tags: ["schedule"] }
);

// GET /api/schedule — weekly broadcast grid for ONGOING animes
export async function GET() {
  const user = await getCurrentUser();

  const items = await getCachedSchedule();

  // Merge owned status without blocking the cached response
  let ownedIds = new Set<string>();
  if (user) {
    const purchases = await db.purchase.findMany({
      where: { userId: user.id },
      select: { animeId: true },
    });
    ownedIds = new Set(purchases.map((p) => p.animeId));
  }

  return NextResponse.json({
    schedule: items.map((a) => ({ ...a, owned: ownedIds.has(a.id) })),
  });
}
