import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/exchange/proposals - received & sent proposals
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const myOffers = await db.exchangeOffer.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const offerIds = myOffers.map((o) => o.id);

  const [received, sent] = await Promise.all([
    db.exchangeProposal.findMany({
      where: { offerId: { in: offerIds } },
      orderBy: { createdAt: "desc" },
      include: {
        offer: {
          include: {
            anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true, year: true, type: true, price: true } },
          },
        },
        proposer: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true } },
        anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true, year: true, type: true, price: true } },
      },
    }),
    db.exchangeProposal.findMany({
      where: { proposerId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        offer: {
          include: {
            anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true, year: true, type: true, price: true } },
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true } },
          },
        },
        anime: { select: { id: true, slug: true, title: true, coverImage: true, rating: true, year: true, type: true, price: true } },
      },
    }),
  ]);

  return NextResponse.json({ received, sent });
}

// POST /api/exchange/proposals - accept or decline a proposal
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { proposalId, action } = await req.json();
    if (!proposalId || !["accept", "decline"].includes(action)) {
      return NextResponse.json({ error: "proposalId and action (accept|decline) required" }, { status: 400 });
    }

    const proposal = await db.exchangeProposal.findUnique({
      where: { id: proposalId },
      include: { offer: true },
    });
    if (!proposal) return NextResponse.json({ error: "Proposal not found" }, { status: 404 });

    if (proposal.offer.userId !== user.id) {
      return NextResponse.json({ error: "Only the offer owner can respond" }, { status: 403 });
    }
    if (proposal.status !== "PENDING") {
      return NextResponse.json({ error: "Proposal already resolved" }, { status: 400 });
    }

    if (action === "decline") {
      await db.exchangeProposal.update({ where: { id: proposalId }, data: { status: "DECLINED" } });
      return NextResponse.json({ success: true, status: "DECLINED" });
    }

    // Accept: swap ownership of the two animes in a transaction
    const result = await db.$transaction(async (tx) => {
      // Verify both still own their animes
      const ownerA = await tx.purchase.findUnique({
        where: { userId_animeId: { userId: proposal.offer.userId, animeId: proposal.offer.animeId } },
      });
      const ownerB = await tx.purchase.findUnique({
        where: { userId_animeId: { userId: proposal.proposerId, animeId: proposal.animeId } },
      });
      if (!ownerA || !ownerB) throw new Error("Ownership changed - cannot complete exchange");

      // Swap: remove source records, grant targets (skip-if-already-owned)
      await tx.purchase.delete({ where: { id: ownerA.id } });
      await tx.purchase.delete({ where: { id: ownerB.id } });

      const proposerHasOffered = await tx.purchase.findUnique({
        where: { userId_animeId: { userId: proposal.proposerId, animeId: proposal.offer.animeId } },
      });
      if (!proposerHasOffered) {
        await tx.purchase.create({
          data: { userId: proposal.proposerId, animeId: proposal.offer.animeId, pricePaid: 0 },
        });
      }
      const ownerHasProposed = await tx.purchase.findUnique({
        where: { userId_animeId: { userId: proposal.offer.userId, animeId: proposal.animeId } },
      });
      if (!ownerHasProposed) {
        await tx.purchase.create({
          data: { userId: proposal.offer.userId, animeId: proposal.animeId, pricePaid: 0 },
        });
      }

      await tx.creditTransaction.create({
        data: {
          userId: proposal.offer.userId,
          amount: 0,
          type: "EXCHANGE",
          description: `Exchanged "${proposal.offer.animeId}" for "${proposal.animeId}"`,
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId: proposal.proposerId,
          amount: 0,
          type: "EXCHANGE",
          description: `Exchanged "${proposal.animeId}" for "${proposal.offer.animeId}"`,
        },
      });

      // Update statuses
      await tx.exchangeProposal.update({ where: { id: proposalId }, data: { status: "ACCEPTED" } });
      await tx.exchangeOffer.update({ where: { id: proposal.offerId }, data: { status: "MATCHED" } });
      // Decline other pending proposals on this offer
      await tx.exchangeProposal.updateMany({
        where: { offerId: proposal.offerId, status: "PENDING", id: { not: proposalId } },
        data: { status: "DECLINED" },
      });

      return { swapped: true };
    });

    return NextResponse.json({ success: true, status: "ACCEPTED", ...result });
  } catch (e) {
    console.error("proposal respond error", e);
    const message = e instanceof Error && e.message.includes("Ownership")
      ? e.message
      : "Failed to process proposal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
