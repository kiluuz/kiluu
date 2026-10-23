// src/app/api/clubs/[id]/invite/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomBytes } from "crypto";

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

    const membership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: id, userId: user.id } },
    });
    const isStaff =
      membership?.role === "owner" ||
      membership?.role === "mod" ||
      user.role === "admin" ||
      user.role === "ADMIN";
    if (!isStaff) {
      return NextResponse.json({ error: "Taklif havolasi yaratish huquqingiz yo'q" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const maxUses = Math.max(1, Math.min(1000, parseInt(String(body.maxUses || 50), 10)));
    const days = Math.max(1, Math.min(30, parseInt(String(body.expiresInDays || 7), 10)));

    const code = randomBytes(4).toString("hex").toUpperCase(); // 8 belgili noyob kod
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invite = await db.clubInvite.create({
      data: {
        clubId: id,
        code,
        createdBy: user.id,
        maxUses,
        expiresAt,
      },
    });

    return NextResponse.json({ ok: true, invite });
  } catch (error) {
    console.error("Create club invite error:", error);
    return NextResponse.json({ error: "Taklif kodini yaratishda xatolik" }, { status: 500 });
  }
}
