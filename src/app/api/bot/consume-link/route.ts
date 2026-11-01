import { NextRequest, NextResponse } from "next/server";
import { consumeLinkToken } from "@/lib/telegram-link";
import { botRequestAuthorized } from "@/lib/bot-secret";
import { log } from "@/lib/logger";
import { z } from "zod";

const Body = z.object({
  token: z.string().min(8).max(128),
  telegram_id: z.union([z.string(), z.number()]),
  username: z.string().max(64).optional().nullable(),
});

/** Called by the bot after /start link_<token>. */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
  if (!botRequestAuthorized(key)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const result = await consumeLinkToken({
    token: parsed.data.token,
    telegramId: String(parsed.data.telegram_id),
    telegramUsername: parsed.data.username,
  });
  if (!result.ok) {
    log.warn("consume-link refused", { code: result.code });
    return NextResponse.json(
      { error: `link_${result.code}`, code: result.code },
      // 410/404 let the bot tell "get a fresh link" apart from a real config problem.
      { status: result.code === "expired" ? 410 : 404 }
    );
  }
  return NextResponse.json({ ok: true, site_user_id: result.userId });
}
