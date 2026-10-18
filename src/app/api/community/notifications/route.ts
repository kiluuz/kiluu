import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: user.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return NextResponse.json({ notifications, unread });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  let body: { id?: unknown; all?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const now = new Date();
  if (body.all === true) {
    await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: now } });
  } else if (typeof body.id === "string") {
    await db.notification.updateMany({
      where: { id: body.id, userId: user.id, readAt: null },
      data: { readAt: now },
    });
  } else {
    return NextResponse.json({ error: "Notification id or all=true is required" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
