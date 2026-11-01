import { randomInt } from "node:crypto";
import { db } from "@/lib/db";

const RESERVED_HANDLES = new Set([
  "admin", "administrator", "kiluu", "support", "moderator", "mod", "staff", "official", "creator", "viewer",
]);

/** Handle ixtiyoriy: berilmasa, ism yoki emaildan vaqtinchalik unique handle yasaladi. */
export function handleBase(email: string, displayName: string | null): string {
  const source = (displayName || email.split("@")[0] || "user")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = source.slice(0, 16) || "user";
  return base.length >= 3 ? base : `user_${base}`.slice(0, 20);
}

export async function uniqueHandle(base: string): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0
      ? base
      : `${base.slice(0, 14)}_${randomInt(1000, 99999)}`.slice(0, 20);
    const taken = await db.user.findFirst({ where: { username: candidate }, select: { id: true } });
    if (!taken && !RESERVED_HANDLES.has(candidate)) return candidate;
  }
  return `user_${randomInt(100000, 999999)}`;
}

/**
 * Resolves a handle a person typed to the account that owns it, ignoring casing.
 * Prisma's `mode: "insensitive"` only exists on Postgres, so the search narrows on
 * the first letter in both casings and the comparison folds case in JS.
 */
export async function findUserByHandle(handle: string) {
  const wanted = handle.replace(/^@/, "").trim().toLowerCase();
  if (!wanted) return null;
  const candidates = await db.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { username: { startsWith: wanted.charAt(0) } },
        { username: { startsWith: wanted.charAt(0).toUpperCase() } },
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      accentColor: true,
      role: true,
      email: true,
    },
  });
  return candidates.find((user) => user.username.toLowerCase() === wanted) ?? null;
}
