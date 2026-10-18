ALTER TABLE "User" ADD COLUMN "communityBlocked" BOOLEAN NOT NULL DEFAULT 0;

CREATE TABLE "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followerId" TEXT NOT NULL,
    "followedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Follow_followedId_fkey" FOREIGN KEY ("followedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Follow_followerId_followedId_key" ON "Follow"("followerId", "followedId");
CREATE INDEX "Follow_followedId_createdAt_idx" ON "Follow"("followedId", "createdAt");
CREATE INDEX "Follow_followerId_createdAt_idx" ON "Follow"("followerId", "createdAt");

ALTER TABLE "PostAward" ADD COLUMN "idempotencyKey" TEXT NOT NULL DEFAULT '';
UPDATE "PostAward" SET "idempotencyKey" = 'legacy-' || "id";
CREATE UNIQUE INDEX "PostAward_idempotencyKey_key" ON "PostAward"("idempotencyKey");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "PostLike_postId_createdAt_idx" ON "PostLike"("postId", "createdAt");
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");
