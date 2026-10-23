// src/lib/chat.ts
// DubAniX Chat & Real-time yordamchi funksiyalari (10-QISM)

import { db } from "./db";

// ─── JWT (WebSocket token) ────────────────────────────────────────────────
const JWT_SECRET = process.env.REALTIME_JWT_SECRET ?? "dubanix-realtime-jwt-secret-dev-2026-secure";

export async function signChatJwt(payload: {
  userId: string;
  roomId: string;
  role: string;
  level: number;
}): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 300 }) // 5 daqiqa
  );
  const data = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${data}.${sigB64}`;
}

// ─── Room ID yordamchilari ────────────────────────────────────────────────
export function globalRoomId(): string {
  return "global";
}
export function clubRoomId(clubId: string): string {
  return `club:${clubId}`;
}
export function animeRoomId(animeId: string): string {
  return `anime:${animeId}`;
}

// ─── Xonani DB dan topish yoki yaratish (string yoki CUID qabul qiladi) ─────
export async function getOrCreateRoom(roomIdentifier: string) {
  let type: "global" | "club" | "anime" = "global";
  let refId: string | null = null;

  if (roomIdentifier === "global") {
    type = "global";
  } else if (roomIdentifier.startsWith("club:")) {
    type = "club";
    refId = roomIdentifier.slice(5);
  } else if (roomIdentifier.startsWith("anime:")) {
    type = "anime";
    refId = roomIdentifier.slice(6);
  } else {
    // Agar to'g'ridan-to'g'ri CUID berilgan bo'lsa
    const existing = await db.chatRoom.findUnique({
      where: { id: roomIdentifier },
      include: { club: true },
    });
    if (existing) return existing;
    type = "global";
  }

  let room = await db.chatRoom.findFirst({
    where: type === "global" ? { type: "global" } : { type, refId },
    include: { club: true },
  });

  if (!room) {
    room = await db.chatRoom.create({
      data: {
        type,
        refId,
        ...(type === "club" && refId ? { clubId: refId } : {}),
      },
      include: { club: true },
    });
  }

  return room;
}

// ─── Xonaga kirish huquqini tekshirish ───────────────────────────────────
export async function checkRoomAccess(
  roomIdentifier: string,
  userId: string
): Promise<{ allowed: boolean; role: string; level: number; room: any; reason?: string }> {
  const room = await getOrCreateRoom(roomIdentifier);
  if (!room) return { allowed: false, role: "member", level: 1, room: null, reason: "Xona topilmadi" };

  // User ma'lumotlari
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      communityBlocked: true,
      xpEvents: { select: { amount: true } },
    },
  });
  if (!user) return { allowed: false, role: "member", level: 1, room, reason: "Foydalanuvchi topilmadi" };
  if (user.communityBlocked) {
    return { allowed: false, role: "member", level: 1, room, reason: "Jamiyatdan bloklangansiz" };
  }

  const totalXp = user.xpEvents.reduce((sum, e) => sum + e.amount, 0);
  const { level } = (await import("./xp")).levelFromXp(totalXp);

  // Ban tekshiruvi (global yoki xona ban)
  const ban = await db.chatBan.findFirst({
    where: {
      userId,
      type: "ban",
      AND: [
        { OR: [{ roomId: room.id }, { roomId: null }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ],
    },
  });
  if (ban) return { allowed: false, role: "member", level, room, reason: ban.reason || "Xonadan ban qilingansiz" };

  // Global xona
  if (room.type === "global") {
    return { allowed: true, role: user.role === "admin" || user.role === "ADMIN" ? "admin" : "member", level, room };
  }

  // Anime xona
  if (room.type === "anime") {
    return { allowed: true, role: user.role === "admin" || user.role === "ADMIN" ? "admin" : "member", level, room };
  }

  // Klub xonasi
  if (room.type === "club") {
    const clubId = room.clubId || room.refId;
    if (!clubId) return { allowed: false, role: "member", level, room, reason: "Klub xonasi topilmadi" };

    const membership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId, userId } },
    });
    if (!membership && user.role !== "admin" && user.role !== "ADMIN") {
      return { allowed: false, role: "member", level, room, reason: "Ushbu klub a'zosi emassiz" };
    }

    return {
      allowed: true,
      role: user.role === "admin" || user.role === "ADMIN" ? "admin" : membership?.role || "member",
      level,
      room,
    };
  }

  return { allowed: false, role: "member", level, room, reason: "Ruxsat berilmagan" };
}

// ─── Worker ga xabar tarqatish ────────────────────────────────────────────
const PUSH_URL = process.env.NEXT_PUBLIC_REALTIME_WS_URL
  ? process.env.NEXT_PUBLIC_REALTIME_WS_URL.replace("wss://", "https://").replace("ws://", "http://")
  : process.env.REALTIME_WORKER_URL || "";
const PUSH_SECRET = process.env.REALTIME_PUSH_SECRET ?? "dubanix-realtime-push-secret-dev-2026-secure";

export async function pushToRoom(roomId: string, payload: unknown): Promise<void> {
  if (!PUSH_URL || !PUSH_SECRET) return;
  try {
    const cleanUrl = PUSH_URL.replace(/\/+$/, "");
    await fetch(`${cleanUrl}/push/${encodeURIComponent(roomId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PUSH_SECRET}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    });
  } catch (e) {
    console.error("pushToRoom failed:", e);
  }
}

// ─── Level gate tekshiruvi ────────────────────────────────────────────────
export async function checkLevelGate(feature: string, userLevel: number): Promise<boolean> {
  const gate = await db.levelGate.findUnique({ where: { feature } });
  if (!gate) {
    if (feature === "create_club") return userLevel >= 10;
    if (feature === "send_image") return userLevel >= 5;
    if (feature === "create_poll") return userLevel >= 3;
    return true;
  }
  return userLevel >= gate.minLevel;
}

// ─── Rate limit (xabar yuborish) ─────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function chatRateLimit(userId: string, roomId: string): boolean {
  const key = `${userId}:${roomId}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 10_000 });
    return true;
  }
  if (entry.count >= 5) return false; // 5 xabar/10 soniya
  entry.count++;
  return true;
}

// ─── Klub darajasini hisoblash (1-20) ─────────────────────────────────────
export function clubLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  // Har daraja uchun XP: 1 -> 0, 2 -> 200, 3 -> 500, ... 20 -> 50,000
  const lvl = Math.floor(Math.sqrt(xp / 120)) + 1;
  return Math.min(20, Math.max(1, lvl));
}

// ─── Klub XP qo'shish ─────────────────────────────────────────────────────
export async function awardClubXp(clubId: string, userId: string, amount: number, type: string) {
  try {
    const event = await db.clubXpEvent.create({
      data: {
        clubId,
        userId,
        type,
        xp: amount,
      },
    });

    const club = await db.club.findUnique({
      where: { id: clubId },
      select: { xp: true, level: true },
    });
    if (club) {
      const newXp = club.xp + amount;
      const newLevel = clubLevelFromXp(newXp);
      await db.club.update({
        where: { id: clubId },
        data: {
          xp: newXp,
          level: newLevel,
        },
      });
    }
    return event;
  } catch (e) {
    console.error("awardClubXp error:", e);
    return null;
  }
}

// ─── Telegram bildirishnomalari (spamdan himoyalangan: 5 min/xona) ─────────
const telegramNotificationThrottle = new Map<string, number>();

export async function notifyTelegramUser(userId: string, roomLabel: string, text: string) {
  const throttleKey = `${userId}:${roomLabel}`;
  const last = telegramNotificationThrottle.get(throttleKey);
  const now = Date.now();
  if (last && now - last < 5 * 60 * 1000) {
    return; // 5 daqiqalik himoya
  }

  const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  if (!token) return;

  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { telegramId: true, username: true },
    });
    if (!user?.telegramId) return;

    telegramNotificationThrottle.set(throttleKey, now);

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: user.telegramId,
        text: `💬 DubAniX Chat [${roomLabel}]\n\n${text}`,
        parse_mode: "HTML",
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) {
    console.error("Telegram notification error:", e);
  }
}

// ─── Klub kredit narxi ────────────────────────────────────────────────────
export const EXTRA_CLUB_COST_CREDITS = 200; // 1-klub bepul, 2+ klublar 200 kredit
