import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isCreator } from "@/lib/rbac";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreator(user)) {
    return NextResponse.json({ error: "Only creators can add episodes" }, { status: 403 });
  }

  try {
    const ct = req.headers.get("content-type") || "";
    let animeId = "";
    let title = "";
    let description: string | null = null;
    let duration = 0;
    let useR2Hls = false;

    if (ct.includes("application/json")) {
      const body = await req.json();
      animeId = body.animeId;
      title = body.title;
      description = body.description || null;
      duration = Math.max(0, parseInt(body.duration) || 0);
      useR2Hls = body.useR2Hls === true;
    } else {
      return NextResponse.json({ error: "Send episode details as JSON; upload the video through the Telegram bot" }, { status: 415 });
    }

    if (!animeId) return NextResponse.json({ error: "animeId is required" }, { status: 400 });
    if (!title || !title.trim()) return NextResponse.json({ error: "Episode title is required" }, { status: 400 });
    if (!useR2Hls) {
      return NextResponse.json({ error: "Episode videos must be uploaded through Telegram; web video stream required for Watch Together" }, { status: 400 });
    }

    const anime = await db.anime.findUnique({ where: { id: animeId } });
    if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    if (anime.creatorId !== user.id) {
      return NextResponse.json({ error: "You can only add episodes to your own animes" }, { status: 403 });
    }

    const version = await db.animeVersion.findFirst({
      where: { animeId, creatorId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const lastEpisode = await db.episode.findFirst({
      where: { animeId, versionId: version?.id ?? undefined },
      orderBy: { number: "desc" },
    });
    const number = (lastEpisode?.number || 0) + 1;
    const hlsKey = `hls/${anime.slug}/${number}/index.m3u8`;

    const episode = await db.episode.create({
      data: {
        animeId,
        versionId: version?.id ?? null,
        number,
        title: title.trim(),
        description,
        videoUrl: "r2-hls",
        duration,
        streamId: null,
        hlsKey,
      },
    });

    return NextResponse.json({ episode, hlsKey }, { status: 201 });
  } catch (e) {
    console.error("add episode error", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add episode" },
      { status: e instanceof Error && e.message === "Cloudflare Stream is not configured" ? 503 : 500 }
    );
  }
}
