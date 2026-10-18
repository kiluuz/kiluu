import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const sets = await db.animeSet.findMany({
    orderBy: { code: "asc" },
    include: {
      items: {
        include: { anime: { select: { id: true, slug: true, title: true, hidden: true, moderationStatus: true } } },
      },
    },
  });
  return NextResponse.json({ sets });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const animeIds = Array.isArray(body.animeIds) && body.animeIds.every((id) => typeof id === "string")
    ? [...new Set(body.animeIds)]
    : [];
  const bonusCredits = body.bonusCredits === undefined ? 0 : body.bonusCredits;
  if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(code)) {
    return NextResponse.json({ error: "Set code must be 2–50 lowercase letters, numbers, or hyphens" }, { status: 400 });
  }
  if (!name || name.length > 100 || animeIds.length === 0 || animeIds.length > 100) {
    return NextResponse.json({ error: "Set name and 1–100 anime IDs are required" }, { status: 400 });
  }
  if (typeof bonusCredits !== "number" || !Number.isInteger(bonusCredits) || bonusCredits < 0 || bonusCredits > 1000) {
    return NextResponse.json({ error: "Bonus credits must be an integer from 0 to 1000" }, { status: 400 });
  }

  const validAnimeCount = await db.anime.count({
    where: { id: { in: animeIds }, hidden: false, moderationStatus: "APPROVED" },
  });
  if (validAnimeCount !== animeIds.length) {
    return NextResponse.json({ error: "Every set anime must be visible and approved" }, { status: 400 });
  }

  const set = await db.$transaction(async (tx) => {
    const saved = await tx.animeSet.upsert({
      where: { code },
      create: { code, name, bonusCredits },
      update: { name, bonusCredits },
    });
    await tx.animeSetItem.deleteMany({ where: { setId: saved.id } });
    await tx.animeSetItem.createMany({ data: animeIds.map((animeId) => ({ setId: saved.id, animeId })) });
    return tx.animeSet.findUniqueOrThrow({
      where: { id: saved.id },
      include: { items: { include: { anime: { select: { id: true, slug: true, title: true } } } } },
    });
  });
  return NextResponse.json({ set });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Set ID is required" }, { status: 400 });
  const existing = await db.animeSet.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Set not found" }, { status: 404 });
  await db.animeSet.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
