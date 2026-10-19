import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserStatus } from "@/lib/bot-api";

/**
 * GET /api/bot/order-status?orderId=xxx
 *
 * Returns the current status of an order owned by the authenticated user.
 * Also checks bot status.linked so the frontend knows whether to show the link widget.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const order = await db.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Security: ensure the order belongs to the requesting user
    if (order.site_user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If order is completed or paid_pending_grant, also check if user is linked
    let linked: boolean | null = null;
    if (order.status === "PAID_PENDING_GRANT" || order.status === "COMPLETED") {
      try {
        const botStatus = await getUserStatus(user.id);
        linked = botStatus?.linked ?? null;
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      status: order.status,
      anime_slug: order.anime_slug,
      amount: order.amount,
      linked,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
