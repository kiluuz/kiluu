import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import {
  DA_OAUTH_STATE_COOKIE,
  daExchangeCode,
  daFetchProfile,
  daStoreAuth,
  timingSafeEqualText,
} from "@/lib/donationalerts";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/admin/payments?daError=${code}`, req.nextUrl.origin));
    res.cookies.delete(DA_OAUTH_STATE_COOKIE);
    return res;
  };

  const user = await getCurrentUser();
  if (!isAdminUser(user)) return fail("forbidden");

  const rawState = req.cookies.get(DA_OAUTH_STATE_COOKIE)?.value;
  if (!rawState) return fail("state");
  let saved: { state?: unknown; userId?: unknown };
  try {
    saved = JSON.parse(rawState) as { state?: unknown; userId?: unknown };
  } catch {
    return fail("state");
  }
  const state = req.nextUrl.searchParams.get("state") || "";
  if (
    typeof saved.state !== "string" ||
    typeof saved.userId !== "string" ||
    saved.userId !== user!.id ||
    !timingSafeEqualText(state, saved.state)
  ) {
    return fail("state");
  }
  if (req.nextUrl.searchParams.get("error")) return fail("denied");
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return fail("denied");

  try {
    const redirectUri = new URL("/api/admin/donationalerts/callback", req.nextUrl.origin).toString();
    const tokens = await daExchangeCode(code, redirectUri);
    const profile = await daFetchProfile(tokens.accessToken);
    await daStoreAuth(tokens, profile, user!.id);
    const res = NextResponse.redirect(new URL("/admin/payments?da=connected", req.nextUrl.origin));
    res.cookies.delete(DA_OAUTH_STATE_COOKIE);
    return res;
  } catch (error) {
    log.error("donationalerts oauth callback failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fail("exchange");
  }
}
