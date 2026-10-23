// src/app/api/chat/rooms/[id]/pin/route.ts
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
    const isStaff = access.role === "owner" || access.role === "mod" || access.role === "admin";
    if (!isStaff) {
      return NextResponse.json({ error: "Xabarni qadash huquqingiz yo'q" }, { status: 403 });
    }

    const body = await req.json();
    const { messageId } = body;
    if (!messageId) {
      return NextResponse.json({ error: "messageId talab qilinadi" }, { status: 400 });
    }

    const existing = await db.pinnedMessage.findUnique({
      where: {
        roomId_messageId: {
          roomId: room.id,
          messageId,
        },
      },
    });

    let isPinned = false;
    if (existing) {
      await db.pinnedMessage.delete({
        where: { id: existing.id },
      });
      isPinned = false;
    } else {
      await db.pinnedMessage.create({
        data: {
          roomId: room.id,
          messageId,
          pinnedBy: user.id,
        },
      });
      isPinned = true;
    }

    await pushToRoom(rawRoomId, {
      type: "pin",
      messageId,
      isPinned,
      pinnedBy: user.displayName || user.username,
    });

    return NextResponse.json({ ok: true, isPinned });
  } catch (error) {
    console.error("Pin message error:", error);
    return NextResponse.json({ error: "Xabarni qadashda xatolik" }, { status: 500 });
  }
}
