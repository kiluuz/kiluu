CREATE TABLE "ScheduleDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "scheduleId" INTEGER NOT NULL,
    "animeTitle" TEXT NOT NULL,
    "episode" INTEGER NOT NULL,
    "airingAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lockedAt" DATETIME,
    "sentAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduleDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ScheduleDelivery_userId_scheduleId_key" ON "ScheduleDelivery"("userId", "scheduleId");
CREATE INDEX "ScheduleDelivery_status_lockedAt_idx" ON "ScheduleDelivery"("status", "lockedAt");
CREATE INDEX "ScheduleDelivery_airingAt_idx" ON "ScheduleDelivery"("airingAt");
CREATE INDEX "ScheduleSubscription_anilistId_idx" ON "ScheduleSubscription"("anilistId");
