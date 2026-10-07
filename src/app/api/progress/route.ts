import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// POST /api/progress - save watch position
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { episodeId, position, duration, completed } = await req.json();
    if (!episodeId || typeof position !== "number") {
      return NextResponse.json({ error: "episodeId and position required" }, { status: 400 });
    }

    const episode = await db.episode.findUnique({ where: { id: episodeId } });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const anime = await db.anime.findUnique({ where: { id: episode.animeId } });

    // Verify access
    if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    if (!anime.isFree) {
      const purchase = await db.purchase.findUnique({
        where: { userId_animeId: { userId: user.id, animeId: anime.id } },
      });
      if (!purchase) return NextResponse.json({ error: "You do not own this anime" }, { status: 403 });
    }

    const isCompleted = Boolean(completed) || (duration > 0 && position >= duration * 0.95);

    await db.watchProgress.upsert({
      where: { userId_episodeId: { userId: user.id, episodeId } },
      update: { position, duration: duration || 0, completed: isCompleted },
      create: {
        userId: user.id,
        episodeId,
        animeId: anime.id,
        position,
        duration: duration || 0,
        completed: isCompleted,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("progress error", e);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
