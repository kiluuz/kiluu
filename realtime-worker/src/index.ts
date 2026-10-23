/**
 * Kiluu Real-time Worker
 * Cloudflare Workers + Durable Objects (WebSocket Hibernation API)
 *
 * Arxitektura:
 *   GET  /ws/:roomId?token=JWT  → brauzer WebSocket ulanadi
 *   POST /push/:roomId          → Vercel xabar tarqatadi (Bearer auth)
 *   scheduled()                 → har daqiqa Vercel cron chaqiradi
 */

export interface Env {
  CHAT_ROOM: DurableObjectNamespace;
  REALTIME_JWT_SECRET: string;
  REALTIME_PUSH_SECRET: string;
  REALTIME_ALLOWED_ORIGINS: string;
  SITE_API_URL: string;
  CRON_SECRET: string;
}

// ─── JWT tekshirish (HS256) ───────────────────────────────────────────────
async function verifyJwt(
  token: string,
  secret: string
): Promise<{ userId: string; roomId: string; role: string; level: number } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sig, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── Main Worker ──────────────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS
    const origin = request.headers.get("Origin") ?? "";
    const allowedOrigins = env.REALTIME_ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const path = url.pathname;

    // GET /ws/:roomId — WebSocket ulanish
    if (path.startsWith("/ws/")) {
      const roomId = path.slice(4);
      if (!roomId) return new Response("roomId required", { status: 400 });

      const token = url.searchParams.get("token");
      if (!token) return new Response("token required", { status: 401 });

      const payload = await verifyJwt(token, env.REALTIME_JWT_SECRET);
      if (!payload) return new Response("Invalid or expired token", { status: 401 });
      if (payload.roomId !== roomId) return new Response("Token room mismatch", { status: 403 });

      // Upgrade to WebSocket
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }

      const id = env.CHAT_ROOM.idFromName(roomId);
      const stub = env.CHAT_ROOM.get(id);
      // Attach user info to request
      const newReq = new Request(request.url, {
        headers: {
          ...Object.fromEntries(request.headers),
          "X-User-Id": payload.userId,
          "X-User-Role": payload.role,
          "X-User-Level": String(payload.level),
        },
      });
      return stub.fetch(newReq);
    }

    // POST /push/:roomId — Vercel dan xabar tarqatish
    if (path.startsWith("/push/") && request.method === "POST") {
      const authHeader = request.headers.get("Authorization") ?? "";
      if (authHeader !== `Bearer ${env.REALTIME_PUSH_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }
      const roomId = path.slice(6);
      if (!roomId) return new Response("roomId required", { status: 400 });

      const id = env.CHAT_ROOM.idFromName(roomId);
      const stub = env.CHAT_ROOM.get(id);
      return stub.fetch(request);
    }

    // Health check
    if (path === "/health") {
      return Response.json({ ok: true, ts: Date.now() }, { headers: corsHeaders });
    }

    return new Response("Not Found", { status: 404 });
  },

  // Cron: har daqiqa Vercel cron endpointlarini chaqiradi
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const headers = { Authorization: `Bearer ${env.CRON_SECRET}` };
    const siteUrl = env.SITE_API_URL.replace(/\/+$/, "");

    try {
      await fetch(`${siteUrl}/api/cron/schedule-notifications`, {
        method: "POST",
        headers,
      });
    } catch (e) {
      console.error("Schedule cron failed:", e);
    }

    // Kunlik va retention tozalash
    try {
      await fetch(`${siteUrl}/api/cron/daily-reset`, {
        method: "POST",
        headers,
      });
    } catch (e) {
      console.error("Daily reset cron failed:", e);
    }
  },
};

// ─── ChatRoom Durable Object ─────────────────────────────────────────────
export class ChatRoom {
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
    // Hibernation API — bo'sh xonalar CPU ishlatmaydi
    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket ulanish
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = request.headers.get("X-User-Id") ?? "anon";
      const role = request.headers.get("X-User-Role") ?? "member";

      // Hibernation API — xona bo'sh bo'lganda Worker uxlaydi
      this.state.acceptWebSocket(server, [userId, role]);

      // Salomlashuv xabari va xonadagi faol userlar ro'yxati
      const allSockets = this.state.getWebSockets();
      const onlineUserIds = Array.from(new Set(allSockets.map((s) => this.state.getTags(s)[0]).filter(Boolean)));
      server.send(JSON.stringify({ type: "room_presence", userIds: onlineUserIds, count: onlineUserIds.length }));

      // Boshqa a'zolarga yangi foydalanuvchi online bo'lganini tarqatish
      if (userId && userId !== "anon") {
        const joinPayload = JSON.stringify({ type: "presence", userId, online: true, ts: Date.now() });
        for (const socket of allSockets) {
          if (socket !== server) {
            try {
              socket.send(joinPayload);
            } catch {
              // ignore
            }
          }
        }
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    // POST /push/:roomId — tarqatish
    if (request.method === "POST") {
      let message: unknown;
      try {
        message = await request.json();
      } catch {
        return new Response("Invalid JSON", { status: 400 });
      }

      const payload = JSON.stringify(message);
      const sockets = this.state.getWebSockets();

      for (const ws of sockets) {
        try {
          ws.send(payload);
        } catch {
          // Ulanish uzilgan — ignore
        }
      }

      return Response.json({ sent: sockets.length });
    }

    return new Response("Not found", { status: 404 });
  }

  // WebSocket Hibernation API handlerlari
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    const tags = this.state.getTags(ws);
    const userId = tags[0] ?? "anon";

    try {
      const data = JSON.parse(typeof message === "string" ? message : "{}");

      // Faqat typing/presence/ping qabul qilinadi — boshqasi Vercel orqali
      if (data.type === "typing") {
        // Boshqa a'zolarga typing indicator tarqatish
        const payload = JSON.stringify({ type: "typing", userId, ts: Date.now() });
        for (const socket of this.state.getWebSockets()) {
          if (socket !== ws) {
            try {
              socket.send(payload);
            } catch {
              // ignore
            }
          }
        }
      }
      // ping — autoResponse bilan "pong" qaytariladi (setWebSocketAutoResponse yuqorida)
    } catch {
      // invalid JSON — ignore
    }
  }

  webSocketClose(ws: WebSocket, _code: number, _reason: string): void {
    const tags = this.state.getTags(ws);
    const userId = tags[0] ?? "anon";

    // Agar foydalanuvchining boshqa faol ulanishi bo'lmasa, oflayn deb tarqatamiz
    const allSockets = this.state.getWebSockets();
    const hasOtherSocket = allSockets.some((s) => s !== ws && this.state.getTags(s)[0] === userId);

    if (!hasOtherSocket && userId && userId !== "anon") {
      const payload = JSON.stringify({ type: "presence", userId, online: false, ts: Date.now() });
      for (const socket of allSockets) {
        if (socket !== ws) {
          try {
            socket.send(payload);
          } catch {
            // ignore
          }
        }
      }
    }
  }

  webSocketError(_ws: WebSocket, _error: unknown): void {
    // log qilish uchun — ignore
  }
}
