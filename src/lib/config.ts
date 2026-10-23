import { isAdmin } from "@/lib/rbac";

export function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const APP_CONFIG = {
  creatorSharePercent: Number(env("CREATOR_SHARE_PERCENT", "70")),
  platformSharePercent: Number(env("PLATFORM_SHARE_PERCENT", "30")),
  giftExpiryDays: Number(env("GIFT_EXPIRY_DAYS", "14")),
  defaultLocale: env("DEFAULT_LOCALE", "en"),
  watchPartyRequireOwn: env("WATCH_PARTY_REQUIRE_OWN", "true") !== "false",
  awardCost: 10,
  minAnimePrice: 10,
  adminUserIds: env("ADMIN_USER_IDS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  adminTelegramIds: env("ADMIN_TELEGRAM_IDS", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
};

export function isAdminUser(user: { id: string; role: string; telegramId?: string | null } | null): boolean {
  return isAdmin(user, {
    adminUserIds: APP_CONFIG.adminUserIds,
    adminTelegramIds: APP_CONFIG.adminTelegramIds,
  });
}
