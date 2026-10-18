import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getLeaderboards } from "@/lib/leaderboards";
import { sqlTable } from "@/lib/sql-table";

export async function GET() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const presenceCutoff = new Date(now.getTime() - 5 * 60_000);

  const [postsToday, online, trendingRows, leaderboards, parties] = await Promise.all([
    db.post.count({ where: { createdAt: { gte: startOfDay }, hidden: false } }),
    db.user.count({ where: { lastSeenAt: { gte: presenceCutoff } } }),
    db.$queryRaw<Array<{ animeId: string; postCount: number; likeCount: number }>>(Prisma.sql`
      SELECT p."animeId" AS "animeId",
        COUNT(DISTINCT p.id) AS "postCount",
        COUNT(DISTINCT l.id) AS "likeCount"
      FROM ${sqlTable("Post")} p
      LEFT JOIN ${sqlTable("PostLike")} l ON l."postId" = p.id
      WHERE p.hidden = false AND p."animeId" IS NOT NULL AND p."createdAt" >= ${weekAgo}
      GROUP BY p."animeId"
      ORDER BY "postCount" DESC, "likeCount" DESC
      LIMIT 8
    `),
    getLeaderboards(),
    db.watchParty.findMany({
      where: {
        endedAt: null,
        expiresAt: { gt: now },
        members: { some: { lastSeenAt: { gte: new Date(now.getTime() - 60_000) } } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        anime: { select: { title: true, coverImage: true } },
        members: { where: { lastSeenAt: { gte: new Date(now.getTime() - 60_000) } }, select: { id: true } },
      },
    }),
  ]);

  const animeIds = trendingRows.map((row) => row.animeId);
  const animes = animeIds.length
    ? await db.anime.findMany({
        where: { id: { in: animeIds } },
        select: { id: true, slug: true, title: true, coverImage: true },
      })
    : [];
  const animeById = new Map(animes.map((anime) => [anime.id, anime]));

  return NextResponse.json({
    online,
    postsToday,
    trending: trendingRows.flatMap((row) => {
      const anime = animeById.get(row.animeId);
      return anime ? [{ ...anime, posts: Number(row.postCount), likes: Number(row.likeCount) }] : [];
    }),
    contributors: leaderboards.contributors.slice(0, 5),
    watchParties: parties.map((party) => ({
      id: party.id,
      code: party.code,
      name: party.name,
      title: party.anime.title,
      coverImage: party.anime.coverImage,
      watching: party.members.length,
    })),
  });
}
