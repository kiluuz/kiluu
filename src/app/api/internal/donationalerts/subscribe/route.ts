import { NextRequest, NextResponse } from "next/server";
import { daSubscribeTokens } from "@/lib/donationalerts";
import { daErrorResponse, daInternalAuthorized } from "@/lib/da-internal";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!daInternalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(rateKey(req, "da-subscribe"), 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { client?: unknown } | null;
  if (!body || typeof body.client !== "string") {
    return NextResponse.json({ error: "Missing client" }, { status: 400 });
  }
  try {
    return NextResponse.json({ channels: await daSubscribeTokens(body.client) });
  } catch (error) {
    return daErrorResponse(error);
  }
}
