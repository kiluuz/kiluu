export type CanonicalRole = "user" | "creator" | "admin";

export function canonicalRole(role: string | null | undefined): CanonicalRole {
  const r = (role || "user").toLowerCase();
  if (r === "admin") return "admin";
  if (r === "creator") return "creator";
  return "user";
}

/** Client/legacy UI still uses CREATOR | VIEWER | ADMIN. */
export function clientRole(role: string | null | undefined): "VIEWER" | "CREATOR" | "ADMIN" {
  const r = canonicalRole(role);
  if (r === "admin") return "ADMIN";
  if (r === "creator") return "CREATOR";
  return "VIEWER";
}

export function parseOnboardingRole(raw: string): CanonicalRole | null {
  const r = raw.toLowerCase();
  if (r === "creator" || raw === "CREATOR") return "creator";
  if (r === "user" || r === "viewer" || raw === "VIEWER") return "user";
  return null;
}

export function isCreator(user: { role: string } | null | undefined): boolean {
  if (!user) return false;
  const r = canonicalRole(user.role);
  return r === "creator" || r === "admin";
}

export function isAdmin(
  user: { id: string; role: string; telegramId?: string | null } | null | undefined,
  opts?: { adminUserIds?: string[]; adminTelegramIds?: string[] }
): boolean {
  if (!user) return false;
  if (canonicalRole(user.role) === "admin") return true;
  if (opts?.adminUserIds?.includes(user.id)) return true;
  if (user.telegramId && opts?.adminTelegramIds?.includes(String(user.telegramId))) return true;
  return false;
}

export function requireAuth<T>(user: T | null): user is T {
  return user != null;
}
