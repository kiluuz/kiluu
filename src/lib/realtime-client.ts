// src/lib/realtime-client.ts
// DubAniX Real-time Client (Cloudflare WebSocket + Polling Fallback + Leader Tab)

export type RealtimeStatus = "connected" | "polling" | "connecting" | "disconnected";

export interface ChatMessagePayload {
  id: string;
  roomId: string;
  body: string;
  type: string;
  isDeleted?: boolean;
  attachmentUrl?: string | null;
  replyTo?: { id: string; body: string; username: string } | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string | null;
    avatarFrame?: string | null;
    role: string;
    level: number;
    titleJa: string;
    titleUz: string;
    clubTag?: string | null;
  };
  animeCard?: any;
  spoiler?: { animeId: string; episodeNo: number; hidden: boolean } | null;
  poll?: any;
  reactions?: Record<string, { count: number; users: string[]; hasReacted: boolean }>;
  isPinned?: boolean;
  createdAt: string | Date;
  editedAt?: string | Date | null;
}

export type MessageHandler = (data: any) => void;
export type StatusHandler = (status: RealtimeStatus) => void;

class RealtimeRoomManager {
  private roomId: string;
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = "disconnected";
  private messageHandlers = new Set<MessageHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private pollTimer: any = null;
  private lastMessageTime = new Date().toISOString();
  private isDestroyed = false;
  private channel: BroadcastChannel | null = null;
  private isLeader = false;
  private heartbeatTimer: any = null;
  private hiddenTimeout: any = null;
  private reconnectTimer: any = null;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.initBroadcastChannel();
    this.setupVisibilityListener();
  }

  public subscribe(onMessage: MessageHandler, onStatus?: StatusHandler) {
    this.messageHandlers.add(onMessage);
    if (onStatus) {
      this.statusHandlers.add(onStatus);
      onStatus(this.status);
    }

    if (this.status === "disconnected") {
      this.connect();
    }

    return () => {
      this.messageHandlers.delete(onMessage);
      if (onStatus) this.statusHandlers.delete(onStatus);
      if (this.messageHandlers.size === 0) {
        this.destroy();
      }
    };
  }

  private setStatus(newStatus: RealtimeStatus) {
    if (this.status === newStatus) return;
    this.status = newStatus;
    for (const h of this.statusHandlers) h(newStatus);
  }

  private emitMessage(msg: any) {
    for (const h of this.messageHandlers) h(msg);
  }

  private initBroadcastChannel() {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    try {
      this.channel = new BroadcastChannel(`kiluu_rt_${this.roomId}`);
      this.channel.onmessage = (event) => {
        const { type, payload } = event.data || {};
        if (type === "MESSAGE") {
          this.emitMessage(payload);
        } else if (type === "STATUS") {
          if (!this.isLeader) {
            this.setStatus(payload);
          }
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel not supported or blocked:", e);
    }
  }

  private setupVisibilityListener() {
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Tab 5 daqiqa yashirin tursa uzish (Durable Object duration tejash)
        this.hiddenTimeout = setTimeout(() => {
          if (document.hidden && !this.isDestroyed) {
            this.disconnectWs();
            this.stopPolling();
            this.setStatus("disconnected");
          }
        }, 5 * 60 * 1000);
      } else {
        if (this.hiddenTimeout) {
          clearTimeout(this.hiddenTimeout);
          this.hiddenTimeout = null;
        }
        if (this.status === "disconnected" && !this.isDestroyed) {
          this.connect();
        }
      }
    });
  }

  public async connect() {
    if (this.isDestroyed) return;
    this.setStatus("connecting");

    // Force polling if requested via env
    if (process.env.NEXT_PUBLIC_REALTIME_PROVIDER === "polling") {
      this.startPolling();
      return;
    }

    try {
      // 1. Vercel dan WebSocket JWT token olish
      const tokenRes = await fetch("/api/chat/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: this.roomId }),
      });

      if (!tokenRes.ok) {
        // Token olib bo'lmadi — polling rejimiga fallback
        this.startPolling();
        return;
      }

      const { token } = await tokenRes.json();
      if (!token) {
        this.startPolling();
        return;
      }

      // 2. Cloudflare Worker WebSocket ga ulanish
      const wsBase =
        process.env.NEXT_PUBLIC_REALTIME_WS_URL ||
        "wss://kiluu-realtime.workers.dev";
      const wsUrl = `${wsBase.replace(/\/+$/, "")}/ws/${encodeURIComponent(this.roomId)}?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isDestroyed) {
          this.ws?.close();
          return;
        }
        this.stopPolling();
        this.setStatus("connected");
        this.isLeader = true;
        this.channel?.postMessage({ type: "STATUS", payload: "connected" });

        // Heartbeat ping
        this.heartbeatTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send("ping");
          }
        }, 30_000);
      };

      this.ws.onmessage = (event) => {
        if (event.data === "pong") return;
        try {
          const data = JSON.parse(event.data);
          this.emitMessage(data);
          this.channel?.postMessage({ type: "MESSAGE", payload: data });
        } catch {
          // ignore non-json
        }
      };

      this.ws.onerror = () => {
        this.handleWsFailure();
      };

      this.ws.onclose = () => {
        if (!this.isDestroyed) {
          this.handleWsFailure();
        }
      };
    } catch {
      this.handleWsFailure();
    }
  }

  private handleWsFailure() {
    this.disconnectWs();
    // WebSocket ishlamasa avtomatik polling'ga o'tish (Sekin rejim)
    this.startPolling();

    // 30 soniyadan so'ng WebSocket ga qayta urinib ko'rish
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (!this.isDestroyed && this.status === "polling") {
          this.connect();
        }
      }, 30_000);
    }
  }

  private disconnectWs() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  private startPolling() {
    if (this.pollTimer) return;
    this.setStatus("polling");
    this.channel?.postMessage({ type: "STATUS", payload: "polling" });

    const poll = async () => {
      if (this.isDestroyed) return;
      try {
        const query = new URLSearchParams({
          after: this.lastMessageTime,
          limit: "30",
        });
        const res = await fetch(`/api/chat/rooms/${encodeURIComponent(this.roomId)}/messages?${query}`);
        if (res.ok) {
          const data = await res.json();
          const incoming: ChatMessagePayload[] = data.messages || [];
          if (incoming.length > 0) {
            this.lastMessageTime = new Date().toISOString();
            for (const msg of incoming) {
              const payload = { type: "message", message: msg };
              this.emitMessage(payload);
              this.channel?.postMessage({ type: "MESSAGE", payload });
            }
          }
        }
      } catch (e) {
        console.warn("Realtime poll error:", e);
      }
    };

    this.pollTimer = setInterval(poll, 3500); // 3.5 soniyada bir
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public sendTyping() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "typing" }));
    }
  }

  public destroy() {
    this.isDestroyed = true;
    this.disconnectWs();
    this.stopPolling();
    if (this.hiddenTimeout) clearTimeout(this.hiddenTimeout);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.messageHandlers.clear();
    this.statusHandlers.clear();
    realtimePool.delete(this.roomId);
  }
}

// Bitta sahifada ayni bir xona uchun bitta singleton boshqaruvchi (maks 2 xona)
const realtimePool = new Map<string, RealtimeRoomManager>();

export function getRealtimeClient(roomId: string): RealtimeRoomManager {
  let manager = realtimePool.get(roomId);
  if (!manager) {
    // Agar pool da 2 tadan ko'p xona bo'lsa, eskisini yopish (kvota tejash)
    if (realtimePool.size >= 2) {
      const firstKey = realtimePool.keys().next().value;
      if (firstKey) {
        realtimePool.get(firstKey)?.destroy();
      }
    }
    manager = new RealtimeRoomManager(roomId);
    realtimePool.set(roomId, manager);
  }
  return manager;
}
