import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/creator - my published animes + stats
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "CREATOR") {
    return NextResponse.json({ error: "Only creators can access the studio" }, { status: 403 });
  }

  const animes = await db.anime.findMany({
    where: { creatorId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { episodes: true, purchases: true, favorites: true } },
    },
  });

  return NextResponse.json({
    animes: animes.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      coverImage: a.coverImage,
      status: a.status,
      type: a.type,
      isFree: a.isFree,
      price: a.price,
      year: a.year,
      rating: a.rating,
      episodeCount: a._count.episodes,
      purchaseCount: a._count.purchases,
      favoriteCount: a._count.favorites,
      createdAt: a.createdAt,
    })),
  });
}

// POST /api/creator - publish a new anime
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "CREATOR") {
    return NextResponse.json({ error: "Only creators can publish animes" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      title, altTitle, description, coverImage, bannerImage,
      genres, year, studio, status, type, isFree, price,
    } = body;

    if (!title || typeof title !== "string" || title.trim().length < 2) {
      return NextResponse.json({ error: "Title is required (min 2 chars)" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.trim().length < 20) {
      return NextResponse.json({ error: "Description is required (min 20 chars)" }, { status: 400 });
    }
    if (!coverImage || typeof coverImage !== "string" || !/^https?:\/\//.test(coverImage)) {
      return NextResponse.json({ error: "A valid cover image URL is required" }, { status: 400 });
    }
    if (!genres || !Array.isArray(genres) || genres.length === 0) {
      return NextResponse.json({ error: "Pick at least one genre" }, { status: 400 });
    }
    const parsedYear = parseInt(year) || new Date().getFullYear();
    if (parsedYear < 1960 || parsedYear > 2035) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }

    const isFreeBool = Boolean(isFree);
    const priceInt = isFreeBool ? 0 : Math.max(0, Math.min(10000, parseInt(price) || 0));
    if (!isFreeBool && priceInt < 10) {
      return NextResponse.json({ error: "Paid animes must cost at least 10 credits" }, { status: 400 });
    }

    let slug = slugify(title);
    const slugExists = await db.anime.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    const anime = await db.anime.create({
      data: {
        slug,
        title: title.trim(),
        altTitle: altTitle || null,
        description: description.trim(),
        coverImage,
        bannerImage: bannerImage || coverImage,
        genres: genres.join(","),
        year: parsedYear,
        studio: studio || null,
        status: ["ONGOING", "COMPLETED", "UPCOMING"].includes(status) ? status : "ONGOING",
        type: ["TV", "MOVIE", "OVA"].includes(type) ? type : "TV",
        isFree: isFreeBool,
        price: priceInt,
        creatorId: user.id,
        trending: 0,
      },
    });

    return NextResponse.json({ anime }, { status: 201 });
  } catch (e) {
    console.error("publish anime error", e);
    return NextResponse.json({ error: "Failed to publish anime" }, { status: 500 });
  }
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}
