import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false });
  await db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
