import { createHash, createHmac, timingSafeEqual } from "crypto";

const MAX_AUTH_AGE_SEC = 86400; // 24h

export function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
}

function hmacHex(secret: Buffer | string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function dataCheckString(fields: Record<string, string>): string {
  return Object.keys(fields)
    .filter((k) => k !== "hash" && fields[k] !== undefined && fields[k] !== "")
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
}

function authDateFresh(authDate: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const n = Number(authDate);
  if (!Number.isFinite(n) || n <= 0) return false;
  return Math.abs(nowSec - n) <= MAX_AUTH_AGE_SEC;
}

/**
 * Telegram Login Widget: secret = SHA256(bot_token), then HMAC-SHA256(data_check_string).
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramLoginWidget(
  fields: Record<string, string>,
  token = botToken(),
  nowSec?: number
): boolean {
  if (!token || !fields.hash) return false;
  if (!authDateFresh(fields.auth_date, nowSec)) return false;
  const secret = createHash("sha256").update(token).digest();
  const check = dataCheckString(fields);
  const digest = hmacHex(secret, check);
  return safeEqualHex(digest, fields.hash);
}

/**
 * Mini App initData. Official secret is HMAC-SHA256("WebAppData", bot_token).
 * The 1-qism spec also mentions SHA256(bot_token); both are accepted.
 */
export function verifyTelegramInitData(initData: string, token = botToken(), nowSec?: number): boolean {
  if (!token || !initData) return false;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  if (!hash) return false;
  const fields: Record<string, string> = {};
  params.forEach((v, k) => {
    if (k !== "hash") fields[k] = v;
  });
  if (!authDateFresh(fields.auth_date, nowSec)) return false;
  const check = dataCheckString(fields);

  const webAppSecret = createHmac("sha256", "WebAppData").update(token).digest();
  const widgetSecret = createHash("sha256").update(token).digest();
  const a = hmacHex(webAppSecret, check);
  const b = hmacHex(widgetSecret, check);
  return safeEqualHex(a, hash) || safeEqualHex(b, hash);
}

export function parseInitDataUser(initData: string): {
  id: string;
  username?: string;
  first_name?: string;
} | null {
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: number; username?: string; first_name?: string };
    if (!u.id) return null;
    return { id: String(u.id), username: u.username, first_name: u.first_name };
  } catch {
    return null;
  }
}
