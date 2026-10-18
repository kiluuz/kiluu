import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "up",
      ts: new Date().toISOString(),
      service: "dubanix-web",
    });
  } catch (e) {
    log.error("health check failed", { err: String(e) });
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
