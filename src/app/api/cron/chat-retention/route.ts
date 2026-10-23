// src/app/api/cron/chat-retention/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Qadalgan xabarlardan tashqari 90 kundan eski xabarlarni o'chirish
    const result = await db.chatMessage.deleteMany({
      where: {
        createdAt: { lt: ninetyDaysAgo },
        pins: { none: {} },
      },
    });

    return NextResponse.json({
      ok: true,
      deletedCount: result.count,
      retentionDate: ninetyDaysAgo.toISOString(),
    });
  } catch (error) {
    console.error("Chat retention cleanup error:", error);
    return NextResponse.json({ error: "Retention cleanup xatosi" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
