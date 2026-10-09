"use client";

import { useState } from "react";
import { Star, Play, Lock, BadgeCheck, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnimeSummary, ContinueWatchingItem } from "./types";
import { useAppStore } from "./store";

export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatCredits(n: number): string {
  return n.toLocaleString("en-US");
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.slice(0, 2).toUpperCase();
}

/** Avatar with accent ring, image or gradient fallback, optional frame */
export function Avatar({
  src,
  name,
  accent = "#f97316",
  accentTo,
  frame,
  size = 40,
  className,
  onClick,
  ring = false,
}: {
  src?: string | null;
  name?: string | null;
  accent?: string;
  accentTo?: string | null;
  frame?: string | null;
  size?: number;
  className?: string;
  onClick?: () => void;
  ring?: boolean;
}) {
  const [err, setErr] = useState(false);
  const showImg = src && !err;
  const to = accentTo || accent;
  const frameStyle =
    frame && frame !== "none"
      ? { padding: Math.max(2, Math.round(size * 0.06)), background: FRAMES[frame] || FRAMES.ember }
      : undefined;
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-full overflow-hidden select-none",
        onClick && "cursor-pointer hover:brightness-110 transition",
        className
      )}
      style={{
        width: frameStyle ? size + (frameStyle.padding * 2) : size,
        height: frameStyle ? size + (frameStyle.padding * 2) : size,
        ...(frameStyle || {}),
        ...(ring ? { boxShadow: `0 0 0 2px ${accent}` } : {}),
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={name ? `${name} avatar` : undefined}
    >
      <div className="w-full h-full rounded-full overflow-hidden bg-background">
        {showImg ? (
          <img
            src={src!}
            alt={name || "avatar"}
            className="w-full h-full object-cover"
            onError={() => setErr(true)}
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${to})`,
              fontSize: size * 0.38,
            }}
          >
            {initials(name)}
          </div>
        )}
      </div>
    </div>
  );
}

const FRAMES: Record<string, string> = {
  ember: "conic-gradient(from 140deg, #f97316, #fbbf24, #f43f5e, #f97316)",
  gold: "conic-gradient(from 0deg, #fbbf24, #fef3c7, #d97706, #fbbf24)",
  neon: "conic-gradient(from 200deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4)",
  sakura: "conic-gradient(from 90deg, #fda4af, #f472b6, #c084fc, #fda4af)",
};

/** Smart image with gradient fallback — never renders raw URLs as text */
export function SmartImage({
  src,
  alt,
  className,
  accentFrom = "#f97316",
  accentTo = "#b91c1c",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  accentFrom?: string;
  accentTo?: string;
}) {
  const [err, setErr] = useState(false);
  const valid = typeof src === "string" && (/^https?:\/\//.test(src) || /^\/(?!\/)/.test(src));
  if (!src || err || !valid) {
    return (
      <div
        className={cn("flex items-center justify-center p-4", className)}
        style={{ background: `linear-gradient(140deg, ${accentFrom}, ${accentTo})` }}
      >
        <span className="text-white/90 font-bold text-sm text-center line-clamp-3 drop-shadow">
          {alt}
        </span>
      </div>
    );
  }
  return (
     
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErr(true)}
      loading="lazy"
    />
  );
}

/** Standard anime poster card — cinematic size */
export function AnimeCard({ anime, rank }: { anime: AnimeSummary; rank?: number }) {
  const navigate = useAppStore((s) => s.navigate);
  const genres: string[] = typeof anime.genres === "string"
    ? String(anime.genres).split(",").filter(Boolean)
    : anime.genres || [];
  return (
    <div
      className="group relative w-[176px] sm:w-[196px] xl:w-[210px] cursor-pointer glow-hover rounded-xl"
      onClick={() => navigate("detail", { animeId: anime.slug })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("detail", { animeId: anime.slug })}
      aria-label={`Open ${anime.title}`}
    >
      <div className="img-zoom relative aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-lg border border-white/[0.06]">
        <SmartImage
          src={anime.coverImage}
          alt={anime.title}
          className="w-full h-full object-cover"
        />
        {/* Top badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {rank !== undefined && (
            <span
              className="text-[13px] font-black leading-none text-white/95"
              style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}
            >
              {String(rank).padStart(2, "0")}
            </span>
          )}
          {anime.isFree ? (
            <Badge className="bg-emerald-500/90 hover:bg-emerald-500 text-[10px] px-1.5 py-0 h-5">FREE</Badge>
          ) : (
            <Badge className="bg-amber-500/90 hover:bg-amber-500 text-[10px] px-1.5 py-0 h-5 gap-0.5">
              <Coins className="w-2.5 h-2.5" />
              {anime.price}
            </Badge>
          )}
        </div>
        {anime.owned && (
          <div className="absolute top-2 right-2 bg-primary/95 rounded-full p-1" title="Owned">
            <BadgeCheck className="w-3 h-3 text-white" />
          </div>
        )}
        {/* Hover play overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <div className="flex items-center gap-2 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
            <span className="bg-white/95 text-black rounded-full p-2 shadow-lg">
              <Play className="w-4 h-4 fill-black" />
            </span>
            <span className="text-[12px] font-bold text-white">
              {anime.owned || anime.isFree ? "Watch now" : `${anime.price} credits`}
            </span>
          </div>
          <p className="text-[11px] text-white/75 mt-2 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
            {anime.description}
          </p>
        </div>
        {/* Bottom gradient always for rating */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-[12px] font-bold text-white">{anime.rating.toFixed(1)}</span>
            <span className="text-[11px] text-white/70 ml-auto">{anime.year}</span>
          </div>
        </div>
        {/* Lock for unowned paid */}
        {!anime.isFree && !anime.owned && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <span className="bg-black/60 backdrop-blur-sm rounded-full p-2.5 border border-white/20">
              <Lock className="w-4 h-4 text-white" />
            </span>
          </div>
        )}
      </div>
      <div className="pt-2.5 px-0.5">
        <h3 className="text-[14px] font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {anime.title}
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-1 line-clamp-1">
          {anime.type} · {genres.slice(0, 2).join(", ")}
        </p>
      </div>
    </div>
  );
}

/** Netflix-style ranked card — oversized outline numeral beside a large poster */
export function RankedCard({ anime, rank }: { anime: AnimeSummary; rank: number }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <div
      className="rank-card group relative flex items-end gap-0 cursor-pointer shrink-0"
      onClick={() => navigate("detail", { animeId: anime.slug })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("detail", { animeId: anime.slug })}
      aria-label={`#${rank} ${anime.title}`}
    >
      <span
        className="rank-numeral relative z-0 text-[104px] sm:text-[122px] xl:text-[136px] -mr-3 sm:-mr-4 select-none translate-y-[8px]"
        aria-hidden="true"
      >
        {rank}
      </span>
      <div className="img-zoom relative z-10 w-[152px] sm:w-[168px] xl:w-[184px] aspect-[2/3] rounded-xl overflow-hidden bg-muted shadow-xl border border-white/[0.06]">
        <SmartImage src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent p-2.5 pt-8">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span className="text-[12px] font-bold text-white">{anime.rating.toFixed(1)}</span>
            {anime.isFree ? (
              <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-white">FREE</span>
            ) : anime.owned ? (
              <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/90 text-white">OWNED</span>
            ) : (
              <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white">
                {anime.price} CR
              </span>
            )}
          </div>
        </div>
        {/* hover preview */}
        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition flex flex-col justify-end p-3">
          <h3 className="text-[13px] font-bold text-white line-clamp-2 leading-tight">{anime.title}</h3>
          <p className="text-[10.5px] text-white/65 mt-1 line-clamp-1">
            {anime.year} · {anime.type}
          </p>
          <span className="mt-2 self-start bg-white/95 text-black rounded-full p-1.5">
            <Play className="w-3.5 h-3.5 fill-black" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Wide 16:9 spotlight card — Fresh Drops / editorial rows */
export function WideCard({ anime, tag }: { anime: AnimeSummary; tag?: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const genres: string[] = typeof anime.genres === "string"
    ? String(anime.genres).split(",").filter(Boolean)
    : anime.genres || [];
  return (
    <div
      className="group relative w-[290px] sm:w-[340px] xl:w-[380px] shrink-0 cursor-pointer glow-hover rounded-2xl"
      onClick={() => navigate("detail", { animeId: anime.slug })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("detail", { animeId: anime.slug })}
      aria-label={`Open ${anime.title}`}
    >
      <div className="img-zoom relative aspect-video rounded-2xl overflow-hidden bg-muted shadow-xl border border-white/[0.06]">
        <SmartImage
          src={anime.bannerImage || anime.coverImage}
          alt={anime.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
        {tag && (
          <span className="absolute top-3 left-3 brand-gradient text-white text-[10px] font-black px-2.5 py-1 rounded-full tracking-wide shadow-lg">
            {tag}
          </span>
        )}
        <div className="absolute bottom-0 inset-x-0 p-3.5">
          <h3 className="text-[15px] font-black text-white truncate drop-shadow">{anime.title}</h3>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-white/75">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-bold text-white">{anime.rating.toFixed(1)}</span>
            <span>· {anime.year}</span>
            <span>· {genres[0]}</span>
            {anime.isFree ? (
              <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-white">FREE</span>
            ) : (
              <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white">
                {anime.price} CR
              </span>
            )}
          </div>
        </div>
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <span className="bg-white/95 rounded-full p-3 shadow-2xl">
              <Play className="w-5 h-5 fill-black text-black" />
            </span>
        </span>
      </div>
    </div>
  );
}

/** Wide card for Continue Watching */
export function ContinueCard({ item }: { item: ContinueWatchingItem }) {
  const navigate = useAppStore((s) => s.navigate);
  const pct = item.duration > 0 ? Math.min(100, (item.position / item.duration) * 100) : 0;
  return (
    <div
      className="group relative w-[240px] sm:w-[280px] shrink-0 cursor-pointer glow-hover rounded-xl"
      onClick={() => navigate("watch", { animeId: item.animeId, episodeId: item.episodeId })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("watch", { animeId: item.animeId, episodeId: item.episodeId })}
    >
      <div className="img-zoom relative aspect-video rounded-xl overflow-hidden bg-muted shadow-lg">
        <SmartImage
          src={item.bannerImage || item.coverImage}
          alt={item.animeTitle}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
          <span className="bg-white/95 rounded-full p-2.5 shadow-xl">
            <Play className="w-5 h-5 fill-black text-black" />
          </span>
        </div>
        <div className="absolute bottom-0 inset-x-0 p-2.5">
          <h3 className="text-xs font-bold text-white truncate">{item.animeTitle}</h3>
          <p className="text-[10px] text-white/75">EP {item.episodeNumber} · {item.episodeTitle}</p>
          <div className="mt-1.5 h-1 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full brand-gradient rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Section header with See all */
export function SectionHeader({
  title,
  icon,
  actionLabel,
  onAction,
}: {
  title: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {actionLabel && (
        <button
          onClick={onAction}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition flex items-center gap-1"
        >
          {actionLabel}
          <span aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}

/** Horizontal scroll row */
export function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="scroll-row flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
      {children}
    </div>
  );
}
