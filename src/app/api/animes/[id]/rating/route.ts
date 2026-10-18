import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to rate anime" }, { status: 401 });

  const { id } = await params;
  const anime = await db.anime.findFirst({
    where: { OR: [{ id }, { slug: id }], hidden: false, moderationStatus: "APPROVED" },
    select: { id: true },
  });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const rating = (body as { rating?: unknown } | null)?.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 10) {
    return NextResponse.json({ error: "Rating must be an integer from 1 to 10" }, { status: 400 });
  }

  await db.animeRating.upsert({
    where: { userId_animeId: { userId: user.id, animeId: anime.id } },
    create: { userId: user.id, animeId: anime.id, rating },
    update: { rating },
  });
  const stats = await db.animeRating.aggregate({
    where: { animeId: anime.id },
    _avg: { rating: true },
    _count: { _all: true },
  });

  return NextResponse.json({
    myRating: rating,
    ratingCount: stats._count._all,
    communityRating: stats._avg.rating,
  });
}
