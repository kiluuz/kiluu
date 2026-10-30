import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addDubCredit, assertTeamManager, dubErrorInfo, removeDubCredit } from "@/lib/dub-teams";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  try {
    await assertTeamManager(id, user);
    const body = await req.json();
    const credit = await addDubCredit({
      teamId: id,
      animeId: typeof body?.animeId === "string" ? body.animeId : "",
      versionId: typeof body?.versionId === "string" ? body.versionId : null,
      language: body?.language,
      cast: Array.isArray(body?.cast) ? body.cast : [],
    });
    return NextResponse.json({ credit }, { status: 201 });
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
    const creditId = req.nextUrl.searchParams.get("creditId") || "";
    if (!creditId) return NextResponse.json({ error: "creditId kerak" }, { status: 400 });
    await removeDubCredit(id, creditId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const info = dubErrorInfo(error);
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
  }
}
