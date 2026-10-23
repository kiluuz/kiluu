// src/app/api/chat/rooms/[id]/ban/route.ts
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
      return NextResponse.json({ error: "Moderatsiya huquqingiz yo'q" }, { status: 403 });
    }

    const body = await req.json();
    const { targetUserId, type = "mute", durationMinutes = 60, reason } = body;
    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId talab qilinadi" }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, username: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "Foydalanuvchi topilmadi" }, { status: 404 });
    }

    if (targetUser.role === "admin" || targetUser.role === "ADMIN") {
      return NextResponse.json({ error: "Adminni jazolab bo'lmaydi" }, { status: 400 });
    }

    const expiresAt = durationMinutes > 0
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null;

    const ban = await db.chatBan.create({
      data: {
        roomId: room.id,
        userId: targetUserId,
        bannedBy: user.id,
        type: type === "ban" ? "ban" : "mute",
        reason: reason || null,
        expiresAt,
      },
    });

    await pushToRoom(rawRoomId, {
      type: "user_moderated",
      targetUserId,
      moderationType: type,
      reason,
      expiresAt,
    });

    return NextResponse.json({ ok: true, ban });
  } catch (error) {
    console.error("Chat moderation error:", error);
    return NextResponse.json({ error: "Moderatsiyada xatolik" }, { status: 500 });
  }
}
