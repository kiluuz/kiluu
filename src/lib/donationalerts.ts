import { createHmac, randomInt } from "crypto";
import { db } from "@/lib/db";
import { open, seal, sealingReady } from "@/lib/sealed";
import { log } from "@/lib/logger";

const DA_API = "https://www.donationalerts.com";
export const DA_WS_URL = "wss://centrifugo.donationalerts.com/connection/websocket";
export const DA_OAUTH_STATE_COOKIE = "da_oauth_state";
const DA_SCOPES = ["oauth-user-show", "oauth-donation-subscribe", "oauth-donation-index"];
const INTENT_TTL_MS = 30 * 60_000;
const MAX_PENDING_INTENTS = 3;
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export class DonationAlertsError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DonationAlertsError";
    this.code = code;
    this.status = status;
  }
}

export function daClientId(): string {
  return (process.env.DONATIONALERTS_CLIENT_ID || "").trim();
}

function daClientSecret(): string {
  return (process.env.DONATIONALERTS_CLIENT_SECRET || "").trim();
}

export function daIngestSecret(): string {
  return (process.env.DONATIONALERTS_INGEST_SECRET || "").trim();
}

export function daCurrency(): string {
  return (process.env.DONATIONALERTS_CURRENCY || "RUB").trim().toUpperCase() || "RUB";
}

export function daDonationUrl(): string {
  return (process.env.DONATIONALERTS_DONATION_URL || "https://www.donationalerts.com/r/kiluu").trim();
}

export function daConfigState() {
  return {
    clientId: Boolean(daClientId()),
    clientSecret: Boolean(daClientSecret()),
    tokenKey: sealingReady(),
    ingestSecret: Boolean(daIngestSecret()),
    currency: daCurrency(),
    donationUrl: daDonationUrl(),
  };
}

function requireConfig() {
  const state = daConfigState();
  if (!state.clientId || !state.clientSecret || !state.tokenKey) {
    throw new DonationAlertsError("NOT_CONFIGURED", "DonationAlerts environment is not configured", 503);
  }
}

/* ------------------------------- OAuth ------------------------------- */

export function daAuthorizeUrl(redirectUri: string, state: string): string {
  requireConfig();
  const params = new URLSearchParams({
    client_id: daClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: DA_SCOPES.join(" "),
    state,
  });
  return `${DA_API}/oauth/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}

function parseTokenResponse(json: TokenResponse, fallbackRefresh?: string) {
  const accessToken = typeof json.access_token === "string" ? json.access_token : "";
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : fallbackRefresh || "";
  if (!accessToken || !refreshToken) {
    throw new DonationAlertsError("TOKEN_INVALID", "DonationAlerts returned an invalid token response", 502);
  }
  const ttl = Number(json.expires_in);
  const lifetime = Number.isFinite(ttl) && ttl > 0 ? Math.max(60, ttl - 60) : 3540;
  return { accessToken, refreshToken, lifetime };
}

async function tokenRequest(body: URLSearchParams): Promise<TokenResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${DA_API}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: body.toString(),
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) throw new DonationAlertsError("TOKEN_HTTP", `DonationAlerts token error (${res.status})`, 502);
    return text ? (JSON.parse(text) as TokenResponse) : {};
  } finally {
    clearTimeout(timer);
  }
}

export async function daExchangeCode(code: string, redirectUri: string) {
  requireConfig();
  const json = await tokenRequest(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: daClientId(),
      client_secret: daClientSecret(),
      code,
      redirect_uri: redirectUri,
    })
  );
  return parseTokenResponse(json);
}

async function daRefreshToken(refreshToken: string) {
  requireConfig();
  const json = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: daClientId(),
      client_secret: daClientSecret(),
      refresh_token: refreshToken,
    })
  );
  return parseTokenResponse(json, refreshToken);
}

export async function daFetchProfile(accessToken: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${DA_API}/api/v1/user/oauth`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new DonationAlertsError("PROFILE_HTTP", `DonationAlerts profile error (${res.status})`, 502);
    const json = (await res.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
    const data = (json.data && typeof json.data === "object" ? json.data : json) as Record<string, unknown>;
    const id = data.id;
    const socketToken = data.socket_connection_token;
    if ((typeof id !== "number" && typeof id !== "string") || typeof socketToken !== "string" || !socketToken) {
      throw new DonationAlertsError("PROFILE_INVALID", "DonationAlerts profile is missing required fields", 502);
    }
    return {
      id: String(id),
      name: typeof data.name === "string" ? data.name : null,
      socketToken,
    };
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------- token storage --------------------------- */

export interface DaAuthRecord {
  daUserId: string;
  daUserName: string | null;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
}

export async function daReadAuth(): Promise<DaAuthRecord | null> {
  const row = await db.donationAlertsAuth.findUnique({ where: { id: "primary" } });
  if (!row) return null;
  return {
    daUserId: row.daUserId,
    daUserName: row.daUserName,
    accessToken: open(row.accessToken),
    refreshToken: open(row.refreshToken),
    accessExpiresAt: row.accessExpiresAt,
  };
}

export async function daStoreAuth(
  tokens: { accessToken: string; refreshToken: string; lifetime: number },
  profile: { id: string; name: string | null },
  adminId: string | null
) {
  const expiresAt = new Date(Date.now() + tokens.lifetime * 1000);
  const data = {
    daUserId: profile.id,
    daUserName: profile.name,
    accessToken: seal(tokens.accessToken),
    refreshToken: seal(tokens.refreshToken),
    accessExpiresAt: expiresAt,
  };
  await db.donationAlertsAuth.upsert({
    where: { id: "primary" },
    create: { id: "primary", ...data, connectedById: adminId },
    update: adminId ? { ...data, connectedById: adminId } : data,
  });
  log.info("donationalerts account connected", { daUserId: profile.id });
}

export async function daDisconnect() {
  await db.donationAlertsAuth.deleteMany({ where: { id: "primary" } });
  log.warn("donationalerts account disconnected");
}

let refreshInFlight: Promise<DaAuthRecord> | null = null;

export async function daAccessToken(): Promise<{ token: string; auth: DaAuthRecord }> {
  requireConfig();
  const auth = await daReadAuth();
  if (!auth) throw new DonationAlertsError("NOT_CONNECTED", "DonationAlerts account is not connected", 409);
  if (auth.accessExpiresAt.getTime() > Date.now() + 120_000) {
    return { token: auth.accessToken, auth };
  }
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const renewed = await daRefreshToken(auth.refreshToken);
      const accessExpiresAt = new Date(Date.now() + renewed.lifetime * 1000);
      await db.donationAlertsAuth.update({
        where: { id: "primary" },
        data: {
          accessToken: seal(renewed.accessToken),
          refreshToken: seal(renewed.refreshToken),
          accessExpiresAt,
        },
      });
      log.info("donationalerts access token refreshed");
      return { ...auth, accessToken: renewed.accessToken, refreshToken: renewed.refreshToken, accessExpiresAt };
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  const refreshed = await refreshInFlight;
  return { token: refreshed.accessToken, auth: refreshed };
}

/* ------------------------- websocket plumbing ------------------------- */

export async function daSocketSession() {
  const { token, auth } = await daAccessToken();
  const profile = await daFetchProfile(token);
  if (profile.id !== auth.daUserId) {
    throw new DonationAlertsError("ACCOUNT_MISMATCH", "Connected DonationAlerts account changed; reconnect required", 409);
  }
  return {
    wsUrl: DA_WS_URL,
    socketToken: profile.socketToken,
    channel: `$alerts:donation_${auth.daUserId}`,
    daUserId: auth.daUserId,
  };
}

export async function daSubscribeTokens(client: string) {
  if (!client || client.length > 128) {
    throw new DonationAlertsError("BAD_CLIENT", "Invalid Centrifugo client id", 400);
  }
  const { token, auth } = await daAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${DA_API}/api/v1/centrifuge/subscribe`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ client, channels: [`$alerts:donation_${auth.daUserId}`] }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new DonationAlertsError("SUBSCRIBE_HTTP", `DonationAlerts subscribe error (${res.status})`, 502);
    const json = (await res.json()) as { channels?: Array<{ channel?: unknown; token?: unknown }> };
    const channels = Array.isArray(json.channels) ? json.channels : [];
    return channels
      .filter((c) => typeof c.channel === "string" && typeof c.token === "string")
      .map((c) => ({ channel: c.channel as string, token: c.token as string }));
  } finally {
    clearTimeout(timer);
  }
}

export async function daListDonations(page = 1) {
  const { token } = await daAccessToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${DA_API}/api/v1/alerts/donations?page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new DonationAlertsError("DONATIONS_HTTP", `DonationAlerts donations error (${res.status})`, 502);
    const json = (await res.json()) as { data?: unknown } | unknown[];
    if (Array.isArray(json)) return json;
    return Array.isArray((json as { data?: unknown }).data) ? ((json as { data: unknown[] }).data) : [];
  } finally {
    clearTimeout(timer);
  }
}

export async function daConnectionSummary() {
  const configured = daConfigState();
  const base = { configured, connected: false, account: null as null | Record<string, unknown> };
  if (!configured.clientId || !configured.clientSecret || !configured.tokenKey) return base;
  const row = await db.donationAlertsAuth.findUnique({
    where: { id: "primary" },
    select: { daUserId: true, daUserName: true, accessExpiresAt: true, connectedAt: true, updatedAt: true },
  });
  if (!row) return base;
  return {
    configured,
    connected: true,
    account: {
      daUserId: row.daUserId,
      daUserName: row.daUserName,
      accessExpiresAt: row.accessExpiresAt.toISOString(),
      connectedAt: row.connectedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

/* ----------------------------- intents ----------------------------- */

const CODE_RE = /\bKL[\s-]*([0-9A-HJKMNP-TV-Z]{4})[\s-]*([0-9A-HJKMNP-TV-Z]{4})\b/;

export function generateIntentCode(): string {
  let out = "KL";
  for (let i = 0; i < 8; i += 1) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export function formatIntentCode(code: string): string {
  const normalized = code.toUpperCase().replace(/^KL/, "").replace(/[^0-9A-Z]/g, "").slice(0, 8);
  return `KL-${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
}

export function extractIntentCode(message: string | null | undefined): string | null {
  if (!message) return null;
  const match = message.toUpperCase().match(CODE_RE);
  return match ? `KL${match[1]}${match[2]}` : null;
}

export interface DonationIntentView {
  id: string;
  code: string;
  amountMinor: number;
  credits: number;
  currency: string;
  status: string;
  expiresAt: string;
  donateUrl: string;
  creditsGranted: number | null;
}

function intentView(intent: {
  id: string;
  code: string;
  amountMinor: number;
  credits: number;
  status: string;
  expiresAt: Date;
  creditsGranted?: number | null;
}): DonationIntentView {
  return {
    id: intent.id,
    code: formatIntentCode(intent.code),
    amountMinor: intent.amountMinor,
    credits: intent.credits,
    currency: daCurrency(),
    status: intent.status,
    expiresAt: intent.expiresAt.toISOString(),
    donateUrl: daDonationUrl(),
    creditsGranted: intent.creditsGranted ?? null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && typeof error === "object" && (error as { code?: string }).code === "P2002";
}

export async function createDonationIntent(userId: string, packageId: string): Promise<DonationIntentView> {
  const pkg = await db.creditPackage.findFirst({ where: { id: packageId, active: true } });
  if (!pkg || pkg.priceDa <= 0) {
    throw new DonationAlertsError("INVALID_PACKAGE", "Invalid credit package", 400);
  }
  const now = new Date();
  await db.donationIntent.updateMany({
    where: { userId, status: "pending", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
  const existing = await db.donationIntent.findFirst({
    where: { userId, packageId: pkg.id, status: "pending", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return intentView(existing);

  const pending = await db.donationIntent.count({
    where: { userId, status: "pending", expiresAt: { gt: now } },
  });
  if (pending >= MAX_PENDING_INTENTS) {
    throw new DonationAlertsError("TOO_MANY_PENDING", "Too many active payment codes", 429);
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const created = await db.donationIntent.create({
        data: {
          userId,
          packageId: pkg.id,
          code: generateIntentCode(),
          amountMinor: pkg.priceDa * 100,
          credits: pkg.credits + pkg.bonus,
          expiresAt: new Date(Date.now() + INTENT_TTL_MS),
        },
      });
      return intentView(created);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new DonationAlertsError("CODE_CONFLICT", "Could not allocate a payment code", 500);
}

export async function getDonationIntentForUser(userId: string, intentId: string): Promise<DonationIntentView> {
  const intent = await db.donationIntent.findFirst({ where: { id: intentId, userId } });
  if (!intent) throw new DonationAlertsError("NOT_FOUND", "Payment code not found", 404);
  if (intent.status === "pending" && intent.expiresAt.getTime() < Date.now()) {
    await db.donationIntent.updateMany({ where: { id: intent.id, status: "pending" }, data: { status: "expired" } });
    return intentView({ ...intent, status: "expired" });
  }
  return intentView(intent);
}

/* --------------------------- donation ingest --------------------------- */

export interface NormalizedDonation {
  donationId: string;
  amountMinor: number;
  currency: string;
  message: string | null;
  donorName: string | null;
  recipientId: string | null;
  createdAt: Date;
}

export function normalizeDonation(raw: unknown): NormalizedDonation | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rawId = r.id ?? r.donation_id;
  if (rawId === undefined || rawId === null) return null;
  const donationId = String(rawId).trim();
  if (!/^\d{1,20}$/.test(donationId)) return null;

  let amount = r.amount;
  if (typeof amount === "string") amount = Number(amount.replace(",", "."));
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  const amountMinor = Math.round(amount * 100);
  if (amountMinor <= 0 || amountMinor > 10_000_000_000) return null;

  const currency = typeof r.currency === "string" ? r.currency.trim().toUpperCase().slice(0, 8) : "";
  if (!currency) return null;

  const messageRaw = typeof r.message === "string" ? r.message : null;
  const message = messageRaw ? messageRaw.slice(0, 500) : null;
  const donorName =
    typeof r.name === "string" ? r.name.slice(0, 80) : typeof r.username === "string" ? r.username.slice(0, 80) : null;
  const recipient = r.recipient && typeof r.recipient === "object" ? (r.recipient as Record<string, unknown>) : null;
  const recipientId = recipient?.user_id !== undefined && recipient?.user_id !== null ? String(recipient.user_id) : null;

  const createdRaw = typeof r.created_at === "string" ? r.created_at : null;
  const parsed = createdRaw ? new Date(createdRaw) : null;
  const createdAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();

  return { donationId, amountMinor, currency, message, donorName, recipientId, createdAt };
}

export interface ProcessDonationResult {
  ok: boolean;
  status: "processed" | "duplicate" | "unmatched" | "expired" | "ignored" | "wrong_currency" | "invalid" | "not_connected";
  creditsGranted?: number;
  error?: string;
}

export async function processDonation(raw: unknown, source: "socket" | "sync"): Promise<ProcessDonationResult> {
  const donation = normalizeDonation(raw);
  if (!donation) return { ok: false, status: "invalid", error: "Invalid donation payload" };

  const auth = await daReadAuth();
  if (!auth) return { ok: false, status: "not_connected", error: "DonationAlerts is not connected" };

  if (donation.recipientId !== null && donation.recipientId !== auth.daUserId) {
    return { ok: false, status: "ignored", error: "Recipient mismatch" };
  }

  const expectedCurrency = daCurrency();
  const code = extractIntentCode(donation.message);

  try {
    return await db.$transaction(async (tx): Promise<ProcessDonationResult> => {
      await tx.donationEvent.create({
        data: {
          donationId: donation.donationId,
          amountMinor: donation.amountMinor,
          currency: donation.currency,
          message: donation.message,
          donorName: donation.donorName,
          status: "ignored",
          createdAt: donation.createdAt,
        },
      });

      const settle = async (status: ProcessDonationResult["status"], reason: string | null) => {
        await tx.donationEvent.update({
          where: { donationId: donation.donationId },
          data: { status, reason },
        });
        return { ok: status === "processed", status } as ProcessDonationResult;
      };

      if (donation.currency !== expectedCurrency) {
        return settle("wrong_currency", `Currency ${donation.currency} (expected ${expectedCurrency})`);
      }
      if (!code) return settle("unmatched", "No payment code in message");

      const intent = await tx.donationIntent.findUnique({ where: { code } });
      if (!intent) return settle("unmatched", "Unknown payment code");
      if (intent.status === "completed") return settle("ignored", "Payment code already used");
      if (intent.status !== "pending") return settle("ignored", `Payment code is ${intent.status}`);
      if (donation.createdAt.getTime() > intent.expiresAt.getTime() + 2 * 60_000) {
        return settle("expired", "Donation sent after the code expired");
      }

      const granted =
        donation.amountMinor >= intent.amountMinor
          ? intent.credits
          : Math.floor((intent.credits * donation.amountMinor) / intent.amountMinor);
      if (granted < 1) return settle("ignored", "Amount is too small");

      const claimed = await tx.donationIntent.updateMany({
        where: { id: intent.id, status: "pending" },
        data: {
          status: "completed",
          donationId: donation.donationId,
          donatedMinor: donation.amountMinor,
          creditsGranted: granted,
          completedAt: new Date(),
        },
      });
      if (claimed.count === 0) return settle("ignored", "Payment code was already claimed");

      await tx.creditTransaction.create({
        data: {
          userId: intent.userId,
          amount: granted,
          type: "TOPUP",
          description: `DonationAlerts top-up ${formatIntentCode(intent.code)}`,
          refType: "donation_alerts",
          refId: donation.donationId,
          idempotencyKey: `da-${donation.donationId}`,
        },
      });
      await tx.user.update({
        where: { id: intent.userId },
        data: { credits: { increment: granted } },
      });
      await tx.donationEvent.update({
        where: { donationId: donation.donationId },
        data: { status: "processed", intentId: intent.id, reason: source },
      });
      log.info("donation credited", {
        donationId: donation.donationId,
        intentId: intent.id,
        credits: granted,
        amountMinor: donation.amountMinor,
      });
      return { ok: true, status: "processed", creditsGranted: granted };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: true, status: "duplicate" };
    }
    throw error;
  }
}

export async function syncDonationAlerts(page = 1) {
  const rows = await daListDonations(page);
  let processed = 0;
  let duplicates = 0;
  let unmatched = 0;
  for (const row of rows.slice(0, 25)) {
    const result = await processDonation(row, "sync");
    if (result.status === "processed") processed += 1;
    else if (result.status === "duplicate") duplicates += 1;
    else if (result.status === "unmatched") unmatched += 1;
  }
  return { scanned: Math.min(rows.length, 25), processed, duplicates, unmatched };
}

/** Constant-time string comparison for shared secrets and HMAC hex digests. */
export function timingSafeEqualText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function daSignPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** Listener → app webhook: HMAC over "<unix-ts>.<raw-body>", ±5 min window. */
export function daVerifyPayload(secret: string, timestamp: string, body: string, signature: string): boolean {
  if (!secret || !/^\d{1,12}$/.test(timestamp) || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  const ts = Number(timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > 300) return false;
  return timingSafeEqualText(daSignPayload(secret, ts, body), signature.toLowerCase());
}
