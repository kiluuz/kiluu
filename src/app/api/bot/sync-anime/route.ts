import { NextRequest, NextResponse } from "next/server";
import { ensureAnimeInDatabase } from "@/lib/anime-enricher";
import { db } from "@/lib/db";
import { env } from "process";

const BOT_API_KEY = env.ANIME_BOT_API_KEY || "";
const WEBHOOK_SECRET = env.TELEGRAM_STARS_WEBHOOK_SECRET || "";

/**
 * POST /api/bot/sync-anime
 *
 * Called by the Telegram Bot or backend when an anime is added or updated in the bot.
 * If the anime does not exist on the website yet:
 *   - Automatically fetches official poster and banner images from AniList/Google/web!
 *   - Fetches genres, year, rating, description, and status!
 *   - Saves into Prisma database so it appears immediately on Discover!
 *
 * Body can be:
 *   {
 *     "title": "Black Clover Season 2",
 *     "slug": "black-clover-season-2",
 *     "price": 100,
 *     "isFree": false,
 *     "coverImage": "optional custom image URL"
 *   }
 * OR bulk:
 *   {
 *     "animes": [ ... ]
 *   }
 */
export async function POST(req: NextRequest) {
  try {
    // Auth check: accept either X-API-Key or X-Webhook-Secret
    const authHeader = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
    if (BOT_API_KEY || WEBHOOK_SECRET) {
      const isValid =
        (BOT_API_KEY && authHeader === BOT_API_KEY) ||
        (WEBHOOK_SECRET && authHeader === WEBHOOK_SECRET);
      if (!isValid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();

    // Check if bulk array
    if (Array.isArray(body.animes)) {
      const results: any[] = [];
      for (const item of body.animes) {
        if (!item.title && !item.slug) continue;
        const res = await ensureAnimeInDatabase({
          title: item.title || item.slug,
          slug: item.slug,
          price: item.price,
          isFree: item.isFree,
          coverImage: item.coverImage,
          bannerImage: item.bannerImage,
          description: item.description,
          status: item.status,
        });
        results.push(res);
      }
      return NextResponse.json({ ok: true, synced: results.length, results });
    }

    const { title, slug, price, isFree, coverImage, bannerImage, description, status } = body;

    if (!title && !slug) {
      return NextResponse.json(
        { error: "title or slug is required" },
        { status: 400 }
      );
    }

    const result = await ensureAnimeInDatabase({
      title: title || slug,
      slug,
      price,
      isFree,
      coverImage,
      bannerImage,
      description,
      status,
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      anime: result.anime,
    });
  } catch (error: any) {
    console.error("Error in sync-anime:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync anime" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
    if (BOT_API_KEY || WEBHOOK_SECRET) {
      const isValid =
        (BOT_API_KEY && authHeader === BOT_API_KEY) ||
        (WEBHOOK_SECRET && authHeader === WEBHOOK_SECRET);
      if (!isValid) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await req.json();
    const slug = body.slug;
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const anime = await db.anime.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
    });

    if (anime) {
      await db.anime.delete({ where: { id: anime.id } });
      return NextResponse.json({ ok: true, deleted: anime.slug });
    }

    return NextResponse.json({ ok: true, message: "Anime not found on site" });
  } catch (error: any) {
    console.error("Error in DELETE sync-anime:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete anime" },
      { status: 500 }
    );
  }
}

