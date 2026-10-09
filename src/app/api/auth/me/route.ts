import { NextResponse } from "next/server";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });
  // Owned-anime count powers the Exchange "20+" badge + lock state in the nav
  const ownedCount = await db.purchase.count({ where: { userId: user.id } });
  return NextResponse.json({ user: { ...toPublicUser(user), ownedCount } });
}
