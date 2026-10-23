// src/app/api/quests/reroll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rerollDailyQuest } from "@/lib/quests";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
    }

    const body = await req.json();
    const { userQuestId } = body;
    if (!userQuestId) {
      return NextResponse.json({ error: "userQuestId talab qilinadi" }, { status: 400 });
    }

    const result = await rerollDailyQuest(user.id, userQuestId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Quest reroll error:", error);
    return NextResponse.json({ error: "Vazifani almashtirishda xatolik" }, { status: 500 });
  }
}
