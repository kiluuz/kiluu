import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/animes?search=&genre=&type=&sort=&free=
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const genre = searchParams.get("genre") || "";
  const type = searchParams.get("type") || "";
  const sort = searchParams.get("sort") || "trending";
  const freeOnly = searchParams.get("free") === "1";

  const user = await getCurrentUser();

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { title: { contains: search } },
      { altTitle: { contains: search } },
      { description: { contains: search } },
      { studio: { contains: search } },
    ];
  }
  if (genre) {
    where.genres = { contains: genre };
  }
  if (type) {
    where.type = type;
  }
  if (freeOnly) {
    where.isFree = true;
  }

  let orderBy: Record<string, string> = { trending: "desc" };
  if (sort === "rating") orderBy = { rating: "desc" };
  if (sort === "newest") orderBy = { year: "desc" };
  if (sort === "title") orderBy = { title: "asc" };
  if (sort === "price-low") orderBy = { price: "asc" };
  if (sort === "price-high") orderBy = { price: "desc" };

  const animes = await db.anime.findMany({
    where,
    orderBy,
    include: {
      _count: { select: { episodes: true } },
      creator: { select: { username: true, displayName: true, avatarUrl: true } },
    },
  });

  let ownedIds = new Set<string>();
  if (user) {
    const purchases = await db.purchase.findMany({ where: { userId: user.id }, select: { animeId: true } });
    ownedIds = new Set(purchases.map((p) => p.animeId));
  }

  const result = animes.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    altTitle: a.altTitle,
    description: a.description,
    coverImage: a.coverImage,
    bannerImage: a.bannerImage,
    genres: a.genres.split(",").filter(Boolean),
    year: a.year,
    rating: a.rating,
    studio: a.studio,
    status: a.status,
    type: a.type,
    isFree: a.isFree,
    price: a.price,
    episodeCount: a._count.episodes,
    creator: a.creator,
    owned: ownedIds.has(a.id),
  }));

  return NextResponse.json({ animes: result });
}
