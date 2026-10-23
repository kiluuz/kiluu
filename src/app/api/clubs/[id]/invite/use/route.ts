// src/app/api/clubs/[id]/invite/use/route.ts
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

    const body = await req.json();
    const { code } = body;
    if (!code) {
      return NextResponse.json({ error: "Taklif kodi talab qilinadi" }, { status: 400 });
    }

    const invite = await db.clubInvite.findFirst({
      where: {
        clubId: id,
        code: String(code).trim().toUpperCase(),
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Noto'g'ri taklif kodi" }, { status: 404 });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "Ushbu taklif kodining muddati tugagan" }, { status: 400 });
    }

    if (invite.uses >= invite.maxUses) {
      return NextResponse.json({ error: "Taklif kodining ishlatilish limiti tugagan" }, { status: 400 });
    }

    const existing = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Siz allaqachon ushbu klub a'zosisiz" }, { status: 400 });
    }

    const count = await db.clubMember.count({ where: { userId: user.id } });
    if (count >= 3) {
      return NextResponse.json({ error: "Siz ko'pi bilan 3 ta klubga a'zo bo'la olasiz" }, { status: 400 });
    }

    const [member] = await db.$transaction([
      db.clubMember.create({
        data: {
          clubId: id,
          userId: user.id,
          role: "member",
        },
      }),
      db.clubInvite.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      }),
    ]);

    await awardClubXp(id, user.id, 20, "invite_used");

    return NextResponse.json({ ok: true, member });
  } catch (error) {
    console.error("Use invite error:", error);
    return NextResponse.json({ error: "Taklif kodini ishlatishda xatolik" }, { status: 500 });
  }
}
