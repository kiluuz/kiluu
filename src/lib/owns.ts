import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";

type Db = PrismaClient | Prisma.TransactionClient;

export async function userOwnsVersion(
  userId: string,
  versionId: string,
  episodeNumber = 0,
  client: Db = db
): Promise<boolean> {
  const full = await client.purchase.findFirst({
    where: { userId, versionId, episodeNumber: 0 },
  });
  if (full) return true;
  if (episodeNumber > 0) {
    const ep = await client.purchase.findFirst({
      where: { userId, versionId, episodeNumber },
    });
    return Boolean(ep);
  }
  return false;
}

export async function officialVersionId(animeId: string, client: Db = db): Promise<string | null> {
  const v = await client.animeVersion.findFirst({
    where: { animeId, status: { in: ["published", "draft"] } },
    orderBy: { createdAt: "asc" },
  });
  return v?.id ?? null;
}
