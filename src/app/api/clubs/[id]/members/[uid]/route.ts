// src/app/api/clubs/[id]/members/[uid]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string; uid: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id, uid } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const myMembership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.id } },
    });
    const isOwner = myMembership?.role === "owner" || user.role === "admin" || user.role === "ADMIN";
    const isMod = myMembership?.role === "mod";

    if (!isOwner && !isMod) {
      return NextResponse.json({ error: "Boshqarish huquqingiz yo'q" }, { status: 403 });
    }

    const targetMembership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: uid } },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "A'zo topilmadi" }, { status: 404 });
    }

    const body = await req.json();
    const { role, muteMinutes } = body;

    const data: any = {};

    if (role) {
      if (!isOwner) {
        return NextResponse.json({ error: "Faqat klub egasi rollarni o'zgartira oladi" }, { status: 403 });
      }
      if (role !== "mod" && role !== "member") {
        return NextResponse.json({ error: "Noto'g'ri rol (faqat mod yoki member)" }, { status: 400 });
      }
      data.role = role;
    }

    if (muteMinutes !== undefined) {
      if (targetMembership.role === "owner") {
        return NextResponse.json({ error: "Klub egasini ovozsiz qilib bo'lmaydi" }, { status: 400 });
      }
      if (isMod && targetMembership.role === "mod") {
        return NextResponse.json({ error: "Moderator boshqa moderatorni ovozsiz qila olmaydi" }, { status: 403 });
      }
      data.mutedUntil = muteMinutes > 0 ? new Date(Date.now() + muteMinutes * 60 * 1000) : null;
    }

    const updated = await db.clubMember.update({
      where: { id: targetMembership.id },
      data,
    });

    return NextResponse.json({ ok: true, member: updated });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json({ error: "A'zo ma'lumotlarini yangilashda xatolik" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id, uid } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const myMembership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.id } },
    });
    const isOwner = myMembership?.role === "owner" || user.role === "admin" || user.role === "ADMIN";
    const isMod = myMembership?.role === "mod";

    if (!isOwner && !isMod) {
      return NextResponse.json({ error: "A'zoni chiqarib yuborish huquqingiz yo'q" }, { status: 403 });
    }

    const targetMembership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: uid } },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "A'zo topilmadi" }, { status: 404 });
    }

    if (targetMembership.role === "owner") {
      return NextResponse.json({ error: "Klub egasini chiqarib yuborib bo'lmaydi" }, { status: 400 });
    }
    if (isMod && targetMembership.role === "mod") {
      return NextResponse.json({ error: "Moderator boshqa moderatorni chiqara olmaydi" }, { status: 403 });
    }

    await db.clubMember.delete({
      where: { id: targetMembership.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Kick member error:", error);
    return NextResponse.json({ error: "A'zoni chiqarib yuborishda xatolik" }, { status: 500 });
  }
}
