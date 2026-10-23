// src/app/api/clubs/[id]/join/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardClubXp } from "@/lib/chat";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const club = await db.club.findUnique({
      where: { id },
    });
    if (!club) {
      return NextResponse.json({ error: "Klub topilmadi" }, { status: 404 });
    }

    // A'zolikni tekshirish
    const existing = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Siz allaqachon ushbu klub a'zosisiz" }, { status: 400 });
    }

    // Maksimum 3 ta klub
    const myClubsCount = await db.clubMember.count({
      where: { userId: user.id },
    });
    if (myClubsCount >= 3) {
      return NextResponse.json({ error: "Siz ko'pi bilan 3 ta klubga a'zo bo'la olasiz" }, { status: 400 });
    }

    if (club.isPublic) {
      // Ochiq klub: darhol qo'shish
      const member = await db.clubMember.create({
        data: {
          clubId: id,
          userId: user.id,
          role: "member",
        },
      });

      // Klubga yangi a'zo qo'shilgani uchun XP
      await awardClubXp(id, user.id, 20, "member_joined");

      return NextResponse.json({ ok: true, status: "joined", member });
    } else {
      // Yopiq klub: so'rov yuborish
      const body = await req.json().catch(() => ({}));
      const message = body.message ? String(body.message).slice(0, 200) : null;

      const request = await db.clubJoinRequest.upsert({
        where: { clubId_userId: { clubId: id, userId: user.id } },
        update: { status: "pending", message },
        create: {
          clubId: id,
          userId: user.id,
          message,
          status: "pending",
        },
      });

      return NextResponse.json({ ok: true, status: "requested", request });
    }
  } catch (error) {
    console.error("Join club error:", error);
    return NextResponse.json({ error: "Klubga qo'shilishda xatolik" }, { status: 500 });
  }
}

// Klubdan chiqish
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
    }

    const membership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Siz bu klub a'zosi emassiz" }, { status: 400 });
    }

    if (membership.role === "owner") {
      return NextResponse.json(
        { error: "Klub egasi klubdan chiqa olmaydi. Avval klubni boshqa a'zoga topshiring yoki klubni o'chiring." },
        { status: 400 }
      );
    }

    await db.clubMember.delete({
      where: { id: membership.id },
    });

    return NextResponse.json({ ok: true, message: "Klubdan muvaffaqiyatli chiqdingiz" });
  } catch (error) {
    console.error("Leave club error:", error);
    return NextResponse.json({ error: "Klubdan chiqishda xatolik" }, { status: 500 });
  }
}
