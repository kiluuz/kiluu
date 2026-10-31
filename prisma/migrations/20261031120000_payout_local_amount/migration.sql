-- AlterTable
ALTER TABLE "payout_requests" ADD COLUMN "local_currency" TEXT NOT NULL DEFAULT 'RUB';
ALTER TABLE "payout_requests" ADD COLUMN "local_amount_minor" INTEGER NOT NULL DEFAULT 0;

-- Existing requests were denominated in the base account currency.
UPDATE "payout_requests" SET "local_amount_minor" = "amount_minor" WHERE "local_amount_minor" = 0;
