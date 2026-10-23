// src/app/api/referrals/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getReferralStats } from "@/lib/referrals";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
    }

    const stats = await getReferralStats(user.id);
    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || "DubAniXBot";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kiluu.vercel.app";

    return NextResponse.json({
      stats: {
        ...stats,
        telegramShareLink: `https://t.me/${botUsername}?start=ref_${stats.code}`,
        webShareLink: `${appUrl}?ref=${stats.code}`,
      },
    });
  } catch (error) {
    console.error("Referrals stats error:", error);
    return NextResponse.json({ error: "Referral ma'lumotlarini yuklashda xatolik" }, { status: 500 });
  }
}
