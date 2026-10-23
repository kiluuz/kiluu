import { NextRequest, NextResponse } from "next/server";
import { botRequestAuthorized } from "@/lib/bot-secret";
import { db } from "@/lib/db";
import { bindReferralOnRegistration } from "@/lib/referrals";
import { z } from "zod";

const Body = z.object({
  code: z.string().min(3).max(32),
  telegram_id: z.union([z.string(), z.number()]),
  username: z.string().max(64).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
  if (!botRequestAuthorized(key)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const code = parsed.data.code.trim().toUpperCase();
  const telegramId = String(parsed.data.telegram_id);

  const referrer = await db.user.findUnique({
    where: { referralCode: code },
    select: { id: true, username: true, displayName: true },
  });

  if (!referrer) {
    return NextResponse.json({ ok: false, error: "Referral kodi topilmadi" }, { status: 404 });
  }

  const referrerName = referrer.displayName || referrer.username;

  // Check if there is an existing linked site user
  const linkedUser = await db.user.findUnique({
    where: { telegramId },
  });

  if (linkedUser) {
    if (linkedUser.id === referrer.id) {
      return NextResponse.json({
        ok: true,
        status: "self_referral",
        referrerName,
        message: "O'z referral kodingizdan foydalana olmaysiz.",
      });
    }

    if (linkedUser.referredById) {
      return NextResponse.json({
        ok: true,
        status: "already_bound",
        referrerName,
        message: "Siz allaqachon referral dasturiga ulangansiz.",
      });
    }

    const bindResult = await bindReferralOnRegistration(linkedUser.id, code);
    return NextResponse.json({
      ok: true,
      status: "bound",
      referrerName,
      message: bindResult.message,
    });
  }

  return NextResponse.json({
    ok: true,
    status: "registered_telegram",
    referrerName,
    code,
    message: "Do'stingiz taklifi qabul qilindi. Saytda ro'yxatdan o'ting!",
  });
}
