import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBotCatalog, getDeletedAnimes } from "@/lib/bot-api";
import { ensureAnimeInDatabase } from "@/lib/anime-enricher";
import { animeDubSignals } from "@/lib/dub-teams";
import { collectibleRarity } from "@/lib/gift-rarity";

// Auto-sync cache: fire-and-forget so users never wait for Render cold-start
let lastBotSyncTime = 0;
const BOT_SYNC_INTERVAL = 5 * 60_000; // 5 minutes — Render free tier sleeps
let _syncInFlight = false;

async function syncBotCatalogToDatabase() {
  const now = Date.now();
  if (now - lastBotSyncTime < BOT_SYNC_INTERVAL) return;
  lastBotSyncTime = now;

  try {
    // 1. Sync deleted animes from bot
    try {
      const deletedSlugs = await getDeletedAnimes();
      if (Array.isArray(deletedSlugs) && deletedSlugs.length > 0) {
        await db.anime.deleteMany({
          where: { slug: { in: deletedSlugs } },
        });
      }
    } catch {}

    // 2. Sync active animes from bot
    const botAnimes = await getBotCatalog(true);
    if (Array.isArray(botAnimes) && botAnimes.length > 0) {
      for (const b of botAnimes) {
        if (!b.slug && !b.title) continue;
        let effectivePrice = b.price || 0;
        if (effectivePrice === 0 && b.episode_prices) {
          const epPrices = Object.values(b.episode_prices).map(Number).filter(n => n > 0);
          if (epPrices.length > 0) effectivePrice = Math.min(...epPrices);
        }
        await ensureAnimeInDatabase({
          title: b.title || b.slug,
          slug: b.slug,
          price: effectivePrice > 0 ? effectivePrice : 100,
          coverImage: b.poster,
          description: b.description,
        });
      }
    }
  } catch (e) {
    // Graceful degrade if bot API is sleeping or cold starting
  }
}

// GET /api/animes?search=&genre=&type=&sort=&free=
export async function GET(req: NextRequest) {
  // Fire-and-forget sync — NEVER block the response waiting for Render bot
  const now = Date.now();
  if (!_syncInFlight && now - lastBotSyncTime >= BOT_SYNC_INTERVAL) {
    _syncInFlight = true;
    syncBotCatalogToDatabase().finally(() => { _syncInFlight = false; });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const genre = searchParams.get("genre") || "";
  const type = searchParams.get("type") || "";
  const sort = searchParams.get("sort") || "trending";
  const freeOnly = searchParams.get("free") === "1";

  const user = await getCurrentUser();

  const where: Record<string, unknown> = {
    hidden: false,
    moderationStatus: "APPROVED",
  };
  if (search) {
    const cleanSearch = search.trim();
    const withAsciiApostrophe = cleanSearch.replace(/[\u02bb\u02bc\u2018\u2019`]/g, "'");
    const withUzbekTurnedComma = cleanSearch.replace(/['`\u2018\u2019\u02bc]/g, "ʻ");
    const withoutApostrophe = cleanSearch.replace(/['`\u2018\u2019\u02bb\u02bc]/g, "");
    const words = cleanSearch.split(/\s+/).filter((w) => w.length >= 2);

    const variations = Array.from(new Set([cleanSearch, withAsciiApostrophe, withUzbekTurnedComma, withoutApostrophe, ...words])).filter(Boolean);

    where.OR = variations.flatMap((term) => [
      { title: { contains: term, mode: "insensitive" } },
      { altTitle: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { studio: { contains: term, mode: "insensitive" } },
      { slug: { contains: term, mode: "insensitive" } },
    ]);
  }
  if (genre) {
    where.genres = { contains: genre, mode: "insensitive" };
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

  const dubSignals = await animeDubSignals(animes.map((anime) => anime.id));
  const result = animes.map((a) => {
    const dub = dubSignals.get(a.id);
    return {
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
      source: a.source,
      owned: ownedIds.has(a.id),
      rarity: collectibleRarity({
        price: a.price,
        rating: a.rating,
        speakerCount: dub?.speakerCount,
        teamReputation: dub?.teamReputation,
      }).id,
    };
  });

  return NextResponse.json({ animes: result });
}
