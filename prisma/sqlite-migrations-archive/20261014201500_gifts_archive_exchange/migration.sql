-- Gift is per version; Exchange stays in DB but is archived (not deleted).
ALTER TABLE "Gift" ADD COLUMN "versionId" TEXT;
CREATE INDEX IF NOT EXISTS "Gift_expiresAt_status_idx" ON "Gift"("expiresAt", "status");

ALTER TABLE "ExchangeOffer" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT 1;
UPDATE "ExchangeOffer" SET "archived" = 1, "status" = 'ARCHIVED' WHERE "status" != 'ARCHIVED';
