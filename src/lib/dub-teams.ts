import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { slugify } from "@/lib/sanitize";
import { isAdminUser } from "@/lib/config";
import { notifyTelegramUser } from "@/lib/chat";
import { DUB_LANGUAGES, DUB_ROLES, type DubRole } from "@/lib/dub-team-shared";

type Db = PrismaClient | Prisma.TransactionClient;

/** Anime chiqarish va dub e'loni uchun jamoada kamida shuncha tizim a'zosi bo'lishi kerak. */
export const MIN_TEAM_MEMBERS = 3;

const CLUB_TAG_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomClubTag(): string {
  let tag = "D";
  for (let i = 0; i < 3; i += 1) {
    tag += CLUB_TAG_CHARS[Math.floor(Math.random() * CLUB_TAG_CHARS.length)];
  }
  return tag;
}

/** Dub jamoasi uchun Community → Clubs ichida yopiq klub va chat xonasi yaratadi. */
async function createTeamClub(
  team: { id: string; name: string; description: string | null; avatarUrl: string | null; ownerId: string | null },
  client: Db
) {
  if (!team.ownerId) return null;
  let tag = randomClubTag();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const taken = await client.club.findUnique({ where: { tag }, select: { id: true } });
    if (!taken) break;
    tag = randomClubTag();
  }
  const stillTaken = await client.club.findUnique({ where: { tag }, select: { id: true } });
  if (stillTaken) return null;

  const club = await client.club.create({
    data: {
      name: team.name.slice(0, 40),
      tag,
      description: team.description?.slice(0, 500) ?? null,
      avatarUrl: team.avatarUrl,
      isPublic: false,
      ownerId: team.ownerId,
    },
  });
  await client.clubMember.create({ data: { clubId: club.id, userId: team.ownerId, role: "owner" } });
  await client.chatRoom.create({ data: { type: "club", refId: club.id, clubId: club.id } });
  await client.dubTeam.update({ where: { id: team.id }, data: { clubId: club.id } });
  return club;
}

/** Eski jamoalar uchun klubni kechiktirib yaratadi. */
export async function ensureTeamClub(teamId: string): Promise<string | null> {
  const team = await db.dubTeam.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, description: true, avatarUrl: true, ownerId: true, clubId: true },
  });
  if (!team) return null;
  if (team.clubId) return team.clubId;
  const club = await createTeamClub(team, db);
  return club?.id ?? null;
}

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
  const safeAvatar = avatarUrl && (avatarUrl.startsWith("/uploads/") || /^https?:\/\//.test(avatarUrl)) ? avatarUrl : null;
  const description = cleanText(opts.description, 500) || null;

  return db.$transaction(async (tx) => {
    const team = await tx.dubTeam.create({
      data: {
        name,
        slug,
        description,
        avatarUrl: safeAvatar,
        ownerId: opts.ownerId,
      },
    });
    await createTeamClub({ ...team, description, avatarUrl: safeAvatar }, tx);
    return team;
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
    if (opts.userId) {
      const team = await db.dubTeam.findUnique({ where: { id: teamId }, select: { clubId: true, ownerId: true } });
      if (team?.clubId && team.ownerId !== opts.userId) {
        await db.clubMember.upsert({
          where: { clubId_userId: { clubId: team.clubId, userId: opts.userId } },
          create: { clubId: team.clubId, userId: opts.userId, role: "member" },
          update: {},
        });
      }
    }
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
  const member = await db.dubTeamMember.findFirst({
    where: { id: memberId, teamId },
    select: { id: true, userId: true, team: { select: { clubId: true, ownerId: true } } },
  });
  if (!member) throw fail("NOT_FOUND", "A’zo topilmadi");
  await db.dubTeamMember.delete({ where: { id: memberId } });
  if (member.userId && member.team.clubId && member.userId !== member.team.ownerId) {
    const membership = await db.clubMember.findUnique({
      where: { clubId_userId: { clubId: member.team.clubId, userId: member.userId } },
      select: { role: true },
    });
    if (membership && membership.role !== "owner") {
      await db.clubMember.delete({
        where: { clubId_userId: { clubId: member.team.clubId, userId: member.userId } },
      });
    }
  }
  await recomputeTeamReputation(teamId);
}

/**
 * Jamoa egasi Kiluu foydalanuvchisini speaker sifatida taklif qiladi.
 * Foydalanuvchi qabul qilgach a'zo va yopiq klub chatiga qo'shiladi.
 */
export async function inviteDubTeamMember(teamId: string, inviterId: string, userId: string) {
  if (!userId || userId === inviterId) throw fail("INVALID_INVITE", "O‘zingizni taklif qila olmaysiz");
  const team = await db.dubTeam.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, status: true },
  });
  if (!team || team.status !== "active") throw fail("NOT_FOUND", "Jamoa topilmadi");

  const already = await db.dubTeamMember.findFirst({ where: { teamId, userId }, select: { id: true } });
  if (already) throw fail("DUPLICATE_MEMBER", "Bu foydalanuvchi allaqachon jamoada");

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true },
  });
  if (!target) throw fail("NOT_FOUND", "Foydalanuvchi topilmadi");

  const invite = await db.dubTeamInvite.upsert({
    where: { teamId_userId: { teamId, userId } },
    create: { teamId, userId, invitedById: inviterId },
    update: { status: "pending", invitedById: inviterId, respondedAt: null, createdAt: new Date() },
    select: { id: true, status: true, createdAt: true },
  });

  void ensureTeamClub(teamId).catch(() => null);
  void notifyTelegramUser(
    target.id,
    team.name,
    `Sizni <b>${team.name}</b> dub jamoasiga speaker sifatida taklif qilishdi. ` +
      `Kiluu → Creator Studio → Dub jamoasi bo‘limida qabul qilishingiz mumkin.`
  ).catch(() => null);

  return { invite, user: target };
}

export async function listDubTeamInvites(userId: string) {
  const invites = await db.dubTeamInvite.findMany({
    where: { userId, status: "pending", team: { status: "active" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      invitedBy: { select: { username: true, displayName: true, avatarUrl: true } },
      team: { select: { id: true, name: true, slug: true, avatarUrl: true, reputation: true, verified: true } },
    },
  });
  return invites;
}

export async function respondDubTeamInvite(inviteId: string, userId: string, accept: boolean) {
  const invite = await db.dubTeamInvite.findFirst({
    where: { id: inviteId, userId, status: "pending" },
    select: {
      id: true,
      teamId: true,
      team: { select: { id: true, name: true, status: true, ownerId: true } },
    },
  });
  if (!invite) throw fail("NOT_FOUND", "Taklif topilmadi yoki allaqachon javob berilgan");
  if (!accept) {
    await db.dubTeamInvite.update({ where: { id: invite.id }, data: { status: "declined", respondedAt: new Date() } });
    return { teamId: invite.teamId, clubId: null, accepted: false };
  }
  if (invite.team.status !== "active") throw fail("FORBIDDEN", "Jamoa faol emas");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true },
  });
  if (!user) throw fail("NOT_FOUND", "Foydalanuvchi topilmadi");

  const clubId = await ensureTeamClub(invite.teamId);
  const displayName = (user.displayName || user.username || "A’zo").trim().slice(0, 60);

  await db.$transaction(async (tx) => {
    const member = await tx.dubTeamMember.findFirst({ where: { teamId: invite.teamId, userId }, select: { id: true } });
    if (!member) {
      const sameName = await tx.dubTeamMember.findFirst({
        where: { teamId: invite.teamId, name: displayName },
        select: { id: true, userId: true },
      });
      if (sameName && !sameName.userId) {
        await tx.dubTeamMember.update({ where: { id: sameName.id }, data: { userId } });
      } else if (sameName) {
        const altName = `${displayName.slice(0, 46)} (@${user.username})`.slice(0, 60);
        await tx.dubTeamMember.create({ data: { teamId: invite.teamId, userId, name: altName, role: "voice" } });
      } else {
        await tx.dubTeamMember.create({ data: { teamId: invite.teamId, userId, name: displayName, role: "voice" } });
      }
    }
    if (clubId) {
      await tx.clubMember.upsert({
        where: { clubId_userId: { clubId, userId } },
        create: { clubId, userId, role: "member" },
        update: {},
      });
    }
    await tx.dubTeamInvite.update({ where: { id: invite.id }, data: { status: "accepted", respondedAt: new Date() } });
  });

  await recomputeTeamReputation(invite.teamId);
  return { teamId: invite.teamId, clubId, accepted: true };
}

/** Anime chiqarishdan oldin jamoani tekshiradi: faol, egasi va kamida 3 ta tizim a'zosi. */
export async function assertPublishTeam(teamId: unknown, userId: string) {
  if (typeof teamId !== "string" || !teamId.trim()) {
    throw fail("INVALID_TEAM", "Anime chiqarish uchun dub jamoasini tanlang");
  }
  const team = await db.dubTeam.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, status: true, ownerId: true, clubId: true },
  });
  if (!team || team.status !== "active") throw fail("NOT_FOUND", "Jamoa topilmadi");
  if (team.ownerId !== userId) throw fail("FORBIDDEN", "Bu jamoa sizga tegishli emas");
  const linkedMemberCount = await db.dubTeamMember.count({
    where: { teamId: team.id, userId: { not: null } },
  });
  if (linkedMemberCount < MIN_TEAM_MEMBERS) {
    throw fail(
      "INVALID_TEAM",
      `Anime chiqarish uchun jamoada kamida ${MIN_TEAM_MEMBERS} ta a’zo bo‘lishi kerak (hozir ${linkedMemberCount} ta)`
    );
  }
  return { team, linkedMemberCount };
}

export interface PreparedDubCast {
  language: string;
  rows: { memberId: string | null; speakerName: string; character: string }[];
  speakerCount: number;
}

/**
 * Speaker qatorlarini tozalaydi: ham ism, ham personaj kerak.
 * speakerCount — noyob ismlar soni, bot tomoshabinlarga shu raqamni tasdiqlashni so‘raydi.
 */
export function prepareDubCast(
  cast: DubCastInput[],
  language: unknown,
  members: { id: string; name: string }[] = []
): PreparedDubCast {
  const safeLanguage =
    typeof language === "string" && (DUB_LANGUAGES as readonly string[]).includes(language) ? language : "uz";
  const entries = Array.isArray(cast) ? cast.slice(0, 60) : [];
  if (entries.length === 0) throw fail("INVALID_CAST", "Kamida bitta speaker qo‘shing");
  const memberById = new Map(members.map((member) => [member.id, member]));
  const rows = entries.map((entry) => {
    const character = cleanText(entry.character, 60);
    const member = entry.memberId ? memberById.get(entry.memberId) : undefined;
    const name = cleanText(entry.name, 60) || member?.name || "";
    if (!name || !character) throw fail("INVALID_CAST", "Speaker va personaj nomini to‘ldiring");
    return { memberId: member?.id ?? null, speakerName: name, character };
  });
  return {
    language: safeLanguage,
    rows,
    speakerCount: new Set(rows.map((row) => row.speakerName.toLowerCase())).size,
  };
}

/** DubCredit va uning speaker qatorlarini yaratadi (publish tranzaksiyasi ichida ham ishlaydi). */
export async function createDubCreditRow(
  client: Db,
  opts: { teamId: string; animeId: string; versionId?: string | null; prepared: PreparedDubCast }
) {
  const existing = await client.dubCredit.findFirst({
    where: { teamId: opts.teamId, animeId: opts.animeId, language: opts.prepared.language },
    select: { id: true },
  });
  if (existing) throw fail("DUPLICATE_CREDIT", "Bu anime uchun shu tilda dub allaqachon biriktirilgan");
  return client.dubCredit.create({
    data: {
      teamId: opts.teamId,
      animeId: opts.animeId,
      versionId: opts.versionId || null,
      language: opts.prepared.language,
      speakerCount: opts.prepared.speakerCount,
      cast: { create: opts.prepared.rows },
    },
    include: { cast: true },
  });
}

export async function addDubCredit(opts: {
  teamId: string;
  animeId: string;
  versionId?: string | null;
  language?: unknown;
  cast: DubCastInput[];
  actorId?: string;
}) {
  const team = await db.dubTeam.findUnique({ where: { id: opts.teamId }, select: { id: true, status: true, ownerId: true } });
  if (!team || team.status !== "active") throw fail("NOT_FOUND", "Jamoa topilmadi");
  const anime = await db.anime.findFirst({
    where: { id: opts.animeId },
    select: { id: true, creatorId: true, dubTeamId: true, hidden: true, moderationStatus: true },
  });
  if (!anime) throw fail("NOT_FOUND", "Anime topilmadi");
  const publiclyAvailable = anime.moderationStatus === "APPROVED" && !anime.hidden;
  const ownDraft = Boolean(opts.actorId && anime.creatorId === opts.actorId);
  if (!publiclyAvailable && !ownDraft) throw fail("NOT_FOUND", "Anime topilmadi");
  if (anime.dubTeamId && anime.dubTeamId !== opts.teamId) {
    throw fail("DUPLICATE_CREDIT", "Bu anime boshqa dub jamoasiga biriktirilgan");
  }
  const linkedMembers = await db.dubTeamMember.count({
    where: { teamId: opts.teamId, userId: { not: null } },
  });
  if (linkedMembers < MIN_TEAM_MEMBERS) {
    throw fail(
      "INVALID_TEAM",
      `Dub e’loni qo‘shish uchun jamoada kamida ${MIN_TEAM_MEMBERS} ta a’zo bo‘lishi kerak (hozir ${linkedMembers} ta)`
    );
  }

  const members = await db.dubTeamMember.findMany({ where: { teamId: opts.teamId }, select: { id: true, name: true } });
  const prepared = prepareDubCast(opts.cast, opts.language, members);
  const credit = await createDubCreditRow(db, {
    teamId: opts.teamId,
    animeId: anime.id,
    versionId: opts.versionId,
    prepared,
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
      members: { where: { userId: { not: null } }, select: { id: true } },
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
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          avatarUrl: true,
          reputation: true,
          verified: true,
          _count: { select: { members: true } },
        },
      },
      cast: { orderBy: { createdAt: "asc" }, select: { id: true, speakerName: true, character: true } },
    },
  });
  if (credits.length === 0) return [];

  const ids = credits.map((credit) => credit.id);
  const [aggregates, mine, verification] = await Promise.all([
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
    db.dubVerificationVote.groupBy({
      by: ["creditId", "agrees"],
      where: { creditId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const stats = new Map(aggregates.map((row) => [row.creditId, row]));
  const myVotes = new Map(mine.map((row) => [row.creditId, row.rating]));
  const verificationByCredit = new Map<string, { confirmed: number; rejected: number }>();
  for (const row of verification) {
    const current = verificationByCredit.get(row.creditId) ?? { confirmed: 0, rejected: 0 };
    if (row.agrees) current.confirmed += row._count._all;
    else current.rejected += row._count._all;
    verificationByCredit.set(row.creditId, current);
  }

  return credits.map((credit) => ({
    ...credit,
    rating: stats.get(credit.id)?._avg.rating
      ? Number(stats.get(credit.id)!._avg.rating!.toFixed(2))
      : null,
    ratingCount: stats.get(credit.id)?._count._all ?? 0,
    myRating: myVotes.get(credit.id) ?? null,
    verification: verificationByCredit.get(credit.id) ?? { confirmed: 0, rejected: 0 },
  }));
}
