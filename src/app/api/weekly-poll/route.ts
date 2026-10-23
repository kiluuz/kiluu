// src/app/api/weekly-poll/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateCurrentWeeklyPoll, voteInWeeklyPoll } from "@/lib/weekly-vote";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();
    const poll = await getOrCreateCurrentWeeklyPoll();

    let myVoteAnimeId: string | null = null;
    if (user) {
      const vote = await db.weeklyAnimeVote.findUnique({
        where: { pollId_userId: { pollId: poll.id, userId: user.id } },
      });
      myVoteAnimeId = vote?.animeId || null;
    }

    const isClosed = poll.status === "closed" || poll.endsAt < new Date();
    const totalVotes = poll.candidates.reduce((sum, c) => sum + c.votesCount, 0);

    const candidates = poll.candidates.map((c) => {
      const percentage = isClosed && totalVotes > 0
        ? Math.round((c.votesCount / totalVotes) * 100)
        : null;

      return {
        id: c.anime.id,
        candidateId: c.id,
        title: c.anime.title,
        coverImage: c.anime.coverImage,
        rating: c.anime.rating,
        price: c.anime.price,
        creator: c.anime.creator,
        votesCount: isClosed ? c.votesCount : undefined,
        percentage,
        isWinner: isClosed && poll.winnerAnimeId === c.anime.id,
      };
    });

    return NextResponse.json({
      poll: {
        id: poll.id,
        weekKey: poll.weekKey,
        startsAt: poll.startsAt,
        endsAt: poll.endsAt,
        status: poll.status,
        winnerAnimeId: poll.winnerAnimeId,
        isClosed,
        myVoteAnimeId,
        candidates,
      },
    });
  } catch (error) {
    console.error("Weekly poll get error:", error);
    return NextResponse.json({ error: "Haftalik ovozni yuklashda xatolik" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Ovoz berish uchun tizimga kiring" }, { status: 401 });
    }

    const body = await req.json();
    const { animeId } = body;
    if (!animeId) {
      return NextResponse.json({ error: "animeId talab qilinadi" }, { status: 400 });
    }

    const result = await voteInWeeklyPoll(user.id, animeId);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: result.message });
  } catch (error) {
    console.error("Weekly poll vote error:", error);
    return NextResponse.json({ error: "Ovoz berishda xatolik" }, { status: 500 });
  }
}
