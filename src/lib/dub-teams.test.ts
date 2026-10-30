import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

let tempDir: string;
let db: import("@prisma/client").PrismaClient;
let service: typeof import("./dub-teams");
let shared: typeof import("./dub-team-shared");
let ownerId: string;
let memberTwoId: string;
let memberThreeId: string;
let inviteeId: string;
let teamId: string;
let animeA: string;
let animeB: string;
let creditA: string;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-dub-teams-test-"));
  const databaseUrl = `file:${path.join(tempDir, "dub-teams.db")}`;
  execFileSync(
    path.resolve("node_modules/.bin/prisma"),
    ["db", "push", "--schema", "prisma/schema.test.prisma", "--skip-generate"],
    { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" }
  );
  process.env.DATABASE_URL = databaseUrl;

  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient();
  await db.$connect();

  const owner = await db.user.create({
    data: { email: "dub-owner@example.test", username: "dub-owner", password: "test-hash" },
  });
  const second = await db.user.create({
    data: { email: "dub-member-2@example.test", username: "dub-member-2", password: "test-hash" },
  });
  const third = await db.user.create({
    data: { email: "dub-member-3@example.test", username: "dub-member-3", password: "test-hash" },
  });
  const invitee = await db.user.create({
    data: { email: "dub-invitee@example.test", username: "dub-invitee", password: "test-hash" },
  });
  const first = await db.anime.create({
    data: {
      slug: "dub-test-anime-a",
      title: "Dub Test Anime A",
      description: "First catalog entry for dub credit tests.",
      coverImage: "https://example.test/dub-a.jpg",
      genres: "Action",
      year: 2026,
      price: 100,
    },
  });
  const secondAnime = await db.anime.create({
    data: {
      slug: "dub-test-anime-b",
      title: "Dub Test Anime B",
      description: "Second catalog entry for dub credit tests.",
      coverImage: "https://example.test/dub-b.jpg",
      genres: "Drama",
      year: 2026,
      price: 100,
    },
  });

  ownerId = owner.id;
  memberTwoId = second.id;
  memberThreeId = third.id;
  inviteeId = invitee.id;
  animeA = first.id;
  animeB = secondAnime.id;
  service = await import("./dub-teams");
  shared = await import("./dub-team-shared");
});

after(async () => {
  await db?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("creates a team with a slug, a private club and zero reputation", async () => {
  const team = await service.createDubTeam({ ownerId, name: "Anor Dub Studio" });
  teamId = team.id;

  assert.equal(team.slug, "anor-dub-studio");
  assert.equal(team.reputation, 0);
  assert.equal(team.verified, false);

  const stored = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.ok(stored.clubId, "team club should be created");
  const club = await db.club.findUniqueOrThrow({ where: { id: stored.clubId! } });
  assert.equal(club.isPublic, false);
  assert.equal(club.ownerId, ownerId);
  const room = await db.chatRoom.findUnique({ where: { clubId: club.id } });
  assert.ok(room, "club chat room should exist");
});

test("members raise activity-based reputation before any ratings exist", async () => {
  await service.addDubTeamMember(teamId, { name: "Ali Valiyev", role: "director" });
  let team = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.equal(team.reputation, 1);

  await service.addDubTeamMember(teamId, { name: "Dilnoza Karimova", userId: ownerId });
  await service.addDubTeamMember(teamId, { name: "Sardor Toshev", userId: memberTwoId });
  await service.addDubTeamMember(teamId, { name: "Madina Yusupova", userId: memberThreeId });
  team = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.equal(team.reputation, 4);
});

test("counts distinct speakers case-insensitively", async () => {
  const credit = await service.addDubCredit({
    teamId,
    animeId: animeA,
    language: "uz",
    cast: [
      { name: "Ali", character: "Naruto" },
      { name: "ali", character: "Sasuke" },
      { name: "Vali", character: "Kakashi" },
    ],
  });
  creditA = credit.id;

  assert.equal(credit.speakerCount, 2);
  assert.equal(credit.cast.length, 3);

  const team = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.equal(team.reputation, 8);
});

test("rejects a second credit for the same anime and language", async () => {
  await assert.rejects(
    () =>
      service.addDubCredit({
        teamId,
        animeId: animeA,
        language: "uz",
        cast: [{ name: "Ali", character: "Naruto" }],
      }),
    (error: { code?: string }) => error.code === "DUPLICATE_CREDIT"
  );
});

test("allows the same anime in another language", async () => {
  const credit = await service.addDubCredit({
    teamId,
    animeId: animeA,
    language: "ru",
    cast: [{ name: "Ivan", character: "Naruto" }],
  });
  assert.equal(credit.language, "ru");
  assert.equal(credit.speakerCount, 1);

  const team = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.equal(team.reputation, 12);
});

test("rejects invalid ratings and recomputes reputation from quality", async () => {
  await assert.rejects(
    () => service.rateDubCredit({ creditId: creditA, userId: ownerId, rating: 11 }),
    (error: { code?: string }) => error.code === "INVALID_RATING"
  );

  const result = await service.rateDubCredit({ creditId: creditA, userId: ownerId, rating: 10 });
  // activity = min(20, 2 dubs * 4 + 4 members) = 12; quality = 100 → 80 + 12.
  assert.equal(result.reputation, 92);

  const team = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.equal(team.reputation, 92);
});

test("exposes anime signals and per-viewer credit ratings", async () => {
  const signals = await service.animeDubSignals([animeA, animeB]);
  assert.deepEqual(signals.get(animeA), { speakerCount: 2, teamReputation: 92 });
  assert.equal(signals.get(animeB), undefined);

  const credits = await service.dubCreditsForAnime(animeA, ownerId);
  const rated = credits.find((credit) => credit.id === creditA);
  assert.ok(rated);
  assert.equal(rated.rating, 10);
  assert.equal(rated.ratingCount, 1);
  assert.equal(rated.myRating, 10);
  assert.equal(rated.cast.length, 3);
  assert.deepEqual(rated.verification, { confirmed: 0, rejected: 0 });
  assert.equal(rated.team._count.members, 4);
});

test("inviting a site user joins them to the team and its private club", async () => {
  const { invite } = await service.inviteDubTeamMember(teamId, ownerId, inviteeId);
  assert.equal(invite.status, "pending");

  const invites = await service.listDubTeamInvites(inviteeId);
  assert.equal(invites.length, 1);
  assert.equal(invites[0].team.id, teamId);

  const result = await service.respondDubTeamInvite(invite.id, inviteeId, true);
  assert.equal(result.accepted, true);
  assert.ok(result.clubId);

  const member = await db.dubTeamMember.findFirst({ where: { teamId, userId: inviteeId } });
  assert.ok(member);
  const membership = await db.clubMember.findUnique({
    where: { clubId_userId: { clubId: result.clubId!, userId: inviteeId } },
  });
  assert.ok(membership);

  const stored = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  // activity = 2 dubs * 4 + 5 members = 13; quality 100 → 80 + 13.
  assert.equal(stored.reputation, 93);
});

test("publish guard requires three linked members owned by the creator", async () => {
  const first = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
  assert.ok(first);

  await assert.rejects(
    () => service.assertPublishTeam(teamId, memberTwoId),
    (error: { code?: string }) => error.code === "FORBIDDEN"
  );
  await assert.rejects(
    () => service.assertPublishTeam("missing-team", ownerId),
    (error: { code?: string }) => error.code === "NOT_FOUND"
  );

  const small = await service.createDubTeam({ ownerId, name: "Kichik Jamoa" });
  await service.addDubTeamMember(small.id, { name: "Yolg'iz A'zo", userId: ownerId });
  await assert.rejects(
    () => service.assertPublishTeam(small.id, ownerId),
    (error: { code?: string }) => error.code === "INVALID_TEAM"
  );

  const guard = await service.assertPublishTeam(teamId, ownerId);
  assert.equal(guard.linkedMemberCount, 4);
});

test("awards team titles by reputation and verification", () => {
  assert.equal(shared.dubTeamTitle(0).label, "Yangi jamoa");
  assert.equal(shared.dubTeamTitle(25).label, "Bronza jamoa");
  assert.equal(shared.dubTeamTitle(50).label, "Kumush jamoa");
  assert.equal(shared.dubTeamTitle(75).label, "Oltin jamoa");
  assert.equal(shared.dubTeamTitle(85).label, "Oltin jamoa");
  assert.equal(shared.dubTeamTitle(85, true).label, "Afsonaviy jamoa");
});
