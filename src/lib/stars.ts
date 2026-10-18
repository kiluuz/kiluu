import { db } from "@/lib/db";
import { clawbackCredits, creditFromStars } from "@/lib/economy";
import { log } from "@/lib/logger";

export async function applySuccessfulStarsPayment(opts: {
  telegramChargeId: string;
  payload: string;
  starsAmount: number;
  telegramUserId?: string;
}) {
  const existing = await db.starsPayment.findUnique({
    where: { telegramChargeId: opts.telegramChargeId },
  });
  if (existing?.status === "paid" || existing?.status === "PAID") {
    return { ok: true as const, duplicate: true, payment: existing };
  }

  const pending =
    existing ||
    (await db.starsPayment.findUnique({ where: { invoicePayload: opts.payload } }).catch(() => null)) ||
    (await db.starsPayment.findFirst({
      where: { invoicePayload: opts.payload, status: { in: ["pending", "PENDING"] } },
    }));

  if (!pending) {
    log.warn("stars payment with unknown payload", { payload: opts.payload });
    return { ok: false as const, error: "unknown_payload" };
  }

  if (pending.starsAmount !== opts.starsAmount) {
    await db.starsPayment.update({
      where: { id: pending.id },
      data: { status: "failed", telegramChargeId: opts.telegramChargeId },
    });
    return { ok: false as const, error: "amount_mismatch" };
  }

  const pkg = pending.packageId
    ? await db.creditPackage.findUnique({ where: { id: pending.packageId } })
    : null;
  const credits = pending.creditsGranted || (pkg ? pkg.credits + pkg.bonus : 0);

  await creditFromStars({
    userId: pending.userId,
    amount: credits,
    description: pkg
      ? `Telegram Stars: ${pkg.name} (${pending.starsAmount} XTR)`
      : `Telegram Stars ${pending.starsAmount} XTR`,
    key: `stars-${opts.telegramChargeId}`,
    refId: pending.id,
  });

  const payment = await db.starsPayment.update({
    where: { id: pending.id },
    data: {
      status: "paid",
      telegramChargeId: opts.telegramChargeId,
      creditsGranted: credits,
    },
  });

  return { ok: true as const, duplicate: false, payment };
}

export async function refundStarsPayment(paymentId: string) {
  const p = await db.starsPayment.findUnique({ where: { id: paymentId } });
  if (!p) return { ok: false as const, error: "not_found" };
  if (p.status === "refunded" || p.status === "REFUNDED") {
    return { ok: true as const, duplicate: true, payment: p };
  }
  if (p.status !== "paid" && p.status !== "PAID") {
    return { ok: false as const, error: "not_paid" };
  }
  await clawbackCredits(
    p.userId,
    p.creditsGranted,
    `Stars refund ${p.starsAmount} XTR`,
    `stars-refund-${p.id}`
  );
  const payment = await db.starsPayment.update({
    where: { id: p.id },
    data: { status: "refunded" },
  });
  return { ok: true as const, duplicate: false, payment };
}
