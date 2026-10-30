import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { botRequestAuthorized } from "@/lib/bot-secret";

/** Botga anime bo‘yicha e’lon qilingan speaker sonini beradi. */
export async function GET(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
  if (!botRequestAuthorized(key)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = (req.nextUrl.searchParams.get("slug") || "").trim().toLowerCase();
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  const anime = await db.anime.findFirst({
    where: { slug, hidden: false },
    select: {
      id: true,
      slug: true,
      title: true,
      dubTeamId: true,
      dubTeam: { select: { id: true, name: true } },
    },
  });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  if (!anime.dubTeamId) {
    return NextResponse.json({ anime, credit: null });
  }

  const credit = await db.dubCredit.findFirst({
    where: { animeId: anime.id, teamId: anime.dubTeamId },
    orderBy: { createdAt: "asc" },
    select: { id: true, language: true, speakerCount: true },
  });

  return NextResponse.json({
    anime: { id: anime.id, slug: anime.slug, title: anime.title, dubTeam: anime.dubTeam },
    credit,
  });
}
