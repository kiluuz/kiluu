import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, hashPassword, toPublicUser } from "@/lib/auth";
import {
  parseInitDataUser,
  verifyTelegramInitData,
  verifyTelegramLoginWidget,
} from "@/lib/telegram-auth";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";
import { randomBytes } from "crypto";

function placeholderEmail(telegramId: string) {
  return `tg_${telegramId}@telegram.local`;
}

async function upsertTelegramUser(opts: {
  telegramId: string;
  username?: string;
  firstName?: string;
}) {
  const existing = await db.user.findUnique({ where: { telegramId: opts.telegramId } });
  if (existing) return existing;

  const unameBase = (opts.username || `user_${opts.telegramId}`).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || `u${opts.telegramId}`;
  let username = unameBase;
  let n = 0;
  while (await db.user.findUnique({ where: { username } })) {
    n += 1;
    username = `${unameBase.slice(0, 16)}_${n}`;
  }

  return db.user.create({
    data: {
      email: placeholderEmail(opts.telegramId),
      username,
      password: hashPassword(randomBytes(24).toString("hex")),
      displayName: opts.firstName || opts.username || username,
      role: "user",
      telegramId: opts.telegramId,
      telegramUsername: opts.username || null,
      locale: "en",
      onboardingDone: false,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!rateLimit(rateKey(req, "tg-auth"), 20, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const initData = typeof body.initData === "string" ? body.initData : "";

    if (initData) {
      if (!verifyTelegramInitData(initData)) {
        return NextResponse.json({ error: "Invalid Telegram initData" }, { status: 401 });
      }
      const u = parseInitDataUser(initData);
      if (!u) return NextResponse.json({ error: "Missing Telegram user" }, { status: 400 });
      const user = await upsertTelegramUser({
        telegramId: u.id,
        username: u.username,
        firstName: u.first_name,
      });
      await createSession(user.id);
      const ownedCount = await db.purchase.count({ where: { userId: user.id } });
      return NextResponse.json({ user: { ...toPublicUser(user), ownedCount } });
    }

    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "string" || typeof v === "number") fields[k] = String(v);
    }
    if (!verifyTelegramLoginWidget(fields)) {
      return NextResponse.json({ error: "Invalid Telegram login" }, { status: 401 });
    }
    const user = await upsertTelegramUser({
      telegramId: fields.id,
      username: fields.username,
      firstName: fields.first_name,
    });
    await createSession(user.id);
    const ownedCount = await db.purchase.count({ where: { userId: user.id } });
    return NextResponse.json({ user: { ...toPublicUser(user), ownedCount } });
  } catch (e) {
    log.error("telegram auth failed", { err: String(e) });
    return NextResponse.json({ error: "Telegram auth failed" }, { status: 500 });
  }
}
