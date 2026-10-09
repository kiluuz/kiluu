"use client";

import { useEffect, useState } from "react";
import {
  Play, Star, Plus, Check, Coins, Heart, Share2, Users, Video,
  Clock3, Loader2, BadgeCheck, Tv, Film, Package, Sparkles, Clapperboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "../store";
import type { AnimeDetail, EpisodeItem, AnimeSummary } from "../types";
import { AnimeCard, Avatar, SmartImage, formatCredits } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DetailResponse {
  anime: AnimeDetail;
  episodes: EpisodeItem[];
  related: AnimeSummary[];
}

export function DetailView() {
  const { view, user, setAuthOpen, navigate, updateUser } = useAppStore();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [favBusy, setFavBusy] = useState(false);

  const animeId = view.animeId!;

  const load = async () => {
    try {
      const res = await fetch(`/api/animes/${animeId}`);
      if (!res.ok) throw new Error();
      const d: DetailResponse = await res.json();
      setData(d);
    } catch {
      toast.error("Failed to load anime");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setData(null);
    load();
     
  }, [animeId, user?.id]);

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
  const canWatch = anime.owned || anime.isFree;
  const firstUnwatched = episodes.find((e) => !e.progress?.completed) || episodes[0];

  async function buy() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (user.credits < anime.price) {
      toast.error(`Not enough credits — you need ${anime.price - user.credits} more`, {
        description: "Top up your balance in Get Credits",
        action: { label: "Get Credits", onClick: () => navigate("credits") },
      });
      return;
    }
    setBuying(true);
    try {
      const res = await fetch(`/api/animes/${anime.slug}/purchase`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Purchase failed");
        return;
      }
      updateUser({ credits: d.credits });
      toast.success(`"${anime.title}" added to your library! 🎉`, {
        description: d.unlockedExchange ? "Exchange Marketplace unlocked!" : undefined,
      });
      load();
    } catch {
      toast.error("Network error");
    } finally {
      setBuying(false);
    }
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
        setData((prev) => (prev ? { ...prev, anime: { ...prev.anime, favorited: d.favorited, favoriteCount: prev.anime.favoriteCount + (d.favorited ? 1 : -1) } } : prev));
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
      navigator.share({ title: anime.title, text: `Watch ${anime.title} on DubAniX!`, url }).catch(() => {});
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  }

  function startWatching(episodeId?: string) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!canWatch) {
      toast.error("Purchase this anime first to watch it", {
        action: { label: "Buy", onClick: buy },
      });
      return;
    }
    navigate("watch", { animeId: anime.slug, episodeId: episodeId || firstUnwatched?.id });
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
              ) : canWatch ? (
                <Badge className="bg-primary/90 border-0 font-bold gap-1 text-primary-foreground"><BadgeCheck className="w-3 h-3" /> OWNED</Badge>
              ) : (
                <Badge className="bg-amber-500/90 border-0 font-bold gap-1">
                  <Coins className="w-3 h-3" /> {formatCredits(anime.price)} credits
                </Badge>
              )}
              <Badge variant="secondary" className="font-semibold gap-1">
                {anime.type === "MOVIE" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
                {anime.type}
              </Badge>
              <Badge variant="outline" className="font-semibold">{anime.status}</Badge>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black leading-tight">{anime.title}</h1>
            {anime.altTitle && anime.altTitle !== anime.title && (
              <p className="text-sm text-muted-foreground mt-1">{anime.altTitle}</p>
            )}

            <div className="flex items-center gap-3 mt-3 text-sm flex-wrap justify-center md:justify-start">
              <span className="flex items-center gap-1 font-bold">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> {anime.rating.toFixed(1)}
              </span>
              <span className="text-muted-foreground">{anime.year}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> {episodes.length} episodes
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

            {/* Actions */}
            <div className="flex items-center gap-2.5 mt-5 flex-wrap justify-center md:justify-start">
              {canWatch ? (
                <Button
                  size="lg"
                  onClick={() => startWatching()}
                  className="h-12 px-7 rounded-full brand-gradient hover:opacity-90 text-white font-bold shadow-xl shadow-primary/30"
                >
                  <Play className="w-5 h-5 fill-white" />
                  {data.anime && firstUnwatched?.progress ? "Resume" : "Watch Now"}
                </Button>
              ) : (
                <Button
                  size="lg"
                  disabled={buying}
                  onClick={buy}
                  className="h-12 px-7 rounded-full brand-gradient hover:opacity-90 text-white font-bold shadow-xl shadow-primary/30"
                >
                  {buying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Coins className="w-5 h-5" />}
                  Buy for {formatCredits(anime.price)} credits
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
              {canWatch && episodes.length > 0 && (
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
        <div className="mt-8 grid lg:grid-cols-[1fr_300px] gap-8">
          <div>
            <h2 className="text-lg font-bold mb-2.5">Synopsis</h2>
            <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed whitespace-pre-line">
              {anime.description}
            </p>

            {/* Episodes */}
            <Separator className="my-7" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Tv className="w-5 h-5 text-primary" /> Episodes
              </h2>
              <span className="text-xs text-muted-foreground">{episodes.length} total</span>
            </div>

            {episodes.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
                <Clapperboard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No episodes yet — coming soon!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {episodes.map((ep) => {
                  const locked = !canWatch;
                  const pct = ep.progress && ep.progress.duration > 0
                    ? Math.min(100, (ep.progress.position / ep.progress.duration) * 100)
                    : 0;
                  return (
                    <button
                      key={ep.id}
                      onClick={() => startWatching(ep.id)}
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-primary">EP {String(ep.number).padStart(2, "0")}</span>
                          {ep.progress?.completed && (
                            <Badge className="h-4.5 text-[9px] px-1.5 bg-emerald-500/15 text-emerald-500 border-emerald-500/30">WATCHED</Badge>
                          )}
                        </div>
                        <p className="font-semibold text-sm truncate mt-0.5">{ep.title}</p>
                        {ep.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 hidden sm:block">{ep.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <Clock3 className="w-3 h-3" /> {Math.max(1, Math.round((ep.duration || 600) / 60))} min
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
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
                  <Avatar src={anime.creator.avatarUrl} name={anime.creator.displayName} accent={anime.creator.accentColor} size={44} ring />
                  <div className="text-left min-w-0">
                    <p className="font-bold text-sm truncate flex items-center gap-1.5">
                      {anime.creator.displayName}
                      {anime.creator.role === "CREATOR" && (
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
                { icon: <Star className="w-4 h-4 text-amber-400" />, label: "Rating", value: anime.rating.toFixed(1) },
                { icon: <Users className="w-4 h-4 text-primary" />, label: "Collectors", value: formatCredits(anime.purchaseCount) },
                { icon: <Heart className="w-4 h-4 text-rose-400" />, label: "Favorites", value: formatCredits(anime.favoriteCount) },
                { icon: <Sparkles className="w-4 h-4 text-primary" />, label: "Status", value: anime.status },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">{row.icon}{row.label}</span>
                  <span className="font-bold">{row.value}</span>
                </div>
              ))}
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
    </div>
  );
}

function Lock({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
