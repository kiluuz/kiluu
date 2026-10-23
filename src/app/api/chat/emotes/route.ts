// src/app/api/chat/emotes/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Boshlang'ich tizim emotelari
const DEFAULT_EMOTES = [
  { code: ":fire:", imageUrl: "🔥", unlockType: "free" },
  { code: ":heart:", imageUrl: "❤️", unlockType: "free" },
  { code: ":laugh:", imageUrl: "😂", unlockType: "free" },
  { code: ":skull:", imageUrl: "💀", unlockType: "free" },
  { code: ":party:", imageUrl: "🎉", unlockType: "free" },
  { code: ":eyes:", imageUrl: "👀", unlockType: "free" },
  { code: ":star:", imageUrl: "⭐", unlockType: "free" },
  { code: ":shock:", imageUrl: "😱", unlockType: "free" },
  { code: ":dubanix:", imageUrl: "⚡", unlockType: "free" },
];

export async function GET() {
  try {
    const user = await getCurrentUser();

    // DB dan emotelarni olish
    const dbEmotes = await db.emote.findMany();

    let unlockedCodes = new Set<string>();
    if (user) {
      const userUnlocked = await db.userEmote.findMany({
        where: { userId: user.id },
        include: { emote: true },
      });
      for (const u of userUnlocked) {
        unlockedCodes.add(u.emote.code);
      }
    }

    const allEmotes = [
      ...DEFAULT_EMOTES.map((e) => ({ ...e, unlocked: true })),
      ...dbEmotes.map((e) => ({
        code: e.code,
        imageUrl: e.imageUrl,
        unlockType: e.unlockType,
        unlocked: e.unlockType === "free" || unlockedCodes.has(e.code),
      })),
    ];

    return NextResponse.json({ emotes: allEmotes });
  } catch (error) {
    console.error("Emotes error:", error);
    return NextResponse.json({ error: "Emotelarni yuklashda xatolik" }, { status: 500 });
  }
}
