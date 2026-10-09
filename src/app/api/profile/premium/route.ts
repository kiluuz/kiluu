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

    // current unlocked list lives inside showcase JSON
    let showcase: Record<string, unknown> = {};
    try { showcase = user.showcase ? JSON.parse(user.showcase) : {}; } catch { /* ignore */ }
    const unlocked = new Set<string>(Array.isArray(showcase.unlocked) ? (showcase.unlocked as string[]) : []);
    if (unlocked.has(item)) {
      return NextResponse.json({ error: "Already unlocked" }, { status: 400 });
    }

    if (user.credits < price) {
      return NextResponse.json({ error: `Not enough credits — need ${price}` }, { status: 400 });
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -price,
          type: "PURCHASE",
          description: `Unlocked premium profile item: ${item}`,
        },
      });
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          credits: { decrement: price },
          showcase: JSON.stringify({ ...showcase, unlocked: [...unlocked, item] }),
        },
      });
      return u;
    });

    return NextResponse.json({ user: toPublicUser(updated), unlocked: [...unlocked, item] });
  } catch (e) {
    console.error("premium unlock error", e);
    return NextResponse.json({ error: "Unlock failed" }, { status: 500 });
  }
}
