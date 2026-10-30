import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { slugify } from "@/lib/sanitize";
import { isAdminUser } from "@/lib/config";
import { DUB_LANGUAGES, DUB_ROLES, type DubRole } from "@/lib/dub-team-shared";

type Db = PrismaClient | Prisma.TransactionClient;

export interface DubCastInput {
  name?: string;
  character: string;
  memberId?: string | null;
}

interface DubTeamError extends Error {
  code: string;
}

function fail(code: string, message: string): DubTeamError {
  return Object.assign(new Error(message), { code }) as DubTeamError;
}

export function dubErrorInfo(error: unknown): { status: number; message: string; code?: string } {
  const code = error instanceof Error ? (error as DubTeamError).code : undefined;
  const message = error instanceof Error ? error.message : "Xatolik yuz berdi";
  if (code === "UNAUTHORIZED") return { status: 401, message, code };
  if (code === "FORBIDDEN") return { status: 403, message, code };
  if (code === "NOT_FOUND") return { status: 404, message, code };
  if (code?.startsWith("INVALID")) return { status: 400, message, code };
  if (code?.startsWith("DUPLICATE")) return { status: 409, message, code };
  return { status: 500, message, code };
}

export async function assertTeamManager(
  teamId: string,
  user: { id: string; role: string; telegramId?: string | null } | null
) {
  if (!user) throw fail("UNAUTHORIZED", "Avval tizimga kiring");
  const team = await db.dubTeam.findUnique({ where: { id: teamId }, select: { id: true, ownerId: true, status: true } });
  if (!team) throw fail("NOT_FOUND", "Jamoa topilmadi");
  if (team.ownerId !== user.id && !isAdminUser(user)) {
    throw fail("FORBIDDEN", "Bu jamoa sizga tegishli emas");
  }
  return team;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isDubRole(value: unknown): value is DubRole {
  return typeof value === "string" && (DUB_ROLES as readonly string[]).includes(value);
}

export { dubTeamTitle } from "@/lib/dub-team-shared";

export async function createDubTeam(opts: {
  ownerId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
}) {
  const name = cleanText(opts.name, 60);
  if (name.length < 2) throw fail("INVALID_NAME", "Jamoa nomi kamida 2 belgidan iborat bo‘lsin");

  const base = slugify(name) || `jamoa-${Date.now().toString(36)}`;
  let slug = base;
  for (let i = 2; await db.dubTeam.findUnique({ where: { slug }, select: { id: true } }); i += 1) {
    slug = `${base}-${i}`;
  }

  const avatarUrl = cleanText(opts.avatarUrl, 500);
  return db.dubTeam.create({
    data: {
      name,
      slug,
      description: cleanText(opts.description, 500) || null,
      avatarUrl: avatarUrl && (avatarUrl.startsWith("/uploads/") || /^https?:\/\//.test(avatarUrl)) ? avatarUrl : null,
      ownerId: opts.ownerId,
    },
  });
}

export async function updateDubTeam(
  teamId: string,
  data: { name?: unknown; description?: unknown; avatarUrl?: unknown; verified?: unknown; status?: unknown }
) {
  const update: Prisma.DubTeamUpdateInput = {};
  if (data.name !== undefined) {
    const name = cleanText(data.name, 60);
    if (name.length < 2) throw fail("INVALID_NAME", "Jamoa nomi kamida 2 belgidan iborat bo‘lsin");
    update.name = name;
  }
  if (data.description !== undefined) update.description = cleanText(data.description, 500) || null;
  if (data.avatarUrl !== undefined) {
    const avatarUrl = cleanText(data.avatarUrl, 500);
    update.avatarUrl = avatarUrl && (avatarUrl.startsWith("/uploads/") || /^https?:\/\//.test(avatarUrl)) ? avatarUrl : null;
  }
  if (typeof data.verified === "boolean") update.verified = data.verified;
  if (data.status === "active" || data.status === "archived") update.status = data.status;
  return db.dubTeam.update({ where: { id: teamId }, data: update });
}

export async function addDubTeamMember(
  teamId: string,
  opts: { name: string; role?: unknown; userId?: string | null }
) {
  const name = cleanText(opts.name, 60);
  if (name.length < 2) throw fail("INVALID_NAME", "A’zo nomi kamida 2 belgidan iborat bo‘lsin");
  const role: DubRole = isDubRole(opts.role) ? opts.role : "voice";
  try {
    const member = await db.dubTeamMember.create({
      data: { teamId, name, role, userId: opts.userId || null },
    });
    await recomputeTeamReputation(teamId);
    return member;
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      throw fail("DUPLICATE_MEMBER", "Bu nomdagi a’zo allaqachon jamoada");
    }
    throw error;
  }
}

export async function removeDubTeamMember(teamId: string, memberId: string) {
  const member = await db.dubTeamMember.findFirst({ where: { id: memberId, teamId }, select: { id: true } });
  if (!member) throw fail("NOT_FOUND", "A’zo topilmadi");
  await db.dubTeamMember.delete({ where: { id: memberId } });
  await recomputeTeamReputation(teamId);
}

export async function addDubCredit(opts: {
  teamId: string;
  animeId: string;
  versionId?: string | null;
  language?: unknown;
  cast: DubCastInput[];
}) {
  const team = await db.dubTeam.findUnique({ where: { id: opts.teamId }, select: { id: true, status: true } });
  if (!team || team.status !== "active") throw fail("NOT_FOUND", "Jamoa topilmadi");
  const anime = await db.anime.findFirst({
    where: { id: opts.animeId, hidden: false, moderationStatus: "APPROVED" },
    select: { id: true },
  });
  if (!anime) throw fail("NOT_FOUND", "Anime topilmadi");

  const language = typeof opts.language === "string" && (DUB_LANGUAGES as readonly string[]).includes(opts.language)
    ? opts.language
    : "uz";

  const cast = Array.isArray(opts.cast) ? opts.cast.slice(0, 60) : [];
  if (cast.length === 0) throw fail("INVALID_CAST", "Kamida bitta speaker qo‘shing");
  const members = await db.dubTeamMember.findMany({ where: { teamId: opts.teamId }, select: { id: true, name: true } });
  const memberById = new Map(members.map((member) => [member.id, member]));

  const rows = cast.map((entry) => {
    const character = cleanText(entry.character, 60);
    const member = entry.memberId ? memberById.get(entry.memberId) : undefined;
    const name = cleanText(entry.name, 60) || member?.name || "";
    if (!name || !character) throw fail("INVALID_CAST", "Speaker va personaj nomini to‘ldiring");
    return { memberId: member?.id ?? null, speakerName: name, character };
  });
  const speakerCount = new Set(rows.map((row) => row.speakerName.toLowerCase())).size;

  const existing = await db.dubCredit.findFirst({
    where: { teamId: opts.teamId, animeId: opts.animeId, language },
    select: { id: true },
  });
  if (existing) throw fail("DUPLICATE_CREDIT", "Bu anime uchun shu tilda dub allaqachon biriktirilgan");

  const credit = await db.$transaction(async (tx) => {
    const created = await tx.dubCredit.create({
      data: {
        teamId: opts.teamId,
        animeId: opts.animeId,
        versionId: opts.versionId || null,
        language,
        speakerCount,
        cast: { create: rows },
      },
      include: { cast: true },
    });
    return created;
  });
  await recomputeTeamReputation(opts.teamId);
  return credit;
}

export async function removeDubCredit(teamId: string, creditId: string) {
  const credit = await db.dubCredit.findFirst({ where: { id: creditId, teamId }, select: { id: true } });
  if (!credit) throw fail("NOT_FOUND", "Dub topilmadi");
  await db.dubCredit.delete({ where: { id: creditId } });
  await recomputeTeamReputation(teamId);
}

/**
 * Reputation = baholash sifati + faollik. Baho bo‘lmasa faqat faollik (max 30),
 * baho paydo bo‘lgach sifat ustunlik qiladi (80%) va faollik bonus bo‘ladi.
 */
export async function recomputeTeamReputation(teamId: string, client: Db = db): Promise<number> {
  const [team, ratingAgg, dubCount, memberCount] = await Promise.all([
    client.dubTeam.findUnique({ where: { id: teamId }, select: { verified: true } }),
    client.dubTeamRating.aggregate({
      where: { teamId },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    client.dubCredit.count({ where: { teamId } }),
    client.dubTeamMember.count({ where: { teamId } }),
  ]);
  const activity = Math.min(20, dubCount * 4 + memberCount) + (team?.verified ? 10 : 0);
  const quality = ratingAgg._avg.rating ? (ratingAgg._avg.rating / 10) * 100 : 0;
  const reputation = ratingAgg._count._all > 0
    ? Math.min(100, Math.round(quality * 0.8 + activity))
    : Math.min(30, activity);

  await client.dubTeam.update({ where: { id: teamId }, data: { reputation } });
  return reputation;
}

export async function rateDubCredit(opts: { creditId: string; userId: string; rating: number }) {
  if (!Number.isInteger(opts.rating) || opts.rating < 1 || opts.rating > 10) {
    throw fail("INVALID_RATING", "Baho 1 dan 10 gacha butun son bo‘lsin");
  }
  const credit = await db.dubCredit.findUnique({ where: { id: opts.creditId }, select: { id: true, teamId: true } });
  if (!credit) throw fail("NOT_FOUND", "Dub topilmadi");

  await db.dubTeamRating.upsert({
    where: { userId_creditId: { userId: opts.userId, creditId: opts.creditId } },
    create: { userId: opts.userId, creditId: opts.creditId, teamId: credit.teamId, rating: opts.rating },
    update: { rating: opts.rating },
  });
  const reputation = await recomputeTeamReputation(credit.teamId);
  return { reputation };
}

export async function listDubTeams(opts: { ownerId?: string; take?: number } = {}) {
  return db.dubTeam.findMany({
    where: opts.ownerId ? { ownerId: opts.ownerId } : { status: "active" },
    orderBy: [{ reputation: "desc" }, { createdAt: "asc" }],
    take: Math.min(opts.take ?? 20, 50),
    include: {
      _count: { select: { members: true, credits: true } },
      credits: { select: { animeId: true } },
    },
  });
}

export async function animeDubSignals(animeIds: string[]): Promise<Map<string, { speakerCount: number; teamReputation: number }>> {
  const signals = new Map<string, { speakerCount: number; teamReputation: number }>();
  if (animeIds.length === 0) return signals;
  try {
    const credits = await db.dubCredit.findMany({
      where: { animeId: { in: animeIds } },
      select: { animeId: true, speakerCount: true, team: { select: { reputation: true } } },
    });
    for (const credit of credits) {
      const current = signals.get(credit.animeId) ?? { speakerCount: 0, teamReputation: 0 };
      signals.set(credit.animeId, {
        speakerCount: Math.max(current.speakerCount, credit.speakerCount),
        teamReputation: Math.max(current.teamReputation, credit.team.reputation),
      });
    }
  } catch {
    // Dub jadvali hali migratsiya qilinmagan bo‘lsa, sahifalar ishlashda davom etadi.
  }
  return signals;
}

export async function dubCreditsForAnime(animeId: string, viewerId?: string | null) {
  const credits = await db.dubCredit.findMany({
    where: { animeId },
    orderBy: [{ speakerCount: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      language: true,
      speakerCount: true,
      createdAt: true,
      team: { select: { id: true, name: true, slug: true, avatarUrl: true, reputation: true, verified: true } },
      cast: { orderBy: { createdAt: "asc" }, select: { id: true, speakerName: true, character: true } },
    },
  });
  if (credits.length === 0) return [];

  const ids = credits.map((credit) => credit.id);
  const [aggregates, mine] = await Promise.all([
    db.dubTeamRating.groupBy({
      by: ["creditId"],
      where: { creditId: { in: ids } },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    viewerId
      ? db.dubTeamRating.findMany({
          where: { userId: viewerId, creditId: { in: ids } },
          select: { creditId: true, rating: true },
        })
      : Promise.resolve([] as { creditId: string; rating: number }[]),
  ]);
  const stats = new Map(aggregates.map((row) => [row.creditId, row]));
  const myVotes = new Map(mine.map((row) => [row.creditId, row.rating]));

  return credits.map((credit) => ({
    ...credit,
    rating: stats.get(credit.id)?._avg.rating
      ? Number(stats.get(credit.id)!._avg.rating!.toFixed(2))
      : null,
    ratingCount: stats.get(credit.id)?._count._all ?? 0,
    myRating: myVotes.get(credit.id) ?? null,
  }));
}
