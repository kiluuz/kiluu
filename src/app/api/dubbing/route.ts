import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/** Price per episode in credits by voice profile */
export const VOICE_PRICES: Record<string, number> = {
  aziza: 15, // warm female narrator
  timur: 15, // confident male lead
  dilnoza: 20, // expressive young female
  ulugbek: 20, // deep villain / narrator
  premium_cast: 25, // full multi-voice cast
};

// GET /api/dubbing — my dub jobs
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ jobs: [] });

  const jobs = await db.dubJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      anime: { select: { slug: true, title: true, coverImage: true } },
      episode: { select: { number: true, title: true, duration: true } },
    },
  });

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      animeSlug: j.anime.slug,
      animeTitle: j.anime.title,
      coverImage: j.anime.coverImage,
      episodeNumber: j.episode.number,
      episodeTitle: j.episode.title,
      duration: j.episode.duration,
      targetLang: j.targetLang,
      voice: j.voice,
      status: j.status,
      pricePaid: j.pricePaid,
      createdAt: j.createdAt,
    })),
  });
}

// POST /api/dubbing — create a dub job (charges credits)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to use AI dubbing" }, { status: 401 });

  try {
    const { episodeId, voice } = (await req.json()) as { episodeId?: string; voice?: string };
    if (!episodeId || !voice) {
      return NextResponse.json({ error: "episodeId and voice are required" }, { status: 400 });
    }
    const price = VOICE_PRICES[voice];
    if (!price) {
      return NextResponse.json({ error: "Unknown voice profile" }, { status: 400 });
    }

    const episode = await db.episode.findUnique({
      where: { id: episodeId },
      include: { anime: true },
    });
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    // must own the anime (or it is free)
    if (!episode.anime.isFree) {
      const owned = await db.purchase.findUnique({
        where: { userId_animeId: { userId: user.id, animeId: episode.animeId } },
      });
      if (!owned) {
        return NextResponse.json(
          { error: `You need to own "${episode.anime.title}" before dubbing its episodes` },
          { status: 403 }
        );
      }
    }

    const existing = await db.dubJob.findUnique({
      where: { userId_episodeId_targetLang: { userId: user.id, episodeId, targetLang: "uz" } },
    });
    if (existing) {
      return NextResponse.json({ error: "You already dubbed this episode in Uzbek" }, { status: 409 });
    }

    if (user.credits < price) {
      return NextResponse.json(
        { error: `Not enough credits. You need ${price - user.credits} more.`, needMore: price - user.credits },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const job = await tx.dubJob.create({
        data: {
          userId: user.id,
          animeId: episode.animeId,
          episodeId: episode.id,
          targetLang: "uz",
          voice,
          status: "COMPLETED",
          pricePaid: price,
        },
      });
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          amount: -price,
          type: "PURCHASE",
          description: `AI dub — ${episode.anime.title} EP${episode.number} → Uzbek`,
        },
      });
      const updated = await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: price } },
      });
      return { job, credits: updated.credits };
    });

    return NextResponse.json({
      success: true,
      job: {
        id: result.job.id,
        animeSlug: episode.anime.slug,
        animeTitle: episode.anime.title,
        coverImage: episode.anime.coverImage,
        episodeNumber: episode.number,
        episodeTitle: episode.title,
        duration: episode.duration,
        targetLang: "uz",
        voice,
        status: result.job.status,
        pricePaid: price,
        createdAt: result.job.createdAt,
      },
      credits: result.credits,
    });
  } catch (e) {
    console.error("dubbing error", e);
    return NextResponse.json({ error: "Dubbing failed" }, { status: 500 });
  }
}
