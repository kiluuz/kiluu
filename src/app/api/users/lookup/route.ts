import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("username") ?? "";
  const username = raw.replace(/^@/, "").trim().toLowerCase();
  if (!username || username.length > 40) {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const user = await db.user.findFirst({
    where: { username: { equals: username, mode: "insensitive" }, deletedAt: null },
    select: { id: true, username: true, displayName: true, avatarUrl: true, accentColor: true, role: true },
  });

  return NextResponse.json(
    { user: user && user.id !== me.id ? user : null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
