"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Play, Star, Plus, Check, Coins, Heart, Share2, Users, Video,
  Clock3, Loader2, BadgeCheck, Tv, Film, Package, Sparkles, Clapperboard, Send, ShoppingCart, Bell, BellOff, Link2, Lock, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "../store";
import type { AnimeDetail, EpisodeItem, AnimeSummary, AnimeVersionCard } from "../types";
import { AnimeCard, FramedAvatar, SmartImage, formatCredits } from "../ui-bits";
import { useBotCatalog, useBotStatus } from "../bot-hooks";
import { CreditPurchaseModal, LinkTelegramModal } from "../bot-ui";
import { ChatPanel } from "../chat/chat-panel";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DetailResponse {
  anime: AnimeDetail;
  episodes: EpisodeItem[];
  related: AnimeSummary[];
}

function formatDetailCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const d = Math.floor(ms / (1000 * 60 * 60 * 24));
  const h = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((ms % (1000 * 60)) / 1000);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}k`);
  if (h > 0 || d > 0) parts.push(`${h}s`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}d`);
  parts.push(`${s}s`);

  return parts.join(" ");
}

export function DetailView() {
  const { view, user, setAuthOpen, navigate, updateUser } = useAppStore();
  const [activeDetailTab, setActiveDetailTab] = useState<"episodes" | "chat">("episodes");
  const queryClient = useQueryClient();
  const animeId = view.animeId!;
  const detailKey = ["anime-detail", animeId, user?.id ?? "anonymous"] as const;
  const { data, isPending: loading, error: detailError } = useQuery({
    queryKey: detailKey,
    queryFn: async (): Promise<DetailResponse> => {
      const response = await fetch(`/api/animes/${encodeURIComponent(animeId)}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Failed to load anime");
      return payload as DetailResponse;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const [favBusy, setFavBusy] = useState(false);
  const [ratingBusy, setRatingBusy] = useState(false);

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [justPurchased, setJustPurchased] = useState(false);
  const [notifySubscribed, setNotifySubscribed] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [episodePurchaseModal, setEpisodePurchaseModal] = useState<{number: number; title: string; price: number} | null>(null);
  const [episodeBuying, setEpisodeBuying] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const [anilistEntry, setAnilistEntry] = useState<any>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!data?.anime) return;
    let alive = true;
    fetch("/api/anilist/schedule?days=7")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!alive || !d?.schedule) return;
        const searchArr = [
          data.anime.title.toLowerCase(),
          data.anime.altTitle?.toLowerCase(),
        ].filter(Boolean) as string[];

        let match = null;
        for (const list of Object.values(d.schedule)) {
          for (const entry of (list as any[])) {
            const tRomaji = entry.media.titleRomaji.toLowerCase();
            const tEn = entry.media.title.toLowerCase();
            const tNative = entry.media.titleNative?.toLowerCase();

            if (searchArr.some(s => tEn.includes(s) || tRomaji.includes(s) || (tNative && tNative.includes(s)) || s.includes(tEn) || s.includes(tRomaji))) {
              if (entry.airingAt * 1000 > Date.now()) {
                match = entry;
              }
              break;
            }
          }
          if (match) break;
        }
        if (match) setAnilistEntry(match);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [data?.anime.title, data?.anime.altTitle]);

  async function rateAnime(rating: number) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!data) return;
    setRatingBusy(true);
    try {
      const response = await fetch(`/api/animes/${data.anime.id}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save rating");
      queryClient.setQueryData<DetailResponse>(detailKey, (current) => current ? {
        ...current,
        anime: {
          ...current.anime,
          myRating: result.myRating,
          communityRating: result.communityRating,
          ratingCount: result.ratingCount,
        },
      } : current);
      toast.success("Your rating was saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save rating");
    } finally {
      setRatingBusy(false);
    }
  }

  useEffect(() => {
    if (detailError) {
      toast.error(detailError instanceof Error ? detailError.message : "Failed to load anime");
    }
  }, [detailError]);

  // Bot integration state (ALL hooks must be called before early returns)
  const { map: botMap, loading: botLoading, botError } = useBotCatalog();
  const botStatus = useBotStatus(!!user);
  const { episodePurchases } = botStatus;

  // Notify subscription — uses data?.anime.id so it's safe before data is loaded
  const currentAnimeId = data?.anime.id ?? null;
  const currentSlug = data?.anime.slug ?? null;
  // isAvailableInBot: true if in catalog OR if bot is unreachable (don't block purchase when bot is down)
  const isAvailableInBot = botError || !!(botMap && currentSlug && botMap[currentSlug]);
  const isUpcoming = data?.anime.status === "UPCOMING";

  useEffect(() => {
    if (!user || !currentAnimeId || !isUpcoming) return;
    fetch(`/api/notify/${currentAnimeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setNotifySubscribed(d.subscribed))
      .catch(() => {});
  }, [currentAnimeId, user?.id, isUpcoming]);

  if (loading) {
    return (
      <div className="pb-10">
        <div className="h-[46vh] skeleton" />
        <div className="max-w-[1100px] mx-auto px-4 sm:px-8 mt-6 space-y-4">
          <div className="h-10 w-2/3 rounded-xl skeleton" />
          <div className="h-4 w-1/2 rounded skeleton" />
          <div className="h-24 rounded-2xl skeleton" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-32">
        <p className="text-5xl mb-4">😵‍💫</p>
        <p className="font-bold text-lg">Anime not found</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("home")}>
          Back to Home
        </Button>
      </div>
    );
  }

  const { anime, episodes, related } = data;
  const versions: AnimeVersionCard[] = anime.versions || [];
  const selectedVersion =
    versions.find((v) => v.id === selectedVersionId) ||
    versions.find((v) => v.kind === "official") ||
    versions[0];
  const ownsSelected = Boolean(selectedVersion?.owned || anime.owned);

  const botAnime = botMap ? botMap[anime.slug] : null;
  const isPurchasedInBot = justPurchased || (botStatus?.purchases || []).includes(anime.slug);
  // episodePurchases for this anime: {"1": true, "2": true}
  const myEpisodePurchases: Record<string, boolean> = {};
  if (episodePurchases && episodePurchases[anime.slug]) {
    for (const epNum of episodePurchases[anime.slug]) {
      myEpisodePurchases[String(epNum)] = true;
    }
  }
  if (Array.isArray((anime as any).ownedEpisodes)) {
    for (const epNum of (anime as any).ownedEpisodes) {
      myEpisodePurchases[String(epNum)] = true;
    }
  }

  const displayEpisodes =
    episodes && episodes.length > 0
      ? episodes
      : botAnime?.episodes && Array.isArray(botAnime.episodes)
        ? botAnime.episodes.map((num: number) => ({
            id: `ep-${anime.slug}-${num}`,
            animeId: anime.id,
            number: num,
            title: `${anime.title} Episode ${num}`,
            description: `${anime.title} Episode ${num}`,
            videoUrl: "telegram",
            duration: 1440,
            createdAt: new Date().toISOString(),
            progress: null,
          }))
        : [];

  const totalEpisodesCount = Math.max(
    episodes?.length || 0,
    botAnime?.episode_count || 0,
    botAnime?.episodes?.length || 0,
    displayEpisodes.length
  );

  async function toggleNotify() {
    if (!user) { setAuthOpen(true); return; }
    setNotifyBusy(true);
    try {
      const method = notifySubscribed ? "DELETE" : "POST";
      const res = await fetch(`/api/notify/${anime.id}`, { method });
      if (res.ok) {
        setNotifySubscribed(!notifySubscribed);
        toast.success(notifySubscribed ? "Reminder cancelled" : "🔔 You will be notified when the anime is released!");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setNotifyBusy(false);
    }
  }

  // They can watch if they bought it via old system OR it's free.
  // But if it's a paid bot anime, they use the bot flow.
  const canWatchLocally = anime.owned || anime.isFree;

  function buy() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setShowCreditModal(true);
  }

  async function toggleFavorite() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setFavBusy(true);
    try {
      const res = await fetch(`/api/animes/${anime.slug}/favorite`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        queryClient.setQueryData<DetailResponse>(detailKey, (prev) => (
          prev
            ? { ...prev, anime: { ...prev.anime, favorited: d.favorited, favoriteCount: prev.anime.favoriteCount + (d.favorited ? 1 : -1) } }
            : prev
        ));
        toast.success(d.favorited ? "Added to favorites ♥" : "Removed from favorites");
      }
    } catch {
      toast.error("Failed");
    } finally {
      setFavBusy(false);
    }
  }

  function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: anime.title, text: `Watch ${anime.title} on Kiluu!`, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  }

  async function handleWatchTelegram(episodeNumber?: number) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!botStatus.linked) {
      setShowLinkModal(true);
      return;
    }

    setDelivering(true);
    try {
      const res = await fetch("/api/bot/deliver-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: anime.slug,
          episode_number: episodeNumber,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          episodeNumber
            ? `✅ Episode ${episodeNumber} was sent to your Telegram bot!`
            : "✅ The anime was sent to your Telegram bot!"
        );
      } else {
        toast.error(data.error || "Could not deliver the anime. Opening the bot — try /my_library.");
      }
      botStatus.refresh();

      // Open Telegram (native first, then web fallback)
      const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "DubAniXbot";
      window.location.href = `tg://resolve?domain=${botUsername}`;
      setTimeout(() => {
        if (!document.hidden) {
          window.open(`https://t.me/${botUsername}`, "_blank");
        }
      }, 1500);
    } catch {
      toast.error("Could not send the anime");
    } finally {
      setDelivering(false);
    }
  }

  async function handleBuyEpisode(episodeNumber: number, price: number) {
    if (!user) { setAuthOpen(true); return; }
    setEpisodeBuying(true);
    try {
      // Check credits
      if ((user.credits ?? 0) < price) {
        toast.error(`Not enough credits. You need ${price - (user.credits ?? 0)} more.`, {
          action: { label: "Get credits", onClick: () => setShowCreditModal(true) },
        });
        setEpisodeBuying(false);
        return;
      }
      const res = await fetch(`/api/animes/${anime.slug}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeNumber, episodePrice: price }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.alreadyOwned) {
          // Already bought — just deliver
          toast.info("You already own this episode. Sending it to Telegram...");
          setEpisodePurchaseModal(null);
          await handleWatchTelegram(episodeNumber);
          return;
        }
        toast.error(d.error || "Purchase failed");
        setEpisodeBuying(false);
        return;
      }
      // Update local credits
      if (typeof d.credits === "number") {
        updateUser({ credits: d.credits });
      }
      toast.success(`✅ Episode ${episodeNumber} purchased!`);
      setEpisodePurchaseModal(null);
      botStatus.refresh();
      // Deliver to Telegram
      await handleWatchTelegram(episodeNumber);
    } catch {
      toast.error("Purchase failed");
    } finally {
      setEpisodeBuying(false);
    }
  }

  return (
    <div className="pb-10">
      {/* Banner */}
      <div className="relative h-[46vh] min-h-[320px] overflow-hidden">
        <SmartImage src={anime.bannerImage || anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-background/15" />
      </div>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 -mt-28 relative">
          {/* Poster */}
          <div className="w-40 sm:w-52 shrink-0 mx-auto md:mx-0">
            <div className="aspect-[2/3] rounded-2xl overflow-hidden border-4 border-background shadow-2xl glow-hover">
              <SmartImage src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-2 md:pt-24 min-w-0 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap mb-2">
              {anime.isFree ? (
                <Badge className="bg-emerald-500/90 border-0 font-bold">FREE</Badge>
              ) : isPurchasedInBot || anime.owned ? (
                <Badge className="bg-primary/90 border-0 font-bold gap-1 text-primary-foreground"><BadgeCheck className="w-3 h-3" /> OWNED</Badge>
              ) : botAnime ? (
                <Badge className="bg-amber-500/90 border-0 font-bold gap-1">
                  {new Intl.NumberFormat("en-US").format(botAnime.price)} UZS
                </Badge>
              ) : (
                <Badge className="bg-amber-500/90 border-0 font-bold gap-1">
                  <Coins className="w-3 h-3" /> {formatCredits(anime.price)} credits
                </Badge>
              )}
              <Badge variant="secondary" className="font-semibold gap-1">
                {anime.type === "MOVIE" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                {anime.type}
              </Badge>
              {anime.status === "ONGOING" ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold gap-1.5 px-2.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  EFIRDA (ONGOING)
                </Badge>
              ) : anime.status === "UPCOMING" ? (
                <Badge className="bg-sky-500/15 text-sky-400 border border-sky-500/30 font-bold gap-1.5 px-2.5 py-0.5">
                  UPCOMING
                </Badge>
              ) : (
                <Badge variant="outline" className="font-semibold text-muted-foreground border-border/80 px-2.5 py-0.5">
                  COMPLETED
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-black leading-tight">{anime.title}</h1>
            {anime.altTitle && anime.altTitle !== anime.title && (
              <p className="text-sm text-muted-foreground mt-1">{anime.altTitle}</p>
            )}

            <div className="flex items-center gap-3 mt-3 text-sm flex-wrap justify-center md:justify-start">
              <span className="flex items-center gap-1 font-bold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {anime.catalogRating.toFixed(1)} <span className="text-xs text-muted-foreground">catalog</span>
              </span>
              <span className="text-muted-foreground">{anime.year}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> {totalEpisodesCount} {totalEpisodesCount === 1 ? "episode" : "episodes"}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> {anime.purchaseCount} collectors
              </span>
              {anime.studio && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{anime.studio}</span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
              {anime.genres.map((g) => (
                <button
                  key={g}
                  onClick={() => navigate("browse", { filters: { genre: g } })}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-secondary hover:bg-primary hover:text-white transition"
                >
                  {g}
                </button>
              ))}
            </div>

            {anilistEntry && (anilistEntry.airingAt * 1000 - now > 0) && (
              <div className="mt-6 p-5 rounded-3xl border-2 border-primary/20 bg-primary/5 flex items-center justify-between gap-4 flex-wrap max-w-md mx-auto md:mx-0 shadow-lg shadow-primary/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
                <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, 100 - ((anilistEntry.airingAt * 1000 - now) / (7 * 24 * 60 * 60 * 1000)) * 100))}%` }} />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-primary mb-1 flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5" /> Next episode</p>
                  <h3 className="text-2xl font-black">Episode {anilistEntry.episode}</h3>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-semibold mb-1">Qolgan vaqt</p>
                  <div className="font-display text-xl sm:text-2xl font-black tabular-nums text-foreground tracking-tight">
                    {formatDetailCountdown(anilistEntry.airingAt * 1000 - now)}
                  </div>
                </div>
              </div>
            )}

            {versions.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVersionId(v.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-bold border transition",
                      (selectedVersion?.id === v.id)
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {v.label} · {v.price} kr {v.owned ? "· owned" : ""}
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2.5 mt-5 flex-wrap justify-center md:justify-start">
              {botLoading ? (
                <Button size="lg" disabled className="h-12 px-7 rounded-full bg-secondary text-muted-foreground font-bold">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Tekshirilmoqda...
                </Button>
              ) : isUpcoming ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="lg" disabled className="h-12 px-7 rounded-full bg-secondary/80 text-muted-foreground font-bold cursor-not-allowed">
                    <Bell className="w-5 h-5 mr-2" /> Coming soon
                  </Button>
                  <Button
                    size="lg"
                    variant={notifySubscribed ? "default" : "outline"}
                    disabled={notifyBusy}
                    onClick={toggleNotify}
                    className={cn(
                      "h-12 px-5 rounded-full font-bold transition-all",
                      notifySubscribed
                        ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                        : "border-dashed hover:border-primary/60 hover:text-primary"
                    )}
                  >
                    {notifyBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : notifySubscribed ? (
                      <><BellOff className="w-4 h-4 mr-2" /> Cancel</>
                    ) : (
                      <><Bell className="w-4 h-4 mr-2" /> Remind me</>
                    )}
                  </Button>
                  {anime.releaseDate && (
                    <span className="text-xs text-muted-foreground bg-secondary/60 px-3 py-2 rounded-full font-medium">
                      📅 {new Date(anime.releaseDate).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  )}
                </div>
              ) : (isPurchasedInBot || anime.isFree || ownsSelected) ? (
                <div className="flex flex-col gap-2.5 w-full md:w-auto">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Button
                      size="lg"
                      onClick={() => handleWatchTelegram()}
                      disabled={delivering}
                      className="h-12 px-7 rounded-full brand-gradient hover:opacity-90 text-white font-bold shadow-xl shadow-primary/30"
                    >
                      {delivering ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-2 fill-current" />
                          Watch on Telegram
                        </>
                      )}
                    </Button>

                    {!botStatus.linked && (
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={() => setShowLinkModal(true)}
                        className="h-12 px-5 rounded-full font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10 shadow-sm"
                      >
                        <Send className="w-4 h-4 mr-2" /> Connect Telegram
                      </Button>
                    )}
                  </div>

                  {!botStatus.linked && (
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base shrink-0">⚠️</span>
                        <span className="text-muted-foreground leading-snug">
                          To receive anime from the bot, select <strong>“Connect Telegram”</strong> on the site.
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowLinkModal(true)}
                        className="h-8 px-4 rounded-xl text-xs font-bold brand-gradient text-white shrink-0"
                      >
                        Connect
                      </Button>
                    </div>
                  )}
                </div>
              ) : !botLoading && !isAvailableInBot && !selectedVersion ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    size="lg"
                    disabled
                    className="h-12 px-7 rounded-full bg-secondary/80 text-muted-foreground font-bold cursor-not-allowed"
                  >
                    <Bell className="w-5 h-5 mr-2" /> No episodes
                  </Button>
                  <Button
                    size="lg"
                    variant={notifySubscribed ? "default" : "outline"}
                    disabled={notifyBusy}
                    onClick={toggleNotify}
                    className={cn(
                      "h-12 px-5 rounded-full font-bold transition-all",
                      notifySubscribed
                        ? "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30"
                        : "border-dashed hover:border-primary/60 hover:text-primary"
                    )}
                  >
                    {notifyBusy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : notifySubscribed ? (
                      <><BellOff className="w-4 h-4 mr-2" /> Cancel</>
                    ) : (
                      <><Bell className="w-4 h-4 mr-2" /> Notify me</>
                    )}
                  </Button>
                </div>
              ) : (selectedVersion?.price ?? anime.price) > 0 ? (
                <Button
                  size="lg"
                  onClick={buy}
                  className="h-12 px-7 rounded-full brand-gradient hover:opacity-90 text-white font-bold shadow-xl shadow-primary/30"
                >
                  <Coins className="w-5 h-5 mr-2" />
                  Buy full anime — {(selectedVersion?.price ?? anime.price).toLocaleString()} credits
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const el = document.getElementById("episodes-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="h-12 px-6 rounded-full font-bold border-primary/40 text-primary hover:bg-primary/10 shadow-sm"
                >
                  <Tv className="w-5 h-5 mr-2" />
                  Choose episodes
                </Button>
              )}
              <Button
                size="lg"
                variant="secondary"
                onClick={toggleFavorite}
                disabled={favBusy}
                className={cn("h-12 px-5 rounded-full font-semibold", anime.favorited && "text-rose-500")}
                aria-label="Toggle favorite"
              >
                <Heart className={cn("w-5 h-5", anime.favorited && "fill-rose-500")} />
                <span className="hidden sm:inline">{anime.favorited ? "Favorited" : "Favorite"}</span>
              </Button>
              <Button
                size="lg"
                variant="secondary"
                onClick={share}
                className="h-12 px-5 rounded-full font-semibold"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5" />
              </Button>
              {canWatchLocally && episodes.length > 0 && (
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => navigate("watch-together")}
                  className="h-12 px-5 rounded-full font-semibold"
                  title="Start a watch party"
                >
                  <Users className="w-5 h-5" />
                  <span className="hidden sm:inline">Watch Together</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Description + creator */}
        <div className="mt-8 grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-8">
          <div className="min-w-0">
            <h2 className="text-lg font-bold mb-2.5">Synopsis</h2>
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed whitespace-pre-line">
              {anime.description}
            </p>

            {/* Episodes & Discussion Switcher */}
            <Separator className="my-7" />
            <div id="episodes-section" className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 p-1 bg-secondary/50 rounded-2xl border">
                <button
                  onClick={() => setActiveDetailTab("episodes")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all",
                    activeDetailTab === "episodes"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Tv className="w-4 h-4 text-primary" /> Epizodlar ({totalEpisodesCount})
                </button>
                <button
                  onClick={() => setActiveDetailTab("chat")}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all",
                    activeDetailTab === "chat"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MessageSquare className="w-4 h-4 text-primary" /> Muhokama (Chat)
                </button>
              </div>

              {activeDetailTab === "episodes" && (
                <span className="text-xs text-muted-foreground">{totalEpisodesCount} total</span>
              )}
            </div>

            {activeDetailTab === "chat" ? (
              <ChatPanel
                roomId={`anime:${anime.id}`}
                title={`${anime.title} muhokamasi`}
                subtitle="Ushbu anime bo'yicha fikr almashish xonasi"
              />
            ) : (
              displayEpisodes.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                  <Clapperboard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">No episodes have been added yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayEpisodes.map((ep) => {
                    const isTelegramOnly = !ep.videoUrl || ep.videoUrl === "telegram";
                    // Determine if user owns this specific episode
                    const ownedViaFullPurchase = canWatchLocally || isPurchasedInBot;
                    const ownedThisEp = ownedViaFullPurchase || myEpisodePurchases[String(ep.number)];
                    const epPrice = botAnime?.episode_prices?.[String(ep.number)] ?? botAnime?.price ?? 0;
                    const locked = !ownedThisEp;
                    const pct = ep.progress && ep.progress.duration > 0
                      ? Math.min(100, (ep.progress.position / ep.progress.duration) * 100)
                      : 0;
                    return (
                      <button
                        key={ep.id}
                        onClick={() => {
                          if (locked) {
                            // Show per-episode purchase modal
                            setEpisodePurchaseModal({
                              number: ep.number,
                              title: ep.title,
                              price: epPrice,
                            });
                            return;
                          }
                          // Playback is Telegram-only on the site; Watch Together is
                          // the sole in-browser player.
                          handleWatchTelegram(ep.number);
                        }}
                        className="w-full flex items-center gap-3.5 p-2.5 rounded-2xl border bg-card hover:border-primary/50 hover:bg-accent/50 transition group text-left"
                        aria-label={`Play episode ${ep.number}: ${ep.title}`}
                      >
                        <div className="relative w-28 sm:w-40 aspect-video shrink-0 rounded-xl overflow-hidden bg-muted">
                          <SmartImage src={anime.coverImage} alt={`Episode ${ep.number}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25 transition flex items-center justify-center">
                            {locked ? (
                              <span className="bg-black/60 rounded-full p-2"><Lock size={16} className="text-white" /></span>
                            ) : (
                              <span className="bg-white/90 rounded-full p-2 opacity-0 group-hover:opacity-100 transition scale-75 group-hover:scale-100">
                                <Play className="w-4 h-4 fill-black text-black" />
                              </span>
                            )}
                          </div>
                          {pct > 0 && (
                            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
                              <div className="h-full brand-gradient" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-primary">EP {String(ep.number).padStart(2, "0")}</span>
                            {ep.progress?.completed && (
                              <Badge className="h-4.5 text-[9px] px-1.5 bg-emerald-500/15 text-emerald-500 border-emerald-500/30">WATCHED</Badge>
                            )}
                            {isTelegramOnly && (
                              <Badge variant="outline" className="h-4.5 text-[9px] px-1.5 border-primary/30 text-primary">TELEGRAM</Badge>
                            )}
                            {locked && epPrice > 0 && (
                              <Badge className="h-4.5 text-[9px] px-1.5 bg-amber-500/15 text-amber-600 border-amber-500/30 gap-0.5">
                                <Coins className="w-2.5 h-2.5" />{epPrice}
                              </Badge>
                            )}
                            {!locked && (
                              <Badge className="h-4.5 text-[9px] px-1.5 bg-emerald-500/15 text-emerald-600 border-emerald-500/30">OWNED</Badge>
                            )}
                          </div>
                          <p className="font-semibold text-sm truncate mt-0.5">{ep.title}</p>
                          {ep.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 hidden sm:block">{ep.description}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                            <Clock3 className="w-3 h-3" /> {Math.max(1, Math.round((ep.duration || 1440) / 60))} min
                            {locked && epPrice > 0 && (
                              <span className="ml-2 text-primary font-semibold">• Buy: {epPrice} 💰</span>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Sidebar: creator + stats */}
          <aside className="space-y-5">
            {anime.creator && (
              <div className="glass rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Published by</p>
                <button
                  className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-accent transition"
                  onClick={() => navigate("user-profile", { username: anime.creator!.username })}
                >
                  <FramedAvatar user={anime.creator} size={44} ring />
                  <div className="text-left min-w-0">
                    <p className="font-bold text-sm truncate flex items-center gap-1.5">
                      {anime.creator.displayName}
                      {anime.creator.isVerified && (
                        <span title="Verified Creator"><BadgeCheck className="w-3.5 h-3.5 text-primary" /></span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">@{anime.creator.username}</p>
                  </div>
                </button>
              </div>
            )}

            <div className="glass rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Anime Stats</p>
              {[
                { icon: <Star className="w-4 h-4 text-amber-400" />, label: `Community rating (${anime.ratingCount})`, value: anime.communityRating === null ? "No ratings yet" : anime.communityRating.toFixed(1) },
                { icon: <Star className="w-4 h-4 text-muted-foreground" />, label: "Catalog rating", value: anime.catalogRating.toFixed(1) },
                { icon: <Users className="w-4 h-4 text-primary" />, label: "Collectors", value: formatCredits(anime.collectorCount) },
                { icon: <Heart className="w-4 h-4 text-rose-400" />, label: "Favorites", value: formatCredits(anime.favoriteCount) },
                {
                  icon: <Sparkles className="w-4 h-4 text-primary" />,
                  label: "Status",
                  value: anime.status === "ONGOING" ? "Ongoing" : anime.status === "UPCOMING" ? "Upcoming" : "Completed",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">{row.icon}{row.label}</span>
                  <span className="font-bold">{row.value}</span>
                </div>
              ))}
              <div className="border-t pt-3">
                <p className="text-xs font-semibold mb-2">{anime.myRating ? `Your rating: ${anime.myRating}/10` : "Rate this anime"}</p>
                <div className="grid grid-cols-10 gap-1">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      disabled={ratingBusy}
                      onClick={() => void rateAnime(rating)}
                      aria-label={`Rate ${rating} out of 10`}
                      aria-pressed={anime.myRating === rating}
                      className={cn(
                        "h-7 rounded-md border text-[10px] font-bold transition-colors disabled:opacity-50",
                        anime.myRating === rating ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary hover:text-primary"
                      )}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {related.length > 0 && (
              <div className="glass rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">More like this</p>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {related.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => navigate("detail", { animeId: r.slug })}
                      className="w-24 shrink-0 group text-left"
                    >
                      <div className="aspect-[2/3] rounded-lg overflow-hidden">
                        <SmartImage src={r.coverImage} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      </div>
                      <p className="text-[10px] font-semibold mt-1.5 line-clamp-2 group-hover:text-primary transition">{r.title}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>

        {/* Related row */}
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold mb-4">You may also like</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
              {related.map((r) => (
                <AnimeCard
                  key={r.id}
                  anime={{
                    ...r,
                    genres: typeof r.genres === "string"
                      ? String(r.genres).split(",").filter(Boolean)
                      : (r.genres as unknown as string[]) || [],
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Credit Purchase Modal */}
      {showCreditModal && (
        <CreditPurchaseModal
          animeSlug={anime.slug}
          animeTitle={anime.title}
          price={selectedVersion?.price ?? anime.price}
          versionId={selectedVersion?.id}
          userCredits={user?.credits ?? 0}
          botLinked={botStatus?.linked ?? null}
          onClose={() => setShowCreditModal(false)}
          onSuccess={() => {
            setShowCreditModal(false);
            setJustPurchased(true);
            updateUser({ credits: (user?.credits ?? 0) - (selectedVersion?.price ?? anime.price) });
            botStatus.refresh();
            toast.success("Purchase successful!");
          }}
        />
      )}

      {/* Standalone Telegram Link Modal */}
      <LinkTelegramModal
        open={showLinkModal}
        animeTitle={anime.title}
        onClose={() => setShowLinkModal(false)}
        onLinked={() => {
          botStatus.refresh();
          toast.success("✅ Telegram connected! Sending the anime to your bot...");
        }}
      />

      {/* Episode Purchase Modal */}
      {episodePurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Tv className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Buy episode</p>
                <h3 className="font-bold text-base leading-tight">Episode {episodePurchaseModal.number}</h3>
              </div>
            </div>

            {/* Episode info */}
            <div className="bg-secondary/50 rounded-2xl p-4 mb-5 space-y-2">
              <p className="text-sm font-semibold truncate">{episodePurchaseModal.title}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Price</span>
                <span className="font-black text-lg text-primary flex items-center gap-1">
                  <Coins className="w-4 h-4" /> {episodePurchaseModal.price} credits
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Sizda</span>
                <span className={`font-bold ${(user?.credits ?? 0) >= episodePurchaseModal.price ? "text-emerald-500" : "text-rose-500"}`}>
                  {user?.credits ?? 0} credits
                </span>
              </div>
              {(user?.credits ?? 0) < episodePurchaseModal.price && (
                <p className="text-xs text-rose-500 font-medium pt-1">
                  ⚠️ Not enough credits. You need {episodePurchaseModal.price - (user?.credits ?? 0)} more.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-2xl h-11"
                onClick={() => setEpisodePurchaseModal(null)}
                disabled={episodeBuying}
              >
                Cancel
              </Button>
              {(user?.credits ?? 0) < episodePurchaseModal.price ? (
                <Button
                  className="flex-1 rounded-2xl h-11 brand-gradient text-white font-bold"
                  onClick={() => { setEpisodePurchaseModal(null); setShowCreditModal(true); }}
                >
                  <Coins className="w-4 h-4 mr-1.5" /> Get credits
                </Button>
              ) : (
                <Button
                  className="flex-1 rounded-2xl h-11 brand-gradient text-white font-bold"
                  onClick={() => handleBuyEpisode(episodePurchaseModal.number, episodePurchaseModal.price)}
                  disabled={episodeBuying}
                >
                  {episodeBuying ? (
                    <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Purchasing...</>
                  ) : (
                    <><ShoppingCart className="w-4 h-4 mr-1.5" /> Buy</>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
