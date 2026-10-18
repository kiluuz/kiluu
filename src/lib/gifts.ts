import { db } from "@/lib/db";
import { APP_CONFIG } from "./config";
import { awardXpInTransaction } from "./xp";
import { evaluateAchievements } from "./achievements";
import { grantPurchase } from "./bot-api";
import { officialVersionId, userOwnsVersion } from "./owns";

export function giftExpiryDate(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + APP_CONFIG.giftExpiryDays);
  return d;
}

export async function expirePendingGifts() {
  const now = new Date();
  const stale = await db.gift.findMany({
    where: { status: "PENDING", expiresAt: { lte: now } },
  });
  for (const g of stale) {
    await refundGift(g.id, "EXPIRED");
  }
  return stale.length;
}

export async function refundGift(giftId: string, status: "EXPIRED" | "DECLINED") {
  return db.$transaction(async (tx) => {
    const gift = await tx.gift.findUnique({ where: { id: giftId } });
    if (!gift || gift.status !== "PENDING") return gift;
    const key = `gift-refund-${gift.id}`;
    const dup = await tx.creditTransaction.findUnique({ where: { idempotencyKey: key } });
    if (!dup && gift.pricePaid > 0) {
      await tx.user.update({
        where: { id: gift.senderId },
        data: { credits: { increment: gift.pricePaid } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: gift.senderId,
          amount: gift.pricePaid,
          type: "REFUND",
          description: status === "EXPIRED" ? "Gift expired — credits returned" : "Gift declined — credits returned",
          refType: "gift",
          refId: gift.id,
          idempotencyKey: key,
        },
      });
    }
    return tx.gift.update({
      where: { id: gift.id },
      data: { status: status === "EXPIRED" ? "EXPIRED" : "DECLINED" },
    });
  });
}

export async function sendGift(opts: {
  senderId: string;
  recipientUsername: string;
  animeId: string;
  versionId?: string | null;
  message?: string | null;
  idempotencyKey: string;
}) {
  const username = opts.recipientUsername.replace(/^@/, "").trim().toLowerCase();
  if (!username) throw Object.assign(new Error("NO_RECIPIENT"), { code: "NO_RECIPIENT" });

  const existing = await db.gift.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
  if (existing) return existing;

  const anime = await db.anime.findUnique({ where: { id: opts.animeId } });
  if (!anime || anime.hidden) throw Object.assign(new Error("NO_ANIME"), { code: "NO_ANIME" });

  const versionId = opts.versionId || (await officialVersionId(anime.id));
  if (!versionId) throw Object.assign(new Error("NO_VERSION"), { code: "NO_VERSION" });
  const version = await db.animeVersion.findUnique({ where: { id: versionId } });
  if (!version || version.status !== "published") {
    throw Object.assign(new Error("NOT_FOR_SALE"), { code: "NOT_FOR_SALE" });
  }

  const recipient = await db.user.findFirst({
    where: { username: { equals: username } },
  });

  const sender = await db.user.findUnique({ where: { id: opts.senderId } });
  if (!sender) throw new Error("NO_USER");
  if (recipient && recipient.id === sender.id) {
    throw Object.assign(new Error("SELF"), { code: "SELF" });
  }

  const price = version.price;
  if (price <= 0) throw Object.assign(new Error("FREE"), { code: "FREE" });
  if (sender.credits < price) {
    throw Object.assign(new Error("INSUFFICIENT"), { code: "INSUFFICIENT", need: price - sender.credits });
  }

  const gift = await db.$transaction(async (tx) => {
    const dup = await tx.gift.findUnique({ where: { idempotencyKey: opts.idempotencyKey } });
    if (dup) return dup;

    await tx.user.update({
      where: { id: sender.id },
      data: { credits: { decrement: price } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: sender.id,
        amount: -price,
        type: "GIFT",
        description: `Gift "${anime.title}" to @${username}`,
        refType: "gift",
        refId: opts.idempotencyKey,
        idempotencyKey: opts.idempotencyKey,
      },
    });

    const sharePct = Number(
      (await tx.platformConfig.findUnique({ where: { key: "creator_share" } }))?.value ??
        APP_CONFIG.creatorSharePercent
    );
    const share = Math.floor((price * (Number.isFinite(sharePct) ? sharePct : 70)) / 100);
    if (share > 0 && version.creatorId) {
      await tx.user.update({
        where: { id: version.creatorId },
        data: { credits: { increment: share } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: version.creatorId,
          amount: share,
          type: "BONUS",
          description: `Creator share from gift "${anime.title}"`,
          refType: "gift",
          refId: opts.idempotencyKey,
          idempotencyKey: `creator-${opts.idempotencyKey}`,
        },
      });
    }

    const createdGift = await tx.gift.create({
      data: {
        senderId: sender.id,
        recipientId: recipient?.id ?? null,
        recipientUsername: username,
        animeId: anime.id,
        versionId,
        pricePaid: price,
        status: "PENDING",
        message: opts.message || null,
        idempotencyKey: opts.idempotencyKey,
        expiresAt: giftExpiryDate(),
      },
    });
    await awardXpInTransaction(tx, sender.id, "gift_sent", createdGift.id);
    return createdGift;
  });

  await evaluateAchievements(sender.id);
  if (version.creatorId && version.creatorId !== sender.id) {
    await evaluateAchievements(version.creatorId);
  }
  return gift;
}

export async function claimGift(opts: { giftId: string; userId: string }) {
  await expirePendingGifts();
  const gift = await db.gift.findUnique({
    where: { id: opts.giftId },
    include: { anime: true },
  });
  if (!gift || gift.status !== "PENDING") {
    throw Object.assign(new Error("NOT_PENDING"), { code: "NOT_PENDING" });
  }
  const user = await db.user.findUnique({ where: { id: opts.userId } });
  if (!user) throw new Error("NO_USER");
  const uname = user.username.toLowerCase();
  if (gift.recipientId && gift.recipientId !== user.id && gift.recipientUsername.toLowerCase() !== uname) {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }
  if (!gift.recipientId && gift.recipientUsername.toLowerCase() !== uname) {
    throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  }
  if (gift.senderId === user.id) {
    throw Object.assign(new Error("SELF"), { code: "SELF" });
  }

  const versionId = gift.versionId || (await officialVersionId(gift.animeId));
  if (!versionId) throw Object.assign(new Error("NO_VERSION"), { code: "NO_VERSION" });

  const updated = await db.$transaction(async (tx) => {
    const claimed = await tx.gift.updateMany({
      where: { id: gift.id, status: "PENDING" },
      data: { status: "CLAIMED", claimedAt: new Date(), recipientId: user.id },
    });
    if (claimed.count !== 1) {
      throw Object.assign(new Error("NOT_PENDING"), { code: "NOT_PENDING" });
    }
    const already = await userOwnsVersion(user.id, versionId, 0, tx);
    if (!already) {
      await tx.purchase.create({
        data: {
          userId: user.id,
          animeId: gift.animeId,
          versionId,
          episodeNumber: 0,
          pricePaid: 0,
        },
      });
    }
    await awardXpInTransaction(tx, user.id, "gift_received", gift.id);
    return tx.gift.findUniqueOrThrow({ where: { id: gift.id } });
  });

  await evaluateAchievements(user.id);
  const version = await db.animeVersion.findUnique({
    where: { id: versionId },
    select: { creatorId: true },
  });
  if (version?.creatorId && version.creatorId !== user.id) {
    await evaluateAchievements(version.creatorId);
  }

  try {
    await grantPurchase(user.id, gift.anime.slug, 0, true);
  } catch {
    /* delivery later */
  }
  return updated;
}

export async function declineGift(opts: { giftId: string; userId: string }) {
  const gift = await db.gift.findUnique({ where: { id: opts.giftId } });
  if (!gift || gift.status !== "PENDING") {
    throw Object.assign(new Error("NOT_PENDING"), { code: "NOT_PENDING" });
  }
  const user = await db.user.findUnique({ where: { id: opts.userId } });
  if (!user) throw new Error("NO_USER");
  const uname = user.username.toLowerCase();
  const allowed = gift.recipientId === user.id || gift.recipientUsername.toLowerCase() === uname;
  if (!allowed) throw Object.assign(new Error("FORBIDDEN"), { code: "FORBIDDEN" });
  return refundGift(gift.id, "DECLINED");
}
