// src/app/api/quests/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrAssignUserQuests } from "@/lib/quests";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
    }

    const { dailyQuests, weeklyQuests } = await getOrAssignUserQuests(user.id);

    const formattedDaily = dailyQuests.map((q) => ({
      id: q.id,
      title: q.template.titleUz || q.template.title,
      description: q.template.description,
      category: q.template.category,
      progress: q.progress,
      targetCount: q.targetCount,
      status: q.status,
      xpReward: q.template.xpReward,
      creditReward: q.template.creditReward,
      difficulty: q.template.difficulty,
      expiresAt: q.expiresAt,
    }));

    const formattedWeekly = weeklyQuests.map((q) => ({
      id: q.id,
      title: q.template.titleUz || q.template.title,
      description: q.template.description,
      category: q.template.category,
      progress: q.progress,
      targetCount: q.targetCount,
      status: q.status,
      xpReward: q.template.xpReward,
      creditReward: q.template.creditReward,
      difficulty: q.template.difficulty,
      expiresAt: q.expiresAt,
    }));

    return NextResponse.json({
      daily: formattedDaily,
      weekly: formattedWeekly,
    });
  } catch (error) {
    console.error("Quests get error:", error);
    return NextResponse.json({ error: "Vazifalarni yuklashda xatolik" }, { status: 500 });
  }
}
