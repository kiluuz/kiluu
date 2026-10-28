import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  INTERNAL_SECRET_HEADER,
  internalBridgeConfigured,
  internalRequestAuthorized,
} from "@/lib/internal-api";
import { log } from "@/lib/logger";

const GrantBody = z.object({
  userId: z.string().min(1).max(64),
  orderId: z.string().min(1).max(200),
  amount: z.number().int().positive().max(1_000_000),
  description: z.string().trim().min(1).max(200).optional(),
  source: z.string().regex(/^[a-z0-9_]{1,40}$/).optional(),
});

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function unauthorized() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST /api/internal/credits/grant
 * Mobile bridge (Google Play / App Store) → web credits.
 * Idempotent on orderId: the same order can be retried safely.
 */
export async function POST(req: NextRequest) {
  if (!internalBridgeConfigured()) {
    return NextResponse.json({ error: "Internal bridge is not configured" }, { status: 503 });
  }
  if (!internalRequestAuthorized(req.headers.get(INTERNAL_SECRET_HEADER))) return unauthorized();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = GrantBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "userId, orderId and a positive integer amount are required" },
      { status: 400 },
    );
  }

  const { userId, orderId, amount, source } = parsed.data;
  const description = parsed.data.description ?? `Mobile store purchase (${orderId})`;
  const idempotencyKey = `mobile-order:${orderId}`;

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.creditTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        if (existing.userId !== userId || existing.amount !== amount) {
          return { kind: "conflict" } as const;
        }
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });
        return { kind: "duplicate", balance: user?.credits ?? 0 } as const;
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, deletedAt: true },
      });
      if (!user || user.deletedAt) return { kind: "missing" } as const;

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type: "TOPUP",
          description,
          refType: source ?? "mobile_order",
          refId: orderId,
          idempotencyKey,
        },
      });
      const updated = await tx.user.update({
        where: { id: userId, deletedAt: null },
        data: { credits: { increment: amount } },
        select: { credits: true },
      });
      return { kind: "credited", balance: updated.credits } as const;
    });

    if (result.kind === "conflict") {
      return NextResponse.json(
        { error: "orderId was already used with different parameters" },
        { status: 409 },
      );
    }
    if (result.kind === "missing") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      duplicate: result.kind === "duplicate",
      userId,
      orderId,
      amount,
      balance: result.balance,
    });
  } catch (e) {
    // Two concurrent retries: the loser rolls back and reads the winner's entry.
    if (isUniqueViolation(e)) {
      const existing = await db.creditTransaction.findUnique({ where: { idempotencyKey } });
      if (existing && existing.userId === userId && existing.amount === amount) {
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        });
        return NextResponse.json({
          ok: true,
          duplicate: true,
          userId,
          orderId,
          amount,
          balance: user?.credits ?? 0,
        });
      }
      return NextResponse.json(
        { error: "orderId was already used with different parameters" },
        { status: 409 },
      );
    }
    if (isRecordNotFound(e)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    log.error("credits grant failed", { orderId, err: String(e) });
    return NextResponse.json({ error: "Failed to grant credits" }, { status: 500 });
  }
}
