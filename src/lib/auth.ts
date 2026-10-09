import { db } from "@/lib/db";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "aniverse_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuf = Buffer.from(hash, "hex");
  const testBuf = scryptSync(password, salt, 64);
  return hashBuf.length === testBuf.length && timingSafeEqual(hashBuf, testBuf);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: { token, userId, expiresAt },
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
  return token;
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }
    return session.user;
  } catch {
    return null;
  }
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  accentColor: string;
  credits: number;
  onboardingDone: boolean;
  createdAt: string;
  // customization
  pronouns: string | null;
  tagline: string | null;
  country: string | null;
  timezone: string | null;
  socialLinks: string | null;
  statusEmoji: string | null;
  statusText: string | null;
  accentTo: string | null;
  avatarFrame: string | null;
  bannerPreset: string | null;
  showcase: string | null;
  privacy: string | null;
}

export function toPublicUser(user: {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  role: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  accentColor: string;
  credits: number;
  onboardingDone: boolean;
  createdAt: Date;
  pronouns?: string | null;
  tagline?: string | null;
  country?: string | null;
  timezone?: string | null;
  socialLinks?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  accentTo?: string | null;
  avatarFrame?: string | null;
  bannerPreset?: string | null;
  showcase?: string | null;
  privacy?: string | null;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    bio: user.bio,
    accentColor: user.accentColor,
    credits: user.credits,
    onboardingDone: user.onboardingDone,
    createdAt: user.createdAt.toISOString(),
    pronouns: user.pronouns ?? null,
    tagline: user.tagline ?? null,
    country: user.country ?? null,
    timezone: user.timezone ?? null,
    socialLinks: user.socialLinks ?? null,
    statusEmoji: user.statusEmoji ?? null,
    statusText: user.statusText ?? null,
    accentTo: user.accentTo ?? null,
    avatarFrame: user.avatarFrame ?? null,
    bannerPreset: user.bannerPreset ?? null,
    showcase: user.showcase ?? null,
    privacy: user.privacy ?? null,
  };
}
