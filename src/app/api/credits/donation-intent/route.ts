import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createDonationIntent, daConfigState } from "@/lib/donationalerts";
import { daErrorResponse } from "@/lib/da-internal";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { ensureRuntimeSeed } from "@/lib/seed-runtime";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(`${rateKey(req, "da-intent")}:${user.id}`, 12, 60_000)) {
    return NextResponse.json({ error: "TOO_MANY_REQUESTS" }, { status: 429 });
  }
  const config = daConfigState();
  if (!config.clientId || !config.clientSecret || !config.tokenKey || !config.ingestSecret) {
    return NextResponse.json({ error: "PAYMENTS_UNAVAILABLE" }, { status: 503 });
  }

  await ensureRuntimeSeed();
  const body = (await req.json().catch(() => null)) as { packageId?: unknown } | null;
  if (!body || typeof body.packageId !== "string") {
    return NextResponse.json({ error: "INVALID_PACKAGE" }, { status: 400 });
  }

  try {
    return NextResponse.json(await createDonationIntent(user.id, body.packageId));
  } catch (error) {
    return daErrorResponse(error);
  }
}
