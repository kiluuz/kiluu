// src/lib/referrals.ts
// DubAniX Do'stlarni taklif qilish (Referral) tizimi (11-QISM)

import { db } from "./db";
import { randomBytes } from "crypto";

export const REFERRAL_CONFIG = {
  monthlyMaxLimit: 20, // Bir oyda maksimal mukofotlanadigan referallar
  referrerReward: { xp: 100, credits: 10 },
  referredReward: { xp: 50, credits: 5 },
};

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (user?.referralCode) {
    return user.referralCode;
  }

  // 6 belgili noyob kod yaratish
  let code = "";
  let isUnique = false;
  while (!isUnique) {
    code = randomBytes(3).toString("hex").toUpperCase();
    const exists = await db.user.findUnique({ where: { referralCode: code } });
    if (!exists) isUnique = true;
  }

  await db.user.update({
    where: { id: userId },
    data: { referralCode: code },
  });

  return code;
}

export async function bindReferralOnRegistration(
  newUserId: string,
  referralCode: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{ success: boolean; message: string }> {
  const code = (referralCode || "").trim().toUpperCase();
  if (!code) return { success: false, message: "Referral kodi bo'sh" };

  const referrer = await db.user.findUnique({
    where: { referralCode: code },
    select: { id: true },
  });

  if (!referrer) {
    return { success: false, message: "Referral kodi topilmadi" };
  }

  // O'z-o'zini taklif qilish taqiqlanadi
  if (referrer.id === newUserId) {
    return { success: false, message: "O'zingizni taklif qila olmaysiz" };
  }

  // Allaqachon boshqa referrerga biriktirilganmi?
  const existing = await db.referral.findUnique({
    where: { referredId: newUserId },
  });
  if (existing) {
    return { success: false, message: "Foydalanuvchi allaqachon biriktirilgan" };
  }

  // Shubha tekshiruvi: bir xil IP dan ko'p ro'yxatdan o'tishlar
  let isSuspicious = false;
  if (ipAddress) {
    const sameIpCount = await db.referral.count({
      where: {
        referrerId: referrer.id,
        ipAddress,
        createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (sameIpCount >= 3) {
      isSuspicious = true;
    }
  }

  await db.referral.create({
    data: {
      referrerId: referrer.id,
      referredId: newUserId,
      code,
      status: "pending",
      isSuspicious,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
    },
  });

  await db.user.update({
    where: { id: newUserId },
    data: { referredById: referrer.id },
  });

  return { success: true, message: "Referral muvaffaqiyatli bog'landi" };
}

export async function checkAndQualifyReferral(userId: string): Promise<{
  qualified: boolean;
  rewarded: boolean;
}> {
  const referral = await db.referral.findUnique({
    where: { referredId: userId },
    include: {
      referred: {
        select: {
          id: true,
          purchases: { select: { id: true }, take: 1 },
          watchEvents: { select: { id: true }, take: 1 },
        },
      },
      referrer: {
        select: { id: true },
      },
    },
  });

  if (!referral || referral.status === "rewarded" || referral.status === "declined") {
    return { qualified: false, rewarded: false };
  }

  // Birinchi ma'noli faollik kifoya: bitta epizodni tomosha qilish yoki xarid.
  // Telegram bog'lash shart emas, chunki sayt email bilan ro'yxatdan o'tadi.
  const hasPurchase = referral.referred.purchases.length >= 1;
  const hasWatched = referral.referred.watchEvents.length >= 1;
  const isQualified = hasPurchase || hasWatched;
  if (!isQualified) {
    return { qualified: false, rewarded: false };
  }

  if (referral.isSuspicious) {
    await db.referral.update({
      where: { id: referral.id },
      data: { status: "declined", qualifiedAt: new Date() },
    });
    return { qualified: false, rewarded: false };
  }

  // Oylik limitni tekshirish (referrer uchun)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyRewardedCount = await db.referral.count({
    where: {
      referrerId: referral.referrerId,
      status: "rewarded",
      rewardedAt: { gte: startOfMonth },
    },
  });

  const withinMonthlyLimit = monthlyRewardedCount < REFERRAL_CONFIG.monthlyMaxLimit;

  await db.$transaction(async (tx) => {
    await tx.referral.update({
      where: { id: referral.id },
      data: {
        status: withinMonthlyLimit ? "rewarded" : "qualified",
        qualifiedAt: new Date(),
        rewardedAt: withinMonthlyLimit ? new Date() : null,
      },
    });

    if (withinMonthlyLimit) {
      // 1. Referrerga mukofot (+100 XP, +10 kredit)
      await tx.user.update({
        where: { id: referral.referrerId },
        data: { credits: { increment: REFERRAL_CONFIG.referrerReward.credits } },
      });
      await tx.xpEvent.create({
        data: {
          userId: referral.referrerId,
          reason: "referral_bonus",
          amount: REFERRAL_CONFIG.referrerReward.xp,
          refType: "referral",
          refId: referral.id,
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId: referral.referrerId,
          amount: REFERRAL_CONFIG.referrerReward.credits,
          type: "REFERRAL_BONUS",
          description: "Do'st taklif qilingani uchun mukofot",
        },
      });

      // 2. Taklif qilingan do'stga mukofot (+50 XP, +5 kredit)
      await tx.user.update({
        where: { id: referral.referredId },
        data: { credits: { increment: REFERRAL_CONFIG.referredReward.credits } },
      });
      await tx.xpEvent.create({
        data: {
          userId: referral.referredId,
          reason: "referral_welcome",
          amount: REFERRAL_CONFIG.referredReward.xp,
          refType: "referral_welcome",
          refId: referral.id,
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId: referral.referredId,
          amount: REFERRAL_CONFIG.referredReward.credits,
          type: "REFERRAL_WELCOME",
          description: "Do'st havolasi orqali qo'shilganingiz uchun xush kelibsiz bonusi",
        },
      });
    }
  });

  return { qualified: true, rewarded: withinMonthlyLimit };
}

export async function getReferralStats(userId: string) {
  const code = await getOrCreateReferralCode(userId);

  // Hodisa o'tkazib yuborilgan bo'lsa ham, sahifa ochilganda kutilayotgan
  // referallarni qayta tekshiramiz — aks holda "Kutilmoqda..." abadiy qoladi.
  const pendingReferrals = await db.referral.findMany({
    where: { referrerId: userId, status: { in: ["pending", "qualified"] } },
    select: { referredId: true },
    take: 25,
  });
  for (const pending of pendingReferrals) {
    await checkAndQualifyReferral(pending.referredId);
  }

  const [totalInvited, qualifiedCount, rewards] = await Promise.all([
    db.referral.count({ where: { referrerId: userId } }),
    db.referral.count({ where: { referrerId: userId, status: { in: ["qualified", "rewarded"] } } }),
    db.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return {
    code,
    totalInvited,
    qualifiedCount,
    monthlyMaxLimit: REFERRAL_CONFIG.monthlyMaxLimit,
    rewards,
  };
}

export async function getReferralLeaderboard() {
  const topReferrers = await db.referral.groupBy({
    by: ["referrerId"],
    where: { status: "rewarded" },
    _count: { referredId: true },
    orderBy: { _count: { referredId: "desc" } },
    take: 10,
  });

  const users = await db.user.findMany({
    where: { id: { in: topReferrers.map((r) => r.referrerId) } },
    select: { id: true, username: true, displayName: true, avatarUrl: true, avatarFrame: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return topReferrers.map((r, index) => ({
    rank: index + 1,
    user: userMap.get(r.referrerId) || { username: "Noma'lum" },
    count: r._count.referredId,
  }));
}
