-- AlterTable
ALTER TABLE "CreditPackage" ADD COLUMN "price_da" INTEGER NOT NULL DEFAULT 0;

-- Default DonationAlerts prices (RUB) for the seeded packages.
UPDATE "CreditPackage" SET "price_da" = 100 WHERE "id" = 'starter' AND "price_da" = 0;
UPDATE "CreditPackage" SET "price_da" = 300 WHERE "id" = 'basic' AND "price_da" = 0;
UPDATE "CreditPackage" SET "price_da" = 600 WHERE "id" = 'plus' AND "price_da" = 0;
UPDATE "CreditPackage" SET "price_da" = 1200 WHERE "id" = 'pro' AND "price_da" = 0;
UPDATE "CreditPackage" SET "price_da" = 3000 WHERE "id" = 'mega' AND "price_da" = 0;

-- CreateTable
CREATE TABLE "donation_alerts_auth" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "da_user_id" TEXT NOT NULL,
    "da_user_name" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "connected_by_id" TEXT,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_alerts_auth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_intents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "donation_id" TEXT,
    "donated_minor" INTEGER,
    "credits_granted" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "donation_intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_events" (
    "donation_id" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "message" TEXT,
    "donor_name" TEXT,
    "intent_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donation_events_pkey" PRIMARY KEY ("donation_id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "method" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_note" TEXT,
    "processed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "donation_intents_code_key" ON "donation_intents"("code");

-- CreateIndex
CREATE UNIQUE INDEX "donation_intents_donation_id_key" ON "donation_intents"("donation_id");

-- CreateIndex
CREATE INDEX "donation_intents_user_id_status_created_at_idx" ON "donation_intents"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "donation_intents_status_expires_at_idx" ON "donation_intents"("status", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "donation_events_intent_id_key" ON "donation_events"("intent_id");

-- CreateIndex
CREATE INDEX "donation_events_status_received_at_idx" ON "donation_events"("status", "received_at");

-- CreateIndex
CREATE INDEX "payout_requests_user_id_status_created_at_idx" ON "payout_requests"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "payout_requests_status_created_at_idx" ON "payout_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "donation_intents" ADD CONSTRAINT "donation_intents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_intents" ADD CONSTRAINT "donation_intents_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "CreditPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_events" ADD CONSTRAINT "donation_events_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "donation_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_processed_by_id_fkey" FOREIGN KEY ("processed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
