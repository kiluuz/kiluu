import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { DA_OAUTH_STATE_COOKIE, daAuthorizeUrl } from "@/lib/donationalerts";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  const fail = (code: string) => NextResponse.redirect(new URL(`/admin/payments?daError=${code}`, req.nextUrl.origin));
  if (!isAdminUser(user)) return fail("forbidden");
  if (!rateLimit(`da-connect:${user!.id}`, 10, 60_000)) return fail("rate");

  try {
    const state = randomBytes(24).toString("hex");
    const redirectUri = new URL("/api/admin/donationalerts/callback", req.nextUrl.origin).toString();
    const res = NextResponse.redirect(daAuthorizeUrl(redirectUri, state));
    res.cookies.set(DA_OAUTH_STATE_COOKIE, JSON.stringify({ state, userId: user!.id }), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch {
    return fail("config");
  }
}
