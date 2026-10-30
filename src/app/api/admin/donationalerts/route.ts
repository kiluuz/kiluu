import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { db } from "@/lib/db";
import { daConnectionSummary, daDisconnect } from "@/lib/donationalerts";
import { daErrorResponse } from "@/lib/da-internal";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const [summary, events, pending] = await Promise.all([
      daConnectionSummary(),
      db.donationEvent.findMany({
        where: { status: { in: ["unmatched", "wrong_currency", "expired", "ignored"] } },
        orderBy: { receivedAt: "desc" },
        take: 15,
      }),
      db.payoutRequest.aggregate({
        where: { status: "pending" },
        _count: { _all: true },
        _sum: { amountMinor: true, credits: true },
      }),
    ]);
    return NextResponse.json({
      ...summary,
      events: events.map((event) => ({
        donationId: event.donationId,
        amountMinor: event.amountMinor,
        currency: event.currency,
        message: event.message,
        donorName: event.donorName,
        status: event.status,
        reason: event.reason,
        receivedAt: event.receivedAt.toISOString(),
      })),
      payoutQueue: {
        count: pending._count._all,
        amountMinor: pending._sum.amountMinor ?? 0,
        credits: pending._sum.credits ?? 0,
      },
    });
  } catch (error) {
    return daErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "disconnect") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  try {
    await daDisconnect();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return daErrorResponse(error);
  }
}
