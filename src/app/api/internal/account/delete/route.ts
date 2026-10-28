import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INTERNAL_SECRET_HEADER,
  internalBridgeConfigured,
  internalRequestAuthorized,
} from "@/lib/internal-api";
import { log } from "@/lib/logger";

const DeleteBody = z.object({
  userId: z.string().min(1).max(64),
  reason: z.string().trim().max(200).optional(),
});

/**
 * POST /api/internal/account/delete
 * Mobile bridge → anonymize a web account and revoke access.
 * Idempotent: retries and unknown ids return the same successful shape.
 */
export async function POST(req: NextRequest) {
  if (!internalBridgeConfigured()) {
    return NextResponse.json({ error: "Internal bridge is not configured" }, { status: 503 });
  }
  if (!internalRequestAuthorized(req.headers.get(INTERNAL_SECRET_HEADER))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = DeleteBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const { userId } = parsed.data;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json({ ok: true, userId, alreadyDeleted: true });
    }

    const now = new Date();
    const anonymized = await db.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({
        where: { id: userId, deletedAt: null },
        data: {
          email: `deleted-${userId}@deleted.invalid`,
          username: `deleted_${userId}`,
          password: randomBytes(32).toString("hex"),
          displayName: "Deleted user",
          avatarUrl: null,
          bannerUrl: null,
          bio: null,
          accentColor: "#f97316",
          favoriteGenres: "",
          telegramId: null,
          telegramUsername: null,
          lastSeenAt: null,
          emailVerified: false,
          verifyCode: null,
          verifyCodeExp: null,
          pronouns: null,
          tagline: null,
          country: null,
          timezone: null,
          socialLinks: null,
          statusEmoji: null,
          statusText: null,
          accentTo: null,
          avatarFrame: null,
          equippedAvatarFrameId: null,
          equippedNameFrameId: null,
          bannerPreset: null,
          showcase: null,
          privacy: null,
          onboardingDone: false,
          referralCode: null,
          referredById: null,
          streakCount: 0,
          streakLastActiveAt: null,
          streakFreezeCount: 0,
          deletedAt: now,
        },
      });
      if (updated.count !== 1) return false;

      await tx.session.deleteMany({ where: { userId } });
      await tx.telegramLinkToken.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.watchProgress.deleteMany({ where: { userId } });
      await tx.scheduleSubscription.deleteMany({ where: { userId } });
      await tx.scheduleDelivery.deleteMany({ where: { userId } });
      await tx.animeNotify.deleteMany({ where: { userId } });
      await tx.userBlock.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      });
      return true;
    });

    if (!anonymized) {
      return NextResponse.json({ ok: true, userId, alreadyDeleted: true });
    }

    log.info("account deleted via internal bridge", { userId, reason: parsed.data.reason });
    return NextResponse.json({ ok: true, userId, alreadyDeleted: false });
  } catch (e) {
    log.error("account delete failed", { userId, err: String(e) });
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
