CREATE TABLE "watch_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watch_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "watch_events_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "watch_events_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "watch_events_userId_createdAt_idx" ON "watch_events"("userId", "createdAt");
CREATE INDEX "watch_events_animeId_createdAt_idx" ON "watch_events"("animeId", "createdAt");

CREATE TABLE "anime_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "anime_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "anime_ratings_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "anime_ratings_userId_animeId_key" ON "anime_ratings"("userId", "animeId");
CREATE INDEX "anime_ratings_animeId_rating_idx" ON "anime_ratings"("animeId", "rating");
CREATE INDEX "anime_ratings_userId_createdAt_idx" ON "anime_ratings"("userId", "createdAt");

CREATE INDEX "Anime_creatorId_idx" ON "Anime"("creatorId");
CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt");

INSERT OR IGNORE INTO "Follow" ("id", "followerId", "followedId", "createdAt")
SELECT 'legacy-follow-' || "id", "followerId", "followingId", "createdAt"
FROM "FavoriteUser";
