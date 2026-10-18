import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { APP_CONFIG } from "@/lib/config";
import { awardCommunityPost, POST_AWARD_COST } from "@/lib/community";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { evaluateAchievements } from "@/lib/achievements";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to award posts" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  if (!rateLimit(`community-award:${user.id}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many awards. Please try again later." }, { status: 429 });
  }
  const { id: postId } = await params;
  let key = req.headers.get("Idempotency-Key") || "";
  if (!key) {
    try {
      const body = await req.json() as { idempotencyKey?: unknown };
      key = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";
    } catch {
      return NextResponse.json({ error: "An idempotency key is required" }, { status: 400 });
    }
  }
  if (!/^[\w-]{16,100}$/.test(key)) {
    return NextResponse.json({ error: "An idempotency key must be 16–100 characters" }, { status: 400 });
  }
  const cost = Math.max(1, Math.floor(POST_AWARD_COST));

  const result = await db.$transaction(async (tx) => {
    const configuredShare = Number(
      (await tx.platformConfig.findUnique({ where: { key: "creator_share" } }))?.value ??
      APP_CONFIG.creatorSharePercent
    );
    const sharePercent = Number.isFinite(configuredShare)
      ? Math.min(100, Math.max(0, configuredShare))
      : 70;
    return awardCommunityPost(tx, {
      userId: user.id,
      actorName: user.displayName || user.username,
      postId,
      idempotencyKey: key,
      cost,
      authorSharePercent: sharePercent,
    });
  });

  if ("error" in result) {
    if (result.error === "POST_NOT_FOUND") return NextResponse.json({ error: "Post not found" }, { status: 404 });
    if (result.error === "SELF_AWARD") return NextResponse.json({ error: "You cannot award your own post" }, { status: 400 });
    if (result.error === "INSUFFICIENT_CREDITS") return NextResponse.json({ error: "Not enough credits" }, { status: 409 });
    return NextResponse.json({ error: "Idempotency key was already used for another award" }, { status: 409 });
  }
  if (!result.replay) await evaluateAchievements(user.id);
  return NextResponse.json({
    award: { id: result.award.id, cost: result.award.cost, authorShare: result.award.authorShare },
    replay: result.replay,
  }, { status: result.replay ? 200 : 201 });
}
