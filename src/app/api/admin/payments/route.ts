import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  const status = req.nextUrl.searchParams.get("status") || "";
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { telegramChargeId: { contains: q } },
      { invoicePayload: { contains: q } },
      { user: { username: { contains: q } } },
      { user: { email: { contains: q } } },
    ];
  }
  const payments = await db.starsPayment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, username: true, email: true, telegramId: true } } },
  });
  return NextResponse.json({ payments });
}
