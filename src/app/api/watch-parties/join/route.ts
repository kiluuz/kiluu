import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { evaluateAchievements } from "@/lib/achievements";
import { awardXpInTransaction } from "@/lib/xp";
import { createPartyTicket } from "@/lib/watch-party-auth";
import { chargePartyEntry, getOwnedHlsEpisode, watchPartyJoinPrice } from "@/lib/watch-parties";
import { expectedPlaybackPosition } from "@/lib/watch-party-sync";
import { r2ObjectExists } from "@/lib/r2";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid 6-character party code" }, { status: 400 });
  }
  const party = await db.watchParty.findUnique({ where: { code } });
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });
  const episodeForAvailability = await db.episode.findUnique({
    where: { id: party.episodeId },
    select: { hlsKey: true },
  });
  if (episodeForAvailability?.hlsKey) {
    try {
      if (!(await r2ObjectExists(episodeForAvailability.hlsKey))) {
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

  let ticket: string;
  try {
    ticket = createPartyTicket(user.id, party.id);
  } catch (error) {
    console.error("Watch party ticket configuration error", error);
    return NextResponse.json({ error: "Watch party service is not configured" }, { status: 503 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 60_000);
  const result = await db.$transaction(async (tx) => {
    const currentParty = await tx.watchParty.findUnique({ where: { id: party.id } });
    if (!currentParty || currentParty.endedAt || currentParty.expiresAt <= now) return { error: "PARTY_ENDED" as const };
    const episodeAccess = await getOwnedHlsEpisode(tx, user.id, currentParty.episodeId);
    if ("error" in episodeAccess) {
      if (episodeAccess.error === "NOT_FOUND") return { error: "EPISODE_MISSING" as const };
      if (episodeAccess.error === "FORBIDDEN") return { error: "PURCHASE_REQUIRED" as const };
      return { error: "NO_HLS_STREAM" as const };
    }
    const existing = await tx.watchPartyMember.findUnique({
      where: { partyId_userId: { partyId: currentParty.id, userId: user.id } },
    });
    const activeCount = await tx.watchPartyMember.count({
      where: { partyId: currentParty.id, lastSeenAt: { gte: cutoff } },
    });
    if (activeCount === 0) {
      await tx.watchParty.update({ where: { id: currentParty.id }, data: { endedAt: now } });
      return { error: "PARTY_ENDED" as const };
    }
    if (!existing && activeCount >= currentParty.capacity) return { error: "PARTY_FULL" as const };

    let charged = false;
    if (!existing) {
      const charge = await chargePartyEntry(tx, user.id, currentParty.id, joinPrice);
      if ("error" in charge) return { error: charge.error };
      charged = charge.charged;
    }
    await tx.watchPartyMember.upsert({
      where: { partyId_userId: { partyId: currentParty.id, userId: user.id } },
      create: { partyId: currentParty.id, userId: user.id, lastSeenAt: now },
      update: { lastSeenAt: now },
    });
    if (!existing) await awardXpInTransaction(tx, user.id, "party_joined", currentParty.id);
    const updatedParty = await tx.watchParty.findUniqueOrThrow({
      where: { id: currentParty.id },
      include: {
        anime: { select: { title: true, coverImage: true } },
        host: { select: { id: true, username: true, displayName: true } },
        members: {
          where: { lastSeenAt: { gte: cutoff } },
          include: { user: { select: {
            id: true, username: true, displayName: true, avatarUrl: true, accentColor: true,
            avatarFrame: true, equippedAvatarFrameId: true, equippedNameFrameId: true,
          } } },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { username: true, displayName: true } } } },
      },
    });
    return { party: updatedParty, episode: episodeAccess.episode, charged };
  });
  if ("error" in result) {
    if (result.error === "PARTY_FULL") return NextResponse.json({ error: "Party is full" }, { status: 409 });
    if (result.error === "PURCHASE_REQUIRED") return NextResponse.json({ error: "You must own this anime to join" }, { status: 403 });
    if (result.error === "NO_HLS_STREAM") return NextResponse.json({ error: "This episode has no video stream" }, { status: 409 });
    if (result.error === "INSUFFICIENT_CREDITS") {
      return NextResponse.json(
        { error: `Joining Watch Together requires ${joinPrice} credits`, requiredCredits: joinPrice },
        { status: 402 },
      );
    }
    if (result.error === "EPISODE_MISSING") return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    return NextResponse.json({ error: "Party is no longer active" }, { status: 410 });
  }

  await evaluateAchievements(user.id);
  const { party: joined, episode } = result;
  const serverTs = Number(joined.serverTs) || now.getTime();
  return NextResponse.json({
    ticket,
    entryCostCredits: result.charged ? joinPrice : 0,
    state: {
      video_id: joined.episodeId,
      position: expectedPlaybackPosition({
        position: joined.position,
        isPlaying: joined.isPlaying,
        serverTs,
        playbackRate: joined.playbackRate,
      }, now.getTime()),
      is_playing: joined.isPlaying,
      playback_rate: joined.playbackRate,
      server_ts: now.getTime(),
    },
    party: {
      id: joined.id,
      code: joined.code,
      name: joined.name,
      animeId: joined.animeId,
      animeTitle: joined.anime.title,
      episodeId: joined.episodeId,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      duration: episode.duration,
      videoUrl: episode.hlsKey ? "r2-hls" : (episode.videoUrl?.startsWith("http") ? episode.videoUrl : "cloudflare"),
      streamId: episode.streamId,
      hlsKey: episode.hlsKey,
      coverImage: joined.anime.coverImage,
      createdAt: joined.createdAt.getTime(),
      hostName: joined.host.displayName || joined.host.username,
      participantCount: joined.members.length,
      capacity: joined.capacity,
    },
    participants: joined.members.map((member) => ({
      userId: member.user.id,
      username: member.user.username,
      displayName: member.user.displayName || member.user.username,
      avatarUrl: member.user.avatarUrl,
      accentColor: member.user.accentColor,
      avatarFrame: member.user.avatarFrame,
      equippedAvatarFrameId: member.user.equippedAvatarFrameId,
      equippedNameFrameId: member.user.equippedNameFrameId,
      isHost: member.user.id === joined.hostId,
    })),
    messages: joined.messages.reverse().map((message) => ({
      id: message.id,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      username: message.user.displayName || message.user.username,
    })),
  });
}
