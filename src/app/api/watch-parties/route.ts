import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateAchievements } from "@/lib/achievements";
import { awardXpInTransaction } from "@/lib/xp";
import { createPartyTicket } from "@/lib/watch-party-auth";
import { chargePartyEntry, createPartyCode, getOwnedHlsEpisode, watchPartyJoinPrice } from "@/lib/watch-parties";
import { r2ObjectExists } from "@/lib/r2";

export async function GET() {
  let entryCostCredits: number;
  try {
    entryCostCredits = watchPartyJoinPrice();
  } catch (error) {
    console.error("Watch party price configuration error", error);
    return NextResponse.json({ error: "Watch party pricing is not configured" }, { status: 503 });
  }
  const now = new Date();
  const cutoff = new Date(now.getTime() - 60_000);
  const parties = await db.watchParty.findMany({
    where: {
      endedAt: null,
      expiresAt: { gt: now },
      members: { some: { lastSeenAt: { gte: cutoff } } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      anime: { select: { title: true, coverImage: true } },
      host: { select: { displayName: true, username: true } },
      members: { where: { lastSeenAt: { gte: cutoff } }, select: { id: true } },
    },
  });
  const episodes = parties.length
    ? await db.episode.findMany({
        where: { id: { in: parties.map((party) => party.episodeId) } },
        select: { id: true, title: true, number: true, duration: true },
      })
    : [];
  const episodeById = new Map(episodes.map((episode) => [episode.id, episode]));
  return NextResponse.json({
    entryCostCredits,
    parties: parties.flatMap((party) => {
      const episode = episodeById.get(party.episodeId);
      if (!episode) return [];
      return [{
      id: party.id,
      code: party.code,
      name: party.name,
      animeId: party.animeId,
      animeTitle: party.anime.title,
      episodeId: party.episodeId,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      duration: episode.duration,
      coverImage: party.anime.coverImage,
      hostName: party.host.displayName || party.host.username,
      participantCount: party.members.length,
      expiresAt: party.expiresAt.toISOString(),
      }];
    }),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { episodeId?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body.episodeId !== "string" || !body.episodeId) {
    return NextResponse.json({ error: "episodeId is required" }, { status: 400 });
  }
  const result = await getOwnedHlsEpisode(db, user.id, body.episodeId);
  if ("error" in result) {
    if (result.error === "NOT_FOUND") return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    if (result.error === "FORBIDDEN") return NextResponse.json({ error: "Purchase required" }, { status: 403 });
    return NextResponse.json({ error: "This episode has no video stream yet" }, { status: 409 });
  }
  if (result.episode.hlsKey) {
    try {
      if (!(await r2ObjectExists(result.episode.hlsKey))) {
        return NextResponse.json({ error: "Video stream files have not been uploaded yet" }, { status: 409 });
      }
    } catch (error) {
      console.error("Watch party media availability check failed", error);
      return NextResponse.json({ error: "Media storage is temporarily unavailable" }, { status: 503 });
    }
  }
  let joinPrice: number;
  try {
    joinPrice = watchPartyJoinPrice();
  } catch (error) {
    console.error("Watch party price configuration error", error);
    return NextResponse.json({ error: "Watch party pricing is not configured" }, { status: 503 });
  }
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  const id = randomUUID();
  let ticket: string;
  try {
    ticket = createPartyTicket(user.id, id);
  } catch (error) {
    console.error("Watch party ticket configuration error", error);
    return NextResponse.json({ error: "Watch party service is not configured" }, { status: 503 });
  }

  const now = new Date();
  const resultParty = await db.$transaction(async (tx) => {
    const charge = await chargePartyEntry(tx, user.id, id, joinPrice);
    if ("error" in charge) return { error: "INSUFFICIENT_CREDITS" as const };
    const created = await tx.watchParty.create({
      data: {
        id,
        code: createPartyCode(),
        name: name || `${user.displayName || user.username}'s Watch Party`,
        hostId: user.id,
        createdById: user.id,
        animeId: result.episode.animeId,
        episodeId: result.episode.id,
        videoUrl: result.episode.hlsKey ? "r2-hls" : "cloudflare",
        serverTs: BigInt(now.getTime()),
        capacity: 50,
        expiresAt: new Date(now.getTime() + 8 * 60 * 60 * 1000),
        members: { create: { userId: user.id, lastSeenAt: now } },
      },
    });
    await awardXpInTransaction(tx, user.id, "party_hosted", created.id);
    return { party: created };
  });
  if ("error" in resultParty) {
    return NextResponse.json(
      { error: `Watch Together requires ${joinPrice} credits to create a party`, requiredCredits: joinPrice },
      { status: 402 },
    );
  }
  const party = resultParty.party;
  await evaluateAchievements(user.id);
  return NextResponse.json({
    ticket,
    entryCostCredits: joinPrice,
    party: {
      id: party.id,
      code: party.code,
      name: party.name,
      animeId: result.episode.animeId,
      animeTitle: result.episode.anime.title,
      episodeId: result.episode.id,
      episodeNumber: result.episode.number,
      episodeTitle: result.episode.title,
      duration: result.episode.duration,
      videoUrl: result.episode.hlsKey ? "r2-hls" : "cloudflare",
      streamId: result.episode.streamId,
      hlsKey: result.episode.hlsKey,
      coverImage: result.episode.anime.coverImage,
      createdAt: party.createdAt.getTime(),
      hostName: user.displayName || user.username,
      participantCount: 1,
      capacity: party.capacity,
    },
  }, { status: 201 });
}
