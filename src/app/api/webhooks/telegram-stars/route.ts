import { NextRequest, NextResponse } from "next/server";
import { applySuccessfulStarsPayment } from "@/lib/stars";
import { botRequestAuthorized } from "@/lib/bot-secret";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
  if (!botRequestAuthorized(key) && process.env.TELEGRAM_STARS_WEBHOOK_SECRET) {
    const secret = req.headers.get("x-webhook-secret");
    if (secret !== process.env.TELEGRAM_STARS_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (!botRequestAuthorized(key) && !process.env.TELEGRAM_STARS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    telegram_charge_id?: string;
    order_payload?: string;
    payload?: string;
    stars_amount?: number;
    total_amount?: number;
  };
  const charge = body.telegram_charge_id;
  const payload = body.order_payload || body.payload;
  const stars = body.stars_amount ?? body.total_amount;
  if (!charge || !payload || typeof stars !== "number") {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const result = await applySuccessfulStarsPayment({
      telegramChargeId: charge,
      payload,
      starsAmount: stars,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch (e) {
    log.error("stars webhook", { err: String(e) });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
