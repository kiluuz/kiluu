-- Rename payments table; ownership is per version (not per anime title).
ALTER TABLE "StarsPayment" RENAME TO "star_payments";

DROP INDEX IF EXISTS "Purchase_userId_animeId_episodeNumber_key";
