import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import {
  assertTeamManager,
  dubErrorInfo,
  dubTeamTitle,
  ensureTeamClub,
  recomputeTeamReputation,
  updateDubTeam,
} from "@/lib/dub-teams";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  const team = await db.dubTeam.findUnique({
    where: { id },
    include: {
      owner: { select: { username: true, displayName: true, avatarUrl: true } },
      club: { select: { id: true, tag: true, chatRoom: { select: { id: true } } } },
      members: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          role: true,
          userId: true,
          user: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      },
      credits: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          language: true,
          speakerCount: true,
          createdAt: true,
          anime: { select: { id: true, slug: true, title: true, coverImage: true } },
          cast: { orderBy: { createdAt: "asc" }, select: { id: true, speakerName: true, character: true } },
        },
      },
    },
  });
  if (!team) return NextResponse.json({ error: "Jamoa topilmadi" }, { status: 404 });

  const creditIds = team.credits.map((credit) => credit.id);
  const [creditStats, overall] = await Promise.all([
    creditIds.length
      ? db.dubTeamRating.groupBy({
          by: ["creditId"],
          where: { creditId: { in: creditIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : Promise.resolve([] as { creditId: string; _avg: { rating: number | null }; _count: { _all: number } }[]),
    db.dubTeamRating.aggregate({ where: { teamId: id }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const statsByCredit = new Map(creditStats.map((row) => [row.creditId, row]));
  const isMine = viewer ? viewer.id === team.ownerId || isAdminUser(viewer) : false;
  let clubId = team.club?.id ?? null;
  if (!clubId && isMine) {
    clubId = await ensureTeamClub(team.id).catch(() => null);
  }
  const invites = isMine
    ? await db.dubTeamInvite.findMany({
        where: { teamId: id, status: "pending" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      })
    : [];

  return NextResponse.json(
    {
      team: {
        ...team,
        title: dubTeamTitle(team.reputation, team.verified),
        isMine,
        linkedMemberCount: team.members.filter((member) => member.userId).length,
        clubId,
        chatRoomId: team.club?.chatRoom?.id ?? (clubId ? `club:${clubId}` : null),
        invites,
        rating: average(overall._avg.rating),
        ratingCount: overall._count._all,
        credits: team.credits.map((credit) => ({
          ...credit,
          rating: average(statsByCredit.get(credit.id)?._avg.rating),
          ratingCount: statsByCredit.get(credit.id)?._count._all ?? 0,
        })),
      },
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

function average(value: number | null | undefined): number | null {
  return value == null ? null : Number(value.toFixed(2));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  try {
    await assertTeamManager(id, user);
    const body = await req.json();
    if ((body?.verified !== undefined || body?.status !== undefined) && !isAdminUser(user)) {
      return NextResponse.json({ error: "Faqat admin jamoa holatini o‘zgartiradi" }, { status: 403 });
    }
    const team = await updateDubTeam(id, body ?? {});
    if (body?.verified !== undefined) await recomputeTeamReputation(id);
    return NextResponse.json({ team });
  } catch (error) {
    const info = dubErrorInfo(error);
    return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
  }
}
