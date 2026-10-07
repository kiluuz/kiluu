import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { EXCHANGE_UNLOCK_COUNT } from "../route";

// POST /api/exchange/propose - propose a swap on someone's offer
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  try {
    const { offerId, animeId, message } = await req.json();
    if (!offerId || !animeId) {
      return NextResponse.json({ error: "offerId and animeId are required" }, { status: 400 });
    }

    const purchaseCount = await db.purchase.count({ where: { userId: user.id } });
    if (purchaseCount < EXCHANGE_UNLOCK_COUNT) {
      return NextResponse.json(
        { error: `Exchange unlocks after purchasing ${EXCHANGE_UNLOCK_COUNT} animes. You have ${purchaseCount}.` },
        { status: 403 }
      );
    }

    const offer = await db.exchangeOffer.findUnique({ where: { id: offerId } });
    if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    if (offer.status !== "OPEN") return NextResponse.json({ error: "This offer is no longer open" }, { status: 400 });
    if (offer.userId === user.id) {
      return NextResponse.json({ error: "You cannot propose on your own offer" }, { status: 400 });
    }

    const ownership = await db.purchase.findUnique({
      where: { userId_animeId: { userId: user.id, animeId } },
    });
    if (!ownership) {
      return NextResponse.json({ error: "You can only offer animes you own" }, { status: 403 });
    }

    // The offer owner must not already own the proposed anime
    const ownerOwnsProposed = await db.purchase.findUnique({
      where: { userId_animeId: { userId: offer.userId, animeId } },
    });
    if (ownerOwnsProposed) {
      return NextResponse.json(
        { error: "They already own this anime — propose one they don't have" },
        { status: 400 }
      );
    }

    // You must not already own the offered anime
    const iOwnOffered = await db.purchase.findUnique({
      where: { userId_animeId: { userId: user.id, animeId: offer.animeId } },
    });
    if (iOwnOffered) {
      return NextResponse.json(
        { error: "You already own this anime — no need to trade for it" },
        { status: 400 }
      );
    }

    // Must not be currently offered on the marketplace by this user
    const alreadyOffered = await db.exchangeOffer.findFirst({
      where: { animeId, userId: user.id, status: "OPEN" },
    });
    if (alreadyOffered) {
      return NextResponse.json({ error: "This anime is already listed on the marketplace by you" }, { status: 400 });
    }

    // Duplicate proposal check
    const dup = await db.exchangeProposal.findFirst({
      where: { offerId, proposerId: user.id, status: "PENDING" },
    });
    if (dup) return NextResponse.json({ error: "You already have a pending proposal on this offer" }, { status: 409 });

    const proposal = await db.exchangeProposal.create({
      data: {
        offerId,
        proposerId: user.id,
        animeId,
        message: typeof message === "string" ? message.slice(0, 300) : null,
      },
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (e) {
    console.error("propose error", e);
    return NextResponse.json({ error: "Failed to send proposal" }, { status: 500 });
  }
}
