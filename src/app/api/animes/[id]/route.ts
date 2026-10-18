import { after, NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { isCreator } from "@/lib/rbac";
import { userOwnsVersion } from "@/lib/owns";
import { sqlTable } from "@/lib/sql-table";

const episodeSyncCooldowns = new Map<string, number>();

// GET /api/animes/[id] - anime detail with episodes + ownership
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  const anime = await db.anime.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    include: {
      episodes: { orderBy: { number: "asc" } },
      creator: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, role: true } },
      catalogVersions: {
        include: {
          creator: { select: { username: true, displayName: true } },
          _count: { select: { episodes: true, purchases: true } },
        },
      },
      _count: { select: { purchases: true, favorites: true } },
    },
  });

  if (!anime) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }
  const staff = isAdminUser(user) || (user && anime.creatorId === user.id);
  if (anime.hidden && !staff) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }
  const [ratingStats, myRating, collectorRows] = await Promise.all([
    db.animeRating.aggregate({
      where: { animeId: anime.id },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    user ? db.animeRating.findUnique({
      where: { userId_animeId: { userId: user.id, animeId: anime.id } },
      select: { rating: true },
    }) : Promise.resolve(null),
    db.$queryRaw<Array<{ collectors: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT "buyerId") AS collectors
      FROM (
        SELECT "userId" AS "buyerId" FROM ${sqlTable("Purchase")} WHERE "animeId" = ${anime.id}
        UNION
        SELECT o."site_user_id" AS "buyerId"
        FROM ${sqlTable("Order")} o
        WHERE o."anime_slug" = ${anime.slug}
          AND o.status IN ('COMPLETED', 'PAID_PENDING_GRANT')
      )
    `),
  ]);

  const syncAllowedAt = episodeSyncCooldowns.get(anime.id) ?? 0;
  if (syncAllowedAt <= Date.now()) {
    episodeSyncCooldowns.set(anime.id, Date.now() + 60_000);
    after(async () => {
      try {
        const { getBotAnime } = await import("@/lib/bot-api");
        const botData = await getBotAnime(anime.slug);
        if (!Array.isArray(botData?.episodes) || botData.episodes.length === 0) return;
        const existingNumbers = new Set(anime.episodes.map((episode) => episode.number));
        const missing = botData.episodes.filter(
          (episodeNumber: number) => Number.isInteger(episodeNumber) && !existingNumbers.has(episodeNumber),
        );
        if (missing.length) {
          await db.episode.createMany({
            data: missing.map((episodeNumber: number) => ({
              id: `ep-${anime.slug}-${episodeNumber}`,
              animeId: anime.id,
              number: episodeNumber,
              title: `${anime.title} ${episodeNumber}-qism`,
              description: `${anime.title} serialining ${episodeNumber}-qismi`,
              videoUrl: "telegram",
              duration: 0,
            })),
            skipDuplicates: true,
          });
        }
      } catch (error) {
        console.warn(`Telegram episode sync failed for anime ${anime.slug}`, error);
      }
    });
  }

  let owned = anime.isFree;
  let ownedEpisodes: number[] = [];
  let favorited = false;
  let progressMap: Record<string, { position: number; duration: number; completed: boolean }> = {};

  if (user) {
    const purchases = await db.purchase.findMany({
      where: { userId: user.id, animeId: anime.id },
    });
    const hasFull = purchases.some((p: any) => !p.episodeNumber || p.episodeNumber === 0);
    if (hasFull) owned = true;
    ownedEpisodes = purchases
      .map((p: any) => p.episodeNumber)
      .filter((n: number) => typeof n === "number" && n > 0);

    const fav = await db.favoriteAnime.findUnique({
      where: { userId_animeId: { userId: user.id, animeId: anime.id } },
    });
    favorited = !!fav;

    const progress = await db.watchProgress.findMany({
      where: { userId: user.id, animeId: anime.id },
    });
    progressMap = Object.fromEntries(
      progress.map((p) => [p.episodeId, { position: p.position, duration: p.duration, completed: p.completed }])
    );
  }

  const candidates = await db.anime.findMany({
    where: {
      id: { not: anime.id },
      OR: anime.genres.split(",").filter(Boolean).map((g) => ({ genres: { contains: g } })),
      hidden: false,
      moderationStatus: "APPROVED",
    },
    take: 40,
    select: { id: true, slug: true, title: true, coverImage: true, rating: true, isFree: true, price: true, year: true, type: true, genres: true },
  });
  const baseGenres = new Set(anime.genres.split(",").map((genre) => genre.trim().toLowerCase()).filter(Boolean));
  const related = candidates
    .map((candidate) => ({
      ...candidate,
      overlap: candidate.genres.split(",").map((genre) => genre.trim().toLowerCase()).filter((genre) => baseGenres.has(genre)).length,
    }))
    .filter((candidate) => candidate.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.rating - a.rating || a.id.localeCompare(b.id))
    .slice(0, 6)
    .map(({ overlap: _overlap, ...candidate }) => candidate);

  return NextResponse.json({
    anime: {
      ...anime,
      genres: anime.genres.split(",").filter(Boolean),
      owned,
      ownedEpisodes,
      favorited,
      releaseDate: anime.releaseDate ? anime.releaseDate.toISOString() : null,
      purchaseCount: anime._count.purchases,
      collectorCount: Number(collectorRows[0]?.collectors ?? 0),
      favoriteCount: anime._count.favorites,
      communityRating: ratingStats._avg.rating,
      ratingCount: ratingStats._count._all,
      myRating: myRating?.rating ?? null,
      catalogRating: anime.rating,
      source: anime.source,
      versions: await Promise.all(
        anime.catalogVersions
          .filter((v) => v.status === "published" || staff)
          .map(async (v) => ({
            id: v.id,
            kind: v.kind,
            price: v.price,
            status: v.status,
            episodeCount: v._count.episodes,
            sales: v._count.purchases,
            label: v.kind === "official" ? "DubAniX" : `by @${v.creator?.username || "creator"}`,
            owned: user ? await userOwnsVersion(user.id, v.id, 0) : false,
          }))
      ),
    },
    episodes: anime.episodes.map((e) => ({
      ...e,
      progress: progressMap[e.id] || null,
    })),
    related,
  });
}

// PATCH /api/animes/[id] — update anime metadata (CREATOR only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || (!isCreator(user) && !isAdminUser(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const data: Record<string, unknown> = {};

  if (body.releaseDate !== undefined) {
    data.releaseDate = body.releaseDate ? new Date(body.releaseDate) : null;
  }
  if (typeof body.status === "string") data.status = body.status;
  if (typeof body.featured === "boolean") data.featured = body.featured;

  const anime = await db.anime.update({ where: { id }, data });

  // If anime is now live, trigger notifications
  if (body.triggerNotify) {
    await fetch(`${req.nextUrl.origin}/api/bot/notify-release`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": req.headers.get("Cookie") || "" },
      body: JSON.stringify({ animeSlug: anime.slug }),
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/animes/[id] — delete anime card completely (CREATOR only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || (!isCreator(user) && !isAdminUser(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const anime = await db.anime.findFirst({
    where: { OR: [{ id }, { slug: id }] },
  });
  if (!anime) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }
  if (!isAdminUser(user) && anime.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.anime.delete({ where: { id: anime.id } });

  // Sync deletion with bot if configured
  try {
    const botUrl = process.env.BOT_API_URL;
    const botKey = process.env.BOT_API_KEY;
    if (botUrl && botKey) {
      await fetch(`${botUrl}/api/animes/${anime.slug}`, {
        method: "DELETE",
        headers: { "X-API-Key": botKey },
      });
    }
  } catch (err) {
    console.error("Failed to delete anime from bot database:", err);
  }

  return NextResponse.json({ ok: true, deleted: anime.slug });
}
