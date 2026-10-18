import { timingSafeEqual } from "crypto";

export function siteBotSecret(): string {
  return process.env.ANIME_BOT_API_KEY || process.env.SITE_API_KEY || "";
}

export function telegramBotToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
}

/** Shared secret for site↔bot HTTP. Never treat the Telegram bot token as this key. */
export function botRequestAuthorized(header: string | null): boolean {
  const secret = siteBotSecret();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
