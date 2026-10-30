import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DonationAlertsError, daIngestSecret, timingSafeEqualText } from "@/lib/donationalerts";
import { log } from "@/lib/logger";

export function daInternalAuthorized(req: NextRequest): boolean {
  const secret = daIngestSecret();
  if (!secret) return false;
  const given = req.headers.get("x-da-secret") || "";
  return timingSafeEqualText(given, secret);
}

export function daErrorResponse(error: unknown): NextResponse {
  if (error instanceof DonationAlertsError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  log.error("donationalerts request failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json({ error: "internal" }, { status: 500 });
}
