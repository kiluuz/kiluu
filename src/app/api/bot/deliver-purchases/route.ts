import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { grantPurchase } from "@/lib/bot-api";

/**
 * POST /api/bot/deliver-purchases
 *
 * Called after a user links their Telegram account.
 * Grants all their purchased (but not yet delivered) animes via the bot.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let specificSlug: string | undefined;
    let episodeNumber = 0;
    try {
      const body = await req.json();
      specificSlug = body?.slug || body?.anime_slug;
      if (typeof body?.episodeNumber === "number") episodeNumber = body.episodeNumber;
      if (typeof body?.episode_number === "number") episodeNumber = body.episode_number;
    } catch {}

    const slugsToDeliver = new Set<string>();

    if (specificSlug) {
      // User specifically requested this anime — only deliver this one!
      slugsToDeliver.add(specificSlug);
    } else {
      // Initial account linking or bulk library sync — deliver all user's purchases
      const purchases = await db.purchase.findMany({
        where: { userId: user.id },
        include: { anime: { select: { slug: true, title: true } } },
      });
      for (const p of purchases) {
        if (p.anime?.slug) slugsToDeliver.add(p.anime.slug);
      }
    }

    if (slugsToDeliver.size === 0) {
      return NextResponse.json({ delivered: 0, slugs: [] });
    }

    const results: { slug: string; success: boolean; error?: string }[] = [];

    for (const slug of slugsToDeliver) {
      try {
        const grantRes = await grantPurchase(user.id, slug, specificSlug ? episodeNumber : 0, true);
        if (grantRes && grantRes.linked === false) {
          // Bot has no chat_id for this site user — nothing can be sent until they re-link.
          results.push({ slug, success: false, error: "not_linked_on_bot" });
        } else {
          results.push({ slug, success: true });
        }
      } catch (e: any) {
        results.push({ slug, success: false, error: e.message });
      }
    }

    const delivered = results.filter((r) => r.success).length;
    const firstError = results.find((r) => !r.success)?.error;

    return NextResponse.json({
      delivered,
      total: slugsToDeliver.size,
      results,
      ...(delivered === 0 && firstError
        ? {
            error:
              firstError === "not_linked_on_bot"
                ? "Telegram account is not linked on the bot side. Reconnect Telegram and try again."
                : firstError,
          }
        : {}),
    });
  } catch (error: any) {
    console.error("deliver-purchases error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
