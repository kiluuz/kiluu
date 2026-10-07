import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/creator/episodes - add an episode to my anime
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "CREATOR") {
    return NextResponse.json({ error: "Only creators can add episodes" }, { status: 403 });
  }

  try {
    const { animeId, title, description, videoUrl, duration } = await req.json();

    if (!animeId) return NextResponse.json({ error: "animeId is required" }, { status: 400 });
    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Episode title is required" }, { status: 400 });
    }
    if (!videoUrl || typeof videoUrl !== "string" || !/^https?:\/\//.test(videoUrl)) {
      return NextResponse.json({ error: "A valid video URL (mp4) is required" }, { status: 400 });
    }

    const anime = await db.anime.findUnique({ where: { id: animeId } });
    if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    if (anime.creatorId !== user.id) {
      return NextResponse.json({ error: "You can only add episodes to your own animes" }, { status: 403 });
    }

    const lastEpisode = await db.episode.findFirst({
      where: { animeId },
      orderBy: { number: "desc" },
    });
    const number = (lastEpisode?.number || 0) + 1;

    const episode = await db.episode.create({
      data: {
        animeId,
        number,
        title: title.trim(),
        description: description || null,
        videoUrl,
        duration: Math.max(0, parseInt(duration) || 0),
      },
    });

    return NextResponse.json({ episode }, { status: 201 });
  } catch (e) {
    console.error("add episode error", e);
    return NextResponse.json({ error: "Failed to add episode" }, { status: 500 });
  }
}
