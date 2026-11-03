import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const Body = z.object({
  amount: z.number().int().min(1).max(1_000_000),
  requestId: z.string().min(8).max(64),
  description: z.string().trim().min(1).max(200).optional(),
});

// Manual balance top-up. The client generates `requestId` so a replayed click credits once.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentUser();
  if (!isAdminUser(admin)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { amount, requestId, description } = parsed.data;
  const idempotencyKey = `admin-grant:${requestId}`;

  const target = await db.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, username: true },
  });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  try {
    const balance = await db.$transaction(async (tx) => {
      await tx.creditTransaction.create({
        data: {
          userId: target.id,
          amount,
          type: "ADMIN_GRANT",
          description: description || "Admin bonus",
          refType: "admin_grant",
          refId: admin!.id,
          idempotencyKey,
        },
      });
      const updated = await tx.user.update({
        where: { id: target.id },
        data: { credits: { increment: amount } },
        select: { credits: true },
      });
      return updated.credits;
    });
    log.info("admin granted credits", { adminId: admin!.id, userId: target.id, amount });
    return NextResponse.json({ ok: true, userId: target.id, amount, balance });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.creditTransaction.findUnique({ where: { idempotencyKey } });
      const user = existing
        ? await db.user.findUnique({ where: { id: target.id }, select: { credits: true } })
        : null;
      return NextResponse.json({
        ok: true,
        duplicate: true,
        userId: target.id,
        amount: existing?.amount ?? amount,
        balance: user?.credits ?? 0,
      });
    }
    log.error("admin credit grant failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
