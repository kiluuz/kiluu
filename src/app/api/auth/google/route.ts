import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthUrl,
  googleOAuthConfigured,
  googleRedirectUri,
} from "@/lib/google-oauth";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const loginUrl = new URL("/login", origin);

  if (!googleOAuthConfigured()) {
    loginUrl.searchParams.set("authError", "google_unavailable");
    return NextResponse.redirect(loginUrl);
  }
  if (!rateLimit(rateKey(req, "google-oauth"), 20, 60_000)) {
    loginUrl.searchParams.set("authError", "google_rate");
    return NextResponse.redirect(loginUrl);
  }

  const state = randomBytes(24).toString("hex");
  const nextParam = req.nextUrl.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") && !nextParam.startsWith("/\\")
      ? nextParam.slice(0, 300)
      : "/";

  const res = NextResponse.redirect(
    buildGoogleAuthUrl({ redirectUri: googleRedirectUri(origin), state })
  );
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
