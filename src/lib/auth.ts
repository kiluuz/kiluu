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

export type PublicUser = {
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
};

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
  };
}
