import { NextRequest, NextResponse } from "next/server";
import { consumeLinkToken } from "@/lib/telegram-link";
import { botRequestAuthorized } from "@/lib/bot-secret";
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
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, site_user_id: result.userId });
}
