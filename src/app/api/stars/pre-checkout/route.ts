import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { botRequestAuthorized } from "@/lib/bot-secret";

/** Bot must call this and answerPreCheckoutQuery within 10s. */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-api-key") || req.headers.get("x-webhook-secret");
  if (!botRequestAuthorized(key)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as { payload?: string; stars?: number };
  if (!body.payload) return NextResponse.json({ ok: false, error: "missing payload" }, { status: 400 });

  const p = await db.starsPayment.findFirst({
    where: { invoicePayload: body.payload, status: { in: ["pending", "PENDING"] } },
  });
  if (!p) return NextResponse.json({ ok: false, error: "order not found" });
  if (typeof body.stars === "number" && body.stars !== p.starsAmount) {
    return NextResponse.json({ ok: false, error: "price mismatch" });
  }
  return NextResponse.json({ ok: true, paymentId: p.id });
}
