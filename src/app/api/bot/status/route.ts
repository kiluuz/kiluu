import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserStatus } from "@/lib/bot-api";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let botData: any = { linked: false, purchases: [], episode_purchases: {} };
    try {
      botData = await getUserStatus(user.id);
    } catch (error: any) {
      // If user not found on bot side yet or bot offline, fallback to defaults
    }

    // Merge with site-side database purchases so purchases are never lost
    try {
      const sitePurchases = await db.purchase.findMany({
        where: { userId: user.id },
        include: { anime: { select: { slug: true } } },
      });

      const fullPurchases = new Set<string>(botData.purchases || []);
      const episodePurchases: Record<string, number[]> = { ...(botData.episode_purchases || {}) };

      for (const p of sitePurchases) {
        const slug = p.anime?.slug;
        if (!slug) continue;
        const epNum = (p as any).episodeNumber ?? 0;
        if (epNum === 0) {
          fullPurchases.add(slug);
        } else {
          if (!episodePurchases[slug]) episodePurchases[slug] = [];
          if (!episodePurchases[slug].includes(epNum)) {
            episodePurchases[slug].push(epNum);
          }
        }
      }

      return NextResponse.json({
        linked: botData.linked ?? false,
        purchases: Array.from(fullPurchases),
        episode_purchases: episodePurchases,
      });
    } catch {
      return NextResponse.json(botData);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
