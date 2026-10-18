import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { refundStarsPayment } from "@/lib/stars";
import { refundStarPaymentBot } from "@/lib/bot-api";
import { log } from "@/lib/logger";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const p = await db.starsPayment.findUnique({
    where: { id },
    include: { user: { select: { telegramId: true } } },
  });
  if (!p?.telegramChargeId) return NextResponse.json({ error: "No charge id" }, { status: 400 });
  if (!p.user.telegramId) return NextResponse.json({ error: "User has no Telegram id" }, { status: 400 });

  try {
    await refundStarPaymentBot({
      telegram_id: p.user.telegramId,
      telegram_charge_id: p.telegramChargeId,
    });
  } catch (e) {
    log.error("telegram refundStarPayment failed", { err: String(e), id });
    return NextResponse.json({ error: "Telegram refund failed" }, { status: 502 });
  }

  const result = await refundStarsPayment(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, payment: result.payment });
}
