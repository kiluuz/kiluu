-- AlterTable
ALTER TABLE "Anime" ADD COLUMN "dubTeamId" TEXT;

-- AlterTable
ALTER TABLE "dub_teams" ADD COLUMN "clubId" TEXT;

-- CreateTable
CREATE TABLE "dub_team_invites" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "dub_team_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dub_verification_votes" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speakerCount" INTEGER NOT NULL,
    "agrees" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dub_verification_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anime_dubTeamId_idx" ON "Anime"("dubTeamId");

-- CreateIndex
CREATE UNIQUE INDEX "dub_teams_clubId_key" ON "dub_teams"("clubId");

-- CreateIndex
CREATE UNIQUE INDEX "dub_team_invites_teamId_userId_key" ON "dub_team_invites"("teamId", "userId");

-- CreateIndex
CREATE INDEX "dub_team_invites_userId_status_idx" ON "dub_team_invites"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dub_verification_votes_userId_creditId_key" ON "dub_verification_votes"("userId", "creditId");

-- CreateIndex
CREATE INDEX "dub_verification_votes_creditId_idx" ON "dub_verification_votes"("creditId");

-- AddForeignKey
ALTER TABLE "Anime" ADD CONSTRAINT "Anime_dubTeamId_fkey" FOREIGN KEY ("dubTeamId") REFERENCES "dub_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_teams" ADD CONSTRAINT "dub_teams_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_invites" ADD CONSTRAINT "dub_team_invites_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "dub_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_invites" ADD CONSTRAINT "dub_team_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_invites" ADD CONSTRAINT "dub_team_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_verification_votes" ADD CONSTRAINT "dub_verification_votes_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "dub_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_verification_votes" ADD CONSTRAINT "dub_verification_votes_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "dub_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_verification_votes" ADD CONSTRAINT "dub_verification_votes_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_verification_votes" ADD CONSTRAINT "dub_verification_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
