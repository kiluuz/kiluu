import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isCreator } from "@/lib/rbac";
import { createDubTeam, dubErrorInfo, listDubTeams } from "@/lib/dub-teams";

export async function GET(req: NextRequest) {
  const mine = req.nextUrl.searchParams.get("mine") === "1";
  if (mine) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const teams = await listDubTeams({ ownerId: user.id });
    return NextResponse.json(
      { teams: teams.map(({ credits, ...team }) => ({ ...team, animeCount: new Set(credits.map((row) => row.animeId)).size })) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }
  const teams = await listDubTeams();
  return NextResponse.json(
    { teams: teams.map(({ credits, ...team }) => ({ ...team, animeCount: new Set(credits.map((row) => row.animeId)).size })) },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
  );
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreator(user)) return NextResponse.json({ error: "Faqat creatorlar jamoa yaratadi" }, { status: 403 });

  try {
    const body = await req.json();
    const team = await createDubTeam({
      ownerId: user.id,
      name: body?.name,
      description: body?.description,
      avatarUrl: body?.avatarUrl,
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    const info = dubErrorInfo(error);
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
  }
}
