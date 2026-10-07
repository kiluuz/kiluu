import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/animes/[id]/purchase - buy anime with credits
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to purchase" }, { status: 401 });

  const { id } = await params;

  try {
    const anime = await db.anime.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });

    if (anime.isFree) {
      return NextResponse.json({ error: "This anime is free to watch" }, { status: 400 });
    }

    const existing = await db.purchase.findUnique({
      where: { userId_animeId: { userId: user.id, animeId: anime.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "You already own this anime" }, { status: 409 });
    }

    if (user.credits < anime.price) {
      return NextResponse.json(
        { error: `Not enough credits. You need ${anime.price - user.credits} more.`, needMore: anime.price - user.credits },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      await tx.purchase.create({
        data: { userId: user.id, animeId: anime.id, pricePaid: anime.price },
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -anime.price,
          type: "PURCHASE",
          description: `Purchased "${anime.title}"`,
        },
      });
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: anime.price } },
      });
      return updated;
    });

    const purchaseCount = await db.purchase.count({ where: { userId: user.id } });

    return NextResponse.json({
      success: true,
      credits: result.credits,
      purchaseCount,
      unlockedExchange: purchaseCount >= 20,
    });
  } catch (e) {
    console.error("purchase error", e);
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }
}
