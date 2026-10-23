import { db } from "@/lib/db";
import { APP_CONFIG } from "./config";
import { awardXpInTransaction } from "./xp";
import { evaluateAchievements } from "./achievements";
import { emitEvent } from "./events";
import { grantPurchase } from "./bot-api";
import { officialVersionId, userOwnsVersion } from "./owns";
import { log } from "./logger";

export { userOwnsVersion };

export async function creatorSharePercent(): Promise<number> {
  const row = await db.platformConfig.findUnique({ where: { key: "creator_share" } });
  const n = Number(row?.value ?? APP_CONFIG.creatorSharePercent);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 70;
}

export async function purchaseAnimeAtomic(opts: {
  userId: string;
  animeId: string;
  versionId?: string | null;
  slug: string;
  episodeNumber: number;
  price: number;
  title: string;
  idempotencyKey: string;
  skipOwnershipCheck?: boolean;
}) {
  let creatorToEvaluate: string | null = null;
  const result = await db.$transaction(async (tx) => {
    const versionId = opts.versionId || (await officialVersionId(opts.animeId, tx));
    if (!versionId) throw Object.assign(new Error("NO_VERSION"), { code: "NO_VERSION" });

    const existingKey = await tx.creditTransaction.findUnique({
      where: { idempotencyKey: opts.idempotencyKey },
    });
    if (existingKey) {
      const user = await tx.user.findUnique({ where: { id: opts.userId } });
      if (opts.episodeNumber === 0) {
        await awardXpInTransaction(tx, opts.userId, "purchase", opts.idempotencyKey);
      }
      return user!;
    }

    if (!opts.skipOwnershipCheck) {
      const owned = await userOwnsVersion(opts.userId, versionId, opts.episodeNumber, tx);
      if (owned) {
        throw Object.assign(new Error("ALREADY_OWNED"), { code: "ALREADY_OWNED" });
      }
    }

    const user = await tx.user.findUnique({ where: { id: opts.userId } });
    if (!user) throw new Error("NO_USER");
    if (user.credits < opts.price) {
      throw Object.assign(new Error("INSUFFICIENT"), { code: "INSUFFICIENT", need: opts.price - user.credits });
    }

    const version = await tx.animeVersion.findUnique({ where: { id: versionId } });
    const serverPrice = opts.episodeNumber > 0 ? opts.price : (version?.price ?? opts.price);
    if (opts.episodeNumber === 0 && serverPrice !== opts.price) {
      throw Object.assign(new Error("PRICE_MISMATCH"), { code: "PRICE_MISMATCH" });
    }
    if (user.credits < serverPrice) {
      throw Object.assign(new Error("INSUFFICIENT"), { code: "INSUFFICIENT", need: serverPrice - user.credits });
    }

    await tx.purchase.create({
      data: {
        userId: opts.userId,
        animeId: opts.animeId,
        versionId,
        episodeNumber: opts.episodeNumber,
        pricePaid: serverPrice,
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        amount: -serverPrice,
        type: "PURCHASE",
        description:
          opts.episodeNumber > 0
            ? `Purchased "${opts.title}" — ep ${opts.episodeNumber}`
            : `Purchased "${opts.title}"`,
        refType: "version",
        refId: versionId,
        idempotencyKey: opts.idempotencyKey,
      },
    });

    const updated = await tx.user.update({
      where: { id: opts.userId },
      data: { credits: { decrement: serverPrice } },
    });

    const recipientId = version?.creatorId;
    if (opts.episodeNumber === 0) creatorToEvaluate = recipientId ?? null;
    if (recipientId && serverPrice > 0) {
      const sharePct = Number((await tx.platformConfig.findUnique({ where: { key: "creator_share" } }))?.value ?? APP_CONFIG.creatorSharePercent);
      const share = Math.floor((serverPrice * (Number.isFinite(sharePct) ? sharePct : 70)) / 100);
      if (share > 0) {
        await tx.user.update({
          where: { id: recipientId },
          data: { credits: { increment: share } },
        });
        await tx.creditTransaction.create({
          data: {
            userId: recipientId,
            amount: share,
            type: "BONUS",
            description: `Creator share from "${opts.title}"`,
            refType: "version",
            refId: versionId,
            idempotencyKey: `creator-${opts.idempotencyKey}`,
          },
        });
      }
    }

    if (opts.episodeNumber === 0) {
      await awardXpInTransaction(tx, opts.userId, "purchase", opts.idempotencyKey);
    }
    return updated;
  });

  try {
    await evaluateAchievements(opts.userId);
    await emitEvent({ id: opts.userId }, "purchase", { animeId: opts.animeId, versionId: opts.versionId });
  } catch (error) {
    log.error("Purchase committed but buyer achievement evaluation failed", {
      userId: opts.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (creatorToEvaluate && creatorToEvaluate !== opts.userId) {
    try {
      await evaluateAchievements(creatorToEvaluate);
    } catch (error) {
      log.error("Purchase committed but creator achievement evaluation failed", {
        creatorId: creatorToEvaluate,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    await grantPurchase(opts.userId, opts.slug, opts.episodeNumber, true);
  } catch {
    /* delivery completed in part 3; ownership is already recorded */
  }

  return result;
}

/**
 * Refund Stars/credits. If the user already spent the credits, balance is floored at 0
 * and leftover clawback is recorded (Telegram Stars refund still proceeds).
 */
export async function clawbackCredits(userId: string, amount: number, description: string, key: string) {
  return db.$transaction(async (tx) => {
    const dup = await tx.creditTransaction.findUnique({ where: { idempotencyKey: key } });
    if (dup) return tx.user.findUniqueOrThrow({ where: { id: userId } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const take = Math.min(user.credits, amount);
    const short = amount - take;
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: -take,
        type: "REFUND",
        description: short > 0 ? `${description} (short ${short}; floor 0)` : description,
        idempotencyKey: key,
      },
    });
    return tx.user.update({
      where: { id: userId },
      data: { credits: { decrement: take } },
    });
  });
}

export async function creditFromStars(opts: {
  userId: string;
  amount: number;
  description: string;
  key: string;
  refId?: string;
}) {
  return db.$transaction(async (tx) => {
    const dup = await tx.creditTransaction.findUnique({ where: { idempotencyKey: opts.key } });
    if (dup) return tx.user.findUniqueOrThrow({ where: { id: opts.userId } });
    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        amount: opts.amount,
        type: "STARS",
        description: opts.description,
        refType: "star_payment",
        refId: opts.refId,
        idempotencyKey: opts.key,
      },
    });
    return tx.user.update({
      where: { id: opts.userId },
      data: { credits: { increment: opts.amount } },
    });
  });
}
