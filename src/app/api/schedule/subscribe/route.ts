import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { anilistId?: unknown; title?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const anilistId = body.anilistId;
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (typeof anilistId !== "number" || !Number.isSafeInteger(anilistId) || anilistId <= 0 || !title) {
    return NextResponse.json({ error: "A valid AniList ID and title are required" }, { status: 400 });
  }
  await db.scheduleSubscription.upsert({
    where: { userId_anilistId: { userId: user.id, anilistId } },
    create: { userId: user.id, anilistId, title },
    update: { title },
  });
  return NextResponse.json({ subscribed: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db.scheduleSubscription.findMany({ where: { userId: user.id } });
  return NextResponse.json({ ids: rows.map((r) => r.anilistId) });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const anilistId = Number(new URL(req.url).searchParams.get("anilistId"));
  if (!Number.isSafeInteger(anilistId) || anilistId <= 0) {
    return NextResponse.json({ error: "A valid AniList ID is required" }, { status: 400 });
  }
  await db.scheduleSubscription.deleteMany({ where: { userId: user.id, anilistId } });
  return NextResponse.json({ subscribed: false });
}
