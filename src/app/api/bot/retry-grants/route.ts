import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { grantPurchase } from "@/lib/bot-api";
import { isAdminUser } from "@/lib/config";
import { timingSafeEqual } from "node:crypto";

/**
 * POST /api/bot/retry-grants
 *
 * Retries all PAID_PENDING_GRANT orders that are eligible (retryCount < 10 and nextRetryAt <= now).
 * Can be triggered by an admin or an internal cron (e.g. via TELEGRAM_STARS_WEBHOOK_SECRET header).
 * Max 20 orders per invocation.
 */

interface RetryResult {
  orderId: string;
  success: boolean;
  linked?: boolean;
  error?: string;
}

function isValidCronSecret(supplied: string | null): boolean {
  const secret = process.env.TELEGRAM_STARS_WEBHOOK_SECRET;
  if (!secret || !supplied) return false;
  const expectedBytes = Buffer.from(secret);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(req: NextRequest) {
  try {
    // Allow admins or internal cron (authenticated by bot webhook secret)
    const user = await getCurrentUser();
    const cronSecret = req.headers.get("x-cron-secret");
    const isAuthorized = isAdminUser(user) || isValidCronSecret(cronSecret);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find all eligible PAID_PENDING_GRANT orders
    const orders = await db.order.findMany({
      where: {
        status: "PAID_PENDING_GRANT",
        retryCount: { lt: 10 },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      take: 20,
    });

    const results: RetryResult[] = [];

    for (const order of orders) {
      try {
        const grantRes = await grantPurchase(order.site_user_id, order.anime_slug);

        await db.order.update({
          where: { id: order.id },
          data: { status: "COMPLETED" },
        });

        results.push({ orderId: order.id, success: true, linked: grantRes.linked });
      } catch (e: any) {
        // Exponential backoff: 1m, 2m, 4m, 8m … up to 2^9 = 512m
        const backoffMins = Math.pow(2, order.retryCount);
        await db.order.update({
          where: { id: order.id },
          data: {
            retryCount: { increment: 1 },
            nextRetryAt: new Date(Date.now() + backoffMins * 60_000),
          },
        });
        results.push({ orderId: order.id, success: false, error: e.message });
      }
    }

    return NextResponse.json({ processed: orders.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
