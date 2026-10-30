import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addDubTeamMember, assertTeamManager, dubErrorInfo, removeDubTeamMember } from "@/lib/dub-teams";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  try {
    await assertTeamManager(id, user);
    const body = await req.json();
    const member = await addDubTeamMember(id, { name: body?.name, role: body?.role });
    return NextResponse.json({ member }, { status: 201 });
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
