import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { userOwnsVersion } from "@/lib/owns";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ owns: false });
  const { id } = await params;
  const owns = await userOwnsVersion(user.id, id, 0);
  return NextResponse.json({ owns, versionId: id });
}
