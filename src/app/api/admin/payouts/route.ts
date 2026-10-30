import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { listPayoutsForAdmin } from "@/lib/payouts";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const STATUSES = new Set(["pending", "paid", "rejected", "cancelled", "all"]);

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const raw = req.nextUrl.searchParams.get("status") || "pending";
  const status = STATUSES.has(raw) ? raw : "pending";
  try {
    return NextResponse.json({ status, requests: await listPayoutsForAdmin(status) });
  } catch (error) {
    log.error("admin payout list failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
