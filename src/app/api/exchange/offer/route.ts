import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { EXCHANGE_UNLOCK_COUNT } from "../route";

// POST /api/exchange/offer - create an exchange offer with an owned anime
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in first" }, { status: 401 });

  try {
    const { animeId, wantedNote } = await req.json();
    if (!animeId) return NextResponse.json({ error: "animeId is required" }, { status: 400 });

    const purchaseCount = await db.purchase.count({ where: { userId: user.id } });
    if (purchaseCount < EXCHANGE_UNLOCK_COUNT) {
      return NextResponse.json(
        { error: `Exchange unlocks after purchasing ${EXCHANGE_UNLOCK_COUNT} animes. You have ${purchaseCount}.` },
        { status: 403 }
      );
    }

    const ownership = await db.purchase.findUnique({
      where: { userId_animeId: { userId: user.id, animeId } },
    });
    if (!ownership) {
      return NextResponse.json({ error: "You can only offer animes you own" }, { status: 403 });
    }

    // One open offer per anime
    const existingOffer = await db.exchangeOffer.findFirst({
      where: { animeId, userId: user.id, status: "OPEN" },
    });
    if (existingOffer) {
      return NextResponse.json({ error: "You already have an open offer for this anime" }, { status: 409 });
    }

    const offer = await db.exchangeOffer.create({
      data: {
        userId: user.id,
        animeId,
        wantedNote: typeof wantedNote === "string" ? wantedNote.slice(0, 200) : null,
      },
      include: {
        anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true, year: true, type: true, genres: true, price: true } },
      },
    });

    return NextResponse.json({ offer }, { status: 201 });
  } catch (e) {
    console.error("create offer error", e);
    return NextResponse.json({ error: "Failed to create offer" }, { status: 500 });
  }
}

// DELETE /api/exchange/offer?id=xxx - close own offer
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const offer = await db.exchangeOffer.findUnique({ where: { id } });
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.userId !== user.id) return NextResponse.json({ error: "Not your offer" }, { status: 403 });
  if (offer.status === "MATCHED") return NextResponse.json({ error: "Offer already matched" }, { status: 400 });

  await db.exchangeOffer.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
