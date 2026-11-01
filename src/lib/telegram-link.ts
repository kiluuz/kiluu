import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { BOT_USERNAME } from "@/lib/bot-api";

export const LINK_TTL_SEC = 30 * 60;

export function linkDeepUrl(token: string, botUsername = BOT_USERNAME): string {
  const name = botUsername.replace(/^@/, "");
  return `https://t.me/${name}?start=link_${token}`;
}

export async function issueLinkToken(userId: string) {
  // Only the newest link stays live, so an account can never be bound through two
  // competing links at once.
  await db.telegramLinkToken.deleteMany({ where: { userId, expiresAt: { gte: new Date() } } });
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_SEC * 1000);
  await db.telegramLinkToken.create({
    data: { token, userId, expiresAt },
  });
  return { token, expiresAt, link: linkDeepUrl(token), expires_in: LINK_TTL_SEC };
}

/**
 * Binds the Telegram account that opened the link to the site account that issued it.
 * A link stays usable until it expires rather than after one hit: tapping it twice, or
 * tapping it from the other Telegram account, re-binds instead of failing.
 */
export async function consumeLinkToken(opts: {
  token: string;
  telegramId: string;
  telegramUsername?: string | null;
}): Promise<{ ok: true; userId: string } | { ok: false; code: "expired" | "unknown" }> {
  const row = await db.telegramLinkToken.findUnique({ where: { token: opts.token } });
  if (!row) return { ok: false, code: "unknown" };
  if (row.expiresAt < new Date()) return { ok: false, code: "expired" };

  // The handle moves to whoever taps the link last, so an old binding of the same
  // Telegram account on another site profile is released instead of blocking the switch.
  const taken = await db.user.findFirst({
    where: { telegramId: opts.telegramId, NOT: { id: row.userId } },
  });
  if (taken) {
    await db.user.update({ where: { id: taken.id }, data: { telegramId: null } });
  }

  await db.$transaction([
    db.user.update({
      where: { id: row.userId },
      data: {
        telegramId: opts.telegramId,
        telegramUsername: opts.telegramUsername || undefined,
      },
    }),
    db.telegramLinkToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { ok: true, userId: row.userId };
}
