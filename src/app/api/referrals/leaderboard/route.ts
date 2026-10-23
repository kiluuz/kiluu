// src/app/api/referrals/leaderboard/route.ts
import { NextResponse } from "next/server";
import { getReferralLeaderboard } from "@/lib/referrals";

export async function GET() {
  try {
    const leaderboard = await getReferralLeaderboard();
    return NextResponse.json({ leaderboard });
  } catch (error) {
    console.error("Referral leaderboard error:", error);
    return NextResponse.json({ error: "Yetakchilar ro'yxatini yuklashda xatolik" }, { status: 500 });
  }
}
