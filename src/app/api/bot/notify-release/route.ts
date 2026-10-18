import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";

const BOT_API_URL = process.env.ANIME_BOT_API_URL;
const BOT_API_KEY = process.env.ANIME_BOT_API_KEY;

/**
 * POST /api/bot/notify-release
 * Admin-only: notify all AnimeNotify subscribers that an anime is now available.
 * The bot side receives site_user_ids and sends the messages to linked Telegram accounts.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { animeSlug } = await req.json();
  if (!animeSlug) return NextResponse.json({ error: "animeSlug required" }, { status: 400 });

  const anime = await db.anime.findUnique({ where: { slug: animeSlug } });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });

  // Find all un-notified subscribers — we only need their userId (= site_user_id)
  const subs = await db.animeNotify.findMany({
    where: { animeId: anime.id, notified: false },
    select: { id: true, userId: true },
  });

  if (subs.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  const siteUserIds = subs.map((s) => s.userId);

  let sent = 0;
  if (BOT_API_URL && BOT_API_KEY && siteUserIds.length > 0) {
    try {
      // Bot API receives site_user_ids and maps them to linked Telegram accounts
      const res = await fetch(`${BOT_API_URL}/api/notify-release`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": BOT_API_KEY,
        },
        body: JSON.stringify({
          site_user_ids: siteUserIds,
          anime_slug: animeSlug,
          anime_title: anime.title,
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (res.ok) {
        const data = await res.json();
        sent = data.sent ?? siteUserIds.length;
      }
    } catch {
      // Even if bot fails, mark as notified to avoid spam retries
    }
  }

  // Mark all as notified regardless of bot result
  await db.animeNotify.updateMany({
    where: { animeId: anime.id, notified: false },
    data: { notified: true },
  });

  return NextResponse.json({ ok: true, sent, total: subs.length });
}
