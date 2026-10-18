import { NextResponse } from "next/server";
import { getLeaderboards } from "@/lib/leaderboards";

export async function GET() {
  const leaderboards = await getLeaderboards();
  return NextResponse.json(leaderboards, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
