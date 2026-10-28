"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward,
  Gauge, Loader2, List, ChevronRight, Users, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface PlayerControls {
  play: (pos?: number) => void;
  pause: (pos?: number) => void;
  seek: (pos: number) => void;
  setRate: (rate: number) => void;
  setVolume: (v: number, muted?: boolean) => void;
  getCurrentTime: () => number;
  /** Returns true when the video element is buffering (waiting for data). */
  isBuffering: () => boolean;
  /** Returns true when playback is paused — including when autoplay was blocked. */
  isPaused: () => boolean;
  /** Guest-side safety net: start playback if the party expects it to be playing. */
  ensurePlaying: () => void;
  /** Guest-side recovery for a buffer that stopped progressing mid-playback. */
  recover: () => void;
  /** Hard local restart: pause, seek to the party position and play again. */
  restart: (pos: number) => void;
  enableAudio: () => void;
}

export interface PlayerEpisode {
  id: string;
  number: number;
  title: string;
  videoUrl: string;
  streamId?: string | null;
  hlsKey?: string | null;
  telegramMessageId?: string | null;
  duration: number;
  progress: { position: number; duration: number; completed: boolean } | null;
}

function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function VideoPlayer({
  episode,
  hasNext,
  onNext,
  onEpisodeSelect,
  episodes,
  title,
  syncMode = false,
  isHost = false,
  syncPaused = false,
  onLocalPlay,
  onLocalPause,
  onLocalSeek,
  onLocalRate,
  onAutoplayBlocked,
  onEnded,
  onSyncReady,
  controlsRef,
}: {
  episode: PlayerEpisode;
  hasNext: boolean;
  onNext: () => void;
  onEpisodeSelect?: (epId: string) => void;
  episodes?: PlayerEpisode[];
  title: string;
  syncMode?: boolean;
  isHost?: boolean;
  /** The party itself is paused (host-side state). Guests cannot resume it. */
  syncPaused?: boolean;
  onLocalPlay?: (pos: number) => void;
  onLocalPause?: (pos: number) => void;
  onLocalSeek?: (pos: number) => void;
  onLocalRate?: (rate: number) => void;
  onAutoplayBlocked?: () => void;
  onEnded?: () => void;
  /** Called in syncMode when video metadata has loaded and the player is ready
   *  to receive a seek + play command. Use this to re-apply the current party
   *  playback state so late-joiners land at the correct live position. */
  onSyncReady?: () => void;
  controlsRef?: React.MutableRefObject<PlayerControls | null>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  // The party said "playing" and the player has not reached that state yet.
  // play() can be interrupted (AbortError) by a seek, so retries are driven by
  // this flag instead of being dropped after the first attempt.
  const wantPlayRef = useRef(false);
  const playRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playRetryCountRef = useRef(0);
  // A play/pause requested before metadata is available. Only the latest one is
  // kept — stacking loadedmetadata listeners made late-joining guests seek and
  // play repeatedly, which looked like an endless loading state.
  const pendingCommandRef = useRef<{ type: "play" | "pause" | "seek"; pos?: number } | null>(null);

  // Stable refs for function props — avoids stale closures in the controlsRef effect
  const onSyncReadyRef = useRef(onSyncReady);
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  useEffect(() => { onSyncReadyRef.current = onSyncReady; }, [onSyncReady]);
  useEffect(() => { onAutoplayBlockedRef.current = onAutoplayBlocked; }, [onAutoplayBlocked]);

  const initialUrl = (() => {
    // HLS sources must be authorized through the API route; never fall back to
    // the Telegram MP4 for these, because those files can be HEVC and iPhone
    // Safari cannot play them.
    if (episode.hlsKey || episode.streamId) return null;
    if (episode.videoUrl && (episode.videoUrl.startsWith("http://") || episode.videoUrl.startsWith("https://"))) {
      return episode.videoUrl;
    }
    const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE_URL || "https://kiluu-stream.onrender.com";
    if (episode.telegramMessageId && streamBase) {
      return `${streamBase.replace(/\/+$/, "")}/stream/${episode.telegramMessageId}`;
    }
    return null;
  })();

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(episode.duration || 0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [resumeAt, setResumeAt] = useState<number | null>(episode.progress?.position || null);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(initialUrl);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [stalled, setStalled] = useState(false);
  // The controls object lives for the lifetime of the player, but playbackUrl
  // arrives later. A ref keeps play() from seeing a stale null URL.
  const playbackUrlRef = useRef<string | null>(initialUrl);
  useEffect(() => { playbackUrlRef.current = playbackUrl; }, [playbackUrl]);
  // Note: parent remounts this component via key={episode.id}, so all state resets naturally

  // Save progress (debounced)
  const saveProgress = useCallback(
    (position: number, dur: number, completed = false) => {
      if (syncMode) return; // watch party doesn't track personal progress
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: episode.id, position, duration: dur, completed }),
      }).catch(() => {});
    },
    [episode.id, syncMode]
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (duration > 0 && current > 3) saveProgress(current, duration);
    }, 2500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [current, duration, saveProgress]);

  useEffect(() => {
    let cancelled = false;

    const directUrl = episode.videoUrl && (episode.videoUrl.startsWith("http://") || episode.videoUrl.startsWith("https://"))
      ? episode.videoUrl
      : null;
    const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE_URL || "https://kiluu-stream.onrender.com";
    const telegramUrl = episode.telegramMessageId && streamBase
      ? `${streamBase.replace(/\/+$/, "")}/stream/${episode.telegramMessageId}`
      : null;
    // Last-resort source if the authorized HLS lookup fails (e.g. R2 object
    // missing). Chrome can still play it; Safari may not if it is HEVC.
    const fallbackUrl = telegramUrl || directUrl;

    // 1. HLS (R2 private bucket or Cloudflare Stream) must be resolved through
    // the API route to get a signed URL. Prefer it over any direct MP4 because
    // iPhone Safari only supports HLS for many codecs.
    if (episode.hlsKey || episode.streamId) {
      fetch(`/api/episodes/${encodeURIComponent(episode.id)}/stream`, { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !data.streamUrl) throw new Error(data.error || "Unable to authorize episode playback");
          if (!cancelled) {
            setPlaybackUrl(data.streamUrl);
            setSourceError(null);
          }
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          if (fallbackUrl) {
            console.warn("HLS playback unavailable, falling back to direct stream", error);
            setPlaybackUrl(fallbackUrl);
            setSourceError(null);
          } else {
            setSourceError(error instanceof Error ? error.message : "Unable to load episode stream");
          }
        });
      return () => { cancelled = true; };
    }

    // 2. Direct HTTP / Telegram URLs are already the initial playbackUrl
    // (the parent remounts this component per episode via key={episode.id}).
    if (directUrl || telegramUrl) {
      return () => { cancelled = true; };
    }

    // 3. Last resort: let the API route decide (may return an error message)
    fetch(`/api/episodes/${encodeURIComponent(episode.id)}/stream`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to authorize episode playback");
        if (!cancelled && data.streamUrl) {
          setPlaybackUrl(data.streamUrl);
          setSourceError(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setSourceError(error instanceof Error ? error.message : "Unable to load episode stream");
      });
    return () => { cancelled = true; };
  }, [episode.id, episode.streamId, episode.hlsKey, episode.videoUrl, episode.telegramMessageId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl || !/\.m3u8(?:$|\?)/i.test(playbackUrl)) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari handles HLS natively — set src directly and call load() so
      // Safari picks up the new source even if the element already exists.
      if (video.src !== playbackUrl) {
        video.src = playbackUrl;
        video.load();
      }
      return;
    }
    if (!Hls.isSupported()) {
      queueMicrotask(() => setSourceError("This browser does not support HLS playback."));
      return;
    }
    const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
    hlsRef.current = hls;
    hls.loadSource(playbackUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setSourceError("The HLS stream could not be played.");
    });
    return () => {
      hlsRef.current = null;
      hls.destroy();
    };
  }, [playbackUrl]);

  // If the stream server is slow to even return metadata (common when it is
  // waking up or busy), offer a manual reload instead of an infinite spinner.
  useEffect(() => {
    if (!playbackUrl || (!waiting && metadataLoaded)) return;
    const timer = setTimeout(() => setStalled(true), 20_000);
    return () => clearTimeout(timer);
  }, [playbackUrl, waiting, metadataLoaded]);

  function clearPlayRetry() {
    if (playRetryTimerRef.current) {
      clearTimeout(playRetryTimerRef.current);
      playRetryTimerRef.current = null;
    }
    playRetryCountRef.current = 0;
  }

  function schedulePlayRetry() {
    if (!syncMode || isHost || !wantPlayRef.current) return;
    if (playRetryTimerRef.current) return;
    if (playRetryCountRef.current >= 20) return;
    playRetryCountRef.current += 1;
    playRetryTimerRef.current = setTimeout(() => {
      playRetryTimerRef.current = null;
      const v = videoRef.current;
      if (!v || !wantPlayRef.current || !v.paused) return;
      attemptPlay();
    }, 400 * Math.min(playRetryCountRef.current, 5));
  }

  function attemptPlay() {
    const v = videoRef.current;
    if (!v) return;
    wantPlayRef.current = true;
    v.play()
      .then(() => {
        clearPlayRetry();
        setPlaying(true);
        setWaiting(false);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          // A seek or source switch interrupted play(). This is normal while
          // seeking to the host's live position right after joining — retry
          // instead of leaving the guest paused forever.
          schedulePlayRetry();
          return;
        }
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          // iOS/Safari blocks unmuted autoplay without a user gesture, but
          // muted playback is allowed. Start silently right away so the guest
          // sees the synced video instead of an endless loading spinner; the
          // party view offers a one-tap unmute.
          try {
            v.muted = true;
            setMuted(true);
            void v.play().then(() => {
              clearPlayRetry();
              setPlaying(true);
              setWaiting(false);
            }).catch(() => {
              setWaiting(false);
              schedulePlayRetry();
            });
          } catch {
            setWaiting(false);
            schedulePlayRetry();
          }
          onAutoplayBlockedRef.current?.();
          return;
        }
        // Any other rejection (e.g. source not loaded yet) must not leave the
        // spinner running forever — retry instead of dropping the party's
        // play command silently.
        setWaiting(false);
        schedulePlayRetry();
      });
  }

  /** Guest safety net: the party says "playing" but the element is still paused. */
  function ensurePlaying() {
    const v = videoRef.current;
    if (!v || !syncMode || isHost || !wantPlayRef.current) return;
    if (!v.paused) return;
    // HAVE_METADATA is enough: play() itself starts fetching the data needed
    // at the party position. Requiring current data here left late joiners
    // paused forever because a paused element may never buffer on its own.
    if (v.readyState < HTMLMediaElement.HAVE_METADATA) return;
    attemptPlay();
  }

  /**
   * Guest safety net: the element reports "playing" but stopped progressing
   * (stalled fetch / wedged seek). Restart HLS loading and nudge the timeline
   * so the media element issues a fresh request, then retry play().
   */
  function recover() {
    const v = videoRef.current;
    if (!v || !syncMode || isHost) return;
    wantPlayRef.current = true;
    // A play() call that never settles leaves the element "unpaused" but with
    // no frames. Pausing first clears that wedged state; this is the same
    // pause → play cycle that manually unsticks a guest. A seek that is still
    // in flight is left alone: restarting it aborts the fragment fetches of a
    // slow start, which is how guests ended up needing a manual pause.
    if (!v.seeking) {
      try {
        v.pause();
      } catch {
        // ignore
      }
      const target = v.currentTime > 0.5 ? v.currentTime - 0.25 : 0.01;
      try {
        v.currentTime = target;
      } catch {
        // Some browsers throw while the element is still initializing.
      }
    }
    hlsRef.current?.startLoad();
    attemptPlay();
  }

  function restart(pos: number) {
    const v = videoRef.current;
    if (!v || !syncMode || isHost) return;
    wantPlayRef.current = true;
    try {
      v.pause();
    } catch {
      // ignore
    }
    if (typeof pos === "number" && isFinite(pos)) {
      try {
        v.currentTime = Math.max(0, Math.min(pos, v.duration || pos));
        setCurrent(v.currentTime);
      } catch {
        // Some browsers throw while the element is still initializing.
      }
    }
    hlsRef.current?.startLoad();
    attemptPlay();
  }

  function applyPendingCommand() {
    const v = videoRef.current;
    const pending = pendingCommandRef.current;
    if (!v || !pending) return;
    pendingCommandRef.current = null;
    if (typeof pending.pos === "number" && isFinite(pending.pos)) {
      v.currentTime = Math.max(0, Math.min(pending.pos, v.duration || pending.pos));
    }
    if (pending.type === "play") {
      wantPlayRef.current = true;
      attemptPlay();
    } else {
      wantPlayRef.current = false;
      v.pause();
    }
  }

  function retrySource() {
    const v = videoRef.current;
    if (!v) return;
    retryCountRef.current = 0;
    clearPlayRetry();
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    pendingCommandRef.current = null;
    setSourceError(null);
    setStalled(false);
    setWaiting(true);
    setMetadataLoaded(false);
    // Managed HLS: restart the loader instead of tearing down the MediaSource.
    if (hlsRef.current) {
      hlsRef.current.startLoad();
      return;
    }
    const savedTime = v.currentTime;
    const onMeta = () => {
      v.removeEventListener("loadedmetadata", onMeta);
      if (!syncMode && savedTime > 0) v.currentTime = savedTime;
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.load();
  }

  useEffect(() => {
    let cancelled = false;
    try {
      const saved = JSON.parse(localStorage.getItem("dubanix.player.audio") || "null");
      if (saved && typeof saved.volume === "number" && typeof saved.muted === "boolean") {
        const safeVolume = Math.max(0, Math.min(1, saved.volume));
        queueMicrotask(() => {
          if (cancelled) return;
          setVolume(safeVolume);
          setMuted(saved.muted);
          if (videoRef.current) {
            videoRef.current.volume = safeVolume;
            videoRef.current.muted = saved.muted;
          }
        });
      }
    } catch {
      try { localStorage.removeItem("dubanix.player.audio"); } catch { /* storage unavailable */ }
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("dubanix.player.audio", JSON.stringify({ volume, muted }));
    } catch {
      toast.warning("Your browser could not save the audio preference.");
    }
  }, [volume, muted]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (duration > 0 && videoRef.current && !syncMode) {
        saveProgress(videoRef.current.currentTime, duration);
      }
    };
  }, [duration, saveProgress, syncMode]);

  // Keyboard shortcuts (handlers stored in a ref so declarations below are safe)
  const handlersRef = useRef<{ togglePlay: () => void; seek: (p: number) => void; toggleFullscreen: () => void; toggleMute: () => void } | null>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const v = videoRef.current;
      const h = handlersRef.current;
      if (!v || !h) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          h.togglePlay();
          break;
        case "ArrowRight":
          if (!syncMode || isHost) h.seek(v.currentTime + 10);
          break;
        case "ArrowLeft":
          if (!syncMode || isHost) h.seek(v.currentTime - 10);
          break;
        case "f":
          h.toggleFullscreen();
          break;
        case "m":
          h.toggleMute();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [syncMode, isHost]);

  // Auto-hide controls
  const wake = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (playRetryTimerRef.current) {
        clearTimeout(playRetryTimerRef.current);
        playRetryTimerRef.current = null;
      }
    };
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (syncMode && !isHost) {
      // Guests cannot control the party, but a tap is a valid user gesture:
      // use it to resume synced playback when mobile autoplay was blocked.
      ensurePlaying();
      return;
    }
    if (!v.src && !playbackUrl) {
      toast.info("Video oqimi ulanmoqda, kuting...", { id: "stream-loading" });
      return;
    }
    if (v.paused) {
      v.play()
        .then(() => {
          setPlaying(true);
          onLocalPlay?.(v.currentTime);
        })
        .catch((err) => {
          console.warn("Video play error:", err);
          if (err && err.name === "AbortError") {
            return;
          }
          if (err && err.name === "NotAllowedError") {
            v.muted = true;
            v.play().then(() => {
              setPlaying(true);
              onLocalPlay?.(v.currentTime);
              toast.info("Ovozni yoqish uchun pleyerdagi karnay belgisini bosing", { id: "unmute-hint" });
            }).catch(() => {
              toast.error("Brauzer videoni ijro etishni chekladi. Qaytadan urinib ko'ring.");
            });
          } else if (err && err.name === "NotSupportedError") {
            toast.info("Video manbasi yuklanmoqda, iltimos kuting...", { id: "stream-connecting" });
          } else {
            toast.error("Videoni o'ynatishda xatolik yuz berdi. Sahifani yangilab ko'ring.");
          }
        });
    } else {
      v.pause();
      setPlaying(false);
      onLocalPause?.(v.currentTime);
    }
    wake();
  }

  function seek(pos: number) {
    const v = videoRef.current;
    if (!v || !isFinite(pos)) return;
    v.currentTime = Math.max(0, Math.min(pos, v.duration || pos));
    setCurrent(v.currentTime);
    onLocalSeek?.(v.currentTime);
    wake();
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function toggleFullscreen() {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      c.requestFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    function onFs() {
      setFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function setRate(r: number) {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = r;
    setSpeed(r);
    setSpeedOpen(false);
    onLocalRate?.(r);
  }

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;

  // Keep latest handlers for the keyboard effect
  useEffect(() => {
    handlersRef.current = { togglePlay, seek, toggleFullscreen, toggleMute };
    return () => {
      handlersRef.current = null;
    };
  });

  // Expose imperative controls for watch-party sync
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      play: (pos?: number) => {
        const v = videoRef.current;
        if (!v) return;
        wantPlayRef.current = true;
        const hasMeta = v.readyState >= HTMLMediaElement.HAVE_METADATA;
        if (hasMeta && typeof pos === "number" && isFinite(pos)) {
          v.currentTime = Math.max(0, Math.min(pos, v.duration || pos));
          setCurrent(v.currentTime);
        }
        if (!v.src && !playbackUrlRef.current) {
          // The signed stream URL may still be loading. Keep the party's play
          // command instead of dropping it, so joining guests start as soon as
          // the source is ready.
          pendingCommandRef.current = {
            type: "play",
            pos: typeof pos === "number" && isFinite(pos) ? pos : undefined,
          };
          return;
        }
        if (!hasMeta) {
          // The player may mount (and receive the party state) before the
          // stream metadata is available. Keep one pending command and apply
          // it on loadedmetadata instead of stacking listeners.
          pendingCommandRef.current = {
            type: "play",
            pos: typeof pos === "number" && isFinite(pos) ? pos : undefined,
          };
          return;
        }
        attemptPlay();
      },
      pause: (pos?: number) => {
        const v = videoRef.current;
        if (!v) return;
        wantPlayRef.current = false;
        clearPlayRetry();
        const hasMeta = v.readyState >= HTMLMediaElement.HAVE_METADATA;
        if (hasMeta && typeof pos === "number" && isFinite(pos)) {
          v.currentTime = Math.max(0, Math.min(pos, v.duration || pos));
          setCurrent(v.currentTime);
        }
        if (!hasMeta) {
          pendingCommandRef.current = {
            type: "pause",
            pos: typeof pos === "number" && isFinite(pos) ? pos : undefined,
          };
        }
        v.pause();
        setPlaying(false);
        setWaiting(false);
      },
      seek: (pos: number) => {
        const v = videoRef.current;
        if (!v || !isFinite(pos)) return;
        if (v.readyState < HTMLMediaElement.HAVE_METADATA) {
          pendingCommandRef.current = { type: "seek", pos };
          return;
        }
        v.currentTime = Math.max(0, Math.min(pos, v.duration || pos));
        setCurrent(v.currentTime);
      },
      setRate: (rate: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.playbackRate = rate;
        setSpeed(rate);
      },
      setVolume: (vol: number, mut?: boolean) => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = vol;
        v.muted = Boolean(mut);
        setVolume(vol);
        setMuted(Boolean(mut));
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
      isBuffering: () => {
        const v = videoRef.current;
        if (!v) return false;
        // A pending seek also counts as buffering: correcting drift while the
        // element is seeking interrupts the download and can loop forever.
        return v.seeking || v.readyState < HTMLMediaElement.HAVE_FUTURE_DATA;
      },
      isPaused: () => videoRef.current?.paused ?? true,
      ensurePlaying,
      recover,
      restart,
      enableAudio: () => {
        const v = videoRef.current;
        if (!v) return;
        // Called from a click/tap handler, so unmuting and playing here
        // satisfies mobile autoplay policies.
        wantPlayRef.current = true;
        v.muted = false;
        setMuted(false);
        void v.play().then(() => {
          clearPlayRetry();
          setPlaying(true);
          setWaiting(false);
        }).catch(() => {
          toast.error("This browser did not allow playback. Use the video Play control once.");
        });
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef, isHost, syncMode]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full bg-black rounded-none sm:rounded-2xl overflow-hidden group select-none",
        fullscreen && "rounded-none",
        !showControls && playing && "cursor-none"
      )}
      onMouseMove={wake}
      onTouchStart={wake}
      aria-label="Video player"
    >
      <video
        ref={videoRef}
        src={playbackUrl && !/\.m3u8(?:$|\?)/i.test(playbackUrl) ? playbackUrl : undefined}
        className="w-full aspect-video max-h-[82vh] object-contain bg-black"
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setMetadataLoaded(true);
          setStalled(false);
          setDuration(v.duration || episode.duration || 0);
          v.volume = volume;
          v.playbackRate = speed;
          if (syncMode) {
            // Let the party state drive the seek position with a freshly
            // computed live position instead of the stale snapshot captured
            // at join-time. Applying the pending command here as well issued a
            // second seek that aborted the first play() and left guests on a
            // black frame until the host paused and resumed.
            pendingCommandRef.current = null;
            onSyncReadyRef.current?.();
          } else {
            applyPendingCommand();
            if (!seekedRef.current && resumeAt && resumeAt > 5 && resumeAt < (v.duration || Infinity) - 10) {
              // Resume from saved position (normal watch mode only)
              v.currentTime = resumeAt;
            }
          }
          seekedRef.current = true;
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPlaying={() => {
          clearPlayRetry();
          setWaiting(false);
          setStalled(false);
        }}
        onSeeked={() => {
          // The seek target is now buffered. Clear the spinner so a guest that
          // is paused at the host's position sees the frame instead of an
          // endless loading state.
          setWaiting(false);
          ensurePlaying();
        }}
        onLoadedData={(e) => {
          // HAVE_CURRENT_DATA reached: enough data exists at the current
          // position even if the element never gets as far as canplay while paused.
          if (e.currentTarget.paused) setWaiting(false);
        }}
        onPause={() => {
          setPlaying(false);
          // A blocked autoplay leaves the element paused; never keep the
          // loading spinner up in that state.
          setWaiting(false);
        }}
        onWaiting={() => setWaiting(true)}
        onCanPlay={() => {
          setWaiting(false);
          setStalled(false);
          setSourceError(null);
          retryCountRef.current = 0; // reset retry counter on successful load
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
          // The source just became playable — resume if the party expects
          // playback (this is the reliable moment right after joining).
          ensurePlaying();
        }}
        onError={(e) => {
          setWaiting(false);
          setStalled(false);
          const err = e.currentTarget.error;
          if (err && err.code === 1) return; // MEDIA_ERR_ABORTED — ignore
          if (!playbackUrl) return;
          // MEDIA_ERR_NETWORK (2) — server may be waking up, auto-retry up to 3 times
          if (err && err.code === 2 && retryCountRef.current < 3) {
            retryCountRef.current += 1;
            const delay = retryCountRef.current * 5000; // 5s, 10s, 15s
            setSourceError(`Video yuklanmoqda, qayta urinilmoqda… (${retryCountRef.current}/3)`);
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
            retryTimerRef.current = setTimeout(() => {
              const v = videoRef.current;
              if (!v) return;
              // Snapshot the time BEFORE load(); setting currentTime immediately
              // after load() is unreliable on Safari — it must be done after
              // the loadedmetadata event fires.
              const savedTime = v.currentTime;
              const onMeta = () => {
                v.removeEventListener("loadedmetadata", onMeta);
                if (!syncMode && savedTime > 0) v.currentTime = savedTime;
              };
              v.addEventListener("loadedmetadata", onMeta);
              v.load(); // reload source
              setSourceError(null);
              setWaiting(true);
            }, delay);
            return;
          }
          retryCountRef.current = 0;
          if (err && err.code === 4) {
            // MEDIA_ERR_SRC_NOT_SUPPORTED. On iPhone this almost always means
            // the MP4 is HEVC (hev1) or not faststart — Safari needs H.264 or
            // an HLS rendition.
            setSourceError("Bu video formati brauzerda qo'llab-quvvatlanmaydi. iPhone uchun H.264 yoki HLS versiyasi kerak.");
          } else if (err && err.code === 3) {
            setSourceError("Videoni dekodlashda xatolik yuz berdi. Sahifani yangilab qayta urinib ko'ring.");
          } else {
            setSourceError("Video yuklanmadi. Sahifani yangilab ko'ring yoki biroz kutib yana urinib ko'ring.");
          }
        }}
        onEnded={() => {
          setPlaying(false);
          if (duration > 0) saveProgress(duration, duration, true);
          onEnded?.();
        }}
        onClick={togglePlay}
      />

      {sourceError && (
        <div className="absolute inset-x-4 top-16 z-10 rounded-xl bg-black/80 px-4 py-3 text-center text-sm text-white">
          <p>{sourceError}</p>
          {playbackUrl && (
            <button
              onClick={retrySource}
              className="mt-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold hover:bg-white/25 transition"
            >
              Qayta urinish
            </button>
          )}
        </div>
      )}

      {/* Slow-stream fallback: the server may be waking up or busy */}
      {stalled && !sourceError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/50">
          <p className="px-6 text-center text-sm text-white/90">Video hali yuklanmoqda…</p>
          <button
            onClick={retrySource}
            className="rounded-full bg-white/15 px-5 py-2 text-xs font-bold text-white hover:bg-white/25 transition"
          >
            Qayta urinish
          </button>
        </div>
      )}

      {/* Loading spinner */}
      {waiting && !stalled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 animate-spin text-white/80" />
        </div>
      )}

      {/* Sync badge */}
      {syncMode && (
        <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur text-white text-xs font-bold border border-white/15">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          Watch Party
          <span className="text-white/60 font-normal">· {isHost ? "You control playback" : "Host controls playback"}</span>
        </div>
      )}

      {/* Center play button */}
      {!playing && !waiting && (!syncMode || isHost || !syncPaused) && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
          aria-label="Play"
        >
          <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full brand-gradient flex items-center justify-center shadow-2xl shadow-primary/50 hover:scale-105 active:scale-95 transition">
            <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-white text-white ml-1" />
          </span>
        </button>
      )}

      {/* Guest view of a paused party: the host paused on purpose, so a play
          button here would only look broken. */}
      {syncMode && !isHost && syncPaused && !playing && !waiting && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-black/65 backdrop-blur px-4 py-2 text-xs font-semibold text-white/85 border border-white/15">
            Host paused the video
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-10 px-3 sm:px-5 pb-3 transition-opacity duration-300",
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Seek bar */}
        <div className="relative flex items-center group/seek mb-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={current}
            onChange={(e) => {
              if (syncMode && !isHost) {
                toast.info("Only the host can seek in a party", { id: "host-seek" });
                return;
              }
              seek(parseFloat(e.target.value));
            }}
            className="player-range w-full h-1.5"
            style={{ ["--fill" as string]: `${progressPct}%` }}
            aria-label="Seek"
            disabled={syncMode && !isHost}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 text-white">
          <button onClick={togglePlay} className="p-2 hover:scale-110 transition" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white" />}
          </button>

          {!syncMode && (
            <button
              onClick={() => seek((videoRef.current?.currentTime || 0) - 10)}
              className="p-2 hover:scale-110 transition hidden sm:block"
              aria-label="Back 10 seconds"
            >
              <SkipBack className="w-4.5 h-4.5" />
            </button>
          )}
          {!syncMode && (
            <button
              onClick={() => seek((videoRef.current?.currentTime || 0) + 10)}
              className="p-2 hover:scale-110 transition hidden sm:block"
              aria-label="Forward 10 seconds"
            >
              <SkipForward className="w-4.5 h-4.5" />
            </button>
          )}

          {/* Volume */}
          <div className="flex items-center group/vol">
            <button onClick={toggleMute} className="p-2 hover:scale-110 transition" aria-label="Mute">
              {muted || volume === 0 ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                setMuted(val === 0);
                if (videoRef.current) {
                  videoRef.current.volume = val;
                  videoRef.current.muted = val === 0;
                }
              }}
              className="player-range w-0 group-hover/vol:w-16 sm:w-16 transition-all h-1"
              style={{ ["--fill" as string]: `${(muted ? 0 : volume) * 100}%` }}
              aria-label="Volume"
            />
          </div>

          <span className="text-[11px] sm:text-xs font-mono tabular-nums text-white/90 ml-1">
            {fmtTime(current)} <span className="text-white/50">/ {fmtTime(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {/* Speed */}
            <div className="relative">
              <button
                onClick={() => setSpeedOpen(!speedOpen)}
                className="p-2 hover:scale-110 transition flex items-center gap-1 text-[11px] font-bold"
                aria-label="Playback speed"
              >
                <Gauge className="w-4 h-4" />
                <span className="hidden sm:inline">{speed}x</span>
              </button>
              {speedOpen && (
                <div className="absolute bottom-10 right-0 glass-dark bg-black/85 backdrop-blur rounded-xl border border-white/15 p-1.5 space-y-0.5 min-w-[86px]">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setRate(s)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/15 transition flex items-center justify-between",
                        s === speed ? "text-amber-400" : "text-white/80"
                      )}
                    >
                      {s}x {s === speed && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episode list */}
            {episodes && episodes.length > 0 && !syncMode && (
              <div className="relative">
                <button
                  onClick={() => setListOpen(!listOpen)}
                  className="p-2 hover:scale-110 transition"
                  aria-label="Episode list"
                >
                  <List className="w-4.5 h-4.5" />
                </button>
                {listOpen && (
                  <div className="absolute bottom-10 right-0 w-72 max-w-[80vw] glass-dark bg-black/85 backdrop-blur rounded-xl border border-white/15 p-2 max-h-72 overflow-y-auto fancy-scroll">
                    <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold px-2 pb-1.5">Episodes</p>
                    {episodes.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => {
                          onEpisodeSelect?.(ep.id);
                          setListOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-white/10 transition",
                          ep.id === episode.id && "bg-white/10"
                        )}
                      >
                        <span className={cn(
                          "text-[10px] font-black w-7 shrink-0",
                          ep.id === episode.id ? "text-amber-400" : "text-white/50"
                        )}>
                          {String(ep.number).padStart(2, "0")}
                        </span>
                        <span className={cn("text-xs truncate", ep.id === episode.id ? "text-white font-bold" : "text-white/75")}>
                          {ep.title}
                        </span>
                        {ep.progress?.completed && <Check className="w-3 h-3 text-emerald-400 ml-auto shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Next episode */}
            {hasNext && !syncMode && (
              <button
                onClick={onNext}
                className="p-2 hover:scale-110 transition"
                aria-label="Next episode"
              >
                <ChevronRight className="w-4.5 h-4.5" />
              </button>
            )}

            <button onClick={toggleFullscreen} className="p-2 hover:scale-110 transition" aria-label="Fullscreen">
              {fullscreen ? <Minimize className="w-4.5 h-4.5" /> : <Maximize className="w-4.5 h-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Title overlay top */}
      <div
        className={cn(
          "absolute top-0 inset-x-0 bg-gradient-to-b from-black/70 to-transparent p-4 pr-3 pb-8 transition-opacity duration-300",
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <p className="text-white text-sm font-bold truncate">{title}</p>
        <p className="text-white/70 text-xs">
          EP {String(episode.number).padStart(2, "0")} · {episode.title}
        </p>
      </div>
    </div>
  );
}
