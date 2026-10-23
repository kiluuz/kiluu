// src/app/api/cron/daily-reset/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveWeeklyPoll } from "@/lib/weekly-vote";
import { getWeekPeriodKey } from "@/lib/quests";
import { getDateStringInTimezone } from "@/lib/streaks";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const today = getDateStringInTimezone(now);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday

    const results: Record<string, any> = {};

    // 1. Agar dushanba bo'lsa, o'tgan haftaning Anime of the Week ovozini yakunlash
    if (dayOfWeek === 1) {
      const lastWeekKey = getWeekPeriodKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      const pollRes = await resolveWeeklyPoll(lastWeekKey);
      results.weeklyPollResolved = pollRes;
    }

    // 2. Kechki streak eslatmasi (faqat soat 19:00 dan 22:00 gacha Toshkent vaqti bilan): Bugun kirmagan va streak'i bor userlarga Bot orqali kuniga FAZAT 1 MARTA eslatma
    const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    const tashkentHour = parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tashkent", hour: "numeric", hour12: false }).format(now),
      10
    );
    const isEveningReminderWindow = tashkentHour >= 19 && tashkentHour <= 22;

    if (botToken && isEveningReminderWindow) {
      const candidatesForReminder = await db.user.findMany({
        where: {
          telegramId: { not: null },
          streakReminders: true,
          streakCount: { gt: 0 },
          dailyClaims: {
            none: {
              claimDate: today,
            },
          },
        },
        select: {
          id: true,
          telegramId: true,
          streakCount: true,
          streakFreezeCount: true,
        },
        take: 100, // Batch limit
      });

      const startOfTodayUtc = new Date(now);
      startOfTodayUtc.setUTCHours(0, 0, 0, 0);

      let remindersSent = 0;
      for (const u of candidatesForReminder) {
        if (!u.telegramId) continue;
        try {
          // Bugun foydalanuvchiga eslatma yuborilganligini tekshirish (takrorlanish va har minutda xabar borishini 100% oldini olish)
          const alreadySent = await db.notification.findFirst({
            where: {
              userId: u.id,
              type: "STREAK_REMINDER",
              createdAt: { gte: startOfTodayUtc },
            },
          });
          if (alreadySent) continue;

          const freezeText = u.streakFreezeCount > 0
            ? `🧊 Sizda ${u.streakFreezeCount} ta streak muzlatgichi bor.`
            : `⚠️ Diqqat: Sizda streak muzlatgichi yo'q, bugun kirmasangiz streak 0 ga tushadi!`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: u.telegramId,
              text: `🔥 <b>Kiluu Streak Eslatmasi!</b>\n\nSizning <b>${u.streakCount} kunlik</b> faol streak'ingiz uzilib qolishiga oz qoldi!\nBugungi kunlik mukofotingizni oling va streak'ni davom ettiring.\n\n${freezeText}\n\n👉 <a href="https://kiluu.uz">Kiluu platformasiga kirish</a>`,
              parse_mode: "HTML",
            }),
            signal: AbortSignal.timeout(3000),
          });

          // Eslatma yuborilganini qayd qilish (bugun qayta yuborilmasligi uchun)
          await db.notification.create({
            data: {
              userId: u.id,
              type: "STREAK_REMINDER",
              title: "Streak Eslatmasi",
              body: `${u.streakCount} kunlik streak saqlab qolindi`,
            },
          });

          remindersSent++;
        } catch (e) {
          console.warn("Failed to send streak reminder to:", u.id, e);
        }
      }
      results.remindersSent = remindersSent;
    }

    // 3. Muddati o'tgan eski user quest'larni tozalash (30 kundan eski)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deletedOldQuests = await db.userQuest.deleteMany({
      where: {
        expiresAt: { lt: thirtyDaysAgo },
      },
    });
    results.deletedOldQuestsCount = deletedOldQuests.count;

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("Daily reset cron error:", error);
    return NextResponse.json({ error: "Daily reset cron xatosi" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
