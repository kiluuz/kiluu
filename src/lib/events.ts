// src/lib/events.ts
// DubAniX Markaziy Hodisalar Shinasi (Central Event Bus) (11-QISM)

import { db } from "./db";
import { getDateStringInTimezone, recordUserActivityForStreak } from "./streaks";
import { processQuestsForEvent } from "./quests";
import { checkAndQualifyReferral } from "./referrals";
import { calculateLevel } from "./level-utils";
import { DAILY_ACTIVITY_CAPS } from "./xp";

export interface EventResult {
  xpAwarded: number;
  questsUpdated: number;
  levelUp?: { oldLevel: number; newLevel: number; title: string };
  streakUpdated?: boolean;
  referralQualified?: boolean;
}

// Anti-spam va dublikat xabarlar kesh xotirasi (oxirgi 60 soniya)
const recentContentCache = new Map<string, number>();

export async function emitEvent(
  user: { id: string },
  type: string,
  payload: Record<string, any> = {}
): Promise<EventResult> {
  const userId = user.id;
  let xpAwarded = 0;
  let questsUpdated = 0;

  // 1. Anti-abuse tekshiruvlari
  if (type === "post_created" || type === "comment_created") {
    const text = String(payload.content || payload.body || "").trim();
    if (text.length < 3) {
      return { xpAwarded: 0, questsUpdated: 0 }; // Juda qisqa, hisoblanmaydi
    }
    const cacheKey = `${userId}:${type}:${text.toLowerCase().slice(0, 50)}`;
    const now = Date.now();
    const last = recentContentCache.get(cacheKey);
    if (last && now - last < 60_000) {
      // Dublikat matn 60 soniya ichida takrorlangan — spam
      return { xpAwarded: 0, questsUpdated: 0 };
    }
    recentContentCache.set(cacheKey, now);
  } else if (type === "chat_message_sent") {
    const text = String(payload.content || payload.body || "").trim();
    if (text.length < 1) {
      return { xpAwarded: 0, questsUpdated: 0 };
    }
    const cacheKey = `${userId}:${type}:${text.toLowerCase().slice(0, 50)}`;
    const now = Date.now();
    const last = recentContentCache.get(cacheKey);
    if (last && now - last < 3_000) {
      // 3 soniya ichida bir xil xabarni takrorlash — spam
      return { xpAwarded: 0, questsUpdated: 0 };
    }
    recentContentCache.set(cacheKey, now);
  }

  if (type === "like_given" || type === "like_received") {
    // O'z-o'ziga like hisoblanmaydi
    if (payload.authorId && payload.authorId === userId) {
      return { xpAwarded: 0, questsUpdated: 0 };
    }
  }

  if (type === "like_given" && payload.postId) {
    // Ayni bitta postga bir necha marta like/unlike qilib quest oshirishni oldini olish
    const cacheKey = `${userId}:like_given:${payload.postId}`;
    const now = Date.now();
    const last = recentContentCache.get(cacheKey);
    if (last && now - last < 24 * 60 * 60_000) {
      return { xpAwarded: 0, questsUpdated: 0 };
    }
    recentContentCache.set(cacheKey, now);
  }

  // 2. XP berish va Kunlik XP Limiti tekshiruvi
  const today = getDateStringInTimezone(new Date());

  // Bazaviy XP miqdorlari
  let baseAmount = 0;
  let capSource: string | null = null;

  if (type === "post_created") {
    baseAmount = 25;
    capSource = "post";
  } else if (type === "comment_created") {
    baseAmount = 8;
    capSource = "comment";
  } else if (type === "like_received") {
    baseAmount = 3;
    capSource = "like";
  } else if (type === "chat_message_sent") {
    baseAmount = 5;
    capSource = "chat";
  } else if (type === "episode_watched") {
    baseAmount = 15; // Cheklovsiz
  } else if (type === "purchase") {
    baseAmount = 250; // Cheklovsiz
  } else if (type === "gift_sent") {
    baseAmount = 80;
  } else if (type === "gift_received") {
    baseAmount = 40;
  }

  if (baseAmount > 0) {
    let allowedXp = baseAmount;

    if (capSource && DAILY_ACTIVITY_CAPS[capSource]) {
      const maxCap = DAILY_ACTIVITY_CAPS[capSource];
      const capRecord = await db.dailyXpCap.findUnique({
        where: {
          userId_date_source: {
            userId,
            date: today,
            source: capSource,
          },
        },
      });

      const current = capRecord?.amount ?? 0;
      if (current >= maxCap) {
        allowedXp = 0; // Kunlik limitga yetgan
      } else {
        allowedXp = Math.min(baseAmount, maxCap - current);
        await db.dailyXpCap.upsert({
          where: {
            userId_date_source: {
              userId,
              date: today,
              source: capSource,
            },
          },
          update: { amount: { increment: allowedXp } },
          create: {
            userId,
            date: today,
            source: capSource,
            amount: allowedXp,
          },
        });
      }
    }

    if (allowedXp > 0) {
      // Dastlabki darajani olish
      const oldTotal = await db.xpEvent.aggregate({
        where: { userId },
        _sum: { amount: true },
      });
      const oldLevelInfo = calculateLevel(oldTotal._sum.amount || 0);

      // XP event yozish
      await db.xpEvent.create({
        data: {
          userId,
          reason: type,
          amount: allowedXp,
          refType: payload.refType || null,
          refId: payload.refId || null,
        },
      });
      xpAwarded = allowedXp;

      // Yangi darajani tekshirish
      const newLevelInfo = calculateLevel((oldTotal._sum.amount || 0) + allowedXp);
      if (newLevelInfo.level > oldLevelInfo.level) {
        // Level ko'tarildi!
        await onUserLevelUp(userId, oldLevelInfo.level, newLevelInfo.level, newLevelInfo.titleJa);
      }
    }
  }

  // 3. Vazifalar (Quests) jarayonini yangilash
  questsUpdated = await processQuestsForEvent(userId, type, 1);

  // 4. Streak faolligini qayd qilish (agar ma'noli harakat bo'lsa)
  const isMeaningful = [
    "episode_watched",
    "post_created",
    "comment_created",
    "chat_message_sent",
    "daily_claim",
    "quest_claimed",
  ].includes(type);

  if (isMeaningful) {
    await recordUserActivityForStreak(userId);
  }

  // 5. Referral malakaliligini tekshirish
  let referralQualified = false;
  if (type === "purchase" || type === "episode_watched") {
    const res = await checkAndQualifyReferral(userId);
    referralQualified = res.qualified;
  }

  // 6. Klub vazifalarini yangilash (agar a'zo bo'lsa)
  if (type === "episode_watched" || type === "chat_message_sent") {
    try {
      const membership = await db.clubMember.findFirst({
        where: { userId },
        select: { clubId: true },
      });
      if (membership?.clubId) {
        const activeClubQuest = await db.clubQuest.findFirst({
          where: {
            clubId: membership.clubId,
            eventType: type,
            status: "active",
            expiresAt: { gt: new Date() },
          },
        });
        if (activeClubQuest) {
          const newProgress = activeClubQuest.progress + 1;
          const completed = newProgress >= activeClubQuest.targetCount;
          await db.clubQuest.update({
            where: { id: activeClubQuest.id },
            data: {
              progress: newProgress,
              status: completed ? "completed" : "active",
            },
          });
          await db.clubQuestContribution.upsert({
            where: { clubQuestId_userId: { clubQuestId: activeClubQuest.id, userId } },
            update: { amount: { increment: 1 } },
            create: { clubQuestId: activeClubQuest.id, userId, amount: 1 },
          });
        }
      }
    } catch (e) {
      console.error("Club quest update error:", e);
    }
  }

  return {
    xpAwarded,
    questsUpdated,
    streakUpdated: isMeaningful,
    referralQualified,
  };
}

async function onUserLevelUp(
  userId: string,
  oldLevel: number,
  newLevel: number,
  title: string
) {
  try {
    // 1. In-app bildirishnoma yaratish
    await db.notification.create({
      data: {
        userId,
        type: "LEVEL_UP",
        title: "Darajangiz oshdi!",
        body: `Tabriklaymiz! Siz ${newLevel}-darajaga yetdingiz. Yangi titul: ${title}`,
        dataJson: JSON.stringify({ oldLevel, newLevel, title }),
      },
    });

    // 2. Telegram Bot orqali bildirishnoma
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });

    const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    if (user?.telegramId && token) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user.telegramId,
          text: `🎉 <b>DubAniX Daraja O'sishi!</b>\n\nTabriklaymiz! Siz <b>${newLevel}-daraja</b>ga (${title}) yetdingiz!\nProfil sozlamalari va yangi imkoniyatlar ochildi.`,
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => {});
    }

    // 3. Level mukofotlarini avtomatik berish (agar DB da mavjud bo'lsa)
    const rewards = await db.levelReward.findMany({
      where: {
        level: { gt: oldLevel, lte: newLevel },
      },
    });

    for (const r of rewards) {
      if (r.rewardType === "credits") {
        const credits = parseInt(r.rewardValue, 10) || 0;
        if (credits > 0) {
          await db.user.update({
            where: { id: userId },
            data: { credits: { increment: credits } },
          });
          await db.creditTransaction.create({
            data: {
              userId,
              amount: credits,
              type: "LEVEL_REWARD",
              description: `${r.level}-daraja mukofoti: ${credits} kredit`,
            },
          });
        }
      } else if (r.rewardType === "streak_freeze") {
        const freezes = parseInt(r.rewardValue, 10) || 1;
        await db.user.update({
          where: { id: userId },
          data: { streakFreezeCount: { increment: freezes } },
        });
      }
    }
  } catch (e) {
    console.error("onUserLevelUp error:", e);
  }
}
