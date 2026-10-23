"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  Users, Plus, KeyRound, Loader2, Crown, Heart, Laugh, Angry,
  ThumbsUp, PartyPopper, LogOut, RefreshCw, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAppStore } from "../store";
import type { AnimeDetail, EpisodeItem, AnimeSummary } from "../types";
import { VideoPlayer, PlayerControls } from "../player";
import { FramedAvatar, NameWithFrame, SmartImage, timeAgo } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { expectedPlaybackPosition, playbackCorrection } from "@/lib/watch-party-sync";

interface PartyRoom {
  id: string;
  code: string;
  name: string;
  animeId: string;
  animeTitle: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  videoUrl: string;
  streamId?: string | null;
  hlsKey?: string | null;
  duration?: number;
  coverImage: string | null;
  createdAt: number;
  hostName: string;
  participantCount: number;
  capacity?: number;
}

interface Participant {
  socketId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accentColor: string;
  avatarFrame?: string | null;
  equippedAvatarFrameId?: string | null;
  equippedNameFrameId?: string | null;
  isHost: boolean;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  username: string;
  left: number;
}

interface PartyPlaybackState {
  video_id: string;
  position: number;
  is_playing: boolean;
  playback_rate: number;
  server_ts: number;
}

interface PartyChatMessage {
  id: string;
  body: string;
  createdAt: string;
  userId: string;
  username: string;
}

const REACTIONS = [
  { emoji: "❤️", icon: Heart },
  { emoji: "😂", icon: Laugh },
  { emoji: "😮", icon: Angry },
  { emoji: "🔥", icon: PartyPopper },
  { emoji: "👍", icon: ThumbsUp },
  { emoji: "✨", icon: Sparkles },
];

export function WatchTogetherView() {
  const { user, setAuthOpen, navigate } = useAppStore();
  const [rooms, setRooms] = useState<PartyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryCostCredits, setEntryCostCredits] = useState<number | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  // create form state
  const [ownedAnimes, setOwnedAnimes] = useState<AnimeSummary[]>([]);
  const [selAnime, setSelAnime] = useState<string>("");
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [selEpisode, setSelEpisode] = useState<string>("");
  const [roomName, setRoomName] = useState("");
  const [creating, setCreating] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // party state
  const [activeRoom, setActiveRoom] = useState<PartyRoom | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [chatMessages, setChatMessages] = useState<PartyChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const controlsRef = useRef<PlayerControls | null>(null);
  const clockOffsetRef = useRef(0);
  const playbackStateRef = useRef<PartyPlaybackState | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driftIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Inside a watch-party room the mobile dock hides (immersive mode)
  useEffect(() => {
    useAppStore.getState().setImmersive(Boolean(activeRoom));
    return () => useAppStore.getState().setImmersive(false);
  }, [activeRoom]);

  const refreshRooms = useCallback(async () => {
    try {
      const response = await fetch("/api/watch-parties", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load live parties");
      const data = await response.json();
      if (!Number.isSafeInteger(data.entryCostCredits) || data.entryCostCredits < 1) {
        throw new Error("Watch Together price is unavailable");
      }
      setEntryCostCredits(data.entryCostCredits);
      setRooms(data.parties || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load live parties");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshRooms());
    const interval = setInterval(refreshRooms, 15000);
    return () => {
      clearInterval(interval);
    };
  }, [refreshRooms]);

  useEffect(() => () => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
    socketRef.current?.disconnect();
  }, []);

  // Load owned animes for create dialog
  useEffect(() => {
    if (createOpen && user) {
      fetch("/api/animes")
        .then(async (r) => {
          if (!r.ok) throw new Error("Unable to load your library");
          return r.json();
        })
        .then((d) => {
          setOwnedAnimes((d.animes || []).filter((a: AnimeSummary) => a.owned || a.isFree));
        })
        .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Unable to load your library"));
    }
  }, [createOpen, user]);

  // Load episodes when anime selected
  useEffect(() => {
    if (selAnime) {
      fetch(`/api/animes/${selAnime}`)
        .then(async (r) => {
          if (!r.ok) throw new Error("Unable to load anime episodes");
          return r.json();
        })
        .then((d: { anime: AnimeDetail; episodes: EpisodeItem[] }) => {
          const watchable = (d.anime.owned || d.anime.isFree ? d.episodes : [])
            .filter((episode) => Boolean(episode.streamId || episode.hlsKey));
          setEpisodes(watchable);
          setSelEpisode(watchable[0]?.id || "");
        })
        .catch((error: unknown) => {
          setEpisodes([]);
          toast.error(error instanceof Error ? error.message : "Unable to load anime episodes");
        });
    }
  }, [selAnime]);

  function applyPlaybackState(state: PartyPlaybackState) {
    playbackStateRef.current = state;
    const controls = controlsRef.current;
    if (!controls) {
      setTimeout(() => {
        if (playbackStateRef.current === state) applyPlaybackState(state);
      }, 100);
      return;
    }
    const expected = expectedPlaybackPosition({
      position: state.position,
      isPlaying: state.is_playing,
      serverTs: state.server_ts,
      playbackRate: state.playback_rate,
    }, Date.now() + clockOffsetRef.current);
    controls.setRate(state.playback_rate);
    if (state.is_playing) controls.play(expected);
    else controls.pause(expected);
  }

  function connectToParty(
    ticket: string,
    party: PartyRoom,
    initialParticipants: Participant[],
    initialState?: PartyPlaybackState,
    initialMessages: PartyChatMessage[] = [],
  ) {
    socketRef.current?.disconnect();
    setActiveRoom(party);
    const participantsWithKeys = initialParticipants.map((participant) => ({
      ...participant,
      socketId: participant.socketId || participant.userId,
    }));
    setParticipants(participantsWithKeys);
    setAutoplayBlocked(false);
    setIsHost(participantsWithKeys.some((participant) => participant.userId === user?.id && participant.isHost));
    setChatMessages(initialMessages);
    setReactions([]);
    if (initialState) applyPlaybackState(initialState);

    const socket = io(process.env.NEXT_PUBLIC_WATCH_PARTY_URL || "/?XTransformPort=3003", {
      auth: { ticket },
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
      const ping = () => {
        const sentAt = Date.now();
        socket.emit("clock:ping", { sentAt }, ({ serverTs }: { serverTs: number }) => {
          const receivedAt = Date.now();
          clockOffsetRef.current = serverTs - (sentAt + receivedAt) / 2;
          setLatencyMs(Math.round(receivedAt - sentAt));
        });
      };
      ping();
      pingIntervalRef.current = setInterval(ping, 4000);
      socket.emit("party:heartbeat");
      heartbeatIntervalRef.current = setInterval(() => socket.emit("party:heartbeat"), 20_000);
      driftIntervalRef.current = setInterval(() => {
        const state = playbackStateRef.current;
        const controls = controlsRef.current;
        if (!state || !controls || !state.is_playing) return;
        const expected = expectedPlaybackPosition({
          position: state.position,
          isPlaying: state.is_playing,
          serverTs: state.server_ts,
          playbackRate: state.playback_rate,
        }, Date.now() + clockOffsetRef.current);
        const correction = playbackCorrection(controls.getCurrentTime(), expected);
        if (correction.seekTo !== null) controls.seek(correction.seekTo);
        else controls.setRate(state.playback_rate * correction.rate);
      }, 1000);
    });
    socket.on("connect_error", (error) => {
      toast.error(`Watch party connection failed: ${error.message}`);
    });
    socket.on("rooms:updated", () => void refreshRooms());
    socket.on("party:state", (payload: { state: PartyPlaybackState; participants: Participant[]; messages: PartyChatMessage[] }) => {
      setParticipants(payload.participants);
      setIsHost(payload.participants.some((participant) => participant.userId === user?.id && participant.isHost));
      setChatMessages(payload.messages || []);
      applyPlaybackState(payload.state);
    });
    socket.on("party:participants", (nextParticipants: Participant[]) => {
      setParticipants(nextParticipants);
      setIsHost(nextParticipants.some((participant) => participant.userId === user?.id && participant.isHost));
    });
    socket.on("party:host-changed", ({ userId: hostId, hostName }: { userId: string; hostName: string }) => {
      setParticipants((current) => current.map((participant) => ({ ...participant, isHost: participant.userId === hostId })));
      setIsHost(hostId === user?.id);
      toast.info(`${hostName} is now the host`);
    });
    socket.on("party:ended", ({ reason }: { reason: string }) => {
      toast.info(reason);
      socket.disconnect();
      setActiveRoom(null);
      setParticipants([]);
      void refreshRooms();
    });
    socket.on("party:error", ({ error }: { error: string }) => toast.error(error));
    socket.on("playback:state", (state: PartyPlaybackState) => applyPlaybackState(state));
    socket.on("chat:message", (message: PartyChatMessage) => {
      setChatMessages((current) => [...current.slice(-99), message]);
    });
    socket.on("reaction", (reaction: { id: string; emoji: string; username: string }) => {
      const floating: FloatingReaction = {
        id: reaction.id,
        emoji: reaction.emoji,
        username: reaction.username,
        left: 8 + Math.random() * 78,
      };
      setReactions((current) => [...current.slice(-24), floating]);
      setTimeout(() => setReactions((current) => current.filter((item) => item.id !== floating.id)), 2600);
    });
  }

  async function createRoom() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!selAnime || !selEpisode) {
      toast.error("Pick an anime and episode");
      return;
    }
    const anime = ownedAnimes.find((a) => a.id === selAnime || a.slug === selAnime);
    const episode = episodes.find((e) => e.id === selEpisode);
    if (!anime || !episode) return;
    setCreating(true);
    try {
      const response = await fetch("/api/watch-parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, name: roomName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create party");
      const host: Participant = {
        socketId: "host",
        userId: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        avatarUrl: user.avatarUrl,
        accentColor: user.accentColor,
        avatarFrame: user.avatarFrame,
        equippedAvatarFrameId: user.equippedAvatarFrameId,
        equippedNameFrameId: user.equippedNameFrameId,
        isHost: true,
      };
      setCreateOpen(false);
      connectToParty(data.ticket, data.party, [host]);
      toast.success(`Party created! Share code: ${data.party.code}`, {
        description: `${data.entryCostCredits} credits charged for entry.`,
        duration: 8000,
      });
      void refreshRooms();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create party");
    } finally {
      setCreating(false);
    }
  }

  async function joinRoom(code?: string) {
    const finalCode = (code || joinCode).trim().toUpperCase();
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!finalCode) return;
    try {
      const response = await fetch("/api/watch-parties/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: finalCode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to join party");
      setJoinOpen(false);
      setJoinCode("");
      connectToParty(data.ticket, data.party, data.participants || [], data.state, data.messages || []);
      toast.success(`Joined ${data.party.name}!`, { description: `${data.entryCostCredits} credits charged for entry.` });
      void refreshRooms();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to join party");
    }
  }

  function leaveRoom() {
    socketRef.current?.emit("party:leave");
    socketRef.current?.disconnect();
    socketRef.current = null;
    setActiveRoom(null);
    setParticipants([]);
    setReactions([]);
    setChatMessages([]);
    playbackStateRef.current = null;
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (driftIntervalRef.current) clearInterval(driftIntervalRef.current);
    refreshRooms();
    toast.info("Left the watch party");
  }

  function sendReaction(emoji: string) {
    socketRef.current?.emit("reaction", { emoji });
  }

  function sendChat() {
    const body = chatText.trim();
    if (!body) return;
    socketRef.current?.emit("chat:send", { body });
    setChatText("");
  }

  // ============ ACTIVE PARTY MODE ============
  if (activeRoom) {
    const ep: EpisodeItem = {
      id: activeRoom.episodeId,
      animeId: activeRoom.animeId,
      number: activeRoom.episodeNumber,
      title: activeRoom.episodeTitle,
      description: null,
      videoUrl: activeRoom.videoUrl,
      streamId: activeRoom.streamId,
      hlsKey: activeRoom.hlsKey,
      duration: activeRoom.duration || 0,
      progress: null,
    };
    return (
      <div className="max-w-[1300px] mx-auto px-0 sm:px-8 py-0 sm:py-6 pb-10">
        <VideoPlayer
          key={activeRoom.id + activeRoom.episodeId}
          episode={ep}
          title={activeRoom.animeTitle}
          hasNext={false}
          onNext={() => {}}
          syncMode
          isHost={isHost}
          controlsRef={controlsRef}
          onLocalPlay={(pos) => socketRef.current?.emit("playback:play", { position: pos })}
          onLocalPause={(pos) => socketRef.current?.emit("playback:pause", { position: pos })}
          onLocalSeek={(pos) => socketRef.current?.emit("playback:seek", { position: pos })}
          onLocalRate={(rate) => socketRef.current?.emit("playback:rate", { rate })}
          onAutoplayBlocked={() => setAutoplayBlocked(true)}
        />
        {autoplayBlocked && (
          <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <span>Tap once to allow your browser to play synced video audio.</span>
            <Button size="sm" onClick={() => {
              controlsRef.current?.enableAudio();
              setAutoplayBlocked(false);
              const state = playbackStateRef.current;
              if (state) setTimeout(() => applyPlaybackState(state), 300);
            }}>Enable synced playback</Button>
          </div>
        )}

        {/* Reactions layer */}
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {reactions.map((r) => (
            <div key={r.id} className="reaction-float absolute bottom-24 flex flex-col items-center" style={{ left: `${r.left}%` }}>
              <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
              <span className="text-[10px] font-bold text-white bg-black/50 rounded-full px-2 py-0.5 mt-1">{r.username}</span>
            </div>
          ))}
        </div>

        {/* Party bar */}
        <div className="px-4 sm:px-0 mt-4">
          <div className="glass rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-lg font-black flex items-center gap-2 flex-wrap">
                  <Users className="w-5 h-5 text-primary" />
                  {activeRoom.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {activeRoom.animeTitle} · EP {activeRoom.episodeNumber} —{" "}
                  <span className="font-mono font-bold text-primary">{activeRoom.code}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {latencyMs === null ? "Measuring connection…" : `Sync latency ${latencyMs} ms`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{participants.length} watching</span>
                <Button variant="destructive" size="sm" onClick={leaveRoom} className="rounded-full h-8">
                  <LogOut className="w-3.5 h-3.5" /> Leave
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mr-1">React:</span>
              {REACTIONS.map((r) => (
                <button
                  key={r.emoji}
                  onClick={() => sendReaction(r.emoji)}
                  className="w-11 h-11 rounded-full glass hover:scale-110 hover:border-primary/50 transition flex items-center justify-center text-xl"
                  aria-label={`React ${r.emoji}`}
                >
                  {r.emoji}
                </button>
              ))}
              <p className="text-[11px] text-muted-foreground ml-2 hidden sm:block">
                Emoji reactions only — everyone stays chill, no spam ✌️
              </p>
            </div>

            {/* Participants */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">In this party</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <div
                    key={p.socketId}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-secondary/60 border"
                  >
                    <FramedAvatar user={p} size={26} />
                    <NameWithFrame user={p} compact className="text-xs font-semibold" avatarSize={26} />
                    {p.isHost && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                ))}
              </div>
              {!isHost && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  👑 The host controls playback — just sit back and enjoy the sync.
                </p>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Party chat</p>
              <div className="max-h-44 space-y-2 overflow-y-auto rounded-xl bg-secondary/30 p-3">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No messages yet.</p>
                ) : chatMessages.map((message) => (
                  <p key={message.id} className="break-words text-xs">
                    <span className="font-bold">{message.username}: </span>{message.body}
                  </p>
                ))}
              </div>
              <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); sendChat(); }}>
                <Input value={chatText} maxLength={500} onChange={(event) => setChatText(event.target.value)} placeholder="Message the party…" />
                <Button type="submit" disabled={!chatText.trim()} className="shrink-0">Send</Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ LOBBY ============
  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="sr-only">Watch Together</h1>
      {/* Actions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => (user ? setCreateOpen(true) : setAuthOpen(true))}
          className="group relative rounded-3xl border-2 border-dashed p-7 text-left hover:border-primary/60 hover:bg-accent/40 transition overflow-hidden aurora"
        >
          <div className="w-12 h-12 rounded-2xl brand-gradient flex items-center justify-center mb-3 shadow-lg shadow-primary/25 group-hover:scale-110 transition">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-black text-lg">Start a Watch Party</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Pick any anime you own, get a party code, invite friends. You control playback.
          </p>
        </button>
        <button
          onClick={() => (user ? setJoinOpen(true) : setAuthOpen(true))}
          className="group relative rounded-3xl border-2 border-dashed p-7 text-left hover:border-primary/60 hover:bg-accent/40 transition"
        >
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center mb-3 group-hover:scale-110 transition">
            <KeyRound className="w-6 h-6 text-cyan-400" />
          </div>
          <h3 className="font-black text-lg">Join with Code</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Got a 6-letter code from a friend? Hop into their party instantly.
          </p>
        </button>
      </div>

      {/* Live rooms */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          Live Parties
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" /> LIVE
          </span>
        </h2>
        <button onClick={refreshRooms} className="text-xs font-semibold text-primary flex items-center gap-1 hover:opacity-75 transition">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading live parties...
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <p className="text-4xl mb-3">🍿</p>
          <p className="font-bold">No parties happening right now</p>
          <p className="text-sm text-muted-foreground mt-1">Be the first — start a watch party!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div key={room.id} className="glass rounded-2xl overflow-hidden glow-hover group">
              <div className="relative aspect-video">
                <SmartImage src={room.coverImage} alt={room.animeTitle} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur text-white text-[10px] font-bold rounded-full px-2.5 py-1 flex items-center gap-1.5 border border-white/15">
                  <Users className="w-3 h-3" /> {room.participantCount}
                </span>
                <div className="absolute bottom-0 p-3">
                  <p className="text-white font-bold text-sm truncate">{room.name}</p>
                  <p className="text-white/70 text-[11px] truncate">
                    {room.animeTitle} · EP {room.episodeNumber}
                  </p>
                </div>
              </div>
              <div className="p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">
                      Host: <span className="font-semibold text-foreground">{room.hostName}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">Code: <span className="font-mono font-bold text-primary">{room.code}</span></p>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full brand-gradient text-white font-bold h-8 shrink-0"
                    onClick={() => joinRoom(room.code)}
                  >
                    Join
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="w-5 h-5 text-primary" /> New Watch Party
            </DialogTitle>
            <DialogDescription>
              Choose an anime you own and start the sync. Entry costs {entryCostCredits ?? "…"} credits per participant, host included.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Party name (optional)</Label>
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Friday Night Anime Club"
                maxLength={60}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Anime (from your library)</Label>
              {ownedAnimes.length === 0 ? (
                <p className="text-xs text-muted-foreground rounded-xl border border-dashed p-4">
                  You don&apos;t own any animes yet. Grab some free ones or purchase with credits first!
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto fancy-scroll p-1">
                  {ownedAnimes.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelAnime(a.slug)}
                      className={cn(
                        "relative aspect-[2/3] rounded-lg overflow-hidden border-2 transition",
                        selAnime === a.slug ? "border-primary shadow-lg shadow-primary/25" : "border-transparent opacity-70 hover:opacity-100"
                      )}
                      aria-label={a.title}
                    >
                      <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selAnime && episodes.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Episode</Label>
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto fancy-scroll p-1">
                  {episodes.map((ep) => (
                    <button
                      key={ep.id}
                      onClick={() => setSelEpisode(ep.id)}
                      className={cn(
                        "text-xs font-bold rounded-lg border px-2 py-2 truncate transition",
                        selEpisode === ep.id
                          ? "brand-gradient text-white border-transparent"
                          : "hover:border-primary/50"
                      )}
                    >
                      EP {ep.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selAnime && episodes.length === 0 && (
              <p className="text-xs text-muted-foreground rounded-xl border border-dashed p-4">
                No owned/free episodes have HLS playback yet. Create an episode, prepare its HLS files locally, then upload them to the R2 path shown in Creator Studio.
              </p>
            )}
            <Button
              disabled={!selEpisode || creating}
              onClick={createRoom}
              className="w-full h-11 rounded-xl brand-gradient text-white font-bold"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start the Party 🎉"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-[380px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Join a Watch Party</DialogTitle>
            <DialogDescription>
              Enter the 6-character party code. Joining costs {entryCostCredits ?? "…"} credits.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
              placeholder="A1B2C3"
              className="h-12 rounded-xl text-center font-mono text-xl font-bold tracking-[0.3em]"
              aria-label="Party code"
            />
            <Button
              disabled={joinCode.length < 4}
              onClick={() => joinRoom()}
              className="h-12 rounded-xl brand-gradient text-white font-bold px-5"
            >
              Join
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
