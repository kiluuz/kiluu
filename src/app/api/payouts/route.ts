import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isCreator } from "@/lib/rbac";
import { PayoutError, createPayoutRequest, listPayoutsForUser, payoutPublicConfig } from "@/lib/payouts";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

function payoutErrorResponse(error: unknown) {
  if (error instanceof PayoutError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  log.error("payout request failed", { error: error instanceof Error ? error.message : String(error) });
  return NextResponse.json({ error: "internal" }, { status: 500 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requests = await listPayoutsForUser(user.id);
  return NextResponse.json({
    balance: user.credits,
    config: payoutPublicConfig(),
    eligible: isCreator(user),
    requests,
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreator(user)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!rateLimit(`${rateKey(req, "payout-create")}:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as
    | { credits?: unknown; method?: unknown; details?: unknown; currency?: unknown }
    | null;
  if (!body || typeof body.method !== "string" || typeof body.details !== "string") {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
  const credits = Number(body.credits);
  try {
    const request = await createPayoutRequest({
      userId: user.id,
      credits,
      method: body.method,
      details: body.details,
      displayCurrency: typeof body.currency === "string" ? body.currency : undefined,
    });
    return NextResponse.json({ ok: true, request });
  } catch (error) {
    return payoutErrorResponse(error);
  }
}
