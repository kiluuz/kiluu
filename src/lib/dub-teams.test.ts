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
  const second = await db.anime.create({
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
  animeA = first.id;
  animeB = second.id;
  service = await import("./dub-teams");
  shared = await import("./dub-team-shared");
});

after(async () => {
  await db?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("creates a team with a slug and zero reputation", async () => {
  const team = await service.createDubTeam({ ownerId, name: "Anor Dub Studio" });
  teamId = team.id;

  assert.equal(team.slug, "anor-dub-studio");
  assert.equal(team.reputation, 0);
  assert.equal(team.verified, false);
});

test("members raise activity-based reputation before any ratings exist", async () => {
  await service.addDubTeamMember(teamId, { name: "Ali Valiyev", role: "director" });
  const team = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.equal(team.reputation, 1);
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
  assert.equal(team.reputation, 5);
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
});

test("rejects invalid ratings and recomputes reputation from quality", async () => {
  await assert.rejects(
    () => service.rateDubCredit({ creditId: creditA, userId: ownerId, rating: 11 }),
    (error: { code?: string }) => error.code === "INVALID_RATING"
  );

  const result = await service.rateDubCredit({ creditId: creditA, userId: ownerId, rating: 10 });
  // activity = min(20, 2 dubs * 4 + 1 member) = 9; quality = 100 → 80 + 9.
  assert.equal(result.reputation, 89);

  const team = await db.dubTeam.findUniqueOrThrow({ where: { id: teamId } });
  assert.equal(team.reputation, 89);
});

test("exposes anime signals and per-viewer credit ratings", async () => {
  const signals = await service.animeDubSignals([animeA, animeB]);
  assert.deepEqual(signals.get(animeA), { speakerCount: 2, teamReputation: 89 });
  assert.equal(signals.get(animeB), undefined);

  const credits = await service.dubCreditsForAnime(animeA, ownerId);
  const rated = credits.find((credit) => credit.id === creditA);
  assert.ok(rated);
  assert.equal(rated.rating, 10);
  assert.equal(rated.ratingCount, 1);
  assert.equal(rated.myRating, 10);
  assert.equal(rated.cast.length, 3);
});

test("awards team titles by reputation and verification", () => {
  assert.equal(shared.dubTeamTitle(0).label, "Yangi jamoa");
  assert.equal(shared.dubTeamTitle(25).label, "Bronza jamoa");
  assert.equal(shared.dubTeamTitle(50).label, "Kumush jamoa");
  assert.equal(shared.dubTeamTitle(75).label, "Oltin jamoa");
  assert.equal(shared.dubTeamTitle(85).label, "Oltin jamoa");
  assert.equal(shared.dubTeamTitle(85, true).label, "Afsonaviy jamoa");
});
