-- CreateTable
CREATE TABLE "dub_teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "avatarUrl" TEXT,
    "ownerId" TEXT,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dub_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dub_team_members" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'voice',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dub_team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dub_credits" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "versionId" TEXT,
    "language" TEXT NOT NULL DEFAULT 'uz',
    "speakerCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dub_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dub_cast_members" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "memberId" TEXT,
    "speakerName" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dub_cast_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dub_team_ratings" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dub_team_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dub_teams_slug_key" ON "dub_teams"("slug");

-- CreateIndex
CREATE INDEX "dub_teams_ownerId_idx" ON "dub_teams"("ownerId");

-- CreateIndex
CREATE INDEX "dub_teams_reputation_idx" ON "dub_teams"("reputation");

-- CreateIndex
CREATE INDEX "dub_team_members_userId_idx" ON "dub_team_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "dub_team_members_teamId_name_key" ON "dub_team_members"("teamId", "name");

-- CreateIndex
CREATE INDEX "dub_credits_animeId_idx" ON "dub_credits"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "dub_credits_teamId_animeId_language_key" ON "dub_credits"("teamId", "animeId", "language");

-- CreateIndex
CREATE INDEX "dub_cast_members_creditId_idx" ON "dub_cast_members"("creditId");

-- CreateIndex
CREATE INDEX "dub_team_ratings_teamId_idx" ON "dub_team_ratings"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "dub_team_ratings_userId_creditId_key" ON "dub_team_ratings"("userId", "creditId");

-- AddForeignKey
ALTER TABLE "dub_teams" ADD CONSTRAINT "dub_teams_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_members" ADD CONSTRAINT "dub_team_members_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "dub_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_members" ADD CONSTRAINT "dub_team_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_credits" ADD CONSTRAINT "dub_credits_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "dub_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_credits" ADD CONSTRAINT "dub_credits_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_credits" ADD CONSTRAINT "dub_credits_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "anime_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_cast_members" ADD CONSTRAINT "dub_cast_members_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "dub_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_cast_members" ADD CONSTRAINT "dub_cast_members_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "dub_team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_ratings" ADD CONSTRAINT "dub_team_ratings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "dub_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_ratings" ADD CONSTRAINT "dub_team_ratings_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "dub_credits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dub_team_ratings" ADD CONSTRAINT "dub_team_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

