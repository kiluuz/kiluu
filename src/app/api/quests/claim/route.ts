// src/app/api/quests/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { claimQuestReward } from "@/lib/quests";
import { emitEvent } from "@/lib/events";

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

    const result = await claimQuestReward(user.id, userQuestId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    await emitEvent(user, "quest_claimed", { userQuestId });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Quest claim error:", error);
    return NextResponse.json({ error: "Mukofotni olishda xatolik" }, { status: 500 });
  }
}
