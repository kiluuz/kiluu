import type { Prisma, PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { userOwnsVersion } from "@/lib/owns";

type DbClient = PrismaClient | Prisma.TransactionClient;

const PARTY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createPartyCode(): string {
  return Array.from({ length: 6 }, () => PARTY_CODE_CHARS[randomInt(PARTY_CODE_CHARS.length)]).join("");
}

export async function getOwnedHlsEpisode(client: DbClient, userId: string, episodeId: string) {
  const episode = await client.episode.findUnique({
    where: { id: episodeId },
    include: {
      anime: {
        select: { id: true, title: true, coverImage: true, isFree: true, hidden: true, moderationStatus: true },
      },
    },
  });
  if (!episode) return { error: "NOT_FOUND" as const };
  if (episode.anime.hidden || episode.anime.moderationStatus !== "APPROVED") return { error: "NOT_FOUND" as const };

  let ownsEpisode = episode.anime.isFree;
  if (!ownsEpisode) {
    if (episode.versionId) {
      ownsEpisode = await userOwnsVersion(userId, episode.versionId, episode.number, client);
    } else {
      ownsEpisode = Boolean(await client.purchase.findFirst({
        where: {
          userId,
          animeId: episode.animeId,
          OR: [{ episodeNumber: 0 }, { episodeNumber: episode.number }],
        },
        select: { id: true },
      }));
    }
  }
  if (!ownsEpisode) return { error: "FORBIDDEN" as const };
  const hasDirectStream = Boolean(episode.videoUrl && (episode.videoUrl.startsWith("http://") || episode.videoUrl.startsWith("https://")));
  if (!episode.streamId && !episode.hlsKey && !hasDirectStream) return { error: "NO_HLS_STREAM" as const };
  return { episode };
}

export function watchPartyJoinPrice(): number {
  const raw = process.env.WATCH_PARTY_JOIN_PRICE_CREDITS;
  const price = Number(raw ?? "20");
  if (!Number.isSafeInteger(price) || price < 1) {
    throw new Error("WATCH_PARTY_JOIN_PRICE_CREDITS must be a positive integer");
  }
  return price;
}

export async function chargePartyEntry(
  client: Prisma.TransactionClient,
  userId: string,
  partyId: string,
  price: number,
): Promise<{ charged: boolean } | { error: "INSUFFICIENT_CREDITS" }> {
  const idempotencyKey = `watch-party-entry:${partyId}:${userId}`;
  const previous = await client.creditTransaction.findUnique({ where: { idempotencyKey } });
  if (previous) return { charged: false };

  const debit = await client.user.updateMany({
    where: { id: userId, credits: { gte: price } },
    data: { credits: { decrement: price } },
  });
  if (debit.count !== 1) return { error: "INSUFFICIENT_CREDITS" };

  await client.creditTransaction.create({
    data: {
      userId,
      amount: -price,
      type: "PURCHASE",
      description: `Watch Together entry (${price} credits)`,
      refType: "watch_party",
      refId: partyId,
      idempotencyKey,
    },
  });
  return { charged: true };
}
