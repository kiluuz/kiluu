import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const EXCHANGE_UNLOCK_COUNT = 20;

// GET /api/exchange - marketplace offers + eligibility
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";

  const where: Record<string, unknown> = { status: "OPEN" };
  if (search) {
    where.anime = {
      OR: [
        { title: { contains: search } },
        { genres: { contains: search } },
      ],
    };
  }

  const offers = await db.exchangeOffer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true, year: true, type: true, genres: true, price: true } },
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true } },
      _count: { select: { proposals: true } },
    },
  });

  let eligibility = { unlocked: false, purchaseCount: 0, required: EXCHANGE_UNLOCK_COUNT, ownedAnimes: [] as Array<{ id: string; title: string; coverImage: string; slug: string }> };

  if (user) {
    const purchases = await db.purchase.findMany({
      where: { userId: user.id },
      include: { anime: { select: { id: true, title: true, coverImage: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    eligibility = {
      unlocked: purchases.length >= EXCHANGE_UNLOCK_COUNT,
      purchaseCount: purchases.length,
      required: EXCHANGE_UNLOCK_COUNT,
      ownedAnimes: purchases.map((p) => p.anime),
    };
  }

  return NextResponse.json({
    offers: offers.map((o) => ({
      id: o.id,
      anime: o.anime,
      user: o.user,
      wantedNote: o.wantedNote,
      proposalCount: o._count.proposals,
      createdAt: o.createdAt,
      isMine: user ? o.userId === user.id : false,
    })),
    eligibility,
  });
}
