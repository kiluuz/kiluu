import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  assertTeamManager,
  dubErrorInfo,
  inviteDubTeamMember,
  removeDubTeamMember,
} from "@/lib/dub-teams";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  try {
    await assertTeamManager(id, user);
    const body = await req.json();
    // Only Kiluu accounts can join a team — a name typed by hand is not a member.
    if (typeof body?.userId !== "string" || !body.userId) {
      return NextResponse.json(
        { error: "Jamoaga faqat Kiluu hisoblarini qo‘shish mumkin", code: "USER_REQUIRED" },
        { status: 400 }
      );
    }
    const invite = await inviteDubTeamMember(id, user!.id, body.userId);
    return NextResponse.json({ invite, pending: true }, { status: 201 });
  } catch (error) {
    const info = dubErrorInfo(error);
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  try {
    await assertTeamManager(id, user);
    const memberId = req.nextUrl.searchParams.get("memberId") || "";
    if (!memberId) return NextResponse.json({ error: "memberId kerak" }, { status: 400 });
    await removeDubTeamMember(id, memberId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const info = dubErrorInfo(error);
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
  }
}
