import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";

// Price catalog (credits) — single source of truth for premium unlocks
const PRICES: Record<string, number> = {
  animatedBanner: 500,
  "frame:gold": 300,
  "frame:neon": 300,
  "frame:sakura": 500,
};

// POST /api/profile/premium — unlock a premium customization item with credits
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { item } = await req.json();
    if (typeof item !== "string" || !(item in PRICES)) {
      return NextResponse.json({ error: "Unknown premium item" }, { status: 400 });
    }
    const price = PRICES[item];

    const updated = await db.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: user.id }, select: { showcase: true } });
      let showcase: Record<string, unknown> = {};
      try { showcase = current?.showcase ? JSON.parse(current.showcase) : {}; } catch { /* ignore invalid saved config */ }
      const unlocked = new Set<string>(Array.isArray(showcase.unlocked) ? showcase.unlocked.filter((entry): entry is string => typeof entry === "string") : []);
      if (unlocked.has(item)) return { error: "ALREADY_UNLOCKED" as const };

      const debit = await tx.user.updateMany({
        where: { id: user.id, credits: { gte: price } },
        data: { credits: { decrement: price } },
      });
      if (debit.count !== 1) return { error: "INSUFFICIENT_CREDITS" as const };
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -price,
          type: "PURCHASE",
          description: `Unlocked premium profile item: ${item}`,
          idempotencyKey: `profile-premium:${user.id}:${item}`,
        },
      });
      unlocked.add(item);
      const u = await tx.user.update({
        where: { id: user.id },
        data: { showcase: JSON.stringify({ ...showcase, unlocked: [...unlocked] }) },
      });
      return { user: u, unlocked: [...unlocked] };
    });

    if ("error" in updated) {
      const message = updated.error === "ALREADY_UNLOCKED" ? "Already unlocked" : `Not enough credits — need ${price}`;
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ user: toPublicUser(updated.user), unlocked: updated.unlocked });
  } catch (e) {
    console.error("premium unlock error", e);
    return NextResponse.json({ error: "Unlock failed" }, { status: 500 });
  }
}
