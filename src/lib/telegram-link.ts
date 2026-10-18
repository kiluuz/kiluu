import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { BOT_USERNAME } from "@/lib/bot-api";

export const LINK_TTL_SEC = 15 * 60;

export function linkDeepUrl(token: string, botUsername = BOT_USERNAME): string {
  const name = botUsername.replace(/^@/, "");
  return `https://t.me/${name}?start=link_${token}`;
}

export async function issueLinkToken(userId: string) {
  await db.telegramLinkToken.deleteMany({
    where: { OR: [{ userId, usedAt: null }, { expiresAt: { lt: new Date() } }] },
  });
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + LINK_TTL_SEC * 1000);
  await db.telegramLinkToken.create({
    data: { token, userId, expiresAt },
  });
  return { token, expiresAt, link: linkDeepUrl(token), expires_in: LINK_TTL_SEC };
}

export async function consumeLinkToken(opts: {
  token: string;
  telegramId: string;
  telegramUsername?: string | null;
}) {
  const row = await db.telegramLinkToken.findUnique({ where: { token: opts.token } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    return { ok: false as const, error: "expired_or_invalid" };
  }

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

  return { ok: true as const, userId: row.userId };
}
