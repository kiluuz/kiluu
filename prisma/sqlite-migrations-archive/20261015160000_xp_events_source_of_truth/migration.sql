INSERT INTO "XpEvent" ("id", "userId", "reason", "amount", "refType", "refId", "createdAt")
SELECT
    lower(hex(randomblob(16))),
    u."id",
    'legacy_migration',
    u."xpTotal" - COALESCE(SUM(e."amount"), 0),
    'legacy_migration',
    'xp-total-backfill',
    CURRENT_TIMESTAMP
FROM "User" u
LEFT JOIN "XpEvent" e ON e."userId" = u."id"
GROUP BY u."id"
HAVING u."xpTotal" > COALESCE(SUM(e."amount"), 0);

ALTER TABLE "User" DROP COLUMN "xpTotal";
