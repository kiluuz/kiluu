import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dubErrorInfo, rateDubCredit } from "@/lib/dub-teams";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Avval tizimga kiring" }, { status: 401 });

  try {
    const body = await req.json();
    const rating = Number(body?.rating);
    const result = await rateDubCredit({ creditId: id, userId: user.id, rating });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const info = dubErrorInfo(error);
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
  }
}
