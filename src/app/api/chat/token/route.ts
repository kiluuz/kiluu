// src/app/api/chat/token/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { checkRoomAccess, signChatJwt } from "@/lib/chat";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'ting" }, { status: 401 });
    }

    const body = await req.json();
    const { roomId } = body;
    if (!roomId || typeof roomId !== "string") {
      return NextResponse.json({ error: "roomId talab qilinadi" }, { status: 400 });
    }

    const access = await checkRoomAccess(roomId, user.id);
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.reason || "Ushbu xonaga kirish ruxsati yo'q" },
        { status: 403 }
      );
    }

    // Worker roomId sifatida parametrda uzatilgan xona identifikatorini qabul qiladi
    const token = await signChatJwt({
      userId: user.id,
      roomId: roomId,
      role: access.role,
      level: access.level,
    });

    return NextResponse.json({
      token,
      roomId,
      dbRoomId: access.room?.id,
      role: access.role,
      level: access.level,
      expiresIn: 300,
    });
  } catch (error) {
    console.error("Chat token error:", error);
    return NextResponse.json({ error: "Token yaratishda xatolik yuz berdi" }, { status: 500 });
  }
}
