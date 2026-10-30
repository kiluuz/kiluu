import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { botRequestAuthorized } from "@/lib/bot-secret";

const Body = z.object({
  site_user_id: z.string().min(1).max(64),
  anime_slug: z.string().min(1).max(200),
  agrees: z.boolean(),
});

/**
 * Bot yetkazgandan keyin so'raydigan savol: “Haqiqatan ham bu animeda N ta
 * ovoz bergan inson qatnashganmi?” — javob jamoa e’lon qilgan speakerCount
 * bilan birga saqlanadi.
 */
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
      select: { id: true, slug: true, isFree: true, dubTeamId: true },
    }),
  ]);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  if (!anime.dubTeamId) {
    return NextResponse.json({ error: "Anime has no dub team credit" }, { status: 404 });
  }

  const credit = await db.dubCredit.findFirst({
    where: { animeId: anime.id, teamId: anime.dubTeamId },
    orderBy: { createdAt: "asc" },
    select: { id: true, speakerCount: true },
  });
  if (!credit) {
    return NextResponse.json({ error: "Anime has no dub team credit" }, { status: 404 });
  }

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
    return NextResponse.json({ error: "Purchase required before verification" }, { status: 403 });
  }

  await db.dubVerificationVote.upsert({
    where: { userId_creditId: { userId: user.id, creditId: credit.id } },
    create: {
      userId: user.id,
      creditId: credit.id,
      teamId: anime.dubTeamId,
      animeId: anime.id,
      speakerCount: credit.speakerCount,
      agrees: parsed.data.agrees,
    },
    update: {
      speakerCount: credit.speakerCount,
      agrees: parsed.data.agrees,
    },
  });

  const votes = await db.dubVerificationVote.groupBy({
    by: ["agrees"],
    where: { creditId: credit.id },
    _count: { _all: true },
  });
  let confirmed = 0;
  let rejected = 0;
  for (const row of votes) {
    if (row.agrees) confirmed = row._count._all;
    else rejected = row._count._all;
  }

  return NextResponse.json({
    ok: true,
    agrees: parsed.data.agrees,
    speakerCount: credit.speakerCount,
    confirmed,
    rejected,
  });
}
