import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { claimGift, declineGift } from "@/lib/gifts";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = (body.action || "").toLowerCase();
  try {
    if (action === "claim") {
      await claimGift({ giftId: id, userId: user.id });
      return NextResponse.json({ ok: true, status: "CLAIMED" });
    }
    if (action === "decline") {
      await declineGift({ giftId: id, userId: user.id });
      return NextResponse.json({ ok: true, status: "DECLINED" });
    }
    return NextResponse.json({ error: "action must be claim or decline" }, { status: 400 });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "CREATOR_RECIPIENT") {
      return NextResponse.json({ error: "Creator accounts can't receive anime gifts", code }, { status: 403 });
    }
    if (code === "FORBIDDEN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (code === "NOT_PENDING") return NextResponse.json({ error: "Gift is no longer pending" }, { status: 409 });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
