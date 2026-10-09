"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AudioLines, Search, Check, Lock, Play, Coins, Sparkles, Languages,
  Wand2, ArrowRight, BadgeCheck, Clock3, Loader2, Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { Logo } from "../logo";
import { SmartImage, formatCredits, formatDuration } from "../ui-bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AnimeSummary, DubJobItem } from "../types";

/* ---------- catalog data ---------- */

const LANGUAGES = [
  {
    code: "uz",
    name: "O'zbekcha",
    flag: "🇺🇿",
    note: "Live now · 15 credits per episode",
    live: true,
  },
  {
    code: "kk",
    name: "Қазақша",
    flag: "🇰🇿",
    note: "Coming soon",
    live: false,
  },
  {
    code: "ky",
    name: "Кыргызча",
    flag: "🇰🇬",
    note: "Coming soon",
    live: false,
  },
] as const;

const VOICES = [
  { id: "aziza", name: "Aziza", style: "Warm narrator", gender: "Female", price: 15, gradient: "from-rose-500/80 to-orange-400/80" },
  { id: "timur", name: "Timur", style: "Confident lead", gender: "Male", price: 15, gradient: "from-sky-500/80 to-cyan-400/80" },
  { id: "dilnoza", name: "Dilnoza", style: "Expressive young", gender: "Female", price: 20, gradient: "from-violet-500/80 to-fuchsia-400/80" },
  { id: "ulugbek", name: "Ulugbek", style: "Deep villain", gender: "Male", price: 20, gradient: "from-emerald-500/80 to-teal-400/80" },
  { id: "premium_cast", name: "Full Cast", style: "Multi-voice ensemble", gender: "Ensemble", price: 25, gradient: "from-amber-500/80 to-red-400/80" },
] as const;

const STAGES = [
  { id: "analyze", label: "Analyzing source", desc: "Isolating vocals from the Japanese mix" },
  { id: "transcribe", label: "Transcribing JA", desc: "Speech-to-text with speaker diarization" },
  { id: "translate", label: "Translating → UZ", desc: "Adapting dialogue, timing and nuance" },
  { id: "synthesize", label: "Voice synthesis", desc: "Cloning tone, emotion and pacing" },
  { id: "mix", label: "Mix & master", desc: "Re-adding music and sound effects" },
] as const;

/* ---------- tiny building blocks ---------- */

function Waveform({ active, bars = 28, className }: { active: boolean; bars?: number; className?: string }) {
  return (
    <div className={cn("flex items-end justify-center gap-[3px] h-12", className)} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 22 + Math.abs(Math.sin(i * 0.9)) * 60 + (i % 4) * 6;
        return (
          <span
            key={i}
            className={cn("w-[4px] rounded-full brand-gradient", active && "wave-bar")}
            style={{
              height: `${Math.min(h, 100)}%`,
              animationDelay: `${(i % 9) * 0.09}s`,
              opacity: active ? 1 : 0.25,
            }}
          />
        );
      })}
    </div>
  );
}

function StageStepper({ current }: { current: number }) {
  return (
    <ol className="space-y-0.5" aria-label="Dubbing pipeline">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.id} className="flex items-start gap-3 py-2">
            <span
              className={cn(
                "mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                done && "bg-primary border-primary text-white",
                active && "border-primary text-primary step-pulse",
                !done && !active && "border-border text-muted-foreground/50"
              )}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-black">{i + 1}</span>}
            </span>
            <span>
              <span
                className={cn(
                  "block text-[13px] font-bold",
                  done && "text-foreground",
                  active && "text-primary",
                  !done && !active && "text-muted-foreground/60"
                )}
              >
                {s.label}
              </span>
              <span className="block text-[11px] text-muted-foreground/70">{s.desc}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- main view ---------- */

interface EpisodeOpt {
  id: string;
  number: number;
  title: string;
  duration: number;
}

export function DubbingView() {
  const { user, navigate, updateUser } = useAppStore();

  const [animes, setAnimes] = useState<AnimeSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [animeId, setAnimeId] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeOpt[] | null>(null);
  const [epLoading, setEpLoading] = useState(false);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DubJobItem[]>([]);

  // processing
  const [stage, setStage] = useState(-1); // -1 idle, 0..4 stages, 5 done
  const [submitting, setSubmitting] = useState(false);

  const selectedAnime = animes?.find((a) => a.id === animeId) || null;
  const selectedEpisode = episodes?.find((e) => e.id === episodeId) || null;
  /* Studio voice used for every dub (voice picker removed by request) — API stays unchanged */
  const selectedVoice = VOICES[0];

  // load catalog (ownable: free or owned) + my jobs
  useEffect(() => {
    let alive = true;
    fetch("/api/animes")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setAnimes((d.animes || []).filter((a: AnimeSummary) => a.isFree || a.owned));
      })
      .catch(() => toast.error("Failed to load animes"));
    if (user) {
      fetch("/api/dubbing")
        .then((r) => r.json())
        .then((d) => alive && setJobs(d.jobs || []))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // load episodes of the selected anime
  useEffect(() => {
    if (!animeId || !selectedAnime) {
      setEpisodes(null);
      return;
    }
    setEpLoading(true);
    setEpisodeId(null);
    fetch(`/api/animes/${selectedAnime.slug}`)
      .then((r) => r.json())
      .then((d) => setEpisodes(d.episodes || []))
      .catch(() => toast.error("Failed to load episodes"))
      .finally(() => setEpLoading(false));
  }, [animeId, selectedAnime]);

  const dubbedEpNumbers = useMemo(() => {
    if (!selectedAnime) return new Set<number>();
    return new Set(
      jobs.filter((j) => j.animeSlug === selectedAnime.slug && j.targetLang === "uz").map((j) => j.episodeNumber)
    );
  }, [jobs, selectedAnime]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return animes || [];
    return (animes || []).filter((a) => a.title.toLowerCase().includes(q) || a.genres.join(" ").toLowerCase().includes(q));
  }, [animes, query]);

  async function startDub() {
    if (!user) {
      navigate("login");
      return;
    }
    if (!episodeId || !selectedAnime || !selectedEpisode) {
      toast.error("Pick an anime and an episode first");
      return;
    }
    if (user.credits < selectedVoice.price) {
      toast.error(`Not enough credits — you need ${selectedVoice.price - user.credits} more`);
      navigate("credits");
      return;
    }
    setSubmitting(true);
    setStage(0);
    const startedAt = Date.now();

    // stage choreography (min 4.4s) runs in parallel with the API call
    const timers = [400, 1300, 2300, 3200, 4100].map((ms, i) =>
      setTimeout(() => setStage(i + 1), ms)
    );

    try {
      const res = await fetch("/api/dubbing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId, voice: selectedVoice.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Dubbing failed");
        setStage(-1);
        return;
      }
      // hold until the stage animation lands
      const remaining = 4400 - (Date.now() - startedAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      setJobs((prev) => [data.job, ...prev]);
      if (data.credits !== undefined) updateUser({ credits: data.credits });
      toast.success(`EP${selectedEpisode.number} dubbed to Uzbek — ovozli tamilga tayyor!`);
    } catch {
      toast.error("Network error");
      setStage(-1);
    } finally {
      timers.forEach(clearTimeout);
      setSubmitting(false);
    }
  }

  const processing = stage >= 0 && stage <= 4;

  return (
    <div className="pb-10">
      {/* ===== Header ===== */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
              <Logo variant="mark" size={40} state={processing ? "playing" : "idle"} animated />
              AI Dubbing Studio
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-xl">
              Replace Japanese voices with Uzbek — pick a series you own, choose an episode,
              and let the pipeline do the rest. Powered by your credits.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2 text-xs bg-card border rounded-full px-3.5 py-2 font-semibold">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              {formatCredits(user.credits)} credits
            </div>
          )}
        </div>

        {/* Language cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
          {LANGUAGES.map((l) => (
            <div
              key={l.code}
              className={cn(
                "relative rounded-2xl border p-4 flex items-center gap-3.5 transition-all",
                l.live
                  ? "border-primary/50 bg-primary/[0.07] shadow-[0_0_24px_-12px_var(--glow)]"
                  : "border-dashed opacity-60"
              )}
            >
              <span className="text-2xl">{l.flag}</span>
              <div className="flex-1">
                <p className="font-bold text-[14px] flex items-center gap-2">
                  {l.name}
                  {l.live ? (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      LIVE
                    </span>
                  ) : (
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{l.note}</p>
              </div>
              {l.live && <AudioLines className="w-4 h-4 text-primary" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 grid lg:grid-cols-[1fr_360px] gap-6">
        {/* ===== LEFT: pickers ===== */}
        <div className="space-y-6">
          {/* Processing panel replaces pickers while running */}
          {processing ? (
            <div className="rounded-2xl border aurora relative overflow-hidden p-6 sm:p-8">
              <div className="relative flex flex-col sm:flex-row items-center gap-8">
                <div className="flex-1 w-full">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary mb-1 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Dubbing in progress
                  </p>
                  <h3 className="font-display text-xl font-black mb-4">
                    {selectedAnime?.title} — EP{selectedEpisode?.number}
                  </h3>
                  <StageStepper current={stage} />
                </div>
                <div className="w-full sm:w-[300px] shrink-0">
                  <div className="rounded-xl border bg-card/70 backdrop-blur p-5">
                    <Waveform active bars={32} />
                    <p className="text-center text-[11px] text-muted-foreground mt-3">
                      日本語 → O'zbek · {selectedVoice.name} voice
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Anime picker */}
              <section aria-label="Pick an anime">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Film className="w-[18px] h-[18px] text-primary" />
                    1 · Pick an anime
                    <span className="text-[11px] font-medium text-muted-foreground">(free or owned)</span>
                  </h2>
                  <div className="relative w-52 sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter..."
                      className="pl-9 h-9 rounded-xl text-[13px]"
                      aria-label="Filter animes"
                    />
                  </div>
                </div>

                {!animes ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="aspect-[2/3] rounded-xl skeleton" />
                    ))}
                  </div>
                ) : animes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-10 text-center">
                    <Film className="w-9 h-9 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="font-bold">Nothing to dub yet</p>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      Dubbing works on free animes and titles in your library.
                    </p>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigate("browse")}>
                      Discover animes <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-3 max-h-[340px] overflow-y-auto pr-1">
                    {filtered.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setAnimeId(a.id)}
                        className={cn(
                          "group relative aspect-[2/3] rounded-xl overflow-hidden border-2 transition-all",
                          animeId === a.id
                            ? "border-primary shadow-[0_0_24px_-8px_var(--glow)]"
                            : "border-transparent hover:border-primary/40"
                        )}
                        aria-pressed={animeId === a.id}
                        aria-label={`Dub ${a.title}`}
                      >
                        <SmartImage src={a.coverImage} alt={a.title} className="w-full h-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-5">
                          <span className="block text-[10.5px] font-bold text-white line-clamp-2 text-left leading-tight">
                            {a.title}
                          </span>
                        </span>
                        {animeId === a.id && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full brand-gradient flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Episode picker */}
              {selectedAnime && (
                <section aria-label="Pick an episode">
                  <h2 className="text-base font-bold flex items-center gap-2 mb-3">
                    <Play className="w-[18px] h-[18px] text-primary" />
                    2 · Pick an episode
                  </h2>
                  {epLoading ? (
                    <div className="space-y-2">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-12 rounded-xl skeleton" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2 max-h-[260px] overflow-y-auto pr-1">
                      {(episodes || []).map((ep) => {
                        const dubbed = dubbedEpNumbers.has(ep.number);
                        return (
                          <button
                            key={ep.id}
                            disabled={dubbed}
                            onClick={() => setEpisodeId(ep.id)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                              dubbed
                                ? "opacity-50 cursor-not-allowed border-border"
                                : episodeId === ep.id
                                  ? "border-primary bg-primary/10"
                                  : "hover:border-primary/40 bg-card"
                            )}
                            aria-pressed={episodeId === ep.id}
                          >
                            <span
                              className={cn(
                                "w-9 h-9 rounded-lg flex items-center justify-center text-[12px] font-black shrink-0",
                                episodeId === ep.id ? "brand-gradient text-white" : "bg-accent"
                              )}
                            >
                              {ep.number}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-[13px] font-bold truncate">{ep.title}</span>
                              <span className="block text-[11px] text-muted-foreground">
                                {formatDuration(ep.duration)}
                              </span>
                            </span>
                            {dubbed ? (
                              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400">
                                <BadgeCheck className="w-3.5 h-3.5" /> UZ
                              </span>
                            ) : (
                              <Languages className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* ===== RIGHT: order summary ===== */}
        <div className="space-y-4">
          {/* Order summary */}
          <section className="rounded-2xl border aurora relative overflow-hidden p-4" aria-label="Order summary">
            <div className="relative">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Episode</span>
                <span className="font-bold text-[13px] truncate max-w-[190px]">
                  {selectedEpisode
                    ? `${selectedAnime?.title} · EP${selectedEpisode.number}`
                    : "— not selected —"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">Voice</span>
                <span className="font-bold text-[13px]">{selectedVoice.name} · {selectedVoice.style}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-bold text-[13px]">
                  {selectedEpisode ? formatDuration(selectedEpisode.duration) : "—"}
                </span>
              </div>
              <div className="border-t border-border/70 pt-3 flex items-center justify-between">
                <span className="text-[13px] font-bold flex items-center gap-1.5">
                  <Wand2 className="w-4 h-4 text-primary" /> Total
                </span>
                <span className="text-xl font-black text-amber-500 flex items-center gap-1.5">
                  <Coins className="w-[18px] h-[18px]" />
                  {selectedVoice.price}
                </span>
              </div>
              <Button
                onClick={startDub}
                disabled={processing || submitting || !episodeId}
                className="w-full mt-4 h-12 rounded-xl brand-gradient hover:opacity-90 text-white font-bold"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Dubbing...
                  </>
                ) : !user ? (
                  "Sign in to dub"
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Dub to Uzbek — {selectedVoice.price} credits
                  </>
                )}
              </Button>
              <p className="text-[10.5px] text-muted-foreground text-center mt-2.5 leading-relaxed">
                Output replaces the Japanese vocal track in your player.
                <br />
                Music and sound effects are preserved.
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* ===== My dubs ===== */}
      {user && (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 mt-8">
          <h2 className="text-base font-bold flex items-center gap-2 mb-3">
            <Clock3 className="w-[18px] h-[18px] text-primary" />
            My dubs
            <span className="text-[11px] font-medium text-muted-foreground">({jobs.length})</span>
          </h2>
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No dubs yet — your Uzbek library starts with one episode.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {jobs.map((j) => (
                <div key={j.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                  <button
                    className="w-[52px] aspect-[2/3] rounded-lg overflow-hidden shrink-0"
                    onClick={() => navigate("detail", { animeId: j.animeSlug })}
                    aria-label={`Open ${j.animeTitle}`}
                  >
                    <SmartImage src={j.coverImage} alt={j.animeTitle} className="w-full h-full object-cover" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">{j.animeTitle}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      EP{j.episodeNumber} · {j.episodeTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        UZ READY
                      </span>
                      <span className="text-[10px] text-muted-foreground">−{j.pricePaid} credits</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full shrink-0"
                    aria-label="Watch dubbed"
                    onClick={() => navigate("watch", { animeId: j.animeSlug, episodeId: j.id })}
                  >
                    <Play className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
