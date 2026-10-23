import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sqlTable } from "@/lib/sql-table";
import { getXpTotals, levelFromXp } from "@/lib/xp";

type RankedUser = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  avatarFrame: string | null;
  equippedAvatarFrameId: string | null;
  equippedNameFrameId: string | null;
  accentColor: string;
  accentTo?: string | null;
  score: number;
  level: number;
};

type Leaderboards = {
  collectors: RankedUser[];
  contributors: (RankedUser & { postCount: number; likeCount: number })[];
  creators: RankedUser[];
};

let cached: { expiresAt: number; result: Leaderboards } | null = null;
let pending: Promise<Leaderboards> | null = null;
const CACHE_MS = 10_000;

export async function getLeaderboards(): Promise<Leaderboards> {
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (pending) return pending;

  pending = (async () => {
    const [collectorRows, contributorRows, creatorRows] = await Promise.all([
      db.$queryRaw<Array<{
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        avatarFrame: string | null;
        equippedAvatarFrameId: string | null;
        equippedNameFrameId: string | null;
        accentColor: string;
        animeCount: number | bigint;
      }>>(Prisma.sql`
        WITH owned AS (
          SELECT "userId", "animeId" FROM ${sqlTable("Purchase")}
          UNION
          SELECT o."site_user_id" AS "userId", a.id AS "animeId"
          FROM ${sqlTable("Order")} o
          JOIN ${sqlTable("Anime")} a ON a.slug = o."anime_slug"
          WHERE o.status IN ('COMPLETED', 'PAID_PENDING_GRANT')
        )
        SELECT u.id, u.username, u."displayName", u."avatarUrl", u."avatarFrame",
          u."equipped_avatar_frame_id" AS "equippedAvatarFrameId",
          u."equipped_name_frame_id" AS "equippedNameFrameId", u."accentColor", u."accentTo",
          COUNT(DISTINCT owned."animeId") AS "animeCount"
        FROM owned
        JOIN ${sqlTable("User")} u ON u.id = owned."userId"
        GROUP BY u.id
        HAVING COUNT(DISTINCT owned."animeId") > 0
        ORDER BY "animeCount" DESC, u.username ASC
        LIMIT 10
      `),
      db.$queryRaw<Array<{
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        avatarFrame: string | null;
        equippedAvatarFrameId: string | null;
        equippedNameFrameId: string | null;
        accentColor: string;
        accentTo?: string | null;
        postCount: number;
        likeCount: number;
      }>>(Prisma.sql`
        SELECT u.id, u.username, u."displayName", u."avatarUrl", u."avatarFrame",
          u."equipped_avatar_frame_id" AS "equippedAvatarFrameId",
          u."equipped_name_frame_id" AS "equippedNameFrameId", u."accentColor", u."accentTo",
          COUNT(DISTINCT p.id) AS "postCount", COUNT(DISTINCT l.id) AS "likeCount"
        FROM ${sqlTable("User")} u
        LEFT JOIN ${sqlTable("Post")} p ON p."userId" = u.id AND p.hidden = false
        LEFT JOIN ${sqlTable("PostLike")} l ON l."postId" = p.id
        GROUP BY u.id
        HAVING COUNT(DISTINCT p.id) > 0 OR COUNT(DISTINCT l.id) > 0
        ORDER BY "postCount" DESC, "likeCount" DESC, u.username ASC
        LIMIT 10
      `),
      db.$queryRaw<Array<{
        id: string;
        username: string;
        displayName: string | null;
        avatarUrl: string | null;
        avatarFrame: string | null;
        equippedAvatarFrameId: string | null;
        equippedNameFrameId: string | null;
        accentColor: string;
        accentTo?: string | null;
        animeCount: number | bigint;
      }>>(Prisma.sql`
        SELECT u.id, u.username, u."displayName", u."avatarUrl", u."avatarFrame",
          u."equipped_avatar_frame_id" AS "equippedAvatarFrameId",
          u."equipped_name_frame_id" AS "equippedNameFrameId", u."accentColor", u."accentTo",
          COUNT(a.id) AS "animeCount"
        FROM ${sqlTable("Anime")} a
        JOIN ${sqlTable("User")} u ON u.id = a."creatorId"
        WHERE a.hidden = false AND a."moderationStatus" = 'APPROVED'
        GROUP BY u.id
        HAVING COUNT(a.id) > 0
        ORDER BY "animeCount" DESC, u.username ASC
        LIMIT 10
      `),
    ]);

    const xpTotals = await getXpTotals([
      ...collectorRows.map((row) => row.id),
      ...contributorRows.map((row) => row.id),
      ...creatorRows.map((row) => row.id),
    ]);
    const withLevel = <T extends { id: string }>(row: T) => ({
      ...row,
      level: levelFromXp(xpTotals.get(row.id) ?? 0).level,
    });
    const result: Leaderboards = {
      collectors: collectorRows.map((row) => {
        const { animeCount, ...profile } = row;
        return withLevel({ ...profile, score: Number(animeCount) });
      }),
      contributors: contributorRows.map((row) => withLevel({
        ...row,
        score: Number(row.postCount) + Number(row.likeCount),
        postCount: Number(row.postCount),
        likeCount: Number(row.likeCount),
      })),
      creators: creatorRows.map((row) => {
        const { animeCount, ...profile } = row;
        return withLevel({ ...profile, score: Number(animeCount) });
      }),
    };
    cached = { result, expiresAt: Date.now() + CACHE_MS };
    return result;
  })();

  try {
    return await pending;
  } finally {
    pending = null;
  }
}
