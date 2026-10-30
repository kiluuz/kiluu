import { NextRequest, NextResponse } from "next/server";
import { daIngestSecret, daVerifyPayload, processDonation } from "@/lib/donationalerts";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY = 64_000;

export async function POST(req: NextRequest) {
  const secret = daIngestSecret();
  if (!secret) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!rateLimit(rateKey(req, "da-hook"), 240, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const raw = await req.text();
  if (!raw || raw.length > MAX_BODY) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const timestamp = req.headers.get("x-da-timestamp") || "";
  const signature = req.headers.get("x-da-signature") || "";
  if (!daVerifyPayload(secret, timestamp, raw, signature)) {
    log.warn("donationalerts webhook signature rejected");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: { donation?: unknown };
  try {
    body = JSON.parse(raw) as { donation?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await processDonation(body.donation, "socket");
    if (result.status === "invalid") {
      return NextResponse.json({ ok: false, status: result.status }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      status: result.status,
      creditsGranted: result.creditsGranted ?? null,
    });
  } catch (error) {
    log.error("donationalerts donation processing failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
