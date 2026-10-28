import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { watchDeltaSeconds } from "@/lib/watch-time";
import { awardXpInTransaction } from "@/lib/xp";
import { evaluateAchievements } from "@/lib/achievements";
import { emitEvent } from "@/lib/events";

// POST /api/progress - save watch position
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { episodeId, position } = body;
    const duration = body.duration;
    const completed = body.completed;
    if (
      typeof episodeId !== "string" || !episodeId ||
      typeof position !== "number" || !Number.isFinite(position) || position < 0 ||
      (duration !== undefined && (typeof duration !== "number" || !Number.isFinite(duration) || duration < 0)) ||
      (completed !== undefined && typeof completed !== "boolean")
    ) {
      return NextResponse.json({ error: "episodeId and position required" }, { status: 400 });
    }

    const episode = await db.episode.findUnique({ where: { id: episodeId } });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    const anime = await db.anime.findUnique({ where: { id: episode.animeId } });

    // Verify access
    if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });
    if (!anime.isFree) {
      const purchase = await db.purchase.findFirst({
        where: { userId: user.id, animeId: anime.id },
      });
      if (!purchase) return NextResponse.json({ error: "You do not own this anime" }, { status: 403 });
    }

    const actualDuration = duration || episode.duration || 0;
    const safePosition = actualDuration > 0 ? Math.min(position, actualDuration) : position;
    const isCompleted = completed === true || (actualDuration > 0 && safePosition >= actualDuration * 0.95);

    await db.$transaction(async (tx) => {
      const previous = await tx.watchProgress.findUnique({
        where: { userId_episodeId: { userId: user.id, episodeId } },
        select: { position: true, updatedAt: true, completed: true },
      });
      const elapsedCap = previous
        ? Math.min(30, Math.max(0, Math.floor((Date.now() - previous.updatedAt.getTime()) / 1000)))
        : 0;
      const watchedSeconds = watchDeltaSeconds(previous?.position ?? safePosition, safePosition, elapsedCap);
      await tx.watchProgress.upsert({
        where: { userId_episodeId: { userId: user.id, episodeId } },
        update: { position: safePosition, duration: actualDuration, completed: isCompleted },
        create: {
          userId: user.id,
          episodeId,
          animeId: anime.id,
          position: safePosition,
          duration: actualDuration,
          completed: isCompleted,
        },
      });
      if (watchedSeconds > 0) {
        const beforeWatch = await tx.watchEvent.aggregate({
          where: { userId: user.id },
          _sum: { seconds: true },
        });
        await tx.watchEvent.create({
          data: { userId: user.id, episodeId, animeId: anime.id, seconds: watchedSeconds },
        });
        const previousMinute = Math.floor((beforeWatch._sum.seconds || 0) / 60);
        const newMinute = Math.floor(((beforeWatch._sum.seconds || 0) + watchedSeconds) / 60);
        for (let minute = previousMinute + 1; minute <= newMinute; minute += 1) {
          await awardXpInTransaction(tx, user.id, "watch_time", `minute-${minute}`);
        }
      }
      if (isCompleted && !previous?.completed) {
        await awardXpInTransaction(tx, user.id, "watch_complete", episodeId);
      }
    });

    await evaluateAchievements(user.id);
    await emitEvent(user, "episode_watched", { episodeId, animeId: anime.id, isCompleted });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("progress error", e);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
