import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { PayoutError, cancelPayoutRequest } from "@/lib/payouts";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json(await cancelPayoutRequest(user.id, id));
  } catch (error) {
    if (error instanceof PayoutError) {
      return NextResponse.json({ error: error.code }, { status: error.status });
    }
    log.error("payout cancel failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
