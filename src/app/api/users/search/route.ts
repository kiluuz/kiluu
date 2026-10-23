import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canViewProfile, parseProfilePrivacy } from "@/lib/profile-privacy";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ users: [] });
  if (query.length > 80) {
    return NextResponse.json({ error: "Search query is too long" }, { status: 400 });
  }

  try {
    const me = await getCurrentUser();
    const candidates = await db.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        avatarFrame: true,
        equippedAvatarFrameId: true,
        equippedNameFrameId: true,
        role: true,
        accentColor: true,
        accentTo: true,
        privacy: true,
      },
      orderBy: { username: "asc" },
      take: 30,
    });

    const followedIds = me && candidates.length
      ? await db.follow.findMany({
          where: {
            followerId: me.id,
            followedId: { in: candidates.map((candidate) => candidate.id) },
          },
          select: { followedId: true },
        }).then((follows) => new Set(follows.map((follow) => follow.followedId)))
      : new Set<string>();

    const users = candidates
      .filter((candidate) =>
        canViewProfile(
          parseProfilePrivacy(candidate.privacy),
          candidate.id === me?.id,
          followedIds.has(candidate.id),
        )
      )
      .slice(0, 12)
      .map(({ id, username, displayName, avatarUrl, avatarFrame, equippedAvatarFrameId, equippedNameFrameId, role, accentColor, accentTo }) => ({
        id,
        username,
        displayName,
        avatarUrl,
        avatarFrame,
        equippedAvatarFrameId,
        equippedNameFrameId,
        role,
        accentColor,
        accentTo,
      }));

    return NextResponse.json({ users }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("user search error", error);
    return NextResponse.json({ error: "User search failed" }, { status: 500 });
  }
}
