import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { PayoutError, processPayoutRequest } from "@/lib/payouts";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown; note?: unknown } | null;
  const action = body?.action;
  if (action !== "paid" && action !== "reject") {
    return NextResponse.json({ error: "BAD_ACTION" }, { status: 400 });
  }
  try {
    const result = await processPayoutRequest({
      adminId: user!.id,
      payoutId: id,
      action,
      note: typeof body?.note === "string" ? body.note : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PayoutError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    log.error("admin payout processing failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
