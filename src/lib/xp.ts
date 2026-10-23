import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const XP_CONFIG = {
  curve: { base: 250, exponent: 1.18, maxLevel: 100 },
  amounts: {
    purchase: 250,
    gift_sent: 80,
    gift_received: 40,
    post: 25,
    comment: 8,
    like_received: 3,
    watch_time: 1,
    watch_complete: 15,
    award_given: 12,
    achievement: 20,
    party_hosted: 50,
    party_joined: 15,
    chat_message: 5,
    daily_streak: 20,
    quest_complete: 25,
  } satisfies Record<string, number>,
};

export const DAILY_ACTIVITY_CAPS: Record<string, number> = {
  post: 50,     // 2 ta post
  comment: 40,  // 5 ta comment
  like: 30,     // 10 ta like
  chat: 50,     // 10 ta chat xabari
};

/**
 * Level 1-100 simulyatsiyasi (kunlik faollik bo'yicha)
 */
export function simulateLevelProgression(dailyXp: number, targetDays: number = 365) {
  let totalXp = 0;
  const history: Array<{ day: number; level: number; totalXp: number }> = [];
  let reached100Day = -1;

  for (let day = 1; day <= targetDays; day++) {
    totalXp += dailyXp;
    const { level } = levelFromXp(totalXp);
    if (level >= 100 && reached100Day === -1) {
      reached100Day = day;
    }
    if (day % 30 === 0 || day === targetDays) {
      history.push({ day, level, totalXp });
    }
  }

  return { dailyXp, reached100Day, history, finalXp: totalXp };
}

const LEVEL_COSMETICS: Record<number, string> = {
  5: "frame:gold",
  10: "frame:neon",
  25: "frame:sakura",
  50: "animatedBanner",
};

/** XP required to reach a level; level 1 starts at zero XP. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(XP_CONFIG.curve.base * Math.pow(level - 1, XP_CONFIG.curve.exponent));
}

export function levelFromXp(totalXp: number): {
  level: number;
  xp: number;
  nextLevelXp: number;
  intoLevel: number;
} {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < XP_CONFIG.curve.maxLevel && xp >= xpForLevel(level + 1)) level += 1;
  const current = xpForLevel(level);
  const next = level >= XP_CONFIG.curve.maxLevel ? xp : xpForLevel(level + 1);
  return { level, xp, nextLevelXp: next, intoLevel: xp - current };
}

export async function getXpTotal(userId: string): Promise<number> {
  const result = await db.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } });
  return Math.max(0, result._sum.amount ?? 0);
}

export async function getXpTotals(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = await db.xpEvent.groupBy({
    by: ["userId"],
    where: { userId: { in: [...new Set(userIds)] } },
    _sum: { amount: true },
  });
  return new Map(rows.map((row) => [row.userId, Math.max(0, row._sum.amount ?? 0)]));
}

export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

type XpTransaction = Prisma.TransactionClient;

export async function awardXpInTransaction(
  tx: XpTransaction,
  userId: string,
  reason: string,
  refId: string,
  amount?: number,
) {
  const value = amount ?? XP_CONFIG.amounts[reason] ?? 0;
  if (!Number.isInteger(value) || value <= 0) return null;

  const previousEvent = await tx.xpEvent.findUnique({
    where: { userId_reason_refId: { userId, reason, refId } },
  });
  if (previousEvent) return null;

  const before = await tx.xpEvent.aggregate({ where: { userId }, _sum: { amount: true } });
  const previousTotal = Math.max(0, before._sum.amount ?? 0);
  const event = await tx.xpEvent.create({
    data: { userId, reason, amount: value, refType: reason, refId },
  });
  const previousLevel = levelFromXp(previousTotal).level;
  const levelInfo = levelFromXp(previousTotal + value);

  if (levelInfo.level > previousLevel) {
    const current = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { showcase: true },
    });
    let showcase: Record<string, unknown> = {};
    try {
      const parsed: unknown = current.showcase ? JSON.parse(current.showcase) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        showcase = parsed as Record<string, unknown>;
      }
    } catch {
      showcase = {};
    }
    const unlocked = new Set(
      Array.isArray(showcase.unlocked)
        ? showcase.unlocked.filter((item): item is string => typeof item === "string")
        : [],
    );
    const earnedCosmetics: string[] = [];
    for (let level = previousLevel + 1; level <= levelInfo.level; level += 1) {
      const cosmetic = LEVEL_COSMETICS[level];
      if (cosmetic && !unlocked.has(cosmetic)) {
        unlocked.add(cosmetic);
        earnedCosmetics.push(cosmetic);
      }
    }
    if (earnedCosmetics.length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { showcase: JSON.stringify({ ...showcase, unlocked: [...unlocked] }) },
      });
    }
    await tx.notification.create({
      data: {
        userId,
        type: "LEVEL_UP",
        title: "Level up!",
        body: `You reached Level ${levelInfo.level}.${earnedCosmetics.length ? ` New cosmetic unlocked: ${earnedCosmetics.join(", ")}.` : ""}`,
        dataJson: JSON.stringify({ level: levelInfo.level, cosmetics: earnedCosmetics }),
      },
    });
  }

  return { event, xpTotal: previousTotal + value, ...levelInfo };
}

export async function awardXp(
  userId: string,
  reason: keyof typeof XP_CONFIG.amounts | string,
  refId: string,
  amount?: number,
) {
  try {
    return await db.$transaction((tx) => awardXpInTransaction(tx, userId, reason, refId, amount));
  } catch (error) {
    if (isUniqueConstraintError(error)) return null;
    throw error;
  }
}
