import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatScheduleLocalTime } from "@/lib/schedule-notifications";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const SCHEDULE_QUERY = `
query ($from: Int, $to: Int) {
  Page(page: 1, perPage: 50) {
    airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
      id
      episode
      airingAt
      media {
        id
        isAdult
        title { romaji english }
      }
    }
  }
}`;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "Telegram bot is not configured" }, { status: 503 });

  const now = new Date();
  const lowerBound = Math.floor((now.getTime() - 2 * 60_000) / 1000);
  const upperBound = Math.floor((now.getTime() + 60_000) / 1000);
  const airingResponse = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: SCHEDULE_QUERY,
      variables: { from: lowerBound, to: upperBound },
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!airingResponse.ok) {
    console.error("AniList schedule notification lookup failed", { status: airingResponse.status });
    return NextResponse.json({ error: "Schedule provider is unavailable" }, { status: 502 });
  }
  const payload = await airingResponse.json() as {
    errors?: unknown[];
    data?: { Page?: { airingSchedules?: Array<{
      id: number;
      episode: number;
      airingAt: number;
      media?: { id: number; isAdult?: boolean; title?: { romaji?: string; english?: string | null } };
    }> } };
  };
  if (payload.errors?.length) {
    console.error("AniList returned schedule notification errors", { errors: payload.errors });
    return NextResponse.json({ error: "Schedule provider returned invalid data" }, { status: 502 });
  }
  const airings = (payload.data?.Page?.airingSchedules || []).filter(
    (airing) => !airing.media?.isAdult && Number.isSafeInteger(airing.id) && Number.isSafeInteger(airing.media?.id),
  );
  if (!airings.length) return NextResponse.json({ checked: 0, sent: 0, failed: 0 });

  const subscriptions = await db.scheduleSubscription.findMany({
    where: { anilistId: { in: [...new Set(airings.map((airing) => airing.media!.id))] } },
    include: { user: { select: { id: true, telegramId: true, timezone: true } } },
  });
  const subscriptionsByAnime = new Map<number, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const list = subscriptionsByAnime.get(subscription.anilistId) || [];
    list.push(subscription);
    subscriptionsByAnime.set(subscription.anilistId, list);
  }

  let sent = 0;
  let failed = 0;
  let checked = 0;
  for (const airing of airings) {
    const media = airing.media;
    if (!media) continue;
    const animeTitle = media.title?.english || media.title?.romaji || "Anime";
    for (const subscription of subscriptionsByAnime.get(media.id) || []) {
      const telegramId = subscription.user.telegramId;
      if (!telegramId) continue;
      checked += 1;
      const airingAt = new Date(airing.airingAt * 1000);
      await db.scheduleDelivery.upsert({
        where: { userId_scheduleId: { userId: subscription.userId, scheduleId: airing.id } },
        create: {
          userId: subscription.userId,
          scheduleId: airing.id,
          animeTitle,
          episode: airing.episode,
          airingAt,
        },
        update: {},
      });
      const claim = await db.scheduleDelivery.updateMany({
        where: {
          userId: subscription.userId,
          scheduleId: airing.id,
          OR: [
            { status: "PENDING" },
            { status: "SENDING", lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
          ],
        },
        data: { status: "SENDING", lockedAt: now, attempts: { increment: 1 }, lastError: null },
      });
      if (claim.count === 0) continue;

      const timezoneText = formatScheduleLocalTime(airingAt, subscription.user.timezone);
      const text = `🔔 ${animeTitle} — ${airing.episode}-qism chiqdi.\nMahalliy vaqt: ${timezoneText}`;
      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: telegramId, text }),
          signal: AbortSignal.timeout(8_000),
        });
        const telegramResult = await telegramResponse.json() as { ok?: boolean; description?: string };
        if (!telegramResponse.ok || !telegramResult.ok) {
          throw new Error(telegramResult.description || `Telegram error: ${telegramResponse.status}`);
        }
        await db.scheduleDelivery.updateMany({
          where: { userId: subscription.userId, scheduleId: airing.id, status: "SENDING" },
          data: { status: "SENT", sentAt: new Date(), lockedAt: null, lastError: null },
        });
        sent += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message.slice(0, 500) : "Telegram delivery failed";
        console.error("Schedule Telegram notification failed", { userId: subscription.userId, scheduleId: airing.id, message });
        await db.scheduleDelivery.updateMany({
          where: { userId: subscription.userId, scheduleId: airing.id, status: "SENDING" },
          data: { status: "PENDING", lockedAt: null, lastError: message },
        });
      }
    }
  }

  return NextResponse.json({ checked, sent, failed });
}
