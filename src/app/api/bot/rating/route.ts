import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { botRequestAuthorized } from "@/lib/bot-secret";
import { emitEvent } from "@/lib/events";

const Body = z.object({
  site_user_id: z.string().min(1).max(64),
  anime_slug: z.string().min(1).max(200),
  stars: z.number().int().min(1).max(5),
});

/** Botdagi 5 yulduzli baho saytdagi 1–10 shkalaga map qilinadi. */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
  if (!botRequestAuthorized(key)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [user, anime] = await Promise.all([
    db.user.findUnique({ where: { id: parsed.data.site_user_id }, select: { id: true } }),
    db.anime.findFirst({
      where: { slug: parsed.data.anime_slug.toLowerCase(), hidden: false },
      select: { id: true, slug: true, isFree: true },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });

  const [purchase, order] = await Promise.all([
    db.purchase.findFirst({ where: { userId: user.id, animeId: anime.id }, select: { id: true } }),
    db.order.findFirst({
      where: {
        site_user_id: user.id,
        anime_slug: anime.slug,
        status: { in: ["COMPLETED", "PAID_PENDING_GRANT"] },
      },
      select: { id: true },
    }),
  ]);
  if (!anime.isFree && !purchase && !order) {
    return NextResponse.json({ error: "Purchase required before rating" }, { status: 403 });
  }

  const rating = parsed.data.stars * 2;
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
  const avgRating = stats._avg.rating ? Number(stats._avg.rating.toFixed(2)) : 0;
  await db.anime.update({ where: { id: anime.id }, data: { rating: avgRating } });

  try {
    await emitEvent({ id: user.id }, "rating_given", { animeId: anime.id, rating, source: "bot" });
  } catch {
    // Event bus xatolari bahoni saqlashga to'sqinlik qilmasin.
  }

  return NextResponse.json({
    ok: true,
    myRating: rating,
    stars: parsed.data.stars,
    ratingCount: stats._count._all,
    communityRating: avgRating,
  });
}
