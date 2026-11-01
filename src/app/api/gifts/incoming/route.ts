import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { animeDubSignals } from "@/lib/dub-teams";
import { collectibleRarity } from "@/lib/gift-rarity";

const NO_STORE = { headers: { "Cache-Control": "private, no-store" } };

/**
 * The oldest still-openable gift that landed after `since`. The client keeps a
 * watermark per user, so a reveal plays once and history never replays. Without
 * `since` it only reports server time, which seeds that watermark.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("since");
  const since = raw ? new Date(raw) : null;
  if (raw && (!since || Number.isNaN(since.getTime()))) {
    return NextResponse.json({ error: "since must be an ISO timestamp" }, { status: 400 });
  }
  const serverNow = new Date();
  if (!since) return NextResponse.json({ gift: null, now: serverNow.toISOString() }, NO_STORE);
  if (since > serverNow) return NextResponse.json({ gift: null, now: serverNow.toISOString() }, NO_STORE);

  const gift = await db.gift.findFirst({
    where: {
      status: "PENDING",
      senderId: { not: user.id },
      createdAt: { gt: since },
      expiresAt: { gt: serverNow },
      OR: [{ recipientId: user.id }, { recipientUsername: user.username.toLowerCase() }],
    },
    include: {
      anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true } },
      sender: { select: { username: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!gift) return NextResponse.json({ gift: null }, NO_STORE);

  const signals = await animeDubSignals([gift.animeId]);
  return NextResponse.json(
    {
      gift: {
        id: gift.id,
        status: gift.status,
        incoming: true,
        message: gift.message,
        pricePaid: gift.pricePaid,
        createdAt: gift.createdAt.toISOString(),
        claimedAt: null,
        recipientUsername: gift.recipientUsername,
        rarity: collectibleRarity({
          price: gift.pricePaid,
          rating: gift.anime.rating,
          speakerCount: signals.get(gift.animeId)?.speakerCount,
          teamReputation: signals.get(gift.animeId)?.teamReputation,
        }).id,
        anime: {
          slug: gift.anime.slug,
          title: gift.anime.title,
          coverImage: gift.anime.coverImage,
        },
        sender: gift.sender,
      },
    },
    NO_STORE
  );
}
