import assert from "node:assert/strict";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";
import { after, before, test } from "node:test";
import { io, type Socket } from "socket.io-client";
import type { PrismaClient } from "@prisma/client";
import { createPartyTicket, verifyPartyTicket } from "@/lib/watch-party-auth";
import { expectedPlaybackPosition, playbackCorrection } from "@/lib/watch-party-sync";
import { chargePartyEntry, getOwnedHlsEpisode } from "@/lib/watch-parties";

const secret = "watch-party-test-secret-with-more-than-thirty-two-characters";
let tempDir: string;
let databaseUrl: string;
let client: PrismaClient;
let service: ChildProcessByStdio<null, Readable, Readable>;
let servicePort: number;
let episodeId: string;
let hostId: string;
let guestId: string;
let partyId: string;
let loadPartyId: string;
let loadUserIds: string[];
const sockets: Socket[] = [];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openSocket(userId: string, id: string) {
  const socket = io(`http://127.0.0.1:${servicePort}`, {
    path: "/",
    autoConnect: false,
    reconnection: false,
    transports: ["websocket"],
    auth: { ticket: createPartyTicket(userId, id) },
    timeout: 3000,
  });
  sockets.push(socket);
  const initialState = new Promise<{
    state: { video_id: string; position: number; is_playing: boolean; server_ts: number; version?: number };
  }>((resolve) => socket.once("party:state", resolve));
  return { socket, initialState };
}

async function connectSocket(userId: string, id: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const pending = openSocket(userId, id);
    try {
      await new Promise<void>((resolve, reject) => {
        pending.socket.once("connect", resolve);
        pending.socket.once("connect_error", reject);
        pending.socket.connect();
      });
      return { socket: pending.socket, state: await pending.initialState };
    } catch (error) {
      lastError = error;
      pending.socket.disconnect();
      await delay(100);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Watch party socket did not connect");
}

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dubanix-watch-party-"));
  databaseUrl = `file:${path.join(tempDir, "watch-party.db")}`;
  servicePort = 33_000 + Math.floor(Math.random() * 10_000);
  process.env.DATABASE_URL = databaseUrl;
  process.env.WATCH_PARTY_SECRET = secret;
  execFileSync(path.resolve("node_modules/.bin/prisma"), [
    "db", "push", "--schema", "prisma/schema.test.prisma", "--skip-generate",
  ], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: "pipe" });
  const { PrismaClient } = await import("@prisma/client");
  client = new PrismaClient();
  await client.$connect();

  const users = await Promise.all(Array.from({ length: 52 }, (_, index) => client.user.create({
    data: {
      email: `watch-party-${index}@example.test`,
      username: `watchparty${index}`,
      password: "test-hash",
    },
  })));
  hostId = users[0].id;
  guestId = users[1].id;
  loadUserIds = users.slice(2).map((user) => user.id);
  const anime = await client.anime.create({
    data: {
      slug: "watch-party-test-anime",
      title: "Watch Party Test",
      description: "Test anime",
      coverImage: "",
      genres: "Action",
      year: 2026,
      isFree: true,
      hidden: false,
      moderationStatus: "APPROVED",
    },
  });
  const episode = await client.episode.create({
    data: {
      animeId: anime.id,
      number: 1,
      title: "Episode 1",
      videoUrl: "r2-hls",
      hlsKey: "hls/watch-party-test-anime/1/index.m3u8",
      duration: 3600,
    },
  });
  episodeId = episode.id;

  const now = new Date();
  const party = await client.watchParty.create({
    data: {
      code: "SYNC42",
      name: "Sync integration",
      hostId,
      createdById: hostId,
      animeId: anime.id,
      episodeId,
      position: 10,
      serverTs: BigInt(now.getTime()),
      expiresAt: new Date(now.getTime() + 60 * 60_000),
      members: { create: [{ userId: users[0].id, lastSeenAt: now }, { userId: users[1].id, lastSeenAt: now }] },
    },
  });
  partyId = party.id;

  const loadHostId = users[2].id;
  const loadUsers = users.slice(2);
  const loadParty = await client.watchParty.create({
    data: {
      code: "LOAD50",
      name: "50 participant load",
      hostId: loadHostId,
      createdById: loadHostId,
      animeId: anime.id,
      episodeId,
      capacity: 50,
      expiresAt: new Date(now.getTime() + 60 * 60_000),
      members: {
        create: loadUsers.map((user) => ({ userId: user.id, lastSeenAt: now })),
      },
    },
  });
  loadPartyId = loadParty.id;

  service = spawn(process.execPath, [
    path.resolve("mini-services/watch-party/node_modules/.bin/tsx"),
    "mini-services/watch-party/index.ts",
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      WATCH_PARTY_SECRET: secret,
      WATCH_PARTY_PORT: String(servicePort),
      WATCH_PARTY_ALLOWED_ORIGINS: `http://127.0.0.1:${servicePort}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  service.stdout.on("data", (chunk: Buffer) => process.stdout.write(`[party-service] ${chunk.toString()}`));
  service.stderr.on("data", (chunk: Buffer) => process.stderr.write(`[party-service] ${chunk.toString()}`));
});

after(async () => {
  for (const socket of sockets) socket.disconnect();
  if (service && service.exitCode === null) {
    service.kill("SIGTERM");
    await new Promise<void>((resolve) => service.once("exit", () => resolve()));
  }
  await client?.$disconnect();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("party tickets reject tampering and playback clock uses server time", () => {
  const ticket = createPartyTicket("user-a", "party-a", 1_800_000_000_000);
  assert.deepEqual(verifyPartyTicket(ticket, 1_800_000_000_000), {
    userId: "user-a",
    partyId: "party-a",
    exp: 1_800_000_000 + 8 * 60 * 60,
  });
  assert.equal(verifyPartyTicket(`${ticket.slice(0, -1)}x`, 1_800_000_000_000), null);
  assert.equal(verifyPartyTicket(ticket, 1_800_000_000_000 + 8 * 60 * 60_000), null);
  assert.equal(expectedPlaybackPosition({
    position: 12,
    isPlaying: true,
    serverTs: 1000,
    playbackRate: 1,
  }, 2500), 13.5);
  assert.deepEqual(playbackCorrection(10, 10.2), { seekTo: null, rate: 1.01 });
  assert.deepEqual(playbackCorrection(10, 10.6), { seekTo: 10.6, rate: 1 });
});

test("episode HLS access is denied without ownership and allowed for free episodes", async () => {
  const stranger = await client.user.create({
    data: { email: "watch-party-stranger@example.test", username: "partystranger", password: "test-hash" },
  });
  const anime = await client.anime.create({
    data: {
      slug: "watch-party-paid-anime",
      title: "Paid Watch Party Test",
      description: "Test anime",
      coverImage: "",
      genres: "Action",
      year: 2026,
      isFree: false,
      hidden: false,
      moderationStatus: "APPROVED",
    },
  });
  const paidEpisode = await client.episode.create({
    data: { animeId: anime.id, number: 1, title: "Paid Episode", videoUrl: "r2-hls", hlsKey: "hls/watch-party-test-anime/2/index.m3u8" },
  });
  await client.purchase.create({ data: { userId: hostId, animeId: anime.id, episodeNumber: 0, pricePaid: 10 } });
  assert.deepEqual(await getOwnedHlsEpisode(client, stranger.id, paidEpisode.id), { error: "FORBIDDEN" });
  const ownedEpisode = await getOwnedHlsEpisode(client, hostId, paidEpisode.id);
  assert.ok(ownedEpisode.episode);
  assert.equal(ownedEpisode.episode.hlsKey, "hls/watch-party-test-anime/2/index.m3u8");
  const freeEpisode = await getOwnedHlsEpisode(client, stranger.id, episodeId);
  assert.ok(freeEpisode.episode);
  assert.equal(freeEpisode.episode.hlsKey, "hls/watch-party-test-anime/1/index.m3u8");
});

test("Watch Together entry charges credits and records the debit atomically and idempotently", async () => {
  const payer = await client.user.create({
    data: { email: "party-payer@example.test", username: "partypayer", password: "test-hash", credits: 12 },
  });

  const first = await client.$transaction((tx) => chargePartyEntry(tx, payer.id, "paid-party", 5));
  assert.deepEqual(first, { charged: true });
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: payer.id } })).credits, 7);
  assert.equal(await client.creditTransaction.count({
    where: { userId: payer.id, idempotencyKey: `watch-party-entry:paid-party:${payer.id}`, amount: -5 },
  }), 1);

  const retry = await client.$transaction((tx) => chargePartyEntry(tx, payer.id, "paid-party", 5));
  assert.deepEqual(retry, { charged: false });
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: payer.id } })).credits, 7);

  const insufficient = await client.$transaction((tx) => chargePartyEntry(tx, payer.id, "another-party", 8));
  assert.deepEqual(insufficient, { error: "INSUFFICIENT_CREDITS" });
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: payer.id } })).credits, 7);
  assert.equal(await client.creditTransaction.count({ where: { userId: payer.id } }), 1);
});

test("two clients receive host playback changes and reconnect restores server state", async () => {
  const host = await connectSocket(hostId, partyId);
  const guest = await connectSocket(guestId, partyId);
  assert.equal(host.state.state.video_id, episodeId);
  assert.equal(guest.state.state.position, host.state.state.position);

  const playUpdate = new Promise<{ is_playing: boolean }>((resolve) => {
    guest.socket.once("playback:state", resolve);
  });
  const playAck = new Promise<{ ok: boolean }>((resolve) => {
    host.socket.emit("playback:play", { position: 20 }, resolve);
  });
  assert.deepEqual(await playAck, { ok: true });
  assert.equal((await playUpdate).is_playing, true);

  const pauseUpdate = new Promise<{ is_playing: boolean; position: number }>((resolve) => {
    guest.socket.once("playback:state", resolve);
  });
  const pauseAck = new Promise<{ ok: boolean }>((resolve) => {
    host.socket.emit("playback:pause", { position: 35 }, resolve);
  });
  assert.deepEqual(await pauseAck, { ok: true });
  const pausedState = await pauseUpdate;
  assert.equal(pausedState.is_playing, false);
  assert.equal(pausedState.position, 35);

  const guestUpdate = new Promise<{ position: number }>((resolve) => {
    guest.socket.once("playback:state", (state: { position: number }) => resolve(state));
  });
  const hostAck = new Promise<{ ok: boolean }>((resolve) => {
    host.socket.emit("playback:seek", { position: 42 }, resolve);
  });
  assert.deepEqual(await hostAck, { ok: true });
  assert.equal((await guestUpdate).position, 42);

  guest.socket.disconnect();
  const reconnected = await connectSocket(guestId, partyId);
  assert.ok(Math.abs(reconnected.state.state.position - 42) < 0.5);

  const denied = new Promise<{ ok: boolean }>((resolve) => {
    reconnected.socket.emit("playback:seek", { position: 90 }, resolve);
  });
  assert.equal((await denied).ok, false);
});

test("a guest joining mid-playback receives the playing state immediately", async () => {
  const host = await connectSocket(hostId, partyId);
  const playAck = new Promise<{ ok: boolean }>((resolve) => {
    host.socket.emit("playback:play", { position: 50 }, resolve);
  });
  assert.deepEqual(await playAck, { ok: true });

  const lateJoinerId = loadUserIds[0];
  await client.watchPartyMember.create({
    data: { partyId, userId: lateJoinerId, lastSeenAt: new Date() },
  });
  const late = await connectSocket(lateJoinerId, partyId);
  assert.equal(late.state.state.is_playing, true);
  assert.ok(late.state.state.position >= 50 && late.state.state.position < 55);

  const syncState = await new Promise<{ is_playing: boolean; position: number }>((resolve) => {
    late.socket.emit("playback:sync", resolve);
  });
  assert.equal(syncState.is_playing, true);
  assert.ok(syncState.position >= late.state.state.position);
});

test("host playback commands buffered before connecting are not dropped", async () => {
  // Socket.IO buffers events emitted while disconnected and flushes them right
  // after the connection handshake — at the exact moment the service used to
  // wait for a database write before joining the socket to the party room.
  // The room guard then rejected the host's command and the party stayed in
  // the old state, so every guest that joined while the host was watching got
  // the paused snapshot and never started playing.
  const pending = openSocket(hostId, partyId);
  const ack = new Promise<{ ok: boolean; error?: string }>((resolve) => {
    pending.socket.emit("playback:pause", { position: 7 }, resolve);
  });
  pending.socket.connect();
  assert.deepEqual(await ack, { ok: true });

  const lateJoinerId = loadUserIds[1];
  await client.watchPartyMember.create({
    data: { partyId, userId: lateJoinerId, lastSeenAt: new Date() },
  });
  const late = await connectSocket(lateJoinerId, partyId);
  assert.equal(late.state.state.is_playing, false);
  assert.equal(late.state.state.position, 7);
  const stored = await client.watchParty.findUniqueOrThrow({ where: { id: partyId } });
  assert.equal(late.state.state.version, Number(stored.serverTs));
});

test("50 connected participants receive the same measured playback update", async () => {
  const connectionStarted = performance.now();
  const connected = await Promise.all(loadUserIds.map((userId) => connectSocket(userId, loadPartyId)));
  assert.equal(connected.length, 50);
  const connectionMs = Number((performance.now() - connectionStarted).toFixed(2));

  const deliveries = connected.map(({ socket }) => new Promise<number>((resolve) => {
    socket.once("playback:state", (state: { position: number }) => resolve(state.position));
  }));
  const broadcastStarted = performance.now();
  const ack = new Promise<{ ok: boolean }>((resolve) => {
    connected[0].socket.emit("playback:seek", { position: 123 }, resolve);
  });
  assert.deepEqual(await ack, { ok: true });
  const positions = await Promise.all(deliveries);
  assert.equal(positions.length, 50);
  assert.ok(positions.every((position) => position === 123));
  const broadcastMs = Number((performance.now() - broadcastStarted).toFixed(2));
  console.log(`WATCH_PARTY_LOAD participants=50 connect_ms=${connectionMs} broadcast_ms=${broadcastMs}`);
});
