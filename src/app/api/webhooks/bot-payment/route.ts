import { NextResponse } from "next/server";

/**
 * @deprecated Use /api/webhooks/telegram-stars instead.
 * This stub is kept so existing references don't 404.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Bu endpoint eskirgan. /api/webhooks/telegram-stars dan foydalaning." },
    { status: 410 }
  );
}
