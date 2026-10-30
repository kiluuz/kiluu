const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const GOOGLE_STATE_COOKIE = "kiluu_google_state";

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl({ redirectUri, state }: { redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeGoogleCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID as string,
        client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
    return typeof data?.access_token === "string" ? data.access_token : null;
  } catch {
    return null;
  }
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile | null> {
  try {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) return null;
    const sub = typeof data.sub === "string" ? data.sub : null;
    const email = typeof data.email === "string" ? data.email.toLowerCase() : null;
    const verified = data.email_verified === true || data.email_verified === "true";
    if (!sub || !email || !verified) return null;
    return {
      sub,
      email,
      name: typeof data.name === "string" ? data.name : null,
    };
  } catch {
    return null;
  }
}
