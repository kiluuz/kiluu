-- Reverse 20261014184500_foundation. Restores ledger table name; drops new empty tables.
-- User/Anime extra columns are left in place (SQLite cannot cheaply drop them without rebuild).
-- Restore from a DB backup if you need a byte-identical previous schema.

DROP INDEX IF EXISTS "Purchase_userId_versionId_episodeNumber_key";

DROP TABLE IF EXISTS "telegram_link_tokens";
DROP TABLE IF EXISTS "anime_versions";
DROP TABLE IF EXISTS "StarsPayment";
DROP TABLE IF EXISTS "Gift";
DROP TABLE IF EXISTS "XpEvent";
DROP TABLE IF EXISTS "UserAchievement";
DROP TABLE IF EXISTS "Achievement";
DROP TABLE IF EXISTS "Notification";
DROP TABLE IF EXISTS "PostBookmark";
DROP TABLE IF EXISTS "PostAward";
DROP TABLE IF EXISTS "Report";
DROP TABLE IF EXISTS "CommentLike";
DROP TABLE IF EXISTS "ScheduleSubscription";
DROP TABLE IF EXISTS "DubWaitlist";
DROP TABLE IF EXISTS "WatchPartyMessage";
DROP TABLE IF EXISTS "WatchPartyMember";
DROP TABLE IF EXISTS "WatchParty";
DROP TABLE IF EXISTS "AnimeSetItem";
DROP TABLE IF EXISTS "AnimeSet";
DROP TABLE IF EXISTS "CreditPackage";
DROP TABLE IF EXISTS "PlatformConfig";

ALTER TABLE "credit_ledger" RENAME TO "CreditTransaction";
