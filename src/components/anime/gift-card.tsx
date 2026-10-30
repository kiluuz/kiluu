"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Loader2, Sparkles, Star, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { giftRarity, giftRarityById, giftSerialNumber, type GiftRarity } from "@/lib/gift-rarity";

export interface GiftCardAnime {
  title: string;
  coverImage?: string | null;
  genres?: string[] | string | null;
}

export interface GiftCardRecord {
  id: string;
  pricePaid: number;
  message?: string | null;
  createdAt: string;
  claimedAt?: string | null;
  status?: string;
  incoming?: boolean;
  rarity?: string | null;
  recipientUsername: string;
  anime: {
    slug: string;
    title: string;
    coverImage?: string | null;
    genres?: string[] | string | null;
  };
  sender?: { username: string; displayName?: string | null; avatarUrl?: string | null } | null;
}

function giftRarityFor(gift: GiftCardRecord): GiftRarity {
  return giftRarityById(gift.rarity) ?? giftRarity(gift.pricePaid);
}

function formatPrice(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

export function formatGiftDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const KANJI = "贈";

export function GiftStarRow({
  stars,
  color,
  className,
  size = 12,
}: {
  stars: number;
  color: string;
  className?: string;
  size?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${stars} star rarity`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          width={size}
          height={size}
          strokeWidth={1.5}
          className={index < stars ? "drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]" : "opacity-25"}
          style={{ color: index < stars ? "#ffd479" : "#ffffff", fill: index < stars ? "#ffd479" : "transparent" }}
        />
      ))}
    </span>
  );
}

export function GiftBox({
  size = "full",
  shaking = false,
  className,
}: {
  size?: "full" | "mini";
  shaking?: boolean;
  className?: string;
}) {
  const mini = size === "mini";
  return (
    <div
      className={cn(
        "relative select-none",
        mini ? "w-full" : "mx-auto w-[190px] max-w-full",
        shaking && "gift-box-shake",
        className
      )}
      aria-hidden="true"
    >
      <div className={cn("relative", mini ? "aspect-[5/7]" : "aspect-square")}>
        <div className="absolute inset-x-0 bottom-0 top-[24%] rounded-b-2xl rounded-t-md bg-gradient-to-br from-[#c12339] via-[#a91d31] to-[#6d0d19] shadow-[inset_0_2px_0_rgba(255,255,255,0.22),inset_0_-18px_30px_rgba(0,0,0,0.28),0_18px_40px_-16px_rgba(215,38,61,0.8)]" />
        <div className="absolute inset-x-[-4%] top-[16%] h-[13%] rounded-md bg-gradient-to-b from-[#e13d51] to-[#a91d31] shadow-[inset_0_2px_0_rgba(255,255,255,0.3),0_3px_8px_rgba(0,0,0,0.35)]" />
        <div className="absolute bottom-0 left-1/2 top-[16%] w-[15%] -translate-x-1/2 bg-gradient-to-b from-[#ffe2a0] via-[#f2b54b] to-[#c98a25] shadow-[0_0_12px_rgba(255,212,121,0.55)]" />
        <div className="absolute inset-x-[-4%] top-[16%] h-[13%] rounded-md border-y border-[#c98a25]/70" />
        <div className="absolute left-1/2 top-[-3%] flex -translate-x-1/2">
          <span className="block h-6 w-9 -rotate-[22deg] rounded-[50%] border-[3px] border-[#f2b54b] bg-[#f2b54b]/20" />
          <span className="-ml-2 block h-6 w-9 rotate-[22deg] rounded-[50%] border-[3px] border-[#f2b54b] bg-[#f2b54b]/20" />
        </div>
        <span className="absolute left-1/2 top-[1%] h-3 w-3 -translate-x-1/2 rounded-full bg-[#ffe2a0] shadow-[0_0_10px_rgba(255,226,160,0.9)]" />
      </div>
    </div>
  );
}

function GiftArt({
  anime,
  rarity,
  compact,
}: {
  anime?: GiftCardAnime | null;
  rarity: GiftRarity;
  compact?: boolean;
}) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const cover = anime?.coverImage ?? null;
  const showImage = Boolean(cover) && failedCover !== cover;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: `linear-gradient(155deg, ${rarity.color}38, #1b1410 58%, #0b0908)` }}
    >
      {showImage ? (
        <img
          src={cover!}
          alt={anime ? `${anime.title} gift card art` : "Gift card art"}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedCover(cover)}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "font-black leading-none text-white/85",
              compact ? "text-[64px]" : "text-[104px]"
            )}
            style={{ textShadow: `0 6px 30px ${rarity.color}55` }}
          >
            {KANJI}
          </span>
        </div>
      )}

      <div className="gift-speedlines pointer-events-none absolute inset-[-32%] opacity-50" aria-hidden="true" />
      <div className="gift-halftone pointer-events-none absolute inset-x-0 bottom-0 h-1/2 opacity-30 mix-blend-overlay" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" aria-hidden="true" />
    </div>
  );
}

export function GiftCard({
  anime,
  price = 0,
  rarity: rarityOverride,
  toUsername,
  fromUsername,
  message,
  serialNumber,
  size = "full",
  className,
}: {
  anime?: GiftCardAnime | null;
  price?: number;
  rarity?: GiftRarity;
  toUsername?: string | null;
  fromUsername?: string | null;
  message?: string | null;
  serialNumber?: string | number | null;
  size?: "full" | "mini";
  className?: string;
}) {
  const rarity = rarityOverride ?? giftRarity(price);
  const mini = size === "mini";
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (mini || typeof window === "undefined") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const update = () => setInteractive(!reduced.matches && !coarse.matches);
    update();
    reduced.addEventListener?.("change", update);
    coarse.addEventListener?.("change", update);
    return () => {
      reduced.removeEventListener?.("change", update);
      coarse.removeEventListener?.("change", update);
    };
  }, [mini]);

  function handleMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!interactive || !innerRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 28;
    const rotateX = (0.5 - py) * 28;
    innerRef.current.style.transform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
    frameRef.current?.style.setProperty("--foil-x", `${(px * 100).toFixed(1)}%`);
    frameRef.current?.style.setProperty("--foil-y", `${(py * 100).toFixed(1)}%`);
  }

  function handleLeave() {
    if (innerRef.current) innerRef.current.style.transform = "";
  }

  const serial =
    serialNumber == null
      ? "No. ——"
      : typeof serialNumber === "number"
        ? `No. ${String(serialNumber).padStart(4, "0")}`
        : serialNumber;
  const title = anime?.title || "Choose an anime";
  const recipient = toUsername?.replace(/^@/, "") || "username";

  if (mini) {
    return (
      <div
        className={cn("w-full select-none", className)}
        style={{ boxShadow: `0 0 26px -12px ${rarity.color}` }}
      >
        <div
          className="rounded-[16px] p-[6px]"
          style={{
            background: `linear-gradient(150deg, ${rarity.color}, rgba(255,255,255,0.16) 30%, ${rarity.color} 55%, rgba(0,0,0,0.6))`,
          }}
        >
          <div className="overflow-hidden rounded-[12px] bg-[#0d0b0a]">
            <div className="relative aspect-[5/7]">
              <GiftArt anime={anime} rarity={rarity} compact />
              <GiftStarRow stars={rarity.stars} color={rarity.color} size={10} className="absolute bottom-1.5 left-1.5 z-10" />
            </div>
            <div className="bg-black/70 px-2 py-1.5">
              <p className="line-clamp-1 text-[11px] font-bold leading-tight text-white">{title}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={frameRef}
      className={cn(
        "relative w-full max-w-[320px] select-none",
        interactive && "gift-card-tilt",
        className
      )}
      style={{ perspective: 900 }}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
    >
      <div
        ref={innerRef}
        className="gift-frame relative flex aspect-[5/7] w-full flex-col overflow-hidden rounded-[20px] p-[11px]"
        style={{
          background: `linear-gradient(150deg, ${rarity.color}, rgba(255,255,255,0.14) 26%, ${rarity.color} 52%, rgba(0,0,0,0.62))`,
          boxShadow: `0 0 60px -10px ${rarity.color}, inset 0 0 0 1px rgba(255,255,255,0.18)`,
        }}
      >
        <div className="gift-ribbon" style={{ background: `linear-gradient(90deg, ${rarity.color}, #ffffff)` }}>
          {rarity.label}
        </div>

        {/* Header */}
        <div className="z-10 flex items-center justify-between gap-2 rounded-t-[10px] bg-black/45 px-2.5 py-2 backdrop-blur-sm">
          <p className="line-clamp-1 text-[11px] font-black uppercase tracking-wide text-white/95">{title}</p>
          <span
            className="flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold"
            style={{ borderColor: `${rarity.color}88`, color: rarity.color }}
          >
            <Coins className="h-2.5 w-2.5" />
            {formatPrice(price)}
          </span>
        </div>

        {/* Art */}
        <div className="relative mt-1 flex-1 overflow-hidden rounded-[12px]">
          <GiftArt anime={anime} rarity={rarity} />
          <GiftStarRow
            stars={rarity.stars}
            color={rarity.color}
            size={14}
            className="absolute bottom-2 left-2.5 z-10"
          />
          {fromUsername ? (
            <span className="absolute bottom-2 right-2.5 z-10 text-[8px] font-bold uppercase tracking-[0.16em] text-white/60">
              from @{fromUsername.replace(/^@/, "")}
            </span>
          ) : null}
          <div className="gift-foil z-20" aria-hidden="true" />
        </div>

        {/* Footer */}
        <div className="z-10 mt-1 flex items-center justify-between gap-2 rounded-b-[10px] bg-black/45 px-2.5 py-1.5 backdrop-blur-sm">
          <span className="truncate text-[10px] font-bold text-white/90">To @{recipient}</span>
          <span className="shrink-0 font-mono text-[9px] text-white/45">{serial}</span>
        </div>

        {/* Speech bubble */}
        <div className="relative z-10 mt-1.5 rounded-xl bg-white px-2.5 pb-2 pt-1.5 text-neutral-900 shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
          <span className="absolute -top-[6px] left-5 h-2.5 w-3.5 bg-white [clip-path:polygon(50%_0,100%_100%,0_100%)]" />
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-[#b91c1c]">{rarity.label} gift</p>
          <p className="mt-0.5 line-clamp-2 min-h-[2.2em] text-[10px] italic leading-snug text-neutral-700">
            {message?.trim() || "Write something from the heart…"}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface GiftDetailDialogProps {
  gift: GiftCardRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "received" | "sent";
  unopened?: boolean;
  onClaim?: () => Promise<boolean> | boolean;
  onDecline?: () => Promise<boolean> | boolean;
  onWatch?: () => void;
  busy?: boolean;
}

export function GiftDetailDialog(props: GiftDetailDialogProps) {
  const { gift, open, onOpenChange } = props;
  if (!gift) return null;
  const rarity = giftRarityFor(gift);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-[430px] border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">
          {gift.anime.title} — {rarity.label} gift
        </DialogTitle>
        <DialogDescription className="sr-only">
          Gift card details, message and actions.
        </DialogDescription>
        <GiftDetailBody {...props} gift={gift} />
      </DialogContent>
    </Dialog>
  );
}

function GiftDetailBody({
  gift,
  onOpenChange,
  mode,
  unopened = false,
  onClaim,
  onDecline,
  onWatch,
  busy = false,
}: GiftDetailDialogProps & { gift: GiftCardRecord }) {
  const [revealed, setRevealed] = useState(!unopened);
  const [opening, setOpening] = useState(false);

  const rarity = giftRarityFor(gift);
  const status = gift.status ?? "PENDING";
  const senderName = gift.sender?.username;
  const serial = giftSerialNumber(gift.id);

  async function unwrap() {
    if (busy || opening) return;
    if (!onClaim) {
      setRevealed(true);
      return;
    }
    setOpening(true);
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) await new Promise((resolve) => setTimeout(resolve, 900));
    const ok = await onClaim();
    setOpening(false);
    if (ok) setRevealed(true);
  }

  const statusLabel =
    status === "PENDING"
      ? mode === "sent"
        ? `Waiting for @${gift.recipientUsername}`
        : "Unopened"
      : status === "CLAIMED"
        ? "Opened"
        : status.charAt(0) + status.slice(1).toLowerCase();

  return (
    <div className="relative max-h-[92vh] overflow-y-auto rounded-[26px] border border-white/10 bg-card p-4 shadow-2xl">
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        className="absolute right-3 top-3 z-30 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white/80 transition hover:bg-black/60 hover:text-white focus-ring-accent"
        aria-label="Close gift details"
      >
        <X className="h-4 w-4" />
      </button>

      {revealed ? (
        <div className="gift-fade-in">
          <div className="flex justify-center pt-2">
            <GiftCard
              anime={gift.anime}
              price={gift.pricePaid}
              rarity={rarity}
              toUsername={mode === "sent" ? gift.recipientUsername : undefined}
              fromUsername={senderName}
              message={gift.message}
              serialNumber={serial}
            />
          </div>
          <div className="mt-4 space-y-2.5 px-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                style={{ background: `${rarity.color}22`, color: rarity.color }}
              >
                {rarity.label}
              </span>
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {statusLabel}
              </span>
              <span className="text-[11px] text-muted-foreground">{formatGiftDate(gift.createdAt)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "received"
                ? <>From <span className="font-semibold text-foreground">@{senderName ?? "unknown"}</span></>
                : <>To <span className="font-semibold text-foreground">@{gift.recipientUsername}</span></>}
              {" · "}
              <span className="font-semibold text-amber-400">{formatPrice(gift.pricePaid)} credits</span>
            </p>
            {gift.message ? (
              <p className="rounded-xl border bg-background/60 p-3 text-sm italic leading-relaxed text-muted-foreground">
                “{gift.message}”
              </p>
            ) : null}
            {mode === "received" && onWatch ? (
              <Button className="w-full rounded-xl brand-gradient text-white" onClick={onWatch}>
                <Sparkles className="h-4 w-4" /> Watch now
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 px-2 pb-1 pt-6 text-center">
          <GiftBox size="full" shaking={opening} />
          <div>
            <p className="text-sm font-bold">A gift from @{senderName ?? "someone"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {rarity.label} · {statusLabel} · {formatGiftDate(gift.createdAt)}
            </p>
          </div>
          <div className="flex w-full gap-2">
            <Button
              className="flex-1 rounded-xl brand-gradient text-white"
              disabled={busy || opening}
              onClick={() => void unwrap()}
            >
              {opening || busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {opening ? "Opening…" : "Unwrap gift"}
            </Button>
            {onDecline ? (
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={busy || opening}
                onClick={() => void onDecline()}
              >
                Decline
              </Button>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">The anime moves into your library when you unwrap it.</p>
        </div>
      )}
    </div>
  );
}
