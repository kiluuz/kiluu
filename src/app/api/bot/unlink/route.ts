import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { unlinkBotAccount } from "@/lib/bot-api";
import { unlinkTelegramAccount } from "@/lib/telegram-link";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

/** Releases this account's Telegram binding so another account can be linked cleanly. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!rateLimit(rateKey(req, "bot-unlink") + user.id, 6, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const wasLinked = await unlinkTelegramAccount(user.id);

  // The site row is the source of truth: the unlink stands even when the bot is asleep.
  let botNotified = true;
  if (wasLinked) {
    try {
      await unlinkBotAccount(user.id);
    } catch (error) {
      botNotified = false;
      log.warn("bot unlink sync failed; site binding already cleared", { err: String(error) });
    }
  }

  return NextResponse.json({ ok: true, wasLinked, botNotified });
}
