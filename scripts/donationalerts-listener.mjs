#!/usr/bin/env node
/**
 * Kiluu ⇄ DonationAlerts realtime listener.
 *
 * Long-running process (Render background worker / any Node >=22 host).
 * It never holds the DA app secret: it asks the web app for short-lived
 * socket/subscription tokens (guarded by DONATIONALERTS_INGEST_SECRET) and
 * forwards donations with an HMAC-signed webhook.
 *
 * Required env:
 *   KILUU_APP_URL                 e.g. https://kiluu.vercel.app
 *   DONATIONALERTS_INGEST_SECRET  same value as on Vercel
 * Optional env:
 *   DA_SYNC_INTERVAL_MS           default 300000 (5 min)
 */
import { createHmac } from "node:crypto";

const APP_URL = (process.env.KILUU_APP_URL || "").replace(/\/+$/, "");
const SECRET = process.env.DONATIONALERTS_INGEST_SECRET || "";
const SYNC_INTERVAL_MS = Math.max(60_000, Number(process.env.DA_SYNC_INTERVAL_MS || 300_000));
const HEARTBEAT_MS = 25_000;

if (!APP_URL || !SECRET) {
  console.error("[da-listener] KILUU_APP_URL and DONATIONALERTS_INGEST_SECRET are required");
  process.exit(1);
}

let socket = null;
let heartbeat = null;
let reconnectTimer = null;
let stopped = false;
let backoff = 5_000;

function log(msg, extra = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), msg, ...extra }));
}

function logError(msg, extra = {}) {
  console.error(JSON.stringify({ ts: new Date().toISOString(), msg, ...extra }));
}

async function appFetch(path, init = {}) {
  const res = await fetch(`${APP_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-da-secret": SECRET,
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new Error(`${path} -> ${res.status}${json && json.error ? ` ${json.error}` : ""}`);
  }
  return json;
}

function sign(timestamp, body) {
  return createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");
}

async function forwardDonation(donation) {
  const body = JSON.stringify({ donation });
  const timestamp = Math.floor(Date.now() / 1000);
  const res = await fetch(`${APP_URL}/api/webhooks/donationalerts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-da-timestamp": String(timestamp),
      "x-da-signature": sign(timestamp, body),
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`webhook -> ${res.status}${json && json.error ? ` ${json.error}` : ""}`);
  log("donation forwarded", {
    donationId: donation && donation.id,
    status: json && json.status,
    credits: json && json.creditsGranted,
  });
}

function cleanupSocket() {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
  socket = null;
}

function scheduleReconnect() {
  if (stopped) return;
  if (reconnectTimer) return;
  log("reconnecting", { inMs: backoff });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoff);
  backoff = Math.min(60_000, backoff * 2);
}

function handlePublication(payload) {
  const donation = payload && payload.data && payload.data.data ? payload.data.data : payload && payload.data;
  if (!donation || typeof donation !== "object") return;
  forwardDonation(donation).catch((error) => logError("forward failed", { error: String(error) }));
}

async function connect() {
  if (stopped) return;
  let session;
  try {
    session = await appFetch("/api/internal/donationalerts/session");
  } catch (error) {
    logError("session failed", { error: String(error) });
    scheduleReconnect();
    return;
  }

  const ws = new WebSocket(session.wsUrl);
  socket = ws;

  ws.addEventListener("open", () => {
    log("socket open");
    ws.send(JSON.stringify({ id: 1, params: { token: session.socketToken } }));
  });

  ws.addEventListener("message", (event) => {
    const raw = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
    if (raw === "{}") {
      try {
        ws.send("{}");
      } catch {
        /* socket already closing */
      }
      return;
    }
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.id === 1 && msg.result && msg.result.client) {
      const client = msg.result.client;
      appFetch("/api/internal/donationalerts/subscribe", {
        method: "POST",
        body: JSON.stringify({ client }),
      })
        .then((result) => {
          const channels = Array.isArray(result && result.channels) ? result.channels : [];
          const channel = channels.find((c) => c.channel === session.channel) || channels[0];
          if (!channel || !channel.token) throw new Error("no subscription token");
          ws.send(
            JSON.stringify({
              id: 2,
              method: 1,
              params: { channel: channel.channel, token: channel.token },
            })
          );
          backoff = 5_000;
          log("subscribed", { channel: channel.channel });
        })
        .catch((error) => {
          logError("subscribe failed", { error: String(error) });
          try {
            ws.close();
          } catch {
            /* ignore */
          }
        });
      return;
    }

    if (msg.id === 1 && msg.error) {
      logError("connect rejected", { error: msg.error });
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      return;
    }

    if (msg.result && msg.result.channel) {
      handlePublication(msg.result);
    }
  });

  ws.addEventListener("close", () => {
    cleanupSocket();
    if (!stopped) scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  });

  heartbeat = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send("{}");
      } catch {
        /* ignore */
      }
    }
  }, HEARTBEAT_MS);
}

async function syncDonations() {
  try {
    const result = await appFetch("/api/internal/donationalerts/sync", { method: "POST", body: "{}" });
    log("donation sync", result || {});
  } catch (error) {
    logError("donation sync failed", { error: String(error) });
  }
}

function shutdown(signal) {
  stopped = true;
  log("shutting down", { signal });
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  }
  cleanupSocket();
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

log("listener starting", { app: APP_URL });
connect();
syncDonations();
setInterval(syncDonations, SYNC_INTERVAL_MS);
