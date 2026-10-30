import { db } from "@/lib/db";
import { openJson, sealJson } from "@/lib/sealed";
import { daCurrency } from "@/lib/donationalerts";

export const PAYOUT_METHODS = ["uzcard", "humo", "payme", "click", "bank", "other"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export class PayoutError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "PayoutError";
    this.code = code;
    this.status = status;
  }
}

export function payoutRate(): number {
  const n = Number(process.env.PAYOUT_RATE || "0.3");
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(100, Math.max(0.01, n));
}

export function payoutMinMinor(): number {
  const n = Number(process.env.PAYOUT_MIN_RUB || "100");
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 10_000;
}

export function payoutAmountMinor(credits: number): number {
  return Math.round(credits * payoutRate() * 100);
}

export function payoutPublicConfig() {
  return {
    rate: payoutRate(),
    minMinor: payoutMinMinor(),
    currency: daCurrency(),
    methods: PAYOUT_METHODS,
  };
}

function sealDetails(account: string): string {
  return sealJson({ account });
}

export function revealPayoutDetails(sealed: string): string {
  try {
    return openJson<{ account?: string }>(sealed).account || "";
  } catch {
    return "";
  }
}

export function maskPayoutDetails(sealed: string): string {
  const account = revealPayoutDetails(sealed);
  if (!account) return "••••";
  const tail = account.slice(-4);
  return `${"•".repeat(Math.min(12, Math.max(2, account.length - 4)))}${tail}`;
}

export interface PayoutView {
  id: string;
  credits: number;
  amountMinor: number;
  currency: string;
  method: string;
  detailsMasked: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
}

function payoutView(row: {
  id: string;
  credits: number;
  amountMinor: number;
  currency: string;
  method: string;
  details: string;
  status: string;
  adminNote: string | null;
  createdAt: Date;
  processedAt: Date | null;
}): PayoutView {
  return {
    id: row.id,
    credits: row.credits,
    amountMinor: row.amountMinor,
    currency: row.currency,
    method: row.method,
    detailsMasked: maskPayoutDetails(row.details),
    status: row.status,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
  };
}

export async function createPayoutRequest(opts: {
  userId: string;
  credits: number;
  method: string;
  details: string;
}) {
  const credits = opts.credits;
  if (!Number.isInteger(credits) || credits < 1 || credits > 1_000_000) {
    throw new PayoutError("BAD_CREDITS", "Invalid credit amount", 400);
  }
  if (!PAYOUT_METHODS.includes(opts.method as PayoutMethod)) {
    throw new PayoutError("BAD_METHOD", "Unsupported payout method", 400);
  }
  const account = opts.details.trim();
  if (account.length < 4 || account.length > 200) {
    throw new PayoutError("BAD_DETAILS", "Payout details must be 4-200 characters", 400);
  }
  const amountMinor = payoutAmountMinor(credits);
  if (amountMinor < payoutMinMinor()) {
    throw new PayoutError("BELOW_MIN", "Amount is below the minimum payout", 400);
  }
  const pendingCount = await db.payoutRequest.count({ where: { userId: opts.userId, status: "pending" } });
  if (pendingCount >= 2) {
    throw new PayoutError("TOO_MANY_PENDING", "You already have two pending payout requests", 429);
  }

  return db.$transaction(async (tx) => {
    const created = await tx.payoutRequest.create({
      data: {
        userId: opts.userId,
        credits,
        amountMinor,
        currency: daCurrency(),
        method: opts.method,
        details: sealDetails(account),
      },
    });
    const held = await tx.user.updateMany({
      where: { id: opts.userId, credits: { gte: credits } },
      data: { credits: { decrement: credits } },
    });
    if (held.count === 0) throw new PayoutError("INSUFFICIENT", "Not enough credits", 400);
    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        amount: -credits,
        type: "WITHDRAWAL",
        description: `Payout request ${created.id.slice(-8)}`,
        refType: "payout",
        refId: created.id,
        idempotencyKey: `payout-${created.id}`,
      },
    });
    return payoutView(created);
  });
}

export async function cancelPayoutRequest(userId: string, payoutId: string) {
  return db.$transaction(async (tx) => {
    const request = await tx.payoutRequest.findFirst({ where: { id: payoutId, userId } });
    if (!request) throw new PayoutError("NOT_FOUND", "Payout request not found", 404);
    const claimed = await tx.payoutRequest.updateMany({
      where: { id: request.id, status: "pending" },
      data: { status: "cancelled", processedAt: new Date() },
    });
    if (claimed.count === 0) throw new PayoutError("NOT_PENDING", "Only pending requests can be cancelled", 409);
    await tx.user.update({ where: { id: userId }, data: { credits: { increment: request.credits } } });
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: request.credits,
        type: "WITHDRAWAL_REFUND",
        description: `Payout cancelled ${request.id.slice(-8)}`,
        refType: "payout",
        refId: request.id,
        idempotencyKey: `payout-refund-${request.id}`,
      },
    });
    return { ok: true };
  });
}

export async function processPayoutRequest(opts: {
  adminId: string;
  payoutId: string;
  action: "paid" | "reject";
  note?: string;
}) {
  const note = opts.note?.trim().slice(0, 300) || null;
  return db.$transaction(async (tx) => {
    const request = await tx.payoutRequest.findUnique({ where: { id: opts.payoutId } });
    if (!request) throw new PayoutError("NOT_FOUND", "Payout request not found", 404);
    const nextStatus = opts.action === "paid" ? "paid" : "rejected";
    const claimed = await tx.payoutRequest.updateMany({
      where: { id: request.id, status: "pending" },
      data: { status: nextStatus, processedById: opts.adminId, processedAt: new Date(), adminNote: note },
    });
    if (claimed.count === 0) throw new PayoutError("NOT_PENDING", "Request is already processed", 409);
    if (opts.action === "reject") {
      await tx.user.update({ where: { id: request.userId }, data: { credits: { increment: request.credits } } });
      await tx.creditTransaction.create({
        data: {
          userId: request.userId,
          amount: request.credits,
          type: "WITHDRAWAL_REFUND",
          description: `Payout rejected ${request.id.slice(-8)}`,
          refType: "payout",
          refId: request.id,
          idempotencyKey: `payout-refund-${request.id}`,
        },
      });
    }
    return { ok: true, status: nextStatus };
  });
}

export async function listPayoutsForUser(userId: string) {
  const rows = await db.payoutRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return rows.map(payoutView);
}

export async function listPayoutsForAdmin(status: string, take = 50) {
  const rows = await db.payoutRequest.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: { id: true, username: true, displayName: true, email: true } },
      processedBy: { select: { username: true, displayName: true } },
    },
  });
  return rows.map((row) => ({
    ...payoutView(row),
    details: revealPayoutDetails(row.details),
    user: row.user,
    processedBy: row.processedBy,
  }));
}
