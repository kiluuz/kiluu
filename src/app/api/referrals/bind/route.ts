// src/app/api/referrals/bind/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bindReferralOnRegistration } from "@/lib/referrals";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
    }

    const body = await req.json();
    const { code } = body;
    if (!code) {
      return NextResponse.json({ error: "Referral kodi kiritilmadi" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await bindReferralOnRegistration(user.id, code, ip, userAgent);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Referral bind error:", error);
    return NextResponse.json({ error: "Referralni bog'lashda xatolik" }, { status: 500 });
  }
}
