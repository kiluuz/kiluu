import { env } from "process";

const BOT_API_URL = env.ANIME_BOT_API_URL || "http://localhost:8000";
const BOT_API_KEY = env.ANIME_BOT_API_KEY || "";
export const BOT_USERNAME = env.ANIME_BOT_USERNAME || env.NEXT_PUBLIC_BOT_USERNAME || "DubAniXbot";

/** Generic fetch to Bot API with X-API-Key header.
 *  - 60 s timeout (bot may be cold-starting on free tier).
 *  - Does NOT retry by default; callers that need retry use fetchBotRetry.
 */
async function fetchBotApi(endpoint: string, options: RequestInit = {}) {
  const url = `${BOT_API_URL}${endpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set("X-API-Key", BOT_API_KEY);
  if (
    !headers.has("Content-Type") &&
    options.method !== "GET" &&
    options.method !== "HEAD"
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
    signal: options.signal || AbortSignal.timeout(60_000), // 60 s for cold-start
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Bot API ${res.status}: ${body}`);
  }

  return res.json();
}

/** Fetch with exponential-backoff retry (maxAttempts times). */
async function fetchBotRetry(
  endpoint: string,
  options: RequestInit,
  maxAttempts = 3
): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
    try {
      return await fetchBotApi(endpoint, options);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

// ─── Catalog ───────────────────────────────────────────────────────────────

export async function getBotCatalog(onlyActive = true) {
  return fetchBotApi(
    `/api/animes${!onlyActive ? "?only_active=false" : ""}`,
    { cache: "no-store" }
  );
}

export async function getBotAnime(slug: string) {
  return fetchBotApi(`/api/animes/${slug}`, {
    cache: "no-store",
  });
}

export async function updateBotAnime(slug: string, data: Record<string, unknown>) {
  return fetchBotRetry(`/api/animes/${slug}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getDeletedAnimes(): Promise<string[]> {
  try {
    const res = await fetchBotApi("/api/deleted-animes", { cache: "no-store" });
    if (Array.isArray(res)) return res;
  } catch {}
  return [];
}


// ─── Telegram account linking ──────────────────────────────────────────────

/** Returns { link, expires_in } — link opens the bot and performs account linking. */
export async function createLinkToken(siteUserId: string, token?: string) {
  return fetchBotRetry(
    `/api/link-token`,
    {
      method: "POST",
      body: JSON.stringify({ site_user_id: siteUserId, token }),
    },
    3
  );
}

export async function getUserStatus(siteUserId: string) {
  return fetchBotApi(`/api/users/${siteUserId}/status`, {
    cache: "no-store",
  } as RequestInit);
}

// ─── Stars invoice ────────────────────────────────────────────────────────

export async function createStarsInvoice(body: {
  site_user_id: string;
  kind: "CREDITS" | "ANIME";
  title: string;
  description: string;
  stars: number;
  payload: string;
  anime_slug?: string;
}) {
  return fetchBotRetry(
    `/api/invoice`,
    { method: "POST", body: JSON.stringify(body) },
    3
  );
}

export async function refundStarPaymentBot(opts: {
  telegram_id: string;
  telegram_charge_id: string;
}) {
  return fetchBotRetry(
    `/api/refund-stars`,
    { method: "POST", body: JSON.stringify(opts) },
    2
  );
}

export async function ingestEpisodeToChannel(opts: {
  slug: string;
  number: number;
  caption?: string;
  file_url?: string;
}) {
  return fetchBotRetry(
    `/api/ingest-episode`,
    { method: "POST", body: JSON.stringify(opts) },
    2
  );
}

// ─── Grant / Revoke ────────────────────────────────────────────────────────

/** Grant access. Idempotent — safe to call multiple times.
 * episodeNumber: 0 = full anime, 1..N = specific episode
 * force: re-send episodes even if already delivered
 */
export async function grantPurchase(
  siteUserId: string,
  animeSlug: string,
  episodeNumber = 0,
  force = true
) {
  return fetchBotRetry(
    `/api/grant`,
    {
      method: "POST",
      body: JSON.stringify({
        site_user_id: siteUserId,
        anime_slug: animeSlug,
        episode_number: episodeNumber || undefined,
        force,
      }),
    },
    3
  );
}

export async function revokePurchase(siteUserId: string, animeSlug: string) {
  return fetchBotRetry(
    `/api/revoke`,
    {
      method: "POST",
      body: JSON.stringify({ site_user_id: siteUserId, anime_slug: animeSlug }),
    },
    3
  );
}
