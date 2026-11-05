import type { Prisma, PrismaClient } from "@prisma/client";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { userOwnsVersion } from "@/lib/owns";
import { verifyPartyTicket } from "@/lib/watch-party-auth";

type DbClient = PrismaClient | Prisma.TransactionClient;

const PARTY_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createPartyCode(): string {
  return Array.from({ length: 6 }, () => PARTY_CODE_CHARS[randomInt(PARTY_CODE_CHARS.length)]).join("");
}

/**
 * Episode + ownership for a watch party. Unlike `getOwnedHlsEpisode` this does
 * not refuse non-owners: Watch Together lets them in for half the anime price.
 */
export async function getPartyEpisode(client: DbClient, userId: string, episodeId: string) {
  const episode = await client.episode.findUnique({
    where: { id: episodeId },
    include: {
      anime: {
        select: { id: true, title: true, coverImage: true, isFree: true, price: true, hidden: true, moderationStatus: true },
      },
      version: { select: { id: true, price: true, creatorId: true } },
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
  const hasStream = Boolean(episode.hlsKey || episode.streamId)
    || Boolean(episode.videoUrl && (episode.videoUrl.startsWith("http://") || episode.videoUrl.startsWith("https://")));
  return {
    episode,
    owns: ownsEpisode,
    hasStream,
    fullPrice: episode.version?.price ?? episode.anime.price,
    creatorId: episode.version?.creatorId ?? null,
  };
}

export async function getOwnedHlsEpisode(client: DbClient, userId: string, episodeId: string) {
  const resolved = await getPartyEpisode(client, userId, episodeId);
  if ("error" in resolved) return resolved;
  if (!resolved.owns) return { error: "FORBIDDEN" as const };
  if (!resolved.hasStream) return { error: "NO_HLS_STREAM" as const };
  return { episode: resolved.episode };
}

/**
 * Entry fee for one participant of a room, host included, paid by someone who
 * already owns the anime. Deliberately a constant: the price a user sees has to
 * match what the join route charges, whatever a deployment's env says.
 */
export const WATCH_PARTY_ENTRY_PRICE_CREDITS = 10;

/**
 * A guest who paid to enter a room may watch that room's episode, and only it.
 * This is a viewing grant, not a purchase: no Purchase row is written, so the
 * anime stays unowned and every other request for it still requires buying it.
 */
export async function getPartyStreamEpisode(
  client: DbClient,
  userId: string,
  episodeId: string,
  ticket: string
) {
  if (!ticket) return null;
  let access: { partyId: string; userId: string } | null = null;
  try {
    access = verifyPartyTicket(ticket);
  } catch {
    // Without WATCH_PARTY_SECRET no ticket can be vouched for.
    return null;
  }
  if (!access || access.userId !== userId) return null;
  const party = await client.watchParty.findFirst({
    where: {
      id: access.partyId,
      episodeId,
      endedAt: null,
      expiresAt: { gt: new Date() },
      members: { some: { userId } },
    },
    select: { id: true },
  });
  if (!party) return null;
  const resolved = await getPartyEpisode(client, userId, episodeId);
  if ("error" in resolved || !resolved.hasStream) return null;
  return resolved.episode;
}

/**
 * Owners pay the flat entry price. Anyone else pays half the anime price and the
 * dubbing creator takes half of that payment.
 */
export function partyJoinCost(opts: { owns: boolean; fullPrice: number; joinPrice: number }): number {
  if (opts.owns) return opts.joinPrice;
  return Math.max(0, Math.ceil(opts.fullPrice / 2));
}

export function partyJoinCreatorShare(cost: number): number {
  return Math.floor(cost / 2);
}

/**
 * Join cost per episode for one user, resolved in bulk for the party list.
 * Ownership comes from a version purchase (episodeNumber 0 = whole version), or a
 * plain anime purchase for episodes that have no version.
 */
export async function partyJoinCosts(
  userId: string | null,
  episodeIds: string[],
  joinPrice: number
): Promise<Map<string, { cost: number; owns: boolean; fullPrice: number }>> {
  const result = new Map<string, { cost: number; owns: boolean; fullPrice: number }>();
  if (episodeIds.length === 0) return result;

  const episodes = await db.episode.findMany({
    where: { id: { in: episodeIds } },
    select: {
      id: true,
      number: true,
      animeId: true,
      versionId: true,
      anime: { select: { isFree: true, price: true } },
      version: { select: { price: true } },
    },
  });

  const versionIds = [...new Set(episodes.map((episode) => episode.versionId).filter((id): id is string => Boolean(id)))];
  const animeIds = [...new Set(episodes.map((episode) => episode.animeId))];
  const ownedVersions = new Set<string>();
  const ownedAnime = new Set<string>();
  const ownedEpisodeKeys = new Set<string>();

  if (userId && (versionIds.length || animeIds.length)) {
    const purchases = await db.purchase.findMany({
      where: { userId, OR: [{ versionId: { in: versionIds } }, { animeId: { in: animeIds } }] },
      select: { versionId: true, animeId: true, episodeNumber: true },
    });
    for (const purchase of purchases) {
      if (purchase.versionId && purchase.episodeNumber === 0) ownedVersions.add(purchase.versionId);
      if (purchase.animeId && purchase.episodeNumber === 0) ownedAnime.add(purchase.animeId);
      if (purchase.versionId) ownedEpisodeKeys.add(`${purchase.versionId}:${purchase.episodeNumber}`);
      if (purchase.animeId) ownedEpisodeKeys.add(`anime:${purchase.animeId}:${purchase.episodeNumber}`);
    }
  }

  for (const episode of episodes) {
    const fullPrice = episode.version?.price ?? episode.anime.price;
    const owns = userId
      ? episode.anime.isFree
        || Boolean(episode.versionId && (ownedVersions.has(episode.versionId)
          || ownedEpisodeKeys.has(`${episode.versionId}:${episode.number}`)))
        || ownedAnime.has(episode.animeId)
        || ownedEpisodeKeys.has(`anime:${episode.animeId}:${episode.number}`)
      : false;
    result.set(episode.id, { cost: partyJoinCost({ owns, fullPrice, joinPrice }), owns, fullPrice });
  }
  return result;
}

export async function chargePartyEntry(
  client: Prisma.TransactionClient,
  userId: string,
  partyId: string,
  price: number,
  creatorShare?: { creatorId: string; amount: number } | null,
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

  const share = creatorShare && creatorShare.amount > 0 ? creatorShare : null;
  if (share) {
    await client.user.update({ where: { id: share.creatorId }, data: { credits: { increment: share.amount } } });
    await client.creditTransaction.create({
      data: {
        userId: share.creatorId,
        amount: share.amount,
        type: "BONUS",
        description: `Creator share from a Watch Together entry (${price} credits)`,
        refType: "watch_party",
        refId: partyId,
        idempotencyKey: `watch-party-creator:${partyId}:${userId}`,
      },
    });
  }
  return { charged: true };
}
