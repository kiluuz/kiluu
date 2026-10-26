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
  onLocalPlay,
  onLocalPause,
  onLocalSeek,
  onLocalRate,
  onAutoplayBlocked,
  onEnded,
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
  onLocalPlay?: (pos: number) => void;
  onLocalPause?: (pos: number) => void;
  onLocalSeek?: (pos: number) => void;
  onLocalRate?: (rate: number) => void;
  onAutoplayBlocked?: () => void;
  onEnded?: () => void;
  controlsRef?: React.MutableRefObject<PlayerControls | null>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekedRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const initialUrl = (() => {
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

    // 1. Direct HTTP streaming URL (e.g. from Render stream bot or CDN)
    if (episode.videoUrl && (episode.videoUrl.startsWith("http://") || episode.videoUrl.startsWith("https://"))) {
      setPlaybackUrl(episode.videoUrl);
      setSourceError(null);
      return () => { cancelled = true; };
    }

    // 2. Direct Telegram Message ID with Stream Server base URL
    const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE_URL || "https://kiluu-stream.onrender.com";
    if (episode.telegramMessageId && streamBase) {
      const directUrl = `${streamBase.replace(/\/+$/, "")}/stream/${episode.telegramMessageId}`;
      setPlaybackUrl(directUrl);
      setSourceError(null);
      return () => { cancelled = true; };
    }

    // 3. Fallback to API route (handles HLS, Cloudflare Stream, R2 signed URLs)
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
      video.src = playbackUrl;
      return;
    }
    if (!Hls.isSupported()) {
      queueMicrotask(() => setSourceError("This browser does not support HLS playback."));
      return;
    }
    const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 });
    hls.loadSource(playbackUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) setSourceError("The HLS stream could not be played.");
    });
    return () => hls.destroy();
  }, [playbackUrl]);

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
    };
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (syncMode && !isHost) {
      toast.info("Only the party host controls playback", { id: "host-only" });
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
        if (!v.src && !playbackUrl) return;
        if (typeof pos === "number" && isFinite(pos)) v.currentTime = pos;
        // If metadata not yet loaded, defer until it is
        if (v.readyState < HTMLMediaElement.HAVE_METADATA) {
          const onReady = () => {
            v.removeEventListener("loadedmetadata", onReady);
            if (typeof pos === "number" && isFinite(pos)) v.currentTime = pos;
            v.play().then(() => setPlaying(true)).catch((err) => {
              if (err && err.name === "AbortError") return;
              if (err && err.name === "NotAllowedError") {
                toast.info("Tap the video once to allow playback audio in this browser.", { id: "party-autoplay" });
                onAutoplayBlocked?.();
              }
            });
          };
          v.addEventListener("loadedmetadata", onReady);
          return;
        }
        v.play().then(() => setPlaying(true)).catch((err) => {
          if (err && err.name === "AbortError") return;
          if (err && err.name === "NotAllowedError") {
            toast.info("Tap the video once to allow playback audio in this browser.", { id: "party-autoplay" });
            onAutoplayBlocked?.();
          }
        });
      },
      pause: (pos?: number) => {
        const v = videoRef.current;
        if (!v) return;
        if (typeof pos === "number" && isFinite(pos)) v.currentTime = pos;
        v.pause();
        setPlaying(false);
      },
      seek: (pos: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = pos;
        setCurrent(pos);
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
        // HAVE_FUTURE_DATA = 3, HAVE_ENOUGH_DATA = 4
        // readyState < 3 means not enough data to play from current position
        return v.readyState < 3;
      },
      enableAudio: () => {
        const v = videoRef.current;
        if (!v) return;
        const wasMuted = v.muted;
        v.muted = true;
        v.play().then(() => {
          v.pause();
          v.muted = wasMuted;
          setPlaying(false);
        }).catch(() => {
          v.muted = wasMuted;
          toast.error("This browser did not allow playback. Use the video Play control once.");
        });
      },
    };
    return () => {
      controlsRef.current = null;
    };
  }, [controlsRef]);

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
          setDuration(v.duration || episode.duration || 0);
          v.volume = volume;
          v.playbackRate = speed;
          // Resume from saved position
          if (!seekedRef.current && resumeAt && resumeAt > 5 && resumeAt < (v.duration || Infinity) - 10) {
            v.currentTime = resumeAt;
          }
          seekedRef.current = true;
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => {
          setWaiting(false);
          setSourceError(null);
          retryCountRef.current = 0; // reset retry counter on successful load
          if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        }}
        onError={(e) => {
          setWaiting(false);
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
              const currentTime = v.currentTime;
              v.load(); // reload source
              v.currentTime = currentTime;
              setSourceError(null);
            }, delay);
            return;
          }
          retryCountRef.current = 0;
          setSourceError("Video yuklanmadi. Sahifani yangilab ko'ring yoki biroz kutib yana urinib ko'ring.");
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
          {sourceError}
        </div>
      )}

      {/* Loading spinner */}
      {waiting && (
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
      {!playing && !waiting && (
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
