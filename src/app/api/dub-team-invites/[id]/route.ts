import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dubErrorInfo, respondDubTeamInvite } from "@/lib/dub-teams";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.accept !== "boolean") {
      return NextResponse.json({ error: "accept (true/false) kerak" }, { status: 400 });
    }
    const result = await respondDubTeamInvite(id, user.id, body.accept);
    return NextResponse.json(result);
  } catch (error) {
    const info = dubErrorInfo(error);
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
  }
}
