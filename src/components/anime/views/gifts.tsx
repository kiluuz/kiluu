"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Coins,
  Gift as GiftIcon,
  Inbox,
  Loader2,
  Search,
  Send,
  SendHorizonal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { formatCredits } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { giftRarity, giftSerialNumber } from "@/lib/gift-rarity";
import {
  GiftBox,
  GiftCard,
  GiftDetailDialog,
  formatGiftDate,
  type GiftCardRecord,
} from "../gift-card";

interface GiftRow {
  id: string;
  status: string;
  message: string | null;
  pricePaid: number;
  expiresAt: string;
  createdAt: string;
  claimedAt: string | null;
  incoming: boolean;
  recipientUsername: string;
  anime: { id: string; slug: string; title: string; coverImage: string | null; genres?: string[] };
  sender: { username: string; displayName: string | null; avatarUrl: string | null };
}

interface CatalogAnime {
  id: string;
  slug: string;
  title: string;
  price: number;
  coverImage: string | null;
  genres: string[];
}

interface Recipient {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
}

const MESSAGE_LIMIT = 80;

function stepTitle(number: number, title: string, optional = false) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-black text-primary">
        {number}
      </span>
      <h2 className="text-sm font-bold">{title}</h2>
      {optional ? (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">optional</span>
      ) : null}
    </div>
  );
}

function PosterThumb({ anime }: { anime: CatalogAnime }) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const failed = Boolean(anime.coverImage) && failedCover === anime.coverImage;
  if (!anime.coverImage || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 via-muted to-background p-2">
        <span className="line-clamp-3 text-center text-[10px] font-black text-muted-foreground">{anime.title}</span>
      </div>
    );
  }
  return (
    <img
      src={anime.coverImage}
      alt={anime.title}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailedCover(anime.coverImage)}
    />
  );
}

export function GiftsView() {
  const { t } = useI18n();
  const { user, setAuthOpen, navigate, updateUser } = useAppStore();

  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [catalog, setCatalog] = useState<CatalogAnime[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [recipientQuery, setRecipientQuery] = useState("");
  const [lookup, setLookup] = useState<{
    query: string;
    status: "valid" | "invalid";
    user: Recipient | null;
  } | null>(null);
  const [animeId, setAnimeId] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [serverNeed, setServerNeed] = useState(0);

  const [tab, setTab] = useState<"received" | "sent">("sent");
  const [visibleCount, setVisibleCount] = useState(12);
  const [selectedGift, setSelectedGift] = useState<GiftRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [celebration, setCelebration] = useState<GiftCardRecord | null>(null);

  const selectedAnime = useMemo(() => catalog.find((anime) => anime.id === animeId) ?? null, [catalog, animeId]);
  const normalizedRecipient = recipientQuery.replace(/^@/, "").trim();
  const currentLookup = lookup && lookup.query === normalizedRecipient ? lookup : null;
  const recipient = normalizedRecipient && currentLookup?.status === "valid" ? currentLookup.user : null;
  const recipientStatus: "idle" | "checking" | "valid" | "invalid" = !normalizedRecipient
    ? "idle"
    : !currentLookup
      ? "checking"
      : currentLookup.status;
  const price = selectedAnime?.price ?? 0;
  const need = selectedAnime ? Math.max(0, price - (user?.credits ?? 0)) : 0;
  const canSend = Boolean(recipient && selectedAnime) && !sending && need === 0;

  const load = useCallback(() => {
    fetch("/api/gifts", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "load failed");
        setGifts(data.gifts || []);
        setLoadError(false);
      })
      .catch(() => {
        setLoadError(true);
        toast.error(t("gifts.loadError"));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (!user) return;
    load();
    fetch("/api/animes?limit=40", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data.animes || data.items || [];
        setCatalog(
          list
            .filter((anime: { price?: number; isFree?: boolean; hidden?: boolean }) => !anime.hidden && !anime.isFree && (anime.price || 0) > 0)
            .map((anime: {
              id: string;
              slug: string;
              title: string;
              price: number;
              coverImage?: string | null;
              genres?: string[] | string;
            }) => ({
              id: anime.id,
              slug: anime.slug,
              title: anime.title,
              price: anime.price,
              coverImage: anime.coverImage ?? null,
              genres: Array.isArray(anime.genres)
                ? anime.genres
                : String(anime.genres || "").split(",").filter(Boolean),
            }))
        );
      })
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [user, load]);

  // Validate the recipient as the user types
  useEffect(() => {
    const username = recipientQuery.replace(/^@/, "").trim();
    if (!username) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/users/lookup?username=${encodeURIComponent(username)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "lookup failed");
          setLookup({
            query: username,
            status: data.user ? "valid" : "invalid",
            user: data.user ?? null,
          });
        })
        .catch((error: Error) => {
          if (error.name === "AbortError") return;
          setLookup({ query: username, status: "invalid", user: null });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [recipientQuery]);

  const filteredCatalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return catalog;
    return catalog.filter(
      (anime) => anime.title.toLowerCase().includes(query) || anime.slug.toLowerCase().includes(query)
    );
  }, [catalog, search]);

  const tabGifts = useMemo(
    () => gifts.filter((gift) => (tab === "received" ? gift.incoming : !gift.incoming)),
    [gifts, tab]
  );
  const shownGifts = tabGifts.slice(0, visibleCount);
  const unopenedCount = gifts.filter((gift) => gift.incoming && gift.status === "PENDING").length;

  function switchTab(next: "received" | "sent") {
    setTab(next);
    setVisibleCount(12);
  }

  async function send() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!recipient || !selectedAnime) return;
    setSending(true);
    setServerNeed(0);
    try {
      const response = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: recipient.username,
          animeId: selectedAnime.id,
          message: message.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (typeof data.need === "number") setServerNeed(data.need);
        toast.error(data.error || t("gifts.sendError"));
        return;
      }
      if (typeof data.credits === "number") updateUser({ credits: data.credits });
      const giftId = String(data.giftId);
      setCelebration({
        id: giftId,
        pricePaid: selectedAnime.price,
        message: message.trim() || null,
        createdAt: new Date().toISOString(),
        status: "PENDING",
        incoming: false,
        recipientUsername: recipient.username,
        sender: { username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
        anime: {
          slug: selectedAnime.slug,
          title: selectedAnime.title,
          coverImage: selectedAnime.coverImage,
          genres: selectedAnime.genres,
        },
      });
      toast.success(`Gift sent to @${recipient.username}`);
      switchTab("sent");
      load();
      setRecipientQuery("");
      setAnimeId("");
      setSearch("");
      setMessage("");
    } catch {
      toast.error(t("gifts.networkError"));
    } finally {
      setSending(false);
    }
  }

  async function claimSelected(): Promise<boolean> {
    if (!selectedGift) return false;
    setActing(true);
    try {
      const response = await fetch(`/api/gifts/${selectedGift.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || t("gifts.actionError"));
        return false;
      }
      toast.success(t("gifts.claimed"));
      setSelectedGift((current) =>
        current ? { ...current, status: "CLAIMED", claimedAt: new Date().toISOString() } : current
      );
      load();
      return true;
    } catch {
      toast.error(t("gifts.networkError"));
      return false;
    } finally {
      setActing(false);
    }
  }

  async function declineSelected(): Promise<boolean> {
    if (!selectedGift) return false;
    setActing(true);
    try {
      const response = await fetch(`/api/gifts/${selectedGift.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || t("gifts.actionError"));
        return false;
      }
      toast.success(t("gifts.declined"));
      setDetailOpen(false);
      load();
      return true;
    } catch {
      toast.error(t("gifts.networkError"));
      return false;
    } finally {
      setActing(false);
    }
  }

  function openGift(gift: GiftRow) {
    setSelectedGift(gift);
    setDetailOpen(true);
  }

  if (!user) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-16 text-center">
        <GiftIcon className="w-10 h-10 mx-auto mb-3 text-primary" />
        <p className="font-bold text-lg mb-2">{t("nav.gifts")}</p>
        <Button onClick={() => setAuthOpen(true)}>{t("signIn")}</Button>
      </div>
    );
  }

  const previewRarity = giftRarity(price);
  const unopenedSelected = Boolean(selectedGift?.incoming && selectedGift.status === "PENDING");

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="sr-only">{t("nav.gifts")}</h1>

      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">Kiluu collectibles</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight">Send a gift</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Turn credits into a numbered collectible card — the anime lands in their library when they unwrap it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-bold tabular-nums">
            <Coins className="h-4 w-4 text-amber-400" />
            {formatCredits(user.credits ?? 0)}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate("credits")}
          >
            + Get credits
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Send form */}
        <section className="rounded-[22px] border bg-card/60 p-4 sm:p-6">
          {/* Step 1 */}
          <div>
            {stepTitle(1, "Who's it for?")}
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                @
              </span>
              <Input
                value={recipientQuery}
                onChange={(event) => setRecipientQuery(event.target.value)}
                placeholder="username"
                autoComplete="off"
                spellCheck={false}
                aria-label="Recipient username"
                aria-invalid={recipientStatus === "invalid"}
                className="h-11 rounded-xl pl-7 pr-10"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {recipientStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                {recipientStatus === "valid" ? <Check className="h-4 w-4 text-emerald-400" /> : null}
                {recipientStatus === "invalid" ? <X className="h-4 w-4 text-destructive" /> : null}
              </span>
            </div>
            {recipientStatus === "valid" && recipient ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] px-2.5 py-1.5">
                {recipient.avatarUrl ? (
                  <img src={recipient.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" loading="lazy" />
                ) : (
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-black text-white"
                    style={{ background: recipient.accentColor || "var(--primary)" }}
                  >
                    {recipient.username.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <p className="text-xs">
                  <span className="font-bold">{recipient.displayName || recipient.username}</span>
                  <span className="text-muted-foreground"> @{recipient.username}</span>
                </p>
              </div>
            ) : null}
            {recipientStatus === "invalid" ? (
              <p className="mt-1.5 text-xs font-medium text-destructive">
                No user found with that username.
              </p>
            ) : null}
          </div>

          {/* Step 2 */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {stepTitle(2, "Choose an anime")}
              <div className="relative mb-2.5 w-full sm:w-48">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search titles"
                  aria-label="Search giftable anime"
                  className="h-8 rounded-lg pl-8 text-xs"
                />
              </div>
            </div>

            {catalogLoading ? (
              <div className="grid max-h-[430px] grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : filteredCatalog.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                {catalog.length === 0 ? "No giftable anime available yet." : "No anime matches that search."}
              </p>
            ) : (
              <div
                className="grid max-h-[430px] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4"
                role="group"
                aria-label="Giftable anime"
              >
                {filteredCatalog.map((anime) => {
                  const rarity = giftRarity(anime.price);
                  const selected = anime.id === animeId;
                  return (
                    <button
                      key={anime.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${anime.title} — ${formatCredits(anime.price)} credits, ${rarity.label}`}
                      onClick={() => setAnimeId(selected ? "" : anime.id)}
                      className={cn(
                        "gift-shine group relative overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        selected
                          ? "border-amber-300/80 shadow-[0_0_26px_-6px_rgba(255,196,107,0.85)] ring-2 ring-amber-300"
                          : "border-border hover:-translate-y-0.5 hover:border-primary/50"
                      )}
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                        <PosterThumb anime={anime} />
                        <span
                          className="absolute left-1.5 top-1.5 z-10 rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider backdrop-blur"
                          style={{
                            color: rarity.color,
                            borderColor: `${rarity.color}77`,
                            background: "rgba(0,0,0,0.55)",
                          }}
                        >
                          {rarity.label}
                        </span>
                        {selected ? (
                          <span className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-amber-300 text-black shadow">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-2 pb-2 pt-6">
                          <p className="line-clamp-1 text-[10px] font-bold text-white">{anime.title}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-300">
                            <Coins className="h-3 w-3" />
                            {formatCredits(anime.price)}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className="mt-6">
            {stepTitle(3, "Message", true)}
            <div className="relative">
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_LIMIT))}
                maxLength={MESSAGE_LIMIT}
                rows={2}
                placeholder="Add a short note to the card…"
                aria-label="Gift message"
                className="w-full resize-none rounded-xl border bg-background px-3 py-2 pr-14 text-sm outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] font-semibold tabular-nums text-muted-foreground">
                {message.length}/{MESSAGE_LIMIT}
              </span>
            </div>
          </div>

          <Button
            onClick={send}
            disabled={!canSend}
            className="mt-5 h-11 w-full rounded-xl brand-gradient text-white brand-gradient-hover"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {selectedAnime ? (
              <span className="flex items-center gap-1.5">
                Send gift · <Coins className="h-4 w-4" /> {formatCredits(selectedAnime.price)}
              </span>
            ) : (
              "Send gift"
            )}
          </Button>

          {need > 0 ? (
            <p className="mt-2 text-center text-xs font-medium text-amber-400">
              You need {formatCredits(need)} more credits for this one.{" "}
              <button type="button" onClick={() => navigate("credits")} className="font-bold underline underline-offset-2">
                Get credits
              </button>
            </p>
          ) : null}
          {serverNeed > 0 && serverNeed !== need ? (
            <p className="mt-2 text-center text-xs font-medium text-amber-400">
              You need {formatCredits(serverNeed)} more credits for this one.{" "}
              <button type="button" onClick={() => navigate("credits")} className="font-bold underline underline-offset-2">
                Get credits
              </button>
            </p>
          ) : null}
          <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">{t("gifts.description")}</p>
        </section>

        {/* Live preview */}
        <aside className="lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">Live preview</h2>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ background: `${previewRarity.color}22`, color: previewRarity.color }}
            >
              {previewRarity.label} · {previewRarity.stars}★
            </span>
          </div>
          <div className="flex justify-center">
            <GiftCard
              anime={
                selectedAnime
                  ? { title: selectedAnime.title, coverImage: selectedAnime.coverImage, genres: selectedAnime.genres }
                  : null
              }
              price={price}
              toUsername={recipient?.username ?? null}
              message={message}
              serialNumber={null}
            />
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
            The real card gets a serial number the moment you send it.
          </p>
        </aside>
      </div>

      {/* Gifts list */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-black">
            <GiftIcon className="h-5 w-5 text-primary" /> Your gifts
          </h2>
          <div className="inline-flex rounded-full border bg-card p-1" role="group" aria-label="Gift history filter">
            <button
              type="button"
              aria-pressed={tab === "sent"}
              onClick={() => switchTab("sent")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-ring-accent",
                tab === "sent" ? "brand-gradient text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <SendHorizonal className="h-3.5 w-3.5" /> Sent
              <span className="tabular-nums opacity-70">{gifts.filter((gift) => !gift.incoming).length}</span>
            </button>
            <button
              type="button"
              aria-pressed={tab === "received"}
              onClick={() => switchTab("received")}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors focus-ring-accent",
                tab === "received" ? "brand-gradient text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Inbox className="h-3.5 w-3.5" /> Received
              <span className="tabular-nums opacity-70">{gifts.filter((gift) => gift.incoming).length}</span>
              {unopenedCount > 0 ? (
                <span className="rounded-full bg-amber-300 px-1 text-[9px] font-black text-black">
                  {unopenedCount} new
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <div className="aspect-[5/7] animate-pulse rounded-[16px] bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-2 w-16 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : loadError && gifts.length === 0 ? (
            <div className="rounded-[22px] border border-dashed p-8 text-center">
              <p className="text-sm font-bold">Could not load your gifts</p>
              <p className="mt-1 text-xs text-muted-foreground">Check your connection and try again.</p>
              <Button variant="outline" className="mt-3 rounded-xl" onClick={load}>
                Try again
              </Button>
            </div>
          ) : shownGifts.length === 0 ? (
            <div className="rounded-[22px] border border-dashed p-10 text-center">
              <p className="text-6xl font-black leading-none text-muted-foreground/20">贈</p>
              <p className="mt-3 text-sm font-bold">No gifts yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "received"
                  ? "Send one above and make someone's day."
                  : "Gifts you send will appear here until they're opened."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {shownGifts.map((gift) => {
                  const unopened = gift.incoming && gift.status === "PENDING";
                  const statusText = unopened
                    ? "Unopened"
                    : gift.status === "PENDING"
                      ? "Waiting"
                      : gift.status === "CLAIMED"
                        ? "Opened"
                        : gift.status.charAt(0) + gift.status.slice(1).toLowerCase();
                  return (
                    <button
                      key={gift.id}
                      type="button"
                      onClick={() => openGift(gift)}
                      aria-label={
                        unopened
                          ? `Unopened gift from @${gift.sender.username} — ${gift.anime.title}`
                          : `${gift.incoming ? "From" : "To"} @${gift.incoming ? gift.sender.username : gift.recipientUsername} — ${gift.anime.title}`
                      }
                      className="group rounded-[18px] text-left focus-ring-accent"
                    >
                      {unopened ? (
                        <div className="relative rounded-[16px] border bg-card/60 p-2 pb-6 transition-colors group-hover:border-primary/50">
                          <GiftBox size="mini" />
                          <span className="absolute inset-x-0 bottom-2 text-center text-[10px] font-black uppercase tracking-wider text-primary">
                            Tap to unwrap
                          </span>
                        </div>
                      ) : (
                        <GiftCard size="mini" anime={gift.anime} price={gift.pricePaid} />
                      )}
                      <div className="mt-2 px-0.5">
                        <p className="truncate text-xs font-bold">
                          {gift.incoming ? `From @${gift.sender.username}` : `To @${gift.recipientUsername}`}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {statusText} · {formatGiftDate(gift.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {visibleCount < tabGifts.length ? (
                <div className="mt-5 flex justify-center">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setVisibleCount((count) => count + 12)}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      <GiftDetailDialog
        gift={selectedGift}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        mode={selectedGift?.incoming ? "received" : "sent"}
        unopened={unopenedSelected}
        onClaim={unopenedSelected ? claimSelected : undefined}
        onDecline={unopenedSelected ? declineSelected : undefined}
        onWatch={
          selectedGift?.incoming && selectedGift.status === "CLAIMED"
            ? () => {
                setDetailOpen(false);
                navigate("detail", { animeId: selectedGift.anime.slug });
              }
            : undefined
        }
        busy={acting}
      />

      {celebration ? <SendCelebration gift={celebration} onClose={() => setCelebration(null)} /> : null}
    </div>
  );
}

function SendCelebration({ gift, onClose }: { gift: GiftCardRecord; onClose: () => void }) {
  const rarity = giftRarity(gift.pricePaid);
  const reducedMotion = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const petals = useMemo(
    () =>
      Array.from({ length: 40 }).map((_, index) => ({
        left: `${(index * 37) % 100}%`,
        delay: `${(((index * 13) % 28) / 10).toFixed(1)}s`,
        duration: `${(2 + ((index * 7) % 20) / 10).toFixed(1)}s`,
        drift: `${((index * 29) % 160) - 80}px`,
        size: 7 + (index % 5) * 2,
      })),
    []
  );

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion.current) {
      setRevealed(true);
      return;
    }
    const timer = setTimeout(() => setRevealed(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Gift sent to @${gift.recipientUsername}`}
      onClick={onClose}
      className="gift-fade-in fixed inset-0 z-[130] flex cursor-pointer items-center justify-center overflow-hidden bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {petals.map((petal, index) => (
          <span
            key={index}
            className="gift-petal"
            style={
              {
                left: petal.left,
                width: petal.size,
                height: petal.size + 3,
                "--petal-delay": petal.delay,
                "--petal-duration": petal.duration,
                "--petal-drift": petal.drift,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {revealed ? (
          <div className="gift-pop-in flex flex-col items-center">
            <p className="mb-3 text-3xl font-black tracking-tight" style={{ color: rarity.color }}>
              {rarity.label}!
            </p>
            <GiftCard
              anime={gift.anime}
              price={gift.pricePaid}
              toUsername={gift.recipientUsername}
              fromUsername={gift.sender?.username}
              message={gift.message}
              serialNumber={giftSerialNumber(gift.id)}
            />
            <p className="mt-4 text-sm font-semibold text-white/90">Gift sent to @{gift.recipientUsername}</p>
            <p className="mt-1 text-[11px] text-white/50">Click anywhere to close</p>
          </div>
        ) : (
          <GiftBox size="full" shaking />
        )}
      </div>
    </div>
  );
}
