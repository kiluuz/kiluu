// src/app/api/chat/rooms/[id]/reactions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRoomAccess, pushToRoom, getOrCreateRoom } from "@/lib/chat";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: rawRoomId } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const room = await getOrCreateRoom(rawRoomId);
    if (!room) {
      return NextResponse.json({ error: "Xona topilmadi" }, { status: 404 });
    }

    const access = await checkRoomAccess(rawRoomId, user.id);
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || "Kirish ruxsati yo'q" }, { status: 403 });
    }

    const body = await req.json();
    const { messageId, emote } = body;
    if (!messageId || !emote) {
      return NextResponse.json({ error: "messageId va emote talab qilinadi" }, { status: 400 });
    }

    const existing = await db.messageReaction.findUnique({
      where: {
        messageId_userId_emote: {
          messageId,
          userId: user.id,
          emote,
        },
      },
    });

    let action: "added" | "removed" = "added";
    if (existing) {
      await db.messageReaction.delete({
        where: { id: existing.id },
      });
      action = "removed";
    } else {
      await db.messageReaction.create({
        data: {
          messageId,
          userId: user.id,
          emote,
        },
      });
      action = "added";
    }

    // Xabardagi ushbu emoji bo'yicha joriy reaksiyalar soni
    const count = await db.messageReaction.count({
      where: { messageId, emote },
    });

    await pushToRoom(rawRoomId, {
      type: "reaction",
      messageId,
      emote,
      userId: user.id,
      action,
      count,
    });

    return NextResponse.json({ ok: true, action, count });
  } catch (error) {
    console.error("Reaction error:", error);
    return NextResponse.json({ error: "Reaksiya qoldirishda xatolik" }, { status: 500 });
  }
}
