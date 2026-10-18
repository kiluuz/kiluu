import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { revokePurchase } from "@/lib/bot-api";
import { isAdminUser } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!isAdminUser(user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { site_user_id, anime_slug } = await req.json();
    if (!site_user_id || !anime_slug) {
      return NextResponse.json({ error: "Missing site_user_id or anime_slug" }, { status: 400 });
    }

    // Call bot API to revoke
    await revokePurchase(site_user_id, anime_slug);

    // Update DB
    await db.order.updateMany({
      where: {
        site_user_id,
        anime_slug,
        status: { in: ["COMPLETED", "PAID_PENDING_GRANT"] }
      },
      data: {
        status: "REFUNDED"
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
