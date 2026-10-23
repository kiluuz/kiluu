// src/lib/streaks.ts
// DubAniX Kunlik kirish, streak va streak freeze tizimi (11-QISM)

import { db } from "./db";

export const DEFAULT_TIMEZONE = "Asia/Tashkent";

export function getDateStringInTimezone(date: Date = new Date(), timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date); // YYYY-MM-DD
  } catch {
    // Noto'g'ri timezone bo'lsa default ga fallback
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: DEFAULT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  }
}

export function getYesterdayStringInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return getDateStringInTimezone(yesterday, timezone);
}

export interface StreakStatus {
  streakCount: number;
  hasClaimedToday: boolean;
  streakFreezeCount: number;
  todayDate: string;
  nextMilestone: number;
  daysToNextMilestone: number;
}

export async function getUserStreakStatus(userId: string): Promise<StreakStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      streakCount: true,
      streakFreezeCount: true,
      streakLastActiveAt: true,
      timezone: true,
    },
  });

  if (!user) {
    return {
      streakCount: 0,
      hasClaimedToday: false,
      streakFreezeCount: 0,
      todayDate: getDateStringInTimezone(new Date()),
      nextMilestone: 7,
      daysToNextMilestone: 7,
    };
  }

  const tz = user.timezone || DEFAULT_TIMEZONE;
  const today = getDateStringInTimezone(new Date(), tz);
  const yesterday = getYesterdayStringInTimezone(tz);

  const todayClaim = await db.userDailyClaim.findUnique({
    where: { userId_claimDate: { userId, claimDate: today } },
  });

  let currentStreak = user.streakCount;

  // Agar oxirgi faollik kecha yoki bugun bo'lmasa, streak uzilgan bo'lishi mumkin
  if (user.streakLastActiveAt) {
    const lastActiveDate = getDateStringInTimezone(new Date(user.streakLastActiveAt), tz);
    if (lastActiveDate !== today && lastActiveDate !== yesterday) {
      // Streak uzilgan (freeze bo'lmasa 0)
      if (user.streakFreezeCount <= 0) {
        currentStreak = 0;
      }
    }
  }

  const milestones = [7, 30, 100, 365];
  const nextMilestone = milestones.find((m) => m > currentStreak) || (currentStreak + 50);
  const daysToNextMilestone = Math.max(0, nextMilestone - currentStreak);

  return {
    streakCount: currentStreak,
    hasClaimedToday: !!todayClaim,
    streakFreezeCount: user.streakFreezeCount,
    todayDate: today,
    nextMilestone,
    daysToNextMilestone,
  };
}

export async function claimDailyStreak(userId: string): Promise<{
  success: boolean;
  streakCount: number;
  xpAwarded: number;
  freezeAwarded?: number;
  milestoneReached?: number;
  message: string;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      streakCount: true,
      streakFreezeCount: true,
      streakLastActiveAt: true,
      timezone: true,
    },
  });

  if (!user) {
    return { success: false, streakCount: 0, xpAwarded: 0, message: "Foydalanuvchi topilmadi" };
  }

  const tz = user.timezone || DEFAULT_TIMEZONE;
  const today = getDateStringInTimezone(new Date(), tz);
  const yesterday = getYesterdayStringInTimezone(tz);

  // Bugun allaqachon olinganmi?
  const existingClaim = await db.userDailyClaim.findUnique({
    where: { userId_claimDate: { userId, claimDate: today } },
  });

  if (existingClaim) {
    return {
      success: false,
      streakCount: user.streakCount,
      xpAwarded: 0,
      message: "Bugungi kunlik mukofotni allaqachon olgansiz!",
    };
  }

  let newStreak = 1;
  let freezeUsed = false;

  if (user.streakLastActiveAt) {
    const lastActiveDate = getDateStringInTimezone(new Date(user.streakLastActiveAt), tz);
    if (lastActiveDate === yesterday) {
      // Kecha kirgan — streak davom etadi
      newStreak = user.streakCount + 1;
    } else if (lastActiveDate === today) {
      // Bugun kirgan
      newStreak = Math.max(1, user.streakCount);
    } else {
      // Bir yoki bir necha kun qolib ketgan
      if (user.streakFreezeCount > 0) {
        // Streak freeze muzlatgichidan foydalanib saqlab qolish
        newStreak = user.streakCount + 1;
        freezeUsed = true;
      } else {
        newStreak = 1;
      }
    }
  }

  // Kunlik bazaviy XP (streak oshgan sari bir oz ko'payadi, 15..40 XP)
  let xpAwarded = Math.min(40, 15 + Math.floor(newStreak / 5) * 5);
  let freezeAwarded = 0;
  let milestoneReached: number | undefined;

  // Milestone tekshiruvi: 7, 30, 100 kun
  if (newStreak === 7) {
    xpAwarded += 100;
    freezeAwarded += 1;
    milestoneReached = 7;
  } else if (newStreak === 30) {
    xpAwarded += 300;
    freezeAwarded += 2;
    milestoneReached = 30;
  } else if (newStreak === 100) {
    xpAwarded += 1000;
    freezeAwarded += 3;
    milestoneReached = 100;
  }

  await db.$transaction(async (tx) => {
    // 1. Claim yozuvi
    await tx.userDailyClaim.create({
      data: {
        userId,
        claimDate: today,
        streakDay: newStreak,
        xpAwarded,
        rewardJson: JSON.stringify({ xp: xpAwarded, freeze: freezeAwarded, milestone: milestoneReached }),
      },
    });

    // 2. User streak holatini yangilash
    await tx.user.update({
      where: { id: userId },
      data: {
        streakCount: newStreak,
        streakLastActiveAt: new Date(),
        streakFreezeCount: {
          increment: freezeAwarded - (freezeUsed ? 1 : 0),
        },
      },
    });

    // 3. XP Event yozish
    await tx.xpEvent.create({
      data: {
        userId,
        reason: "daily_streak",
        amount: xpAwarded,
        refType: "daily_claim",
        refId: `${today}_${newStreak}`,
      },
    });
  });

  return {
    success: true,
    streakCount: newStreak,
    xpAwarded,
    freezeAwarded: freezeAwarded > 0 ? freezeAwarded : undefined,
    milestoneReached,
    message: milestoneReached
      ? `Tabriklaymiz! ${milestoneReached} kunlik streak marrasiga yetdingiz! +${xpAwarded} XP`
      : `Kunlik kirish qabul qilindi! Streak: ${newStreak} kun (+${xpAwarded} XP)`,
  };
}

export async function recordUserActivityForStreak(userId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, streakCount: true, streakFreezeCount: true, streakLastActiveAt: true, timezone: true },
    });
    if (!user) return;

    const tz = user.timezone || DEFAULT_TIMEZONE;
    const today = getDateStringInTimezone(new Date(), tz);
    const yesterday = getYesterdayStringInTimezone(tz);

    if (user.streakLastActiveAt) {
      const lastActiveDate = getDateStringInTimezone(new Date(user.streakLastActiveAt), tz);
      if (lastActiveDate === today) {
        return; // Bugun allaqachon yangilangan
      }

      let newStreak = 1;
      let freezeUsed = false;
      if (lastActiveDate === yesterday) {
        newStreak = user.streakCount + 1;
      } else if (user.streakFreezeCount > 0) {
        newStreak = user.streakCount + 1;
        freezeUsed = true;
      }

      await db.user.update({
        where: { id: userId },
        data: {
          streakCount: newStreak,
          streakLastActiveAt: new Date(),
          ...(freezeUsed ? { streakFreezeCount: { decrement: 1 } } : {}),
        },
      });
    } else {
      await db.user.update({
        where: { id: userId },
        data: {
          streakCount: 1,
          streakLastActiveAt: new Date(),
        },
      });
    }
  } catch (e) {
    console.error("recordUserActivityForStreak error:", e);
  }
}
