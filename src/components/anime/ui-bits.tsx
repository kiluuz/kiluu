"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Play, Lock, BadgeCheck, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AnimeSummary, ContinueWatchingItem } from "./types";
import { useAppStore } from "./store";
import { useBotCatalog } from "./bot-hooks";
import { frameById } from "../../../frames.config";

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
  imageFrame,
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
  imageFrame?: string | null;
  size?: number;
  className?: string;
  onClick?: () => void;
  ring?: boolean;
}) {
  const [err, setErr] = useState(false);
  const showImg = src && !err;
  const to = accentTo || accent;
  const imageFrameConfig = frameById(imageFrame);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const frameImageRef = useRef<HTMLImageElement>(null);
  const frameScale = imageFrameConfig?.scale ?? 1.42;
  useEffect(() => {
    const image = frameImageRef.current;
    if (image?.complete && image.naturalWidth > 0) setFrameLoaded(true);
  }, [imageFrameConfig?.slug, imageFrameConfig?.version]);
  const frameStyle =
    !imageFrameConfig && frame && frame !== "none"
      ? { padding: Math.max(2, Math.round(size * 0.06)), background: FRAMES[frame] || FRAMES.ember }
      : undefined;
  return (
    <div
      className={cn(
        "relative shrink-0 select-none",
        imageFrameConfig ? "overflow-visible" : "rounded-full overflow-hidden",
        onClick && "cursor-pointer hover:brightness-110 transition",
        className
      )}
      style={{
        width: frameStyle ? size + (frameStyle.padding * 2) : size,
        height: frameStyle ? size + (frameStyle.padding * 2) : size,
        ...(frameStyle || {}),
        ...(ring ? { boxShadow: `0 0 0 2px ${accent}`, borderRadius: "9999px" } : {}),
      }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-label={name ? `${name} avatar` : undefined}
    >
      <div className="relative w-full h-full rounded-full overflow-hidden bg-background">
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
      {imageFrameConfig && (
        <picture className="pointer-events-none">
          <source
            type="image/webp"
            srcSet={`/frames/${imageFrameConfig.slug}.v${imageFrameConfig.version ?? 2}.webp${size >= 110 ? ` 1x, /frames/${imageFrameConfig.slug}.v${imageFrameConfig.version ?? 2}@2x.webp 2x` : ""}`}
          />
          <img
            ref={frameImageRef}
            src={`/frames/${imageFrameConfig.slug}.v${imageFrameConfig.version ?? 2}.webp`}
            alt=""
            aria-hidden="true"
            className={cn("absolute pointer-events-none z-10 max-w-none object-contain transition-opacity duration-200", frameLoaded ? "opacity-100" : "opacity-0")}
            style={{
              left: "50%",
              top: "50%",
              width: `${frameScale * 100}%`,
              height: `${frameScale * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            loading="lazy"
            decoding="async"
            fetchPriority={size >= 110 ? "high" : "auto"}
            onLoad={() => setFrameLoaded(true)}
          />
        </picture>
      )}
    </div>
  );
}

const FRAMES: Record<string, string> = {
  ember: "conic-gradient(from 140deg, #f97316, #fbbf24, #f43f5e, #f97316)",
  gold: "conic-gradient(from 0deg, #fbbf24, #fef3c7, #d97706, #fbbf24)",
  neon: "conic-gradient(from 200deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4)",
  sakura: "conic-gradient(from 90deg, #fda4af, #f472b6, #c084fc, #fda4af)",
};

export interface FramedUser {
  username?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  equippedAvatarFrameId?: string | null;
  equippedNameFrameId?: string | null;
  accentColor?: string | null;
  accentTo?: string | null;
}

export function avatarNameGap(user: FramedUser, avatarSize: number, minimumGap = 20): number {
  if (!user.equippedAvatarFrameId) return 0;
  const scale = frameById(user.equippedAvatarFrameId)?.scale ?? 1.42;
  return avatarSize * (scale - 1) / 2 + minimumGap;
}

export function nameFrameContentInset(user: FramedUser, height: number): number {
  const config = frameById(user.equippedNameFrameId);
  if (!config || config.type !== "name" || !config.safe || !config.imageWidth || !config.imageHeight) return 0;
  const aspectRatio = config.imageWidth / config.imageHeight;
  const safeWidthRatio = ((100 - config.safe.left - config.safe.right) / 100) * aspectRatio;
  const safeHeightRatio = (100 - config.safe.top - config.safe.bottom) / 100;
  const minReadableHeight = Math.max(68 / safeWidthRatio, (config.maxFontPx ?? 22) / safeHeightRatio);
  const plateHeight = height >= 36 ? Math.max(height, minReadableHeight) : height;
  return plateHeight * aspectRatio * 0.04;
}

export function FramedAvatar({
  user,
  size = 40,
  className,
  onClick,
  ring = false,
}: {
  user: FramedUser;
  size?: number;
  className?: string;
  onClick?: () => void;
  ring?: boolean;
}) {
  return (
    <Avatar
      src={user.avatarUrl}
      name={user.displayName || user.username}
      accent={user.accentColor || "#f97316"}
      accentTo={user.accentTo}
      frame={user.equippedAvatarFrameId ? null : user.avatarFrame}
      imageFrame={user.equippedAvatarFrameId}
      size={size}
      className={className}
      onClick={onClick}
      ring={ring}
    />
  );
}

export function NameWithFrame({
  user,
  compact = false,
  className,
  height = 40,
  avatarSize = 40,
}: {
  user: FramedUser;
  compact?: boolean;
  className?: string;
  height?: number;
  avatarSize?: number;
}) {
  const name = user.displayName?.trim() || user.username || "";
  const config = frameById(user.equippedNameFrameId);
  const color = user.accentColor || undefined;
  const avatarGap = avatarSize ? avatarNameGap(user, avatarSize, 16) : 0;
  if (compact || !config || config.type !== "name") {
    return <span className={className} title={name} style={{ color, marginLeft: user.equippedAvatarFrameId ? avatarGap : undefined }}>{name}</span>;
  }
  return (
    <NameFramePlate
      name={name}
      color={color}
      config={config}
      className={className}
      height={height}
    />
  );
}

function NameFramePlate({
  name,
  color,
  config,
  className,
  height,
}: {
  name: string;
  color?: string;
  config: NonNullable<ReturnType<typeof frameById>>;
  className?: string;
  height: number;
}) {
  const [debug, setDebug] = useState(false);
  const [fontSize, setFontSize] = useState(config.maxFontPx ?? 16);
  const [imageLoaded, setImageLoaded] = useState(false);
  const plateImageRef = useRef<HTMLImageElement>(null);
  const safeRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const debugFrame = window.requestAnimationFrame(() => {
      setDebug(new URLSearchParams(window.location.search).get("debugFrames") === "1");
    });
    return () => {
      window.cancelAnimationFrame(debugFrame);
    };
  }, []);
  useEffect(() => {
    const safeElement = safeRef.current;
    if (!safeElement) return;
    const fit = () => {
      const width = safeElement.clientWidth;
      if (!width) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return;
      const minFont = config.minFontPx ?? 11;
      const maxFont = Math.min(config.maxFontPx ?? 16, Math.floor(safeElement.clientHeight));
      for (let candidate = maxFont; candidate > minFont; candidate -= 1) {
        context.font = `600 ${candidate}px system-ui, sans-serif`;
        if (context.measureText(name).width <= width) {
          setFontSize(candidate);
          return;
        }
      }
      setFontSize(minFont);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(safeElement);
    return () => observer.disconnect();
  }, [config.maxFontPx, config.minFontPx, name]);
  useEffect(() => {
    const image = plateImageRef.current;
    if (image?.complete && image.naturalWidth > 0) setImageLoaded(true);
  }, [config.slug, config.version]);

  const safe = config.safe!;
  const imageWidth = config.imageWidth!;
  const imageHeight = config.imageHeight!;
  const aspectRatio = imageWidth / imageHeight;
  // Reserve enough plate space for a readable short name at the configured maximum font size.
  const safeWidthRatio = ((100 - safe.left - safe.right) / 100) * aspectRatio;
  const safeHeightRatio = (100 - safe.top - safe.bottom) / 100;
  const minReadableHeight = Math.max(68 / safeWidthRatio, (config.maxFontPx ?? 22) / safeHeightRatio);
  const plateHeight = height >= 36 ? Math.max(height, minReadableHeight) : height;
  const plateWidth = plateHeight * aspectRatio;
  return (
    <span
      className={cn("relative inline-flex max-w-full items-center align-middle", className)}
      title={name}
      style={{
        width: `${plateWidth}px`,
        maxWidth: "100%",
        paddingBlock: Math.round(height * 0.08),
        color: config.textColor || color || "var(--foreground)",
      }}
    >
      <span
        data-name-frame={config.slug}
        className="relative block w-full"
        style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
      >
        <img
          ref={plateImageRef}
          src={`/frames/${config.slug}.v${config.version ?? 2}.webp`}
          alt=""
          aria-hidden="true"
          className={cn("absolute inset-0 h-full w-full object-contain pointer-events-none transition-opacity duration-200", imageLoaded ? "opacity-100" : "opacity-0")}
          loading="lazy"
          decoding="async"
          fetchPriority={height >= 36 ? "high" : "auto"}
          onLoad={() => setImageLoaded(true)}
        />
        <span
          data-safe-text-area={config.slug}
          ref={safeRef}
          className="absolute z-[1] flex min-w-0 items-center overflow-hidden leading-none"
          style={{
            left: `${safe.left}%`,
            right: `${safe.right}%`,
            top: `${safe.top}%`,
            bottom: `${safe.bottom}%`,
            justifyContent: config.textAlign === "left" ? "flex-start" : config.textAlign === "right" ? "flex-end" : "center",
            fontSize: `${fontSize}px`,
            textAlign: config.textAlign ?? "center",
            whiteSpace: "nowrap",
            outline: debug ? "1px dashed #ff00e6" : undefined,
            background: debug ? "rgba(255, 0, 230, 0.16)" : undefined,
          }}
        >
          <span
            className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
            style={{
              textShadow: ["winter-flame", "scarlet-shatter"].includes(config.slug) ? "0 1px 2px var(--background)" : undefined,
            }}
          >
            {name}
          </span>
        </span>
      </span>
    </span>
  );
}

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
export function AnimeCard({ anime, rank, compactTitle = false }: { anime: AnimeSummary; rank?: number; compactTitle?: boolean }) {
  const navigate = useAppStore((s) => s.navigate);
  const { map: botMap, loading: botLoading, botError } = useBotCatalog();
  const isAvailable = botLoading || botError || (botMap && botMap[anime.slug]);

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
        <h3
          title={anime.title}
          className={cn(
            "text-[14px] font-bold leading-tight group-hover:text-primary transition-colors",
            compactTitle ? "truncate" : "line-clamp-2"
          )}
        >
          {anime.title}
        </h3>
        <p className="text-[11.5px] text-muted-foreground mt-1 line-clamp-1">
          {anime.type} · {genres.slice(0, 2).join(", ")}
        </p>
      </div>
    </div>
  );
}

/** Cinematic ranked card — giant metallic podium numeral + premium poster + title.
 *  tone "ember" (Trending Now) or "gold" (Hall of Fame) recolors the numeral. */
export function RankedCard({ anime, rank, tone = "ember" }: { anime: AnimeSummary; rank: number; tone?: "ember" | "gold" }) {
  const navigate = useAppStore((s) => s.navigate);
  const genres: string[] = typeof anime.genres === "string"
    ? String(anime.genres).split(",").filter(Boolean)
    : anime.genres || [];
  return (
    <div
      className={cn(
        "rank-card group relative w-[224px] sm:w-[240px] xl:w-[258px] shrink-0 cursor-pointer grid grid-cols-[72px_minmax(0,1fr)] grid-rows-[1fr_53px]",
        tone === "gold" && "rank-gold"
      )}
      onClick={() => navigate("detail", { animeId: anime.slug })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("detail", { animeId: anime.slug })}
      aria-label={`#${rank} ${anime.title}`}
    >
      {/* metallic podium numeral — grid row 1 keeps it grounded at the POSTER
          bottom so it never bleeds into the title block below */}
      <span
        className="rank-numeral col-start-1 row-start-1 self-end z-0 text-[116px] sm:text-[136px] xl:text-[154px] -mr-4 sm:-mr-5 select-none translate-y-[3px]"
        aria-hidden="true"
      >
        {rank}
      </span>

      {/* poster column — row-span-2, pulled left so the poster overlaps the numeral */}
      <div className="relative z-10 col-start-2 row-start-1 row-span-2 -ml-4 sm:-ml-5 min-w-0">
        <div
          className={cn(
            "img-zoom relative w-[168px] sm:w-[188px] xl:w-[206px] aspect-[2/3] rounded-2xl overflow-hidden bg-muted",
            "border border-white/[0.09] shadow-[0_18px_44px_-16px_rgba(0,0,0,0.75)]",
            "transition-all duration-500 group-hover:border-primary/50 group-hover:shadow-[0_24px_60px_-14px_var(--glow)] group-hover:-translate-y-1.5"
          )}
        >
          <SmartImage src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
          {/* premium top sheen */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.14] to-transparent pointer-events-none" />
          {/* light sweep on hover */}
          <span className="rank-shine" aria-hidden />
          {/* resting info — rating + access chip */}
          <div className="absolute bottom-0 inset-x-0 z-10 bg-gradient-to-t from-black/95 via-black/40 to-transparent p-2.5 pt-10">
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
              <span className="text-[12px] font-black text-white tabular-nums">{anime.rating.toFixed(1)}</span>
              {anime.isFree ? (
                <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/90 text-white tracking-wide">FREE</span>
              ) : anime.owned ? (
                <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/90 text-white tracking-wide">OWNED</span>
              ) : (
                <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/90 text-white tracking-wide">
                  {anime.price} CR
                </span>
              )}
            </div>
          </div>
          {/* hover veil — play FAB + genres */}
          <div className="absolute inset-0 z-[5] bg-gradient-to-t from-black/85 via-black/30 to-black/10 opacity-0 group-hover:opacity-100 transition duration-300 flex flex-col items-center justify-end pb-4 gap-2.5">
            <span className="bg-white/95 text-black rounded-full p-3 shadow-2xl transition-transform duration-300 group-hover:scale-105">
              <Play className="w-5 h-5 fill-black" />
            </span>
            <p className="text-[10.5px] text-white/80 font-semibold tracking-wide px-2 text-center truncate w-full">
              {genres.slice(0, 2).join(" · ")}
            </p>
          </div>
        </div>

        {/* fixed-height title block keeps every poster in the row aligned */}
        <div className="pt-2 h-[53px] min-w-0">
          <h3 title={anime.title} className="w-full min-w-0 text-[12.5px] leading-[15px] font-bold truncate group-hover:text-primary transition-colors">
            {anime.title}
          </h3>
          <p className="text-[10px] leading-[13px] text-muted-foreground mt-[2px] flex items-center gap-1.5">
            <span className="font-bold text-foreground/80">{anime.type}</span>
            <span aria-hidden>·</span>
            <span>{anime.year}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
              <span className="font-bold">{anime.rating.toFixed(1)}</span>
            </span>
          </p>
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
