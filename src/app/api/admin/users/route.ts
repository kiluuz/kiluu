import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { db } from "@/lib/db";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 80);
  const rawPage = parseInt(req.nextUrl.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(rawPage) ? Math.min(10_000, Math.max(1, rawPage)) : 1;
  const onlineOnly = req.nextUrl.searchParams.get("online") === "1";

  const now = new Date();
  const presenceCutoff = new Date(now.getTime() - 5 * 60_000);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (q) {
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
    ];
  }
  if (onlineOnly) where.lastSeenAt = { gte: presenceCutoff };

  const [users, total, totalAll, online, today, creators] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        role: true,
        avatarUrl: true,
        credits: true,
        emailVerified: true,
        onboardingDone: true,
        telegramUsername: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    db.user.count({ where }),
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, lastSeenAt: { gte: presenceCutoff } } }),
    db.user.count({ where: { deletedAt: null, createdAt: { gte: startOfDay } } }),
    db.user.count({ where: { deletedAt: null, role: "creator" } }),
  ]);

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    onlineOnly,
    stats: { total: totalAll, online, today, creators },
  });
}
