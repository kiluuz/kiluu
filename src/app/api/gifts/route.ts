import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { expirePendingGifts, sendGift } from "@/lib/gifts";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { animeDubSignals } from "@/lib/dub-teams";
import { collectibleRarity } from "@/lib/gift-rarity";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await expirePendingGifts();
  const uname = user.username.toLowerCase();
  const gifts = await db.gift.findMany({
    where: {
      OR: [
        { senderId: user.id },
        { recipientId: user.id },
        { recipientUsername: uname },
      ],
    },
    include: {
      anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true } },
      sender: { select: { username: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const signals = await animeDubSignals([...new Set(gifts.map((gift) => gift.animeId))]);
  return NextResponse.json({
    gifts: gifts.map((g) => ({
      id: g.id,
      status: g.status,
      message: g.message,
      pricePaid: g.pricePaid,
      versionId: g.versionId,
      expiresAt: g.expiresAt.toISOString(),
      createdAt: g.createdAt.toISOString(),
      claimedAt: g.claimedAt?.toISOString() ?? null,
      incoming: g.senderId !== user.id,
      recipientUsername: g.recipientUsername,
      rarity: collectibleRarity({
        price: g.pricePaid,
        rating: g.anime.rating,
        speakerCount: signals.get(g.animeId)?.speakerCount,
        teamReputation: signals.get(g.animeId)?.teamReputation,
      }).id,
      anime: g.anime,
      sender: g.sender,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(rateKey(req, "gift") + user.id, 10, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    animeId?: string;
    versionId?: string;
    username?: string;
    message?: string;
    idempotencyKey?: string;
  };
  if (!body.animeId || !body.username) {
    return NextResponse.json({ error: "animeId and username required" }, { status: 400 });
  }
  try {
    const gift = await sendGift({
      senderId: user.id,
      recipientUsername: body.username,
      animeId: body.animeId,
      versionId: body.versionId,
      message: body.message,
      idempotencyKey: body.idempotencyKey || `gift-${user.id}-${randomBytes(8).toString("hex")}`,
    });
    const me = await db.user.findUnique({ where: { id: user.id }, select: { credits: true } });
    return NextResponse.json({ ok: true, giftId: gift.id, credits: me?.credits ?? 0 });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "INSUFFICIENT") {
      return NextResponse.json({ error: "Not enough credits", need: (e as { need?: number }).need }, { status: 400 });
    }
    if (code === "SELF") return NextResponse.json({ error: "Cannot gift yourself" }, { status: 400 });
    if (code === "FREE") return NextResponse.json({ error: "Free titles cannot be gifted" }, { status: 400 });
    if (code === "NO_ANIME" || code === "NO_VERSION" || code === "NOT_FOR_SALE") {
      return NextResponse.json({ error: "Not available to gift" }, { status: 400 });
    }
    return NextResponse.json({ error: "Gift failed" }, { status: 500 });
  }
}
