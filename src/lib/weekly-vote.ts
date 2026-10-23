// src/lib/weekly-vote.ts
// DubAniX Haftalik "Anime of the Week" ovoz berish tizimi (11-QISM)

import { db } from "./db";
import { getWeekPeriodKey } from "./quests";

export async function getOrCreateCurrentWeeklyPoll() {
  const weekKey = getWeekPeriodKey();

  let poll = await db.weeklyAnimePoll.findUnique({
    where: { weekKey },
    include: {
      candidates: {
        include: {
          anime: {
            select: {
              id: true,
              title: true,
              coverImage: true,
              rating: true,
              price: true,
              creator: {
                select: { username: true, displayName: true },
              },
            },
          },
        },
      },
    },
  });

  if (poll && poll.status === "active" && poll.candidates.length < 10) {
    const existingIds = new Set(poll.candidates.map((c) => c.animeId));
    const newAnimes = await db.anime.findMany({
      where: {
        id: { notIn: Array.from(existingIds) },
        hidden: false,
        moderationStatus: "APPROVED",
      },
      orderBy: { createdAt: "desc" },
      take: 10 - poll.candidates.length,
      select: { id: true },
    });
    if (newAnimes.length > 0) {
      await db.weeklyAnimeCandidate.createMany({
        data: newAnimes.map((a) => ({
          pollId: poll!.id,
          animeId: a.id,
          votesCount: 0,
        })),
        skipDuplicates: true,
      });
      poll = await db.weeklyAnimePoll.findUnique({
        where: { id: poll.id },
        include: {
          candidates: {
            include: {
              anime: {
                select: {
                  id: true,
                  title: true,
                  coverImage: true,
                  rating: true,
                  price: true,
                  creator: {
                    select: { username: true, displayName: true },
                  },
                },
              },
            },
          },
        },
      });
    }
  }

  if (!poll) {
    const now = new Date();
    // Haftaning dushanba kuni boshlanishi
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);

    const nextMonday = new Date(monday);
    nextMonday.setDate(monday.getDate() + 7);

    // Nomzodlarni yig'ish: Oxirgi hafta xarid/tomosha bo'yicha eng yaxshi 8 ta + 2 ta tasodifiy
    const topAnimeIds = await db.watchEvent.groupBy({
      by: ["animeId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 8,
    });

    const candidateIds = topAnimeIds.map((t) => t.animeId);

    // Agar 8 tadan kam bo'lsa, eng ommabop animelarni qo'shish
    if (candidateIds.length < 8) {
      const popular = await db.anime.findMany({
        where: { id: { notIn: candidateIds } },
        orderBy: { rating: "desc" },
        take: 8 - candidateIds.length,
        select: { id: true },
      });
      candidateIds.push(...popular.map((a) => a.id));
    }

    // 2 ta tasodifiy katalogdan
    const randomCatalog = await db.anime.findMany({
      where: { id: { notIn: candidateIds } },
      take: 2,
      select: { id: true },
    });
    candidateIds.push(...randomCatalog.map((a) => a.id));

    poll = await db.weeklyAnimePoll.create({
      data: {
        weekKey,
        startsAt: monday,
        endsAt: nextMonday,
        status: "active",
        candidates: {
          create: candidateIds.map((animeId) => ({
            animeId,
            votesCount: 0,
          })),
        },
      },
      include: {
        candidates: {
          include: {
            anime: {
              select: {
                id: true,
                title: true,
                coverImage: true,
                rating: true,
                price: true,
                creator: {
                  select: { username: true, displayName: true },
                },
              },
            },
          },
        },
      },
    });
  }

  return poll;
}

export async function voteInWeeklyPoll(userId: string, animeId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const poll = await getOrCreateCurrentWeeklyPoll();

  if (poll.status !== "active" || poll.endsAt < new Date()) {
    return { success: false, message: "Ovoz berish muddati tugagan" };
  }

  // User talabi: kamida Level 3 yoki 1 ta anime egasi
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      xpEvents: { select: { amount: true } },
      purchases: { select: { id: true }, take: 1 },
    },
  });

  if (!user) {
    return { success: false, message: "Foydalanuvchi topilmadi" };
  }

  const totalXp = user.xpEvents.reduce((s, e) => s + e.amount, 0);
  const { levelFromXp } = await import("./xp");
  const { level } = levelFromXp(totalXp);
  const ownsAnime = user.purchases.length > 0;

  if (level < 3 && !ownsAnime) {
    return { success: false, message: "Ovoz berish uchun kamida 3-daraja yoki 1 ta anime egasi bo'lish kerak" };
  }

  // Allaqachon ovoz berganmi?
  const existingVote = await db.weeklyAnimeVote.findUnique({
    where: { pollId_userId: { pollId: poll.id, userId } },
  });

  if (existingVote) {
    return { success: false, message: "Siz bu hafta allaqachon ovoz bergansiz!" };
  }

  // Nomzod mavjudmi?
  const candidate = poll.candidates.find((c) => c.animeId === animeId);
  if (!candidate) {
    return { success: false, message: "Ushbu anime nomzodlar orasida yo'q" };
  }

  await db.$transaction(async (tx) => {
    await tx.weeklyAnimeVote.create({
      data: {
        pollId: poll.id,
        animeId,
        userId,
      },
    });

    await tx.weeklyAnimeCandidate.update({
      where: { id: candidate.id },
      data: { votesCount: { increment: 1 } },
    });
  });

  return { success: true, message: "Ovozingiz muvaffaqiyatli qabul qilindi!" };
}

export async function resolveWeeklyPoll(weekKey: string) {
  const poll = await db.weeklyAnimePoll.findUnique({
    where: { weekKey },
    include: {
      candidates: {
        orderBy: { votesCount: "desc" },
      },
      votes: true,
    },
  });

  if (!poll || poll.status === "closed") return;

  const winner = poll.candidates[0];
  const winnerAnimeId = winner?.animeId || null;

  await db.$transaction(async (tx) => {
    await tx.weeklyAnimePoll.update({
      where: { id: poll.id },
      data: {
        status: "closed",
        winnerAnimeId,
      },
    });

    if (winnerAnimeId) {
      // G'olibga ovoz berganlarga +30 XP ("Called it" mukofoti)
      const correctVoters = poll.votes.filter((v) => v.animeId === winnerAnimeId);
      for (const voter of correctVoters) {
        await tx.xpEvent.create({
          data: {
            userId: voter.userId,
            reason: "weekly_poll_winner",
            amount: 30,
            refType: "poll_reward",
            refId: poll.id,
          },
        });
        await tx.weeklyAnimeVote.update({
          where: { id: voter.id },
          data: { rewardClaimed: true },
        });
      }
    }
  });

  return { winnerAnimeId };
}
