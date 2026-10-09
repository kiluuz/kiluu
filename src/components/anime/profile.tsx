"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck, Crown, CalendarDays, Heart, Film, Star, Timer, Package, Users,
  Pencil, Loader2, Smile, Sparkles, Lock, Check, Send,
  Play, MessageSquare, ThumbsUp, Trophy, Clapperboard,
  Instagram, Youtube, Twitter, MapPin, Clock, Layers,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore, useOpenProfile } from "./store";
import type { PublicProfile, AnimeSummary, ShowcaseConfig } from "./types";
import { Avatar, SmartImage, formatDuration, timeAgo, formatCredits } from "./ui-bits";
import { ACHIEVEMENTS, RARITY_LABEL, type Rarity } from "./profile-assets";
import { ProfileEditor } from "./profile-editor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ================================================================
   ACCENT HELPERS — Discord-style profile colors w/ WCAG AA contrast
   ================================================================ */

export function hexLuminance(hex: string): number {
  const m = hex.replace("#", "");
  if (m.length !== 6) return 0.5;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Pick readable text color for a given accent background (WCAG AA) */
export function textOn(hex: string): string {
  return hexLuminance(hex) > 0.35 ? "#17130e" : "#ffffff";
}

/** CSS vars for a user's accent theme */
export function userAccentVars(from: string, to?: string | null): React.CSSProperties {
  return {
    ["--user-accent" as string]: from,
    ["--user-accent-to" as string]: to || from,
  };
}

/* ================================================================
   MARKDOWN-LITE — **bold** *italic* `code` [text](url) (About me)
   ================================================================ */
export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const out: React.ReactNode[] = [];
    const lines = text.split("\n");
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
    lines.forEach((line, li) => {
      if (line.trim() === "") {
        out.push(<br key={`br${li}`} />);
        return;
      }
      const tokens = line.split(pattern).filter(Boolean);
      tokens.forEach((tok, i) => {
        const key = `${li}-${i}`;
        if (/^\*\*[^*]+\*\*$/.test(tok)) {
          out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
        } else if (/^\*[^*]+\*$/.test(tok)) {
          out.push(<em key={key}>{tok.slice(1, -1)}</em>);
        } else if (/^`[^`]+`$/.test(tok)) {
          out.push(<code key={key}>{tok.slice(1, -1)}</code>);
        } else if (/^\[[^\]]+\]\([^)]+\)$/.test(tok)) {
          const m = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
          const url = m[2].startsWith("http") ? m[2] : `https://${m[2]}`;
          out.push(
            <a key={key} href={url} target="_blank" rel="noopener noreferrer nofollow">
              {m[1]}
            </a>
          );
        } else {
          out.push(<span key={key}>{tok}</span>);
        }
      });
    });
    return out;
  }, [text]);
  return <div className={cn("md-lite", className)}>{parts}</div>;
}

/* ================================================================
   SOCIAL LINKS
   ================================================================ */
function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.9 4.6c.2-1.1-.8-2-1.9-1.6L2.7 9.7c-1.2.5-1.1 2.2.1 2.6l4.4 1.4 1.7 5.4c.3 1 1.5 1.3 2.3.6l2.5-2.3 4.6 3.4c.9.7 2.2.2 2.4-.9l3.2-15.3zM8.2 12.9l9.5-6.1c.3-.2.6.2.4.5l-7.4 7-.3 3-1.4-3.1-.8-1.3z" />
    </svg>
  );
}

const SOCIAL_DEFS: Record<string, { icon: (c: string) => React.ReactNode; label: string; build: (v: string) => string }> = {
  telegram: { icon: (c) => <TelegramIcon className={c} />, label: "Telegram", build: (v) => `https://t.me/${v.replace(/^@|https?:\/\/t\.me\//, "")}` },
  instagram: { icon: (c) => <Instagram className={c} />, label: "Instagram", build: (v) => v.startsWith("http") ? v : `https://instagram.com/${v}` },
  youtube: { icon: (c) => <Youtube className={c} />, label: "YouTube", build: (v) => v.startsWith("http") ? v : `https://youtube.com/@${v}` },
  x: { icon: (c) => <Twitter className={c} />, label: "X", build: (v) => v.startsWith("http") ? v : `https://x.com/${v}` },
};

export function SocialLinksRow({ links, compact }: { links: Record<string, string>; compact?: boolean }) {
  const entries = Object.entries(links).filter(([, v]) => v && v.trim().length > 0);
  if (!entries.length) return null;
  return (
    <div className={cn("flex flex-wrap", compact ? "gap-1.5" : "gap-2")}>
      {entries.map(([key, val]) => {
        const def = SOCIAL_DEFS[key];
        if (!def) return null;
        return (
          <a
            key={key}
            href={def.build(val)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            aria-label={`${def.label}: ${val}`}
            title={`${def.label}: ${val}`}
            className={cn(
              "flex items-center gap-1.5 rounded-full border border-border bg-card hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] transition-colors",
              compact ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs font-medium"
            )}
          >
            {def.icon("w-3.5 h-3.5")}
            {!compact && <span className="max-w-[120px] truncate">{val.replace(/^https?:\/\/(www\.)?/, "")}</span>}
          </a>
        );
      })}
    </div>
  );
}

/* ================================================================
   EQUALIZER — "currently watching" pulse
   ================================================================ */
export function Equalizer({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-end gap-[2px] h-3", className)} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="eq-bar w-[3px] h-full rounded-sm bg-[var(--user-accent)]" />
      ))}
    </span>
  );
}

/* ================================================================
   COUNT-UP — animated stat numerals
   ================================================================ */
export function useCountUp(target: number, duration = 850): number {
  const [value, setValue] = useState(0);
  const [prevTarget, setPrevTarget] = useState(target);
  if (target !== prevTarget) {
    setPrevTarget(target);
    if (target <= 0) setValue(0); /* reset without a synchronous effect setState */
  }
  useEffect(() => {
    if (target <= 0) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* ================================================================
   ACHIEVEMENTS — merge catalog with live progress
   ================================================================ */
export interface AchievementState {
  def: (typeof ACHIEVEMENTS)[number];
  current: number;
  target: number;
  earned: boolean;
  pct: number;
}

export function getAchievementStates(p: PublicProfile): AchievementState[] {
  return ACHIEVEMENTS.map((def) => {
    const live = p.achievements.find((a) => a.id === def.id);
    const current = live?.current ?? 0;
    const target = live?.target ?? def.id === "join" ? 1 : 1;
    return {
      def,
      current,
      target,
      earned: current >= target,
      pct: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
    };
  });
}

export function AchievementTile({
  a,
  size = "md",
  unlockLabel,
}: {
  a: AchievementState;
  size?: "sm" | "md" | "lg";
  unlockLabel?: string;
}) {
  const rarity = a.def.rarity;
  return (
    <div
      className={cn(
        "relative rounded-2xl border overflow-hidden transition-all",
        size === "sm" && "p-3",
        size === "md" && "p-4",
        size === "lg" && "p-5",
        a.earned
          ? `rarity-glow rarity-${rarity} border-[color-mix(in_srgb,var(--rarity)_35%,transparent)] bg-gradient-to-br from-[color-mix(in_srgb,var(--rarity)_12%,transparent)] to-card`
          : "border-border bg-card/60 opacity-75"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "relative shrink-0 rounded-xl flex items-center justify-center",
            size === "sm" ? "w-9 h-9 text-lg" : size === "md" ? "w-11 h-11 text-xl" : "w-14 h-14 text-2xl",
            a.earned ? "bg-[color-mix(in_srgb,var(--rarity)_20%,transparent)]" : "bg-muted grayscale"
          )}
        >
          {a.earned ? a.def.emoji : <Lock className="w-4 h-4 text-muted-foreground" />}
          {a.earned && rarity === "legendary" && (
            <span className="absolute -top-1 -right-1 text-[9px]">✨</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className={cn("font-bold leading-tight", size === "sm" ? "text-xs" : "text-sm", !a.earned && "text-muted-foreground")}>
              {a.def.name}
            </p>
            <span
              className={cn(
                "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                rarity === "common" && "border-border text-muted-foreground",
                rarity === "rare" && "border-blue-400/40 text-blue-400",
                rarity === "epic" && "border-purple-400/40 text-purple-400",
                rarity === "legendary" && "border-amber-400/50 text-amber-400"
              )}
            >
              {RARITY_LABEL[rarity as Rarity]}
            </span>
          </div>
          {size !== "sm" && <p className="text-[11px] text-muted-foreground mt-0.5">{a.def.desc}</p>}
          {/* progress */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", a.earned && "bg-[var(--rarity)]")}
                style={{
                  width: `${a.pct}%`,
                  background: a.earned ? undefined : "linear-gradient(90deg, var(--user-accent), var(--user-accent-to))",
                }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground font-semibold">
              {a.current}/{a.target}
            </span>
          </div>
          {a.earned && unlockLabel && size === "lg" && (
            <p className="text-[10px] text-muted-foreground mt-1.5">Unlocked {unlockLabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   POSTER GRID — large poster-first tiles with hover meta
   ================================================================ */
function PosterTile({ anime, rank }: { anime: AnimeSummary; rank?: number }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <div
      className="group relative cursor-pointer glow-hover rounded-2xl"
      onClick={() => navigate("detail", { animeId: anime.slug })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("detail", { animeId: anime.slug })}
      aria-label={`Open ${anime.title}`}
    >
      <div className="img-zoom relative aspect-[2/3] rounded-2xl overflow-hidden bg-muted shadow-xl border border-border/50">
        <SmartImage src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
        {rank !== undefined && (
          <span className="rank-numeral absolute -bottom-2 -left-1 text-[64px] select-none" aria-hidden>
            {rank}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <p className="text-xs font-bold text-white line-clamp-2">{anime.title}</p>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-white/80">
            <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-amber-400 text-amber-400" />{anime.rating?.toFixed?.(1)}</span>
            <span>{anime.year}</span>
            <span className="ml-auto px-1.5 py-0.5 rounded-full bg-white/15 backdrop-blur-sm font-semibold">
              {anime.isFree ? "FREE" : `${formatCredits(anime.price)} cr`}
            </span>
          </div>
        </div>
        {anime.isFree && (
          <span className="absolute top-2 left-2 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white">FREE</span>
        )}
      </div>
      <p className="pt-2 px-0.5 text-[13px] font-semibold leading-tight line-clamp-1 group-hover:text-[var(--user-accent)] transition-colors">
        {anime.title}
      </p>
      <p className="text-[11px] text-muted-foreground line-clamp-1">{anime.type} · {String(anime.genres).split(",").slice(0, 2).join(", ")}</p>
    </div>
  );
}

function RichEmptyState({
  icon, title, hint, actionLabel, onAction,
}: {
  icon: React.ReactNode; title: string; hint: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 flex flex-col items-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-[var(--user-accent)] mb-3">
        {icon}
      </div>
      <p className="font-bold">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">{hint}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" className="mt-4 rounded-full" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

/* ================================================================
   BANNER — cinematic, parallax, accent fallback w/ grain
   ================================================================ */
export function ProfileBanner({ profile, lqip }: { profile: PublicProfile; lqip?: string }) {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    if (window.matchMedia("(max-width: 1100px)").matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, -rect.top / rect.height));
        const img = el.querySelector<HTMLDivElement>(".parallax-banner");
        if (img) img.style.transform = `translateY(${progress * 12}%) scale(1.08)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const preset = null;
  void preset;

  return (
    <div
      ref={bannerRef}
      className={cn(
        "relative w-full aspect-[3/1] max-h-[420px] overflow-hidden rounded-none sm:rounded-3xl border-b sm:border border-border/60 grain",
        "bg-gradient-to-br from-[color-mix(in_srgb,var(--user-accent)_38%,var(--background))] via-[color-mix(in_srgb,var(--user-accent-to)_24%,var(--background))] to-background"
      )}
      style={userAccentVars(profile.accentColor, profile.accentTo)}
    >
      {/* soft moving glow when no banner */}
      {!profile.bannerUrl && (
        <div className="absolute inset-0 aurora" aria-hidden />
      )}
      {profile.bannerUrl && (
        <div className="parallax-banner absolute inset-0">
          <SmartImage
            src={profile.bannerUrl}
            alt={`${profile.displayName || profile.username} banner`}
            className="w-full h-full object-cover"
            accentFrom={profile.accentColor}
            accentTo={profile.accentTo || profile.accentColor}
          />
        </div>
      )}
      {lqip && (
        <div className="absolute inset-0 -z-10" style={{ backgroundImage: `url(${lqip})`, backgroundSize: "cover", filter: "blur(20px)" }} aria-hidden />
      )}
      {/* bottom scrim for smooth transition into content */}
      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background/90 to-transparent pointer-events-none" />
    </div>
  );
}

/* ================================================================
   IDENTITY HEADER — avatar overlap w/ solid ring, name, actions
   ================================================================ */
function StatusLine({ profile }: { profile: PublicProfile }) {
  const watching = profile.currentlyWatching;
  const hasCustom = profile.statusEmoji || profile.statusText;
  return (
    <div className="flex items-center gap-2 flex-wrap text-sm min-h-[22px]">
      {watching ? (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs font-medium">
          <Equalizer />
          <span className="text-muted-foreground">Currently watching</span>
          <button
            className="font-semibold text-[var(--user-accent)] hover:underline focus-ring-accent"
            onClick={() => useAppStore.getState().navigate("detail", { animeId: watching.anime.slug })}
          >
            {watching.anime.title}
          </button>
          <span className="text-muted-foreground">· Ep {watching.episode.number}</span>
        </span>
      ) : hasCustom ? (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs font-medium">
          {profile.statusEmoji && <span>{profile.statusEmoji}</span>}
          {profile.statusText && <span className="text-muted-foreground">{profile.statusText}</span>}
        </span>
      ) : null}
    </div>
  );
}

function IdentityActions({ profile, onEdit }: { profile: PublicProfile; onEdit?: () => void }) {
  const { user, navigate } = useAppStore();
  const [following, setFollowing] = useState(profile.isFollowing);
  const [busy, setBusy] = useState(false);

  async function toggleFollow() {
    if (!user) { useAppStore.getState().setAuthOpen(true); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/users/${profile.username}/favorite`, { method: following ? "DELETE" : "POST" });
      if (res.ok) {
        setFollowing(!following);
        toast.success(following ? "Unfollowed" : `Following @${profile.username}`);
      } else toast.error("Failed to update follow");
    } finally {
      setBusy(false);
    }
  }

  if (profile.isMe) {
    return (
      <div className="flex items-center gap-2">
        {profile.role === "CREATOR" && (
          <Button variant="outline" size="sm" className="rounded-full h-9 gap-1.5" onClick={() => navigate("studio")}>
            <Clapperboard className="w-4 h-4" /> Creator Studio
          </Button>
        )}
        <Button
          size="sm"
          className="rounded-full h-9 gap-1.5 brand-gradient text-white"
          onClick={onEdit ?? (() => useAppStore.getState().navigate("user-profile", { username: profile.username }))}
        >
          <Pencil className="w-4 h-4" /> Edit Profile
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className={cn(
          "rounded-full h-9 gap-1.5 font-semibold",
          following ? "bg-card border border-border text-foreground hover:bg-accent" : "text-white"
        )}
        style={following ? undefined : { background: `linear-gradient(120deg, var(--user-accent), var(--user-accent-to))`, color: textOn(profile.accentColor) }}
        onClick={toggleFollow}
        disabled={busy}
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : following ? <Check className="w-4 h-4" /> : <Users className="w-4 h-4" />}
        {following ? "Following" : "Follow"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full h-9 gap-1.5"
        onClick={() => useAppStore.getState().openProfileCard(profile.username)}
      >
        <Send className="w-4 h-4" /> Message
      </Button>
    </div>
  );
}

function ProfileIdentity({ profile, onEdit }: { profile: PublicProfile; onEdit?: () => void }) {
  const online = profile.currentlyWatching; // presence proxy: active watching = online
  return (
    <div className="relative px-4 sm:px-8">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-[52px] sm:-mt-[64px] relative z-10">
        {/* Avatar — overlaps banner with SOLID page-bg ring (no bleed artifacts) */}
        <div className="relative shrink-0 mx-auto sm:mx-0">
          <div className="rounded-full bg-background p-1.5 shadow-2xl">
            <Avatar
              src={profile.avatarUrl}
              name={profile.displayName || profile.username}
              accent={profile.accentColor}
              accentTo={profile.accentTo}
              frame={profile.avatarFrame}
              size={112}
            />
          </div>
          {/* online dot */}
          <span
            className={cn(
              "absolute bottom-3 right-3 w-[18px] h-[18px] rounded-full border-[3px] border-background",
              online ? "bg-emerald-500 live-dot" : "bg-muted-foreground/50"
            )}
            title={online ? "Online — watching now" : "Offline"}
          />
        </div>

        {/* Name block — BELOW banner edge with breathing room */}
        <div className="flex-1 min-w-0 pt-2 sm:pt-0 sm:pb-1 text-center sm:text-left">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight leading-tight">
              {profile.displayName || profile.username}
            </h1>
            {profile.role === "CREATOR" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white"
                style={{ background: `linear-gradient(120deg, var(--user-accent), var(--user-accent-to))`, color: textOn(profile.accentColor) }}>
                <Crown className="w-3 h-3" /> Creator
              </span>
            )}
            <BadgeCheck className="w-5 h-5 text-[var(--user-accent)]" aria-label="Verified" />
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1 justify-center sm:justify-start">
            <span className="text-sm text-muted-foreground">@{profile.username}</span>
            {profile.pronouns && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-muted-foreground">{profile.pronouns}</span>
            )}
          </div>
          {profile.tagline && (
            <p className="text-sm mt-1.5 font-medium text-foreground/80">{profile.tagline}</p>
          )}
          <div className="mt-2 flex justify-center sm:justify-start">
            <StatusLine profile={profile} />
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 pb-1 flex justify-center sm:justify-end">
          <IdentityActions profile={profile} onEdit={onEdit} />
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   STAT STRIP — refined rows w/ count-up
   ================================================================ */
function StatChip({ icon, label, value, suffix, accent, accentHex }: { icon: React.ReactNode; label: string; value: number; suffix?: string; accent?: boolean; accentHex?: string }) {
  const n = useCountUp(value);
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-2xl border px-4 py-3 flex-1 min-w-[150px]",
      accent ? "border-[color-mix(in_srgb,var(--user-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--user-accent)_10%,transparent)]" : "border-border bg-card"
    )}>
      <span
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={accent && accentHex ? { background: "linear-gradient(120deg, var(--user-accent), var(--user-accent-to))", color: textOn(accentHex) } : undefined}
      >
        <span className={cn(!accent && "bg-accent text-[var(--user-accent)] rounded-xl w-9 h-9 flex items-center justify-center")}>{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="stat-numeral text-xl leading-none">{n.toLocaleString()}{suffix}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">{label}</p>
      </div>
    </div>
  );
}

/* ================================================================
   LEFT STICKY IDENTITY COLUMN
   ================================================================ */
function IdentityColumn({ profile }: { profile: PublicProfile }) {
  const openProfile = useOpenProfile();
  const mutuals = profile.favoriteUsers.slice(0, 5);
  const genres = profile.showcase?.genres ?? [];
  const joinDate = new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const countryLabel = profile.country || null;

  return (
    <aside className="space-y-4 lg:sticky lg:top-20 self-start" aria-label="Profile identity">
      {/* About */}
      {profile.bio ? (
        <section className="rounded-2xl border bg-card p-4">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">About me</h3>
          <MarkdownLite text={profile.bio} className="text-sm text-foreground/85" />
        </section>
      ) : profile.isMe && (
        <section className="rounded-2xl border border-dashed bg-card/40 p-4 text-center">
          <p className="text-xs text-muted-foreground">No bio yet — tell the world about your taste.</p>
        </section>
      )}

      {/* Meta */}
      <section className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Details</h3>
        <div className="flex items-center gap-2.5 text-sm">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Member since</span>
          <span className="ml-auto font-semibold">{joinDate}</span>
        </div>
        {countryLabel && (
          <div className="flex items-center gap-2.5 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-semibold">{countryLabel}</span>
            {profile.timezone && <span className="text-muted-foreground text-xs">{profile.timezone}</span>}
          </div>
        )}
        {profile.timezone && !countryLabel && (
          <div className="flex items-center gap-2.5 text-sm">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-semibold">{profile.timezone}</span>
          </div>
        )}
        <SocialLinksRow links={profile.socialLinks ?? {}} />
      </section>

      {/* Favorite genres chips */}
      {genres.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2.5">Favorite genres</h3>
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <span key={g} className="px-2.5 py-1 rounded-full text-[11px] font-bold border border-[color-mix(in_srgb,var(--user-accent)_35%,transparent)] text-[var(--user-accent)] bg-[color-mix(in_srgb,var(--user-accent)_10%,transparent)]">
                {g}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Following list */}
      {mutuals.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2.5">
            Following · {profile.stats.following}
          </h3>
          <div className="space-y-1">
            {mutuals.map((u) => (
              <button
                key={u.id}
                onClick={() => openProfile(u.username)}
                className="w-full flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-accent transition text-left focus-ring-accent"
              >
                <Avatar src={u.avatarUrl} name={u.displayName || u.username} accent={u.accentColor} accentTo={u.accentTo} size={30} />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold truncate">{u.displayName || u.username}</p>
                  <p className="text-[10px] text-muted-foreground truncate">@{u.username}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Badge strip — role & exchange status */}
      <section className="rounded-2xl border bg-card p-4 flex flex-wrap gap-2">
        {profile.role === "CREATOR" && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold text-white brand-gradient">
            <Clapperboard className="w-3.5 h-3.5" /> Creator
          </span>
        )}
        {profile.stats.exchangeUnlocked && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border border-emerald-500/40 text-emerald-500 bg-emerald-500/10">
            <Sparkles className="w-3.5 h-3.5" /> Exchange Unlocked
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border border-border bg-accent text-muted-foreground">
          <CalendarDays className="w-3.5 h-3.5" /> {new Date(profile.createdAt).getFullYear()} joined
        </span>
      </section>
    </aside>
  );
}

/* ================================================================
   TAB CONTENTS
   ================================================================ */
function OverviewTab({ profile, onEdit }: { profile: PublicProfile; onEdit?: () => void }) {
  const navigate = useAppStore((s) => s.navigate);
  const states = getAchievementStates(profile);
  const earned = states.filter((s) => s.earned);
  const showcaseIds = (profile.showcase?.achievementIds ?? []).slice(0, 6);
  const showcaseAch = showcaseIds.length
    ? showcaseIds.map((id) => states.find((s) => s.def.id === id)).filter(Boolean) as AchievementState[]
    : earned.slice(0, 4);

  const topFiveIds = profile.showcase?.topFive ?? [];
  const topFive = topFiveIds
    .map((id) => profile.ownedAnimes.find((a) => a.id === id) || profile.favoriteAnimes.find((a) => a.id === id))
    .filter(Boolean) as AnimeSummary[];

  // DEDUP: favorites grid excludes top-5; collection excludes both
  const topFiveSet = new Set(topFiveIds);
  const uniqueFavorites = profile.favoriteAnimes.filter((a) => !topFiveSet.has(a.id));
  const favSet = new Set(profile.favoriteAnimes.map((a) => a.id));
  const collectionHighlights = profile.ownedAnimes.filter((a) => !topFiveSet.has(a.id) && !favSet.has(a.id));

  const pinnedPost = profile.showcase?.pinnedPostId
    ? profile.posts.find((p) => p.id === profile.showcase!.pinnedPostId)
    : null;

  const sections: { id: string; node: React.ReactNode }[] = [];
  const order = profile.showcase?.order?.length
    ? profile.showcase.order
    : ["topFive", "currentlyWatching", "favorites", "collection", "pinned", "achievements"];
  const hidden = profile.showcase?.hidden ?? {};

  if (topFive.length > 0 && !hidden.topFive) {
    sections.push({
      id: "topFive",
      node: (
        <section key="top5" aria-label="Top 5 anime">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[var(--user-accent)]" /> Top 5 Anime
            </h2>
            {profile.isMe && (
              <button onClick={onEdit} className="text-xs font-semibold text-[var(--user-accent)] hover:underline focus-ring-accent">
                Edit showcase
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
            {topFive.map((a, i) => <PosterTile key={a.id} anime={a} rank={i + 1} />)}
          </div>
        </section>
      ),
    });
  } else if (profile.isMe && !hidden.topFive) {
    sections.push({
      id: "topFive",
      node: (
        <RichEmptyState
          key="top5-empty"
          icon={<Trophy className="w-5 h-5" />}
          title="Pick your Top 5"
          hint="Rank the anime that define you. Big numbers, big opinions."
          actionLabel="Choose Top 5"
          onAction={onEdit}
        />
      ),
    });
  }

  if (profile.currentlyWatching && !hidden.currentlyWatching) {
    const cw = profile.currentlyWatching;
    const pct = cw.duration > 0 ? Math.min(100, (cw.position / cw.duration) * 100) : 0;
    sections.push({
      id: "currentlyWatching",
      node: (
        <section key="cw" aria-label="Currently watching">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Play className="w-5 h-5 text-[var(--user-accent)]" /> Now Watching
          </h2>
          <button
            onClick={() => navigate("watch", { animeId: cw.anime.slug, episodeId: cw.episode.id })}
            className="w-full group flex items-center gap-4 rounded-2xl border bg-card p-3 text-left hover:border-[color-mix(in_srgb,var(--user-accent)_45%,transparent)] transition glow-hover"
          >
            <div className="relative w-28 sm:w-36 aspect-video rounded-xl overflow-hidden shrink-0 bg-muted">
              <SmartImage src={cw.anime.bannerImage || cw.anime.coverImage} alt={cw.anime.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition" />
              <span className="absolute inset-0 m-auto w-9 h-9 rounded-full bg-white/90 flex items-center justify-center">
                <Play className="w-4 h-4 fill-black text-black ml-0.5" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Equalizer />
                <p className="font-bold truncate">{cw.anime.title}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Episode {cw.episode.number} · {cw.episode.title}</p>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, var(--user-accent), var(--user-accent-to))" }} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{Math.round(pct)}% · updated {timeAgo(cw.updatedAt)}</p>
            </div>
          </button>
        </section>
      ),
    });
  }

  if (uniqueFavorites.length > 0 && !hidden.favorites) {
    sections.push({
      id: "favorites",
      node: (
        <section key="favs" aria-label="Favorite anime">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-[var(--user-accent)]" /> Favorite Anime
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-4">
            {uniqueFavorites.slice(0, 10).map((a) => <PosterTile key={a.id} anime={a} />)}
          </div>
        </section>
      ),
    });
  }

  if (collectionHighlights.length > 0 && !hidden.collection) {
    sections.push({
      id: "collection",
      node: (
        <section key="coll" aria-label="Collection highlights">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Layers className="w-5 h-5 text-[var(--user-accent)]" /> Collection Highlights
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-4">
            {collectionHighlights.slice(0, 10).map((a) => <PosterTile key={a.id} anime={a} />)}
          </div>
        </section>
      ),
    });
  }

  if (pinnedPost && !hidden.pinned) {
    sections.push({
      id: "pinned",
      node: (
        <section key="pinned" aria-label="Pinned post">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-[var(--user-accent)]" /> Pinned
          </h2>
          <PostCard post={pinnedPost} profile={profile} />
        </section>
      ),
    });
  }

  if (showcaseAch.length > 0 && !hidden.achievements) {
    sections.push({
      id: "achievements",
      node: (
        <section key="ach" aria-label="Achievement showcase">
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-[var(--user-accent)]" /> Achievements
            <span className="text-xs font-semibold text-muted-foreground">{earned.length}/{states.length} earned</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {showcaseAch.map((a) => <AchievementTile key={a.def.id} a={a} size="sm" />)}
          </div>
        </section>
      ),
    });
  }

  return <div className="space-y-8">{sections.map((s) => s.node)}</div>;
}

function CollectionTab({ profile }: { profile: PublicProfile }) {
  const navigate = useAppStore((s) => s.navigate);
  if (profile.ownedAnimes.length === 0) {
    return (
      <RichEmptyState
        icon={<Package className="w-5 h-5" />}
        title={profile.isMe ? "Your collection starts here" : "No collection yet"}
        hint={profile.isMe ? "Buy your first anime with credits and it will live here forever." : `${profile.displayName || profile.username} hasn't collected any anime yet.`}
        actionLabel={profile.isMe ? "Discover anime" : undefined}
        onAction={profile.isMe ? () => navigate("browse") : undefined}
      />
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-4">
      {profile.ownedAnimes.map((a) => <PosterTile key={a.id} anime={a} />)}
    </div>
  );
}

function FavoritesTab({ profile }: { profile: PublicProfile }) {
  const navigate = useAppStore((s) => s.navigate);
  if (profile.favoriteAnimes.length === 0) {
    return (
      <RichEmptyState
        icon={<Heart className="w-5 h-5" />}
        title={profile.isMe ? "No favorites yet" : "No favorites yet"}
        hint={profile.isMe ? "Tap the heart on any anime you love — it will show up right here." : "Nothing favorited so far."}
        actionLabel={profile.isMe ? "Find something to love" : undefined}
        onAction={profile.isMe ? () => navigate("browse") : undefined}
      />
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-4">
      {profile.favoriteAnimes.map((a) => <PosterTile key={a.id} anime={a} />)}
    </div>
  );
}

function PostCard({ post, profile }: { post: PublicProfile["posts"][number]; profile: PublicProfile }) {
  const navigate = useAppStore((s) => s.navigate);
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [busy, setBusy] = useState(false);

  async function like() {
    if (busy) return;
    const me = useAppStore.getState().user;
    if (!me) { useAppStore.getState().setAuthOpen(true); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/community/${post.id}/like`, { method: liked ? "DELETE" : "POST" });
      if (res.ok) {
        setLiked(!liked);
        setLikeCount((c) => c + (liked ? -1 : 1));
      }
    } finally { setBusy(false); }
  }

  return (
    <article className="rounded-2xl border bg-card p-4 hover:border-[color-mix(in_srgb,var(--user-accent)_35%,transparent)] transition-colors">
      <div className="flex items-start gap-3">
        <Avatar
          src={profile.avatarUrl}
          name={profile.displayName || profile.username}
          accent={profile.accentColor}
          accentTo={profile.accentTo}
          size={36}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold">{profile.displayName || profile.username}</span>
            <span className="text-xs text-muted-foreground">@{profile.username}</span>
            <span className="text-xs text-muted-foreground">· {timeAgo(post.createdAt)}</span>
          </div>
          <p className="text-sm mt-1.5 whitespace-pre-wrap break-words">{post.content}</p>
          {post.anime && (
            <button
              onClick={() => navigate("detail", { animeId: post.anime!.slug })}
              className="mt-2.5 flex items-center gap-2.5 rounded-xl border bg-background/50 p-2 hover:border-[color-mix(in_srgb,var(--user-accent)_40%,transparent)] transition w-full text-left"
            >
              <img src={post.anime.coverImage} alt="" className="w-9 h-12 object-cover rounded-md" loading="lazy" />
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{post.anime.title}</p>
                <p className="text-[10px] text-muted-foreground">View anime</p>
              </div>
            </button>
          )}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={like}
              className={cn("flex items-center gap-1.5 text-xs font-semibold transition-colors", liked ? "text-[var(--user-accent)]" : "text-muted-foreground hover:text-foreground")}
            >
              <ThumbsUp className={cn("w-3.5 h-3.5", liked && "fill-current")} />
              {likeCount}
            </button>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" /> {post.commentCount}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function ActivityTab({ profile }: { profile: PublicProfile }) {
  if (profile.posts.length === 0) {
    return (
      <RichEmptyState
        icon={<MessageSquare className="w-5 h-5" />}
        title="Quiet here..."
        hint={profile.isMe ? "Share your hot takes with the community — they will appear on your profile." : "No posts yet."}
      />
    );
  }
  return (
    <div className="space-y-3">
      {profile.posts.map((p) => <PostCard key={p.id} post={p} profile={profile} />)}
    </div>
  );
}

function AchievementsTab({ profile }: { profile: PublicProfile }) {
  const states = getAchievementStates(profile);
  const earned = states.filter((s) => s.earned);
  const byRarity = { common: 0, rare: 0, epic: 0, legendary: 0 } as Record<Rarity, number>;
  earned.forEach((s) => { byRarity[s.def.rarity]++; });
  return (
    <div className="space-y-5">
      {/* rarity summary */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-bold">{earned.length} of {states.length} earned</span>
        {(Object.keys(byRarity) as Rarity[]).map((r) => (
          <span key={r} className={cn(
            "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border",
            r === "common" && "border-border text-muted-foreground",
            r === "rare" && "border-blue-400/40 text-blue-400",
            r === "epic" && "border-purple-400/40 text-purple-400",
            r === "legendary" && "border-amber-400/50 text-amber-400"
          )}>
            {byRarity[r]} {RARITY_LABEL[r]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {states
          .slice()
          .sort((a, b) => (Number(b.earned) - Number(a.earned)) || (b.pct - a.pct))
          .map((a) => (
            <AchievementTile key={a.def.id} a={a} size="lg" unlockLabel="unlocked" />
          ))}
      </div>
    </div>
  );
}

/* ================================================================
   PROFILE PAGE BODY — shared by full view & editor live preview
   ================================================================ */
export function ProfilePageBody({
  profile,
  onEdit,
  activeTab,
  onTabChange,
  hideTabs,
}: {
  profile: PublicProfile;
  onEdit?: () => void;
  activeTab?: string;
  onTabChange?: (t: string) => void;
  hideTabs?: boolean;
}) {
  const [tab, setTab] = useState(activeTab || "overview");
  const [prevActiveTab, setPrevActiveTab] = useState(activeTab);
  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    if (activeTab) setTab(activeTab);
  }
  const setT = (t: string) => { setTab(t); onTabChange?.(t); };

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "collection", label: "Collection", count: profile.ownedAnimes.length },
    { id: "favorites", label: "Favorites", count: profile.favoriteAnimes.length },
    { id: "activity", label: "Activity & Posts", count: profile.posts.length },
    { id: "achievements", label: "Achievements", count: getAchievementStates(profile).filter((a) => a.earned).length },
  ];

  const stats = profile.stats;

  return (
    <div style={userAccentVars(profile.accentColor, profile.accentTo)}>
      {/* Cinematic banner */}
      <div className="max-w-[1280px] mx-auto px-0 sm:px-6 pt-0 sm:pt-4">
        <ProfileBanner profile={profile} />
      </div>

      {/* Identity */}
      <div className="max-w-[1280px] mx-auto">
        <ProfileIdentity profile={profile} onEdit={onEdit} />
      </div>

      {/* Stats strip */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 mt-6">
        <div className="flex flex-wrap gap-3">
          <StatChip icon={<Package className="w-4 h-4" />} label="Owned" value={stats.purchaseCount} />
          {stats.watchSeconds != null && (
            <StatChip icon={<Timer className="w-4 h-4" />} label="Watch time" value={Math.round(stats.watchSeconds / 3600)} suffix="h" />
          )}
          <StatChip icon={<Users className="w-4 h-4" />} label="Followers" value={stats.followers} accent accentHex={profile.accentColor} />
          <StatChip icon={<MessageSquare className="w-4 h-4" />} label="Posts" value={stats.postCount} />
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 mt-6 border-b">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px" role="tablist" aria-label="Profile sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              data-active={tab === t.id}
              onClick={() => setT(t.id)}
              className="tab-underline shrink-0 px-4 py-3 text-sm font-semibold transition-colors rounded-t-lg focus-ring-accent"
            >
              {t.label}
              {t.count != null && (
                <span className={cn(
                  "ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                  tab === t.id ? "bg-[var(--user-accent)] text-white" : "bg-muted text-muted-foreground"
                )}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Two-column body */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        <IdentityColumn profile={profile} />
        <div className="min-w-0">
          {hideTabs ? <OverviewTab profile={profile} onEdit={onEdit} /> : (
            <>
              {tab === "overview" && <OverviewTab profile={profile} onEdit={onEdit} />}
              {tab === "collection" && <CollectionTab profile={profile} />}
              {tab === "favorites" && <FavoritesTab profile={profile} />}
              {tab === "activity" && <ActivityTab profile={profile} />}
              {tab === "achievements" && <AchievementsTab profile={profile} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   PROFILE FULL VIEW (route target)
   ================================================================ */
export function ProfileFullView({ username }: { username: string }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/users/${username}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((d) => { if (alive) setProfile(d.profile); })
      .catch(() => { if (alive) setError("Couldn't load this profile"); });
    return () => {
      alive = false;
      setProfile(null); /* reset on target change / unmount (async — lint-safe) */
      setError(null);
    };
  }, [username]);

  if (error) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 py-20 text-center">
        <p className="text-lg font-bold">{error}</p>
        <p className="text-sm text-muted-foreground mt-1">The user may have vanished into another dimension.</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-4 pb-10 space-y-4">
        <div className="aspect-[3/1] rounded-3xl skeleton" />
        <div className="flex gap-4 -mt-10 px-4 relative">
          <div className="w-28 h-28 rounded-full skeleton shrink-0" />
          <div className="space-y-2 pt-12 flex-1">
            <div className="h-7 w-52 rounded-lg skeleton" />
            <div className="h-4 w-32 rounded-lg skeleton" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[68px] rounded-2xl skeleton" />)}
        </div>
      </div>
    );
  }

  return (
    <>
      <ProfilePageBody profile={profile} onEdit={profile.isMe ? () => setEditorOpen(true) : undefined} />
      {editorOpen && (
        <ProfileEditor
          initial={profile}
          onClose={() => setEditorOpen(false)}
          onSaved={(p) => setProfile(p)}
        />
      )}
    </>
  );
}
