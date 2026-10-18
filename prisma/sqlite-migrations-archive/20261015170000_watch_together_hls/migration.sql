ALTER TABLE "Episode" ADD COLUMN "streamId" TEXT;
ALTER TABLE "WatchParty" ADD COLUMN "endedAt" DATETIME;
ALTER TABLE "WatchParty" ADD COLUMN "createdById" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WatchPartyMember" ADD COLUMN "lastSeenAt" DATETIME;

UPDATE "WatchParty" SET "createdById" = "hostId" WHERE "createdById" IS NULL;
CREATE INDEX "WatchParty_endedAt_expiresAt_idx" ON "WatchParty"("endedAt", "expiresAt");
CREATE INDEX "WatchParty_createdById_idx" ON "WatchParty"("createdById");
CREATE INDEX "WatchPartyMember_partyId_lastSeenAt_idx" ON "WatchPartyMember"("partyId", "lastSeenAt");
CREATE INDEX "WatchPartyMember_userId_joinedAt_idx" ON "WatchPartyMember"("userId", "joinedAt");
