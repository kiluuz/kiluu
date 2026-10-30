import { NextRequest, NextResponse } from "next/server";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { normalizeDisplayName } from "@/lib/display-name";
import { handleBase, uniqueHandle } from "@/lib/handles";
import {
  GOOGLE_STATE_COOKIE,
  exchangeGoogleCode,
  fetchGoogleProfile,
  googleRedirectUri,
} from "@/lib/google-oauth";
import { log } from "@/lib/logger";

function sameState(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const loginUrl = new URL("/login", origin);
  const redirectHome = new URL("/", origin);

  const fail = (reason: string) => {
    loginUrl.searchParams.set("authError", reason);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    return res;
  };

  try {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const rawCookie = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;
    let stored: { state?: string; next?: string } | null = null;
    try {
      stored = rawCookie ? JSON.parse(rawCookie) : null;
    } catch {
      stored = null;
    }

    if (!code || !state || !stored?.state || !sameState(state, stored.state)) {
      return fail("google");
    }

    const accessToken = await exchangeGoogleCode({
      code,
      redirectUri: googleRedirectUri(origin),
    });
    if (!accessToken) return fail("google");

    const profile = await fetchGoogleProfile(accessToken);
    if (!profile) return fail("google");

    const existing = await db.user.findUnique({ where: { email: profile.email } });
    let userId: string;

    if (existing) {
      if (existing.deletedAt) return fail("google_disabled");
      userId = existing.id;
      if (!existing.emailVerified) {
        await db.user.update({
          where: { id: existing.id },
          data: { emailVerified: true, verifyCode: null, verifyCodeExp: null },
        });
      }
    } else {
      const username = await uniqueHandle(handleBase(profile.email, profile.name));
      const displayName =
        normalizeDisplayName(profile.name ?? "") ?? normalizeDisplayName(username) ?? username;

      const created = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: profile.email,
            username,
            password: hashPassword(randomBytes(24).toString("hex")),
            displayName,
            role: "user",
            locale: "en",
            emailVerified: true,
            credits: 100,
            onboardingDone: false,
          },
        });
        await tx.creditTransaction.create({
          data: {
            userId: user.id,
            amount: 100,
            type: "BONUS",
            description: "Welcome bonus - 100 free credits",
            idempotencyKey: `welcome-${user.id}`,
          },
        });
        return user;
      });
      userId = created.id;
    }

    await createSession(userId);

    const next = stored.next && stored.next.startsWith("/") ? stored.next : "/";
    const res = NextResponse.redirect(new URL(next, origin));
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    return res;
  } catch (e) {
    log.error("google oauth callback failed", { err: String(e) });
    return fail("google");
  }
}
