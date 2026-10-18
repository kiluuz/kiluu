-- CreateTable
CREATE TABLE "PlatformConfig" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CreditPackage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "starsPrice" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "popular" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "StarsPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "packageId" TEXT,
    "animeId" TEXT,
    "starsAmount" INTEGER NOT NULL,
    "creditsGranted" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "telegramChargeId" TEXT,
    "providerPaymentChargeId" TEXT,
    "invoicePayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StarsPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientUsername" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "pricePaid" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "claimedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Gift_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Gift_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Gift_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XpEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "emoji" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "conditionJson" TEXT NOT NULL,
    "rewardJson" TEXT NOT NULL DEFAULT '{}',
    "secret" BOOLEAN NOT NULL DEFAULT false,
    "seasonal" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 1,
    "unlockedAt" DATETIME,
    CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL DEFAULT '{}',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostBookmark" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostBookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PostAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "authorShare" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PostAward_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScheduleSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "anilistId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DubWaitlist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DubWaitlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchParty" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL DEFAULT '',
    "isPlaying" BOOLEAN NOT NULL DEFAULT false,
    "position" REAL NOT NULL DEFAULT 0,
    "serverTs" BIGINT NOT NULL DEFAULT 0,
    "playbackRate" REAL NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 50,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchParty_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchParty_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchPartyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchPartyMember_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "WatchParty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchPartyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WatchPartyMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "partyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchPartyMessage_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "WatchParty" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WatchPartyMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bonusCredits" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "AnimeSetItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    CONSTRAINT "AnimeSetItem_setId_fkey" FOREIGN KEY ("setId") REFERENCES "AnimeSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeSetItem_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "telegram_link_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telegram_link_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "anime_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'official',
    "creatorId" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'published',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "anime_versions_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "anime_versions_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_ledger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "credit_ledger" ("id", "userId", "amount", "type", "description", "createdAt")
SELECT "id", "userId", "amount", "type", "description", "createdAt" FROM "CreditTransaction";
DROP TABLE "CreditTransaction";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Anime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "altTitle" TEXT,
    "description" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "bannerImage" TEXT,
    "genres" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "rating" REAL NOT NULL DEFAULT 8.0,
    "studio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "type" TEXT NOT NULL DEFAULT 'TV',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER NOT NULL DEFAULT 0,
    "trending" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "airDay" INTEGER,
    "airTime" TEXT,
    "releaseDate" DATETIME,
    "creatorId" TEXT,
    "canonicalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OFFICIAL',
    "moderationStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Anime_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Anime_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "Anime" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Anime" ("airDay", "airTime", "altTitle", "bannerImage", "coverImage", "createdAt", "creatorId", "description", "featured", "genres", "id", "isFree", "price", "rating", "releaseDate", "slug", "status", "studio", "title", "trending", "type", "updatedAt", "year") SELECT "airDay", "airTime", "altTitle", "bannerImage", "coverImage", "createdAt", "creatorId", "description", "featured", "genres", "id", "isFree", "price", "rating", "releaseDate", "slug", "status", "studio", "title", "trending", "type", "updatedAt", "year" FROM "Anime";
DROP TABLE "Anime";
ALTER TABLE "new_Anime" RENAME TO "Anime";
CREATE UNIQUE INDEX "Anime_slug_key" ON "Anime"("slug");
CREATE INDEX "Anime_moderationStatus_hidden_createdAt_idx" ON "Anime"("moderationStatus", "hidden", "createdAt");
CREATE INDEX "Anime_canonicalId_idx" ON "Anime"("canonicalId");
CREATE TABLE "new_Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Comment" ("content", "createdAt", "id", "postId", "userId") SELECT "content", "createdAt", "id", "postId", "userId" FROM "Comment";
DROP TABLE "Comment";
ALTER TABLE "new_Comment" RENAME TO "Comment";
CREATE TABLE "new_Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "versionId" TEXT,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "telegramFileId" TEXT,
    "telegramMessageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Episode_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Episode_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "anime_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Episode" ("animeId", "createdAt", "description", "duration", "id", "number", "title", "videoUrl") SELECT "animeId", "createdAt", "description", "duration", "id", "number", "title", "videoUrl" FROM "Episode";
DROP TABLE "Episode";
ALTER TABLE "new_Episode" RENAME TO "Episode";
CREATE INDEX "Episode_versionId_number_idx" ON "Episode"("versionId", "number");
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "animeId" TEXT,
    "imageUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Discussions',
    "rating" INTEGER,
    "spoiler" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Post_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("animeId", "content", "createdAt", "id", "imageUrl", "updatedAt", "userId") SELECT "animeId", "content", "createdAt", "id", "imageUrl", "updatedAt", "userId" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_category_createdAt_idx" ON "Post"("category", "createdAt");
CREATE TABLE "new_Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "versionId" TEXT,
    "episodeNumber" INTEGER NOT NULL DEFAULT 0,
    "pricePaid" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Purchase_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Purchase_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "anime_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Purchase" ("animeId", "createdAt", "episodeNumber", "id", "pricePaid", "userId") SELECT "animeId", "createdAt", "episodeNumber", "id", "pricePaid", "userId" FROM "Purchase";
DROP TABLE "Purchase";
ALTER TABLE "new_Purchase" RENAME TO "Purchase";
CREATE INDEX "Purchase_userId_versionId_idx" ON "Purchase"("userId", "versionId");
CREATE UNIQUE INDEX "Purchase_userId_animeId_episodeNumber_key" ON "Purchase"("userId", "animeId", "episodeNumber");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "bio" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#f97316',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "telegramId" TEXT,
    "telegramUsername" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'uz',
    "xpTotal" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pronouns" TEXT,
    "tagline" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "socialLinks" TEXT,
    "statusEmoji" TEXT,
    "statusText" TEXT,
    "accentTo" TEXT,
    "avatarFrame" TEXT,
    "bannerPreset" TEXT,
    "showcase" TEXT,
    "privacy" TEXT
);
INSERT INTO "new_User" ("accentColor", "accentTo", "avatarFrame", "avatarUrl", "bannerPreset", "bannerUrl", "bio", "country", "createdAt", "credits", "displayName", "email", "id", "onboardingDone", "password", "privacy", "pronouns", "role", "showcase", "socialLinks", "statusEmoji", "statusText", "tagline", "timezone", "updatedAt", "username", "locale")
SELECT "accentColor", "accentTo", "avatarFrame", "avatarUrl", "bannerPreset", "bannerUrl", "bio", "country", "createdAt", "credits", "displayName", "email", "id", "onboardingDone", "password", "privacy", "pronouns",
CASE
  WHEN "role" IN ('CREATOR','creator') THEN 'creator'
  WHEN "role" IN ('ADMIN','admin') THEN 'admin'
  ELSE 'user'
END,
"showcase", "socialLinks", "statusEmoji", "statusText", "tagline", "timezone", "updatedAt", "username", 'uz' FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StarsPayment_telegramChargeId_key" ON "StarsPayment"("telegramChargeId");

-- CreateIndex
CREATE UNIQUE INDEX "StarsPayment_invoicePayload_key" ON "StarsPayment"("invoicePayload");

-- CreateIndex
CREATE INDEX "StarsPayment_userId_status_idx" ON "StarsPayment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Gift_idempotencyKey_key" ON "Gift"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Gift_recipientId_status_idx" ON "Gift"("recipientId", "status");

-- CreateIndex
CREATE INDEX "Gift_senderId_createdAt_idx" ON "Gift"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "XpEvent_userId_createdAt_idx" ON "XpEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XpEvent_userId_reason_refId_key" ON "XpEvent"("userId", "reason", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostBookmark_userId_postId_key" ON "PostBookmark"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_userId_commentId_key" ON "CommentLike"("userId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSubscription_userId_anilistId_key" ON "ScheduleSubscription"("userId", "anilistId");

-- CreateIndex
CREATE UNIQUE INDEX "DubWaitlist_userId_key" ON "DubWaitlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WatchParty_code_key" ON "WatchParty"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WatchPartyMember_partyId_userId_key" ON "WatchPartyMember"("partyId", "userId");

-- CreateIndex
CREATE INDEX "WatchPartyMessage_partyId_createdAt_idx" ON "WatchPartyMessage"("partyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeSet_code_key" ON "AnimeSet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeSetItem_setId_animeId_key" ON "AnimeSetItem"("setId", "animeId");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_link_tokens_token_key" ON "telegram_link_tokens"("token");

-- CreateIndex
CREATE INDEX "telegram_link_tokens_userId_expiresAt_idx" ON "telegram_link_tokens"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "anime_versions_animeId_kind_idx" ON "anime_versions"("animeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_idempotencyKey_key" ON "credit_ledger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "credit_ledger_userId_createdAt_idx" ON "credit_ledger"("userId", "createdAt");

-- Backfill official/creator versions from existing catalog rows (data-preserving)
INSERT INTO "anime_versions" ("id", "animeId", "kind", "creatorId", "price", "status", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(8))) || '_' || "id", "id",
  CASE WHEN "creatorId" IS NOT NULL AND "creatorId" != '' THEN 'creator' ELSE 'official' END,
  "creatorId", "price", 'published', "createdAt", "updatedAt"
FROM "Anime"
WHERE NOT EXISTS (SELECT 1 FROM "anime_versions" v WHERE v."animeId" = "Anime"."id");

UPDATE "Episode" SET "versionId" = (
  SELECT v."id" FROM "anime_versions" v WHERE v."animeId" = "Episode"."animeId" LIMIT 1
) WHERE "versionId" IS NULL;

UPDATE "Purchase" SET "versionId" = (
  SELECT v."id" FROM "anime_versions" v WHERE v."animeId" = "Purchase"."animeId" LIMIT 1
) WHERE "versionId" IS NULL;

DELETE FROM "Anime" WHERE "slug" IN ('yangi-anime', 'anime');

CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_userId_versionId_episodeNumber_key"
ON "Purchase"("userId", "versionId", "episodeNumber");
