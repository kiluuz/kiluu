import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listDubTeamInvites } from "@/lib/dub-teams";

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const invites = await listDubTeamInvites(user.id);
  return NextResponse.json({ invites }, { headers: { "Cache-Control": "private, no-store" } });
}
