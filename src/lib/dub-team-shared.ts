export const DUB_ROLES = ["voice", "director", "sound"] as const;
export type DubRole = (typeof DUB_ROLES)[number];

/** Dub e'lon qilinadigan tillar — sayt support qiladigan tillar bilan bir xil. */
export const DUB_LANGUAGES = ["uz", "en", "ru", "kk", "ky"] as const;
export type DubLanguage = (typeof DUB_LANGUAGES)[number];

export type DubTitleKey = "new" | "bronze" | "silver" | "gold" | "mythic";

/** Jamoa darajasi — reputation 0..100 asosida. Matn UI'da `dub.title.<key>` kaliti orqali olinadi. */
export function dubTeamTitle(reputation: number, verified = false): { key: DubTitleKey; color: string } {
  if (verified && reputation >= 85) return { key: "mythic", color: "#ffc46b" };
  if (reputation >= 75) return { key: "gold", color: "#ffc46b" };
  if (reputation >= 50) return { key: "silver", color: "#cfd8e3" };
  if (reputation >= 25) return { key: "bronze", color: "#e6a06c" };
  return { key: "new", color: "#9be7d0" };
}

/** Server dub xatolarini kod bilan qaytaradi; UI shu kodni tarjimaga bog'laydi. */
export const DUB_ERROR_CODES = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "INVALID_NAME",
  "INVALID_TEAM",
  "INVALID_CAST",
  "INVALID_INVITE",
  "INVALID_RATING",
  "DUPLICATE_MEMBER",
  "DUPLICATE_CREDIT",
  "TEAM_LEADER_ONLY",
] as const;

export function dubErrorText(
  translate: (key: string, values?: Record<string, string | number>) => string,
  code: unknown,
  fallback: string
): string {
  if (typeof code === "string" && (DUB_ERROR_CODES as readonly string[]).includes(code)) {
    return translate(`dub.error.${code}`);
  }
  return fallback;
}
