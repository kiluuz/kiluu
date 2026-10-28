import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { Server, Socket } from "socket.io";
import { config as loadEnv } from "dotenv";
import { verifyPartyTicket } from "../../src/lib/watch-party-auth";
import { expectedPlaybackPosition } from "../../src/lib/watch-party-sync";
import { sanitizeText } from "../../src/lib/sanitize";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

interface Participant {
  socketId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accentColor: string;
  avatarFrame: string | null;
  equippedAvatarFrameId: string | null;
  equippedNameFrameId: string | null;
  isHost: boolean;
}

interface PartyState {
  video_id: string;
  position: number;
  is_playing: boolean;
  playback_rate: number;
  server_ts: number;
  /** Last persisted playback update (ms). Clients ignore older snapshots. */
  version: number;
}

interface ClientToServerEvents {
  "playback:play": (data: { position?: number }, ack?: (result: { ok: boolean; error?: string }) => void) => void;
  "playback:pause": (data: { position?: number }, ack?: (result: { ok: boolean; error?: string }) => void) => void;
  "playback:seek": (data: { position: number }, ack?: (result: { ok: boolean; error?: string }) => void) => void;
  "playback:rate": (data: { rate: number }, ack?: (result: { ok: boolean; error?: string }) => void) => void;
  "playback:sync": (ack: (state: PartyState | null) => void) => void;
  "party:heartbeat": () => void;
  "party:leave": () => void;
  "chat:send": (data: { body: string }) => void;
  reaction: (data: { emoji: string }) => void;
  "clock:ping": (data: { sentAt: number }, ack: (data: { serverTs: number }) => void) => void;
}

interface ServerToClientEvents {
  "party:state": (data: { state: PartyState; participants: Participant[]; messages: PartyMessage[] }) => void;
  "party:participants": (participants: Participant[]) => void;
  "party:host-changed": (data: { userId: string; hostName: string }) => void;
  "party:ended": (data: { reason: string }) => void;
  "party:error": (data: { error: string }) => void;
  "chat:message": (message: PartyMessage) => void;
  reaction: (data: { id: string; emoji: string; username: string; at: number }) => void;
  "rooms:updated": () => void;
  "playback:state": (state: PartyState) => void;
}

interface SocketData {
  partyId: string;
  userId: string;
}

interface PartyMessage {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  username: string;
}

type PartySocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required by the Watch Together service");
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const allowedOrigins = (process.env.WATCH_PARTY_ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const httpServer = createServer((req, res) => {
  if (req.url === "/health" || req.url === "/healthz" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "watch-party" }));
    return;
  }
});
const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
  path: "/",
  cors: { origin: allowedOrigins, methods: ["GET", "POST"], credentials: true },
  pingTimeout: 20_000,
  pingInterval: 10_000,
  maxHttpBufferSize: 64 * 1024,
});

const lastReactionAt = new Map<string, number>();
const lastMessageAt = new Map<string, number>();
const disconnectCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const REACTION_EMOJIS = new Set(["❤️", "😂", "😮", "🔥", "👍", "✨"]);

async function configureRedisAdapter() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
  console.log("[watch-party] Redis adapter enabled");
}

function currentState(party: {
  episodeId: string;
  position: number;
  isPlaying: boolean;
  playbackRate: number;
  serverTs: bigint;
}): PartyState {
  const now = Date.now();
  const version = Number(party.serverTs) || now;
  return {
    video_id: party.episodeId,
    position: expectedPlaybackPosition({
      position: party.position,
      isPlaying: party.isPlaying,
      playbackRate: party.playbackRate,
      serverTs: version,
    }, now),
    is_playing: party.isPlaying,
    playback_rate: party.playbackRate,
    server_ts: now,
    version,
  };
}

async function getParticipants(partyId: string): Promise<Participant[]> {
  const sockets = await io.in(partyId).fetchSockets();
  const userIds = [...new Set(sockets.map((socket) => socket.data.userId))];
  if (!userIds.length) return [];
  const [users, party] = await Promise.all([
    db.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true, accentColor: true,
        avatarFrame: true, equippedAvatarFrameId: true, equippedNameFrameId: true,
      },
    }),
    db.watchParty.findUnique({ where: { id: partyId }, select: { hostId: true } }),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));
  return sockets.flatMap((socket) => {
    const user = userById.get(socket.data.userId);
    if (!user) return [];
    return [{
      socketId: socket.id,
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
      accentColor: user.accentColor,
      avatarFrame: user.avatarFrame,
      equippedAvatarFrameId: user.equippedAvatarFrameId,
      equippedNameFrameId: user.equippedNameFrameId,
      isHost: user.id === party?.hostId,
    }];
  });
}

async function emitParticipants(partyId: string) {
  io.to(partyId).emit("party:participants", await getParticipants(partyId));
  io.emit("rooms:updated");
}

async function sendCurrentState(socket: PartySocket) {
  const party = await db.watchParty.findFirst({
    where: { id: socket.data.partyId, endedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!party) {
    socket.emit("party:ended", { reason: "This party has ended." });
    return;
  }
  const [participants, rows] = await Promise.all([
    getParticipants(party.id),
    db.watchPartyMessage.findMany({
      where: { partyId: party.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { user: { select: { id: true, username: true, displayName: true } } },
    }),
  ]);
  const messages = rows.reverse().map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    userId: row.user.id,
    username: row.user.displayName || row.user.username,
  }));
  socket.emit("party:state", { state: currentState(party), participants, messages });
}

async function handlePlayback(
  socket: PartySocket,
  action: "play" | "pause" | "seek" | "rate",
  data: { position?: number; rate?: number },
  ack?: (result: { ok: boolean; error?: string }) => void,
) {
  if (!socket.rooms.has(socket.data.partyId)) {
    ack?.({ ok: false, error: "You are no longer in this party." });
    return;
  }
  const now = new Date();
  const party = await db.watchParty.findFirst({
    where: {
      id: socket.data.partyId,
      hostId: socket.data.userId,
      endedAt: null,
      expiresAt: { gt: now },
    },
  });
  if (!party) {
    ack?.({ ok: false, error: "Only the current host can control playback." });
    socket.emit("party:error", { error: "Only the current host can control playback." });
    return;
  }
  const episode = await db.episode.findUnique({
    where: { id: party.episodeId },
    select: { duration: true },
  });
  if (!episode) {
    ack?.({ ok: false, error: "Party episode was removed." });
    return;
  }

  const previous = currentState(party);
  let position = typeof data.position === "number" && Number.isFinite(data.position)
    ? Math.max(0, data.position)
    : previous.position;
  if (episode.duration > 0) position = Math.min(position, episode.duration);
  const playbackRate = action === "rate" && typeof data.rate === "number" && Number.isFinite(data.rate)
    ? Math.max(0.5, Math.min(2, data.rate))
    : party.playbackRate;
  const isPlaying = action === "play" ? true : action === "pause" ? false : party.isPlaying;
  if (action === "rate") position = previous.position;
  const updated = await db.watchParty.updateMany({
    where: { id: party.id, hostId: socket.data.userId, endedAt: null },
    data: {
      position,
      isPlaying,
      playbackRate,
      serverTs: BigInt(now.getTime()),
    },
  });
  if (updated.count !== 1) {
    ack?.({ ok: false, error: "Party state changed; request a fresh sync." });
    return;
  }
  const state: PartyState = {
    video_id: party.episodeId,
    position,
    is_playing: isPlaying,
    playback_rate: playbackRate,
    server_ts: now.getTime(),
    version: now.getTime(),
  };
  io.to(party.id).emit("playback:state", state);
  ack?.({ ok: true });
}

async function leaveParty(socket: PartySocket) {
  const { partyId, userId } = socket.data;
  if (!partyId || !userId) return;
  const timerKey = `${partyId}:${userId}`;
  const cleanupTimer = disconnectCleanupTimers.get(timerKey);
  if (cleanupTimer) clearTimeout(cleanupTimer);
  disconnectCleanupTimers.delete(timerKey);
  const members = await io.in(partyId).fetchSockets();
  const anotherConnection = members.some((member) => member.id !== socket.id && member.data.userId === userId);
  if (!anotherConnection) {
    await db.watchPartyMember.updateMany({
      where: { partyId, userId },
      data: { lastSeenAt: null },
    });
  }
  const cutoff = new Date(Date.now() - 60_000);
  const party = await db.watchParty.findFirst({
    where: { id: partyId, endedAt: null },
    include: {
      members: {
        where: { userId: { not: userId }, lastSeenAt: { gte: cutoff } },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (party && !anotherConnection && party.hostId === userId) {
    const nextHost = party.members[0];
    if (nextHost) {
      const nextUser = await db.user.findUnique({ where: { id: nextHost.userId }, select: { displayName: true, username: true } });
      await db.watchParty.update({ where: { id: partyId }, data: { hostId: nextHost.userId } });
      io.to(partyId).emit("party:host-changed", {
        userId: nextHost.userId,
        hostName: nextUser?.displayName || nextUser?.username || "Participant",
      });
    } else {
      await db.watchParty.update({ where: { id: partyId }, data: { endedAt: new Date() } });
      io.to(partyId).emit("party:ended", { reason: "The host left and no participants remained." });
    }
  }
  socket.leave(partyId);
  if (!anotherConnection) {
    const stillActive = await db.watchPartyMember.count({
      where: { partyId, lastSeenAt: { gte: cutoff } },
    });
    if (stillActive === 0) {
      await db.watchParty.updateMany({ where: { id: partyId, endedAt: null }, data: { endedAt: new Date() } });
      io.to(partyId).emit("party:ended", { reason: "This party is empty and has ended." });
    }
  }
  await emitParticipants(partyId);
}

io.use(async (socket, next) => {
  try {
    const ticket = typeof socket.handshake.auth.ticket === "string"
      ? verifyPartyTicket(socket.handshake.auth.ticket)
      : null;
    if (!ticket) return next(new Error("Unauthorized"));
    const now = new Date();
    const membership = await db.watchPartyMember.findUnique({
      where: { partyId_userId: { partyId: ticket.partyId, userId: ticket.userId } },
      include: { party: { select: { endedAt: true, expiresAt: true } } },
    });
    if (!membership || membership.party.endedAt || membership.party.expiresAt <= now) {
      return next(new Error("Party membership expired"));
    }
    socket.data.partyId = ticket.partyId;
    socket.data.userId = ticket.userId;
    next();
  } catch (error) {
    console.error("[watch-party] connection authorization failed", error);
    next(new Error("Unable to authorize party connection"));
  }
});

io.on("connection", (untypedSocket) => {
  const socket = untypedSocket as PartySocket;
  const { partyId, userId } = socket.data;
  const timerKey = `${partyId}:${userId}`;
  const pendingCleanup = disconnectCleanupTimers.get(timerKey);
  if (pendingCleanup) clearTimeout(pendingCleanup);
  disconnectCleanupTimers.delete(timerKey);
  // Join synchronously, before the first await. Clients flush buffered events
  // (e.g. the host's play command after pressing play while the socket was
  // still connecting) as soon as the connection is acknowledged, and the
  // playback handlers reject sockets that are not in the room yet. Joining
  // after the membership write dropped those commands and left every later
  // guest stuck on the paused state.
  socket.join(partyId);
  void (async () => {
    await db.watchPartyMember.updateMany({
      where: { partyId, userId },
      data: { lastSeenAt: new Date() },
    });
    await sendCurrentState(socket);
    await emitParticipants(partyId);
  })().catch((error: unknown) => {
    console.error("[watch-party] failed to initialize party connection", error);
    socket.emit("party:error", { error: "Unable to restore party state." });
  });

  socket.on("party:heartbeat", () => {
    if (!socket.rooms.has(partyId)) return;
    void db.watchPartyMember.updateMany({
      where: { partyId, userId },
      data: { lastSeenAt: new Date() },
    }).catch((error: unknown) => console.error("[watch-party] heartbeat persistence failed", error));
  });
  socket.on("party:leave", () => {
    void leaveParty(socket)
      .then(() => socket.disconnect(true))
      .catch((error: unknown) => console.error("[watch-party] leave failed", error));
  });
  socket.on("disconnect", () => {
    if (!socket.data.partyId) return;
    const timer = setTimeout(() => {
      void leaveParty(socket).catch((error: unknown) => console.error("[watch-party] disconnect cleanup failed", error));
    }, 30_000);
    disconnectCleanupTimers.set(timerKey, timer);
  });

  socket.on("clock:ping", (_data, ack) => {
    ack({ serverTs: Date.now() });
  });
  socket.on("playback:sync", (ack) => {
    void db.watchParty.findFirst({
      where: { id: partyId, endedAt: null, expiresAt: { gt: new Date() } },
    }).then((party) => ack(party ? currentState(party) : null))
      .catch((error: unknown) => {
        console.error("[watch-party] state read failed", error);
        ack(null);
      });
  });
  socket.on("playback:play", (data, ack) => {
    void handlePlayback(socket, "play", data, ack).catch((error: unknown) => console.error("[watch-party] play update failed", error));
  });
  socket.on("playback:pause", (data, ack) => {
    void handlePlayback(socket, "pause", data, ack).catch((error: unknown) => console.error("[watch-party] pause update failed", error));
  });
  socket.on("playback:seek", (data, ack) => {
    void handlePlayback(socket, "seek", data, ack).catch((error: unknown) => console.error("[watch-party] seek update failed", error));
  });
  socket.on("playback:rate", (data, ack) => {
    void handlePlayback(socket, "rate", data, ack).catch((error: unknown) => console.error("[watch-party] rate update failed", error));
  });

  socket.on("chat:send", (data) => {
    if (!socket.rooms.has(partyId)) return;
    const now = Date.now();
    const last = lastMessageAt.get(socket.id) || 0;
    if (now - last < 1200) return;
    lastMessageAt.set(socket.id, now);
    const body = sanitizeText(data?.body || "", 500);
    if (!body) return;
    void db.watchPartyMessage.create({
      data: { partyId, userId, body },
      include: { user: { select: { id: true, username: true, displayName: true } } },
    }).then((message) => {
      io.to(partyId).emit("chat:message", {
        id: message.id,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        userId: message.user.id,
        username: message.user.displayName || message.user.username,
      });
    }).catch((error: unknown) => console.error("[watch-party] chat persistence failed", error));
  });

  socket.on("reaction", (data) => {
    if (!socket.rooms.has(partyId)) return;
    const now = Date.now();
    const last = lastReactionAt.get(socket.id) || 0;
    if (now - last < 800 || !REACTION_EMOJIS.has(data?.emoji)) return;
    lastReactionAt.set(socket.id, now);
    void db.user.findUnique({
      where: { id: userId },
      select: { displayName: true, username: true },
    }).then((user) => {
      if (!user) return;
      io.to(partyId).emit("reaction", {
        id: `${socket.id}:${now}`,
        emoji: data.emoji,
        username: user.displayName || user.username,
        at: now,
      });
    }).catch((error: unknown) => console.error("[watch-party] reaction lookup failed", error));
  });
});

setInterval(() => {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 60_000);
  void db.watchParty.updateMany({
    where: { endedAt: null, expiresAt: { lte: now } },
    data: { endedAt: now },
  }).then(async () => {
    await db.watchParty.updateMany({
      where: {
        endedAt: null,
        expiresAt: { gt: now },
        members: { none: { lastSeenAt: { gte: staleCutoff } } },
      },
      data: { endedAt: now },
    });
    await db.watchParty.deleteMany({
      where: { endedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60_000) } },
    });
  }).catch((error: unknown) => console.error("[watch-party] stale party cleanup failed", error));
}, 60_000).unref();

async function start() {
  await configureRedisAdapter();
  const port = Number(process.env.PORT || process.env.WATCH_PARTY_PORT || 3003);
  httpServer.listen(port, () => console.log(`[watch-party] WebSocket server running on port ${port}`));
}

void start().catch((error: unknown) => {
  console.error("[watch-party] startup failed", error);
  process.exitCode = 1;
});

process.on("SIGTERM", () => {
  io.close();
  void db.$disconnect();
});
