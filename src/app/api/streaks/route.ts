// src/app/api/streaks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserStreakStatus, claimDailyStreak } from "@/lib/streaks";
import { emitEvent } from "@/lib/events";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
    }

    const status = await getUserStreakStatus(user.id);
    return NextResponse.json({ status });
  } catch (error) {
    console.error("Streak status error:", error);
    return NextResponse.json({ error: "Streak holatini yuklashda xatolik" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
    }

    const result = await claimDailyStreak(user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Event bus ga xabar berish
    await emitEvent(user, "daily_claim", { streakDay: result.streakCount });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Claim streak error:", error);
    return NextResponse.json({ error: "Kunlik mukofotni olishda xatolik" }, { status: 500 });
  }
}
