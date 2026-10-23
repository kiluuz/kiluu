// src/app/api/chat/rooms/[id]/messages/[msgId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRoomAccess, pushToRoom, getOrCreateRoom } from "@/lib/chat";

interface RouteContext {
  params: Promise<{ id: string; msgId: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id: rawRoomId, msgId } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const room = await getOrCreateRoom(rawRoomId);
    if (!room) {
      return NextResponse.json({ error: "Xona topilmadi" }, { status: 404 });
    }

    const message = await db.chatMessage.findUnique({
      where: { id: msgId },
    });
    if (!message || message.roomId !== room.id) {
      return NextResponse.json({ error: "Xabar topilmadi" }, { status: 404 });
    }

    if (message.userId !== user.id) {
      return NextResponse.json({ error: "Faqat o'z xabaringizni tahrirlashingiz mumkin" }, { status: 403 });
    }

    if (message.deletedAt) {
      return NextResponse.json({ error: "O'chirilgan xabarni tahrirlab bo'lmaydi" }, { status: 400 });
    }

    const body = await req.json();
    const newText = (body.body || "").trim();
    if (!newText) {
      return NextResponse.json({ error: "Matn bo'sh bo'lishi mumkin emas" }, { status: 400 });
    }

    const sanitized = newText.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const updated = await db.chatMessage.update({
      where: { id: msgId },
      data: {
        body: sanitized,
        editedAt: new Date(),
      },
    });

    await pushToRoom(rawRoomId, {
      type: "message_edit",
      messageId: msgId,
      body: updated.body,
      editedAt: updated.editedAt,
    });

    return NextResponse.json({ ok: true, message: updated });
  } catch (error) {
    console.error("Edit message error:", error);
    return NextResponse.json({ error: "Tahrirlashda xatolik yuz berdi" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id: rawRoomId, msgId } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const room = await getOrCreateRoom(rawRoomId);
    if (!room) {
      return NextResponse.json({ error: "Xona topilmadi" }, { status: 404 });
    }

    const message = await db.chatMessage.findUnique({
      where: { id: msgId },
    });
    if (!message || message.roomId !== room.id) {
      return NextResponse.json({ error: "Xabar topilmadi" }, { status: 404 });
    }

    const access = await checkRoomAccess(rawRoomId, user.id);
    const isOwner = message.userId === user.id;
    const isStaff = access.role === "owner" || access.role === "mod" || access.role === "admin";

    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "Xabarni o'chirish huquqingiz yo'q" }, { status: 403 });
    }

    await db.chatMessage.update({
      where: { id: msgId },
      data: {
        deletedAt: new Date(),
        body: "Ushbu xabar o'chirildi",
      },
    });

    await pushToRoom(rawRoomId, {
      type: "message_delete",
      messageId: msgId,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json({ error: "O'chirishda xatolik yuz berdi" }, { status: 500 });
  }
}
