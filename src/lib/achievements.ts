import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ACHIEVEMENT_SEEDS } from "./achievements-catalog";
import { sqlTable } from "./sql-table";
import { awardXpInTransaction } from "./xp";

type Condition = {
  type?: string;
  gte?: number;
  month?: number;
  day?: number;
  limit?: number;
  before?: string;
  start?: string;
  end?: string;
};
type Reward = { cosmetics?: string[]; credits?: number };
type UserStats = {
  values: Record<string, number>;
  userCreatedAt: Date;
  timezone: string | null;
  username: string;
  credits: number;
  gifts: { recipientId: string | null; recipientUsername: string; createdAt: Date }[];
  activityDates: Date[];
  completedSets: { id: string; name: string; bonusCredits: number }[];
};

let seedPromise: Promise<void> | null = null;

export async function ensureAchievementsSeeded() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const rows = ACHIEVEMENT_SEEDS.map((achievement, sortOrder) => Prisma.sql`(
        ${achievement.id},
        ${achievement.emoji},
        ${achievement.name},
        ${achievement.description},
        ${achievement.rarity},
        ${achievement.category},
        ${JSON.stringify(achievement.condition)},
        ${JSON.stringify(achievement.reward || {})},
        ${Boolean(achievement.secret)},
        ${Boolean(achievement.seasonal)},
        ${sortOrder}
      )`);
      await db.$executeRaw(Prisma.sql`
        INSERT INTO ${sqlTable("Achievement")} (
          "id", "emoji", "name", "description", "rarity", "category",
          "conditionJson", "rewardJson", "secret", "seasonal", "sortOrder"
        )
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("id") DO UPDATE SET
          "emoji" = excluded."emoji",
          "name" = excluded."name",
          "description" = excluded."description",
          "rarity" = excluded."rarity",
          "category" = excluded."category",
          "conditionJson" = excluded."conditionJson",
          "rewardJson" = excluded."rewardJson",
          "secret" = excluded."secret",
          "seasonal" = excluded."seasonal",
          "sortOrder" = excluded."sortOrder"
      `);
      await db.achievement.updateMany({
        where: { id: { in: ["exchange", "exchange_master", "exchange-master"] } },
        data: { active: false },
      });
    })().catch((error: unknown) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
}

function datePart(date: Date, timezone: string | null, part: "month" | "day" | "hour") {
  const safeTimezone = timezone && isValidTimezone(timezone) ? timezone : "UTC";
  return Number(new Intl.DateTimeFormat("en", {
    timeZone: safeTimezone,
    ...(part === "month" ? { month: "numeric" as const } : {}),
    ...(part === "day" ? { day: "numeric" as const } : {}),
    ...(part === "hour" ? { hour: "numeric" as const, hourCycle: "h23" as const } : {}),
  }).format(date));
}

function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function maxWatchStreak(dates: Date[], timezone: string | null): number {
  const safeTimezone = timezone && isValidTimezone(timezone) ? timezone : "UTC";
  const days = [...new Set(dates.map((date) => {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: safeTimezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  }))].sort();
  let best = 0;
  let streak = 0;
  let previous = 0;
  for (const day of days) {
    const current = Date.parse(`${day}T00:00:00Z`);
    streak = previous && current - previous === 86_400_000 ? streak + 1 : 1;
    best = Math.max(best, streak);
    previous = current;
  }
  return best;
}

async function getUserStats(userId: string): Promise<UserStats | null> {
  const [user, purchases, orders, gifts, followerCount, posts, comments, awardsGiven,
    watchEvents, completedProgress, partiesHosted, partyMembers, partiesJoined, approvedAnimeCount,
    creatorSales, creatorEarnings, dubVersions, spentResult, activityEvents, sets,
    favoriteCount] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true, timezone: true, credits: true, username: true } }),
    db.purchase.findMany({
      where: { userId, episodeNumber: 0 },
      select: {
        id: true, animeId: true, createdAt: true, pricePaid: true,
        anime: { select: { id: true, genres: true, createdAt: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.order.findMany({
      where: { site_user_id: userId, status: { in: ["COMPLETED", "PAID_PENDING_GRANT"] } },
      select: { anime_slug: true },
    }),
    db.gift.findMany({
      where: { senderId: userId, status: { in: ["PENDING", "CLAIMED"] } },
      select: { recipientId: true, recipientUsername: true, createdAt: true },
    }),
    db.follow.count({ where: { followedId: userId } }),
    db.post.findMany({
      where: { userId, hidden: false },
      select: { _count: { select: { likes: true } } },
    }),
    db.comment.count({ where: { userId } }),
    db.postAward.count({ where: { userId } }),
    db.watchEvent.findMany({
      where: { userId },
      select: { seconds: true, episodeId: true, animeId: true, createdAt: true },
    }),
    db.watchProgress.findMany({
      where: { userId, completed: true },
      select: { animeId: true, episodeId: true },
    }),
    db.watchParty.count({ where: { createdById: userId } }),
    db.watchPartyMember.count({ where: { party: { hostId: userId } } }),
    db.watchPartyMember.count({ where: { userId } }),
    db.anime.count({ where: { creatorId: userId, moderationStatus: "APPROVED", hidden: false } }),
    db.purchase.count({ where: { episodeNumber: 0, anime: { creatorId: userId } } }),
    db.creditTransaction.aggregate({
      where: { userId, amount: { gt: 0 }, refType: "version" },
      _sum: { amount: true },
    }),
    db.animeVersion.count({ where: { creatorId: userId, kind: "creator", status: "published" } }),
    db.creditTransaction.aggregate({ where: { userId, amount: { lt: 0 } }, _sum: { amount: true } }),
    db.xpEvent.findMany({
      where: { userId, reason: { not: "legacy_migration" } },
      select: { createdAt: true },
    }),
    db.animeSet.findMany({ include: { items: { select: { animeId: true } } } }),
    db.favoriteAnime.count({ where: { userId } }),
  ]);
  if (!user) return null;

  const orderedAnime = orders.length
    ? await db.anime.findMany({
        where: { slug: { in: orders.map((order) => order.anime_slug) } },
        select: { id: true, genres: true },
      })
    : [];
  const ownedGenres = new Map<string, string>();
  for (const purchase of purchases) ownedGenres.set(purchase.animeId, purchase.anime.genres);
  for (const anime of orderedAnime) ownedGenres.set(anime.id, anime.genres);
  const ownedIds = [...ownedGenres.keys()];
  const allAnime = await db.anime.findMany({
    where: { hidden: false, moderationStatus: "APPROVED" },
    select: { genres: true },
  });
  const genreUniverse = [...new Set(allAnime.flatMap((anime) => anime.genres.split(",").map((genre) => genre.trim()).filter(Boolean)))];
  const genreCounts = new Map<string, number>();
  for (const genreList of ownedGenres.values()) {
    for (const genre of genreList.split(",").map((item) => item.trim()).filter(Boolean)) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
  }

  const [episodeCounts, buyerRows] = await Promise.all([
    db.episode.groupBy({
      by: ["animeId"],
      where: { animeId: { in: [...new Set(completedProgress.map((row) => row.animeId))] } },
      _count: { _all: true },
    }),
    db.purchase.findMany({
      where: { episodeNumber: 0, animeId: { in: ownedIds }, pricePaid: { gt: 0 } },
      select: { id: true, animeId: true, pricePaid: true },
      orderBy: [{ animeId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
  ]);
  const completedByAnime = new Map<string, number>();
  for (const row of completedProgress) completedByAnime.set(row.animeId, (completedByAnime.get(row.animeId) || 0) + 1);
  const fullyCompleted = episodeCounts.filter((row) =>
    row._count._all > 0 && (completedByAnime.get(row.animeId) || 0) >= row._count._all
  ).length;
  const buyerRank = new Map<string, number>();
  let previousAnime = "";
  let rank = 0;
  for (const buyer of buyerRows) {
    rank = buyer.animeId === previousAnime ? rank + 1 : 1;
    previousAnime = buyer.animeId;
    buyerRank.set(buyer.id, rank);
  }
  const ownPurchaseIds = new Set(purchases.map((purchase) => purchase.id));
  const firstDayBuyer = purchases.some((purchase) =>
    purchase.pricePaid > 0 &&
    purchase.createdAt >= purchase.anime.createdAt &&
    purchase.createdAt.getTime() - purchase.anime.createdAt.getTime() <= 86_400_000
  );
  const foundingFan = purchases.some((purchase) =>
    purchase.pricePaid > 0 && ownPurchaseIds.has(purchase.id) && (buyerRank.get(purchase.id) || Infinity) <= 100
  );
  const watchSeconds = watchEvents.reduce((sum, event) => sum + event.seconds, 0);
  const recentEpisodes = new Set(watchEvents
    .filter((event) => Date.now() - event.createdAt.getTime() <= 86_400_000)
    .map((event) => event.episodeId));
  const seasonWindowActivity = activityEvents.map((event) => event.createdAt);
  const spent = Math.abs(spentResult._sum.amount || 0);
  const uniqueRecipients = new Set(gifts.map((gift) => gift.recipientId || gift.recipientUsername.toLowerCase()));

  return {
    userCreatedAt: user.createdAt,
    timezone: user.timezone,
    username: user.username,
    credits: user.credits,
    gifts,
    activityDates: seasonWindowActivity,
    completedSets: sets
      .filter((set) => set.items.length > 0 && set.items.every((item) => ownedGenres.has(item.animeId)))
      .map((set) => ({ id: set.id, name: set.name, bonusCredits: set.bonusCredits })),
    values: {
      purchases: ownedIds.length,
      gifts_sent: gifts.length,
      gift_unique_recipients: uniqueRecipients.size,
      followers: followerCount,
      post_likes: posts.reduce((max, post) => Math.max(max, post._count.likes), 0),
      post_count: posts.length,
      comments,
      awards_given: awardsGiven,
      approved_animes: approvedAnimeCount,
      spent,
      watch_hours: Math.floor(watchSeconds / 3600),
      eps_in_24h: recentEpisodes.size,
      night_owl: Number(watchEvents.some((event) => {
        const hour = datePart(event.createdAt, user.timezone, "hour");
        return hour >= 2 && hour < 5;
      })),
      streak: maxWatchStreak(watchEvents.map((event) => event.createdAt), user.timezone),
      completed_series: fullyCompleted,
      parties_hosted: partiesHosted,
      party_guests: partyMembers,
      parties_joined: partiesJoined,
      creator_sales: creatorSales,
      creator_earnings: creatorEarnings._sum.amount || 0,
      dub_versions: dubVersions,
      favorites: favoriteCount,
      all_genres: Number(genreUniverse.length > 0 && genreUniverse.every((genre) => (genreCounts.get(genre) || 0) > 0)),
      genre_count: Math.max(0, ...genreCounts.values()),
      set_complete: Number(sets.some((set) => set.items.length > 0 && set.items.every((item) => ownedGenres.has(item.animeId)))),
      day_one: Number(firstDayBuyer),
      founding_fan: Number(foundingFan),
      username_palindrome: Number(user.username.length >= 3 && user.username.toLowerCase() === [...user.username.toLowerCase()].reverse().join("")),
      zero_credits_after_spend: Number(user.credits === 0 && spent > 0),
    },
  };
}

function progressFor(condition: Condition, stats: UserStats): { current: number; target: number; unlocked: boolean } {
  const target = condition.gte ?? 1;
  let current = stats.values[condition.type || ""] || 0;
  if (condition.type === "joined_before") {
    current = Number(stats.userCreatedAt < new Date(condition.before || "1970-01-01"));
  } else if (condition.type === "season_window") {
    const start = condition.start ? Date.parse(`${condition.start}T00:00:00Z`) : 0;
    const end = condition.end ? Date.parse(`${condition.end}T23:59:59.999Z`) : 0;
    current = Number(stats.activityDates.some((date) => date.getTime() >= start && date.getTime() <= end));
  } else if (condition.type === "gift_date" || condition.type === "gift_month") {
    current = stats.gifts.filter((gift) =>
      (condition.month === undefined || datePart(gift.createdAt, stats.timezone, "month") === condition.month) &&
      (condition.day === undefined || datePart(gift.createdAt, stats.timezone, "day") === condition.day)
    ).length;
  }
  if (condition.type === "founding_fan") current = Number(current > 0);
  return { current, target, unlocked: current >= target };
}

function parseReward(value: string): Reward {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Reward;
  } catch {
    return {};
  }
  return {};
}

async function applyReward(tx: Prisma.TransactionClient, userId: string, achievementId: string, reward: Reward) {
  const cosmetics = Array.isArray(reward.cosmetics)
    ? reward.cosmetics.filter((item): item is string => typeof item === "string")
    : [];
  const credits = Number.isInteger(reward.credits) ? Math.max(0, reward.credits || 0) : 0;
  if (cosmetics.length) {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { showcase: true } });
    let showcase: Record<string, unknown> = {};
    try {
      const parsed: unknown = user.showcase ? JSON.parse(user.showcase) : {};
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) showcase = parsed as Record<string, unknown>;
    } catch {
      showcase = {};
    }
    const unlocked = new Set(
      Array.isArray(showcase.unlocked)
        ? showcase.unlocked.filter((item): item is string => typeof item === "string")
        : [],
    );
    cosmetics.forEach((item) => unlocked.add(item));
    await tx.user.update({
      where: { id: userId },
      data: { showcase: JSON.stringify({ ...showcase, unlocked: [...unlocked] }) },
    });
  }
  if (credits > 0) {
    await tx.user.update({ where: { id: userId }, data: { credits: { increment: credits } } });
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: credits,
        type: "BONUS",
        description: `Achievement reward: ${achievementId}`,
        refType: "achievement",
        refId: achievementId,
        idempotencyKey: `achievement-reward:${userId}:${achievementId}`,
      },
    });
  }
}

export async function evaluateAchievements(userId: string) {
  await ensureAchievementsSeeded();
  const [catalog, stats] = await Promise.all([
    db.achievement.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    getUserStats(userId),
  ]);
  if (!stats) return [];
  const unlockedIds: string[] = [];
  await db.$transaction(async (tx) => {
    for (const set of stats.completedSets) {
      if (set.bonusCredits <= 0) continue;
      const idempotencyKey = `anime-set-bonus:${userId}:${set.id}`;
      const previous = await tx.creditTransaction.findUnique({ where: { idempotencyKey } });
      if (previous) continue;
      await tx.user.update({ where: { id: userId }, data: { credits: { increment: set.bonusCredits } } });
      await tx.creditTransaction.create({
        data: {
          userId,
          amount: set.bonusCredits,
          type: "BONUS",
          description: `Completed anime set: ${set.name}`,
          refType: "anime_set",
          refId: set.id,
          idempotencyKey,
        },
      });
      await awardXpInTransaction(tx, userId, "achievement", `anime-set:${set.id}`);
      await tx.notification.create({
        data: {
          userId,
          type: "ACHIEVEMENT",
          title: "Collection set complete",
          body: `You completed ${set.name} and earned ${set.bonusCredits} credits`,
          dataJson: JSON.stringify({ setId: set.id }),
        },
      });
    }
    for (const achievement of catalog) {
      const condition = JSON.parse(achievement.conditionJson || "{}") as Condition;
      const progress = progressFor(condition, stats);
      const existing = await tx.userAchievement.findUnique({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
      });
      const wasUnlocked = Boolean(existing?.unlockedAt);
      await tx.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: achievement.id } },
        create: {
          userId,
          achievementId: achievement.id,
          progress: progress.current,
          target: progress.target,
          unlockedAt: progress.unlocked ? new Date() : null,
        },
        update: {
          progress: progress.current,
          target: progress.target,
          unlockedAt: wasUnlocked ? existing!.unlockedAt : progress.unlocked ? new Date() : null,
        },
      });
      if (progress.unlocked && !wasUnlocked) {
        await applyReward(tx, userId, achievement.id, parseReward(achievement.rewardJson));
        await awardXpInTransaction(tx, userId, "achievement", achievement.id);
        await tx.notification.create({
          data: {
            userId,
            type: "ACHIEVEMENT",
            title: "Achievement unlocked",
            body: `You unlocked ${achievement.name}`,
            dataJson: JSON.stringify({ achievementId: achievement.id }),
          },
        });
      }
      if (progress.unlocked) unlockedIds.push(achievement.id);
    }
  });
  return unlockedIds;
}

export async function getUserAchievementStates(userId: string) {
  await ensureAchievementsSeeded();
  const [catalog, userRows] = await Promise.all([
    db.achievement.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.userAchievement.findMany({ where: { userId } }),
  ]);
  const byId = new Map(userRows.map((row) => [row.achievementId, row]));
  return catalog.map((achievement) => {
    const state = byId.get(achievement.id);
    const earned = Boolean(state?.unlockedAt);
    const secretLocked = achievement.secret && !earned;
    return {
      id: achievement.id,
      emoji: secretLocked ? "🔒" : achievement.emoji,
      name: secretLocked ? "Secret achievement" : achievement.name,
      desc: secretLocked ? "Unlock this achievement to reveal its details." : achievement.description,
      rarity: achievement.rarity,
      current: secretLocked ? 0 : state?.progress ?? 0,
      target: secretLocked ? 1 : state?.target ?? 1,
      earned,
      secret: achievement.secret,
      unlockedAt: state?.unlockedAt?.toISOString() ?? null,
    };
  });
}
