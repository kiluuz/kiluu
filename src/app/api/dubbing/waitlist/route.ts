import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.dubWaitlist.upsert({
    where: { userId: user.id },
    create: { userId: user.id, email: user.email },
    update: {},
  });
  return NextResponse.json({ joined: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const row = await db.dubWaitlist.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ joined: Boolean(row) });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.dubWaitlist.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ joined: false });
}
