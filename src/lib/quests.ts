// src/lib/quests.ts
// DubAniX Vazifalar (Quests) tizimi (11-QISM)

import { db } from "./db";
import { getDateStringInTimezone } from "./streaks";

export const DEFAULT_DAILY_QUEST_TEMPLATES = [
  {
    title: "Watch 1 episode",
    titleUz: "1 ta epizod tomosha qil",
    description: "Ixtiyoriy animedan kamida 1 ta epizod ko'r",
    type: "daily",
    category: "watch",
    eventType: "episode_watched",
    targetCount: 1,
    xpReward: 25,
    creditReward: 0,
    difficulty: "easy",
  },
  {
    title: "Join the conversation",
    titleUz: "Chatda 5 ta xabar yoz",
    description: "Global yoki klub chatida 5 ta xabar yoz",
    type: "daily",
    category: "social",
    eventType: "chat_message_sent",
    targetCount: 5,
    xpReward: 20,
    creditReward: 0,
    difficulty: "easy",
  },
  {
    title: "Leave a comment",
    titleUz: "Postga fikr bildir",
    description: "Community postiga mazmunli izoh qoldir",
    type: "daily",
    category: "social",
    eventType: "comment_created",
    targetCount: 1,
    xpReward: 15,
    creditReward: 0,
    difficulty: "easy",
  },
  {
    title: "Spread the love",
    titleUz: "3 ta postga like bos",
    description: "Yoqqan postlarga 3 marta like bosing",
    type: "daily",
    category: "social",
    eventType: "like_given",
    targetCount: 3,
    xpReward: 15,
    creditReward: 0,
    difficulty: "easy",
  },
  {
    title: "Daily Login",
    titleUz: "Kunlik kirish mukofotini ol",
    description: "Kunlik kirish bo'limidan mukofotingizni oling",
    type: "daily",
    category: "explore",
    eventType: "daily_claim",
    targetCount: 1,
    xpReward: 15,
    creditReward: 0,
    difficulty: "easy",
  },
  {
    title: "Rate an Anime",
    titleUz: "Animega real baho ber",
    description: "Ixtiyoriy animega 1 dan 10 gacha yulduz qo'ying",
    type: "daily",
    category: "social",
    eventType: "rating_given",
    targetCount: 1,
    xpReward: 25,
    creditReward: 1,
    difficulty: "easy",
  },
  {
    title: "Vote in Weekly Poll",
    titleUz: "Hafta animesiga ovoz ber",
    description: "Hafta animesi bo'limida sevimli nomzodingizga ovoz bering",
    type: "daily",
    category: "social",
    eventType: "weekly_poll_voted",
    targetCount: 1,
    xpReward: 30,
    creditReward: 1,
    difficulty: "easy",
  },
];

export const DEFAULT_WEEKLY_QUEST_TEMPLATES = [
  {
    title: "Anime Marathon",
    titleUz: "Haftalik marafon: 10 ta epizod",
    description: "Bu hafta kamida 10 ta anime epizodi tomosha qil",
    type: "weekly",
    category: "watch",
    eventType: "episode_watched",
    targetCount: 10,
    xpReward: 120,
    creditReward: 5,
    difficulty: "medium",
  },
  {
    title: "Community Star",
    titleUz: "Jamoat yulduzi: 2 ta post yarat",
    description: "Community bo'limida 2 ta post e'lon qil",
    type: "weekly",
    category: "social",
    eventType: "post_created",
    targetCount: 2,
    xpReward: 80,
    creditReward: 5,
    difficulty: "medium",
  },
  {
    title: "Generous Soul",
    titleUz: "Do'stingga sovg'a yubor",
    description: "Ixtiyoriy foydalanuvchiga anime yoki kredit sovg'a qil",
    type: "weekly",
    category: "spend",
    eventType: "gift_sent",
    targetCount: 1,
    xpReward: 100,
    creditReward: 10,
    difficulty: "hard",
  },
  {
    title: "Invite a Friend",
    titleUz: "Do'stingni taklif qil",
    description: "Referral kodingiz orqali 1 ta do'stingizni saytga taklif qiling",
    type: "weekly",
    category: "social",
    eventType: "referral_completed",
    targetCount: 1,
    xpReward: 150,
    creditReward: 10,
    difficulty: "medium",
  },
];

export function getWeekPeriodKey(date: Date = new Date()): string {
  // ISO hafta hisoblash (YYYY-Www)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `weekly:${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getDailyPeriodKey(timezone?: string): string {
  return `daily:${getDateStringInTimezone(new Date(), timezone)}`;
}

export async function ensureDefaultQuestTemplates() {
  const count = await db.questTemplate.count();
  if (count > 0) return;

  for (const t of [...DEFAULT_DAILY_QUEST_TEMPLATES, ...DEFAULT_WEEKLY_QUEST_TEMPLATES]) {
    await db.questTemplate.create({ data: t });
  }
}

export async function getOrAssignUserQuests(userId: string) {
  await ensureDefaultQuestTemplates();

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const tz = user?.timezone || "Asia/Tashkent";

  const dailyKey = getDailyPeriodKey(tz);
  const weeklyKey = getWeekPeriodKey(new Date());

  // 1. Bugungi kunlik vazifalarni tekshirish
  let dailyQuests = await db.userQuest.findMany({
    where: { userId, periodKey: dailyKey },
    include: { template: true },
  });

  if (dailyQuests.length === 0) {
    const templates = await db.questTemplate.findMany({
      where: { type: "daily", isActive: true },
    });

    // 3 ta tasodifiy tanlash
    const shuffled = [...templates].sort(() => 0.5 - Math.random()).slice(0, 3);
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);

    for (const tmpl of shuffled) {
      await db.userQuest.create({
        data: {
          userId,
          templateId: tmpl.id,
          periodKey: dailyKey,
          targetCount: tmpl.targetCount,
          expiresAt: tomorrow,
        },
      });
    }

    dailyQuests = await db.userQuest.findMany({
      where: { userId, periodKey: dailyKey },
      include: { template: true },
    });
  }

  // 2. Haftalik vazifalarni tekshirish
  let weeklyQuests = await db.userQuest.findMany({
    where: { userId, periodKey: weeklyKey },
    include: { template: true },
  });

  if (weeklyQuests.length === 0) {
    const templates = await db.questTemplate.findMany({
      where: { type: "weekly", isActive: true },
    });

    const shuffled = [...templates].sort(() => 0.5 - Math.random()).slice(0, 3);
    // Keyingi dushanba 00:00 gacha
    const now = new Date();
    const daysUntilNextMonday = ((7 - now.getDay()) % 7) || 7;
    const nextMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMonday);

    for (const tmpl of shuffled) {
      await db.userQuest.create({
        data: {
          userId,
          templateId: tmpl.id,
          periodKey: weeklyKey,
          targetCount: tmpl.targetCount,
          expiresAt: nextMonday,
        },
      });
    }

    weeklyQuests = await db.userQuest.findMany({
      where: { userId, periodKey: weeklyKey },
      include: { template: true },
    });
  }

  return { dailyQuests, weeklyQuests };
}

export async function processQuestsForEvent(
  userId: string,
  eventType: string,
  increment: number = 1
): Promise<number> {
  const activeQuests = await db.userQuest.findMany({
    where: {
      userId,
      status: "active",
      expiresAt: { gt: new Date() },
      template: { eventType },
    },
    include: { template: true },
  });

  let completedCount = 0;

  for (const q of activeQuests) {
    const newProgress = q.progress + increment;
    const isCompleted = newProgress >= q.targetCount;

    await db.userQuest.update({
      where: { id: q.id },
      data: {
        progress: Math.min(newProgress, q.targetCount),
        status: isCompleted ? "completed" : "active",
      },
    });

    if (isCompleted) {
      completedCount++;
    }
  }

  return completedCount;
}

export async function claimQuestReward(userId: string, userQuestId: string): Promise<{
  success: boolean;
  xpAwarded: number;
  creditsAwarded: number;
  message: string;
}> {
  const quest = await db.userQuest.findUnique({
    where: { id: userQuestId },
    include: { template: true },
  });

  if (!quest || quest.userId !== userId) {
    return { success: false, xpAwarded: 0, creditsAwarded: 0, message: "Vazifa topilmadi" };
  }

  if (quest.status === "claimed") {
    return { success: false, xpAwarded: 0, creditsAwarded: 0, message: "Bu mukofot allaqachon olingan" };
  }

  if (quest.progress < quest.targetCount && quest.status !== "completed") {
    return { success: false, xpAwarded: 0, creditsAwarded: 0, message: "Vazifa hali to'liq bajarilmagan" };
  }

  const xpReward = quest.template.xpReward;
  const creditReward = quest.template.creditReward;

  await db.$transaction(async (tx) => {
    // 1. Vazifani claimed qilish
    await tx.userQuest.update({
      where: { id: userQuestId },
      data: {
        status: "claimed",
        claimedAt: new Date(),
      },
    });

    // 2. XP berish
    if (xpReward > 0) {
      await tx.xpEvent.create({
        data: {
          userId,
          reason: "quest_complete",
          amount: xpReward,
          refType: "quest",
          refId: userQuestId,
        },
      });
    }

    // 3. Kredit berish (agar bor bo'lsa)
    if (creditReward > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: creditReward } },
      });
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: creditReward,
          type: "QUEST_REWARD",
          description: `Vazifa mukofoti: ${quest.template.titleUz}`,
        },
      });
    }
  });

  return {
    success: true,
    xpAwarded: xpReward,
    creditsAwarded: creditReward,
    message: `Mukofot qabul qilindi! +${xpReward} XP${creditReward > 0 ? ` va +${creditReward} kredit` : ""}`,
  };
}

export async function rerollDailyQuest(userId: string, userQuestId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const quest = await db.userQuest.findUnique({
    where: { id: userQuestId },
    include: { template: true },
  });

  if (!quest || quest.userId !== userId) {
    return { success: false, message: "Vazifa topilmadi" };
  }

  if (quest.template.type !== "daily") {
    return { success: false, message: "Faqat kunlik vazifalarni almashtirish mumkin" };
  }

  if (quest.status === "claimed") {
    return { success: false, message: "Bajarib olingan vazifani almashtirib bo'lmaydi" };
  }

  // Mavjud boshqa template'lar orasidan tasodifiy tanlash
  const allDailies = await db.questTemplate.findMany({
    where: { type: "daily", isActive: true, id: { not: quest.templateId } },
  });

  if (allDailies.length === 0) {
    return { success: false, message: "Almashtirish uchun boshqa vazifa mavjud emas" };
  }

  const nextTmpl = allDailies[Math.floor(Math.random() * allDailies.length)];

  await db.userQuest.update({
    where: { id: userQuestId },
    data: {
      templateId: nextTmpl.id,
      progress: 0,
      targetCount: nextTmpl.targetCount,
      status: "active",
    },
  });

  return { success: true, message: `Vazifa yangisiga almashtirildi: "${nextTmpl.titleUz}"` };
}
