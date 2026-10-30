import { NextRequest, NextResponse } from "next/server";
import { daSocketSession } from "@/lib/donationalerts";
import { daErrorResponse, daInternalAuthorized } from "@/lib/da-internal";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!daInternalAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(rateKey(req, "da-session"), 120, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  try {
    return NextResponse.json(await daSocketSession());
  } catch (error) {
    return daErrorResponse(error);
  }
}
