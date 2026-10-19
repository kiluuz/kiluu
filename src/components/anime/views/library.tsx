"use client";

import { useEffect, useRef, useState } from "react";
import {
  Clock, Heart, Sparkles, Film, Trophy, Timer, Package,
  Send, Link2, CheckCircle2, Loader2, ExternalLink, ShoppingBag, AlertCircle, Star
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAppStore } from "../store";
import type { AnimeSummary } from "../types";
import { AnimeCard, formatDuration, formatCredits } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LibraryData {
  owned: (AnimeSummary & { purchasedAt: string; episodeCount: number })[];
  favorites: (AnimeSummary & { episodeCount: number })[];
  starsPurchases: (AnimeSummary & { purchasedAt: string; episodeCount: number })[];
  stats: {
    purchaseCount: number;
    totalWatchSeconds: number;
    completedEpisodes: number;
    exchangeUnlocked: boolean;
    credits: number;
  };
}

interface LeaderboardEntry {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  score: number;
  level: number;
  postCount?: number;
  likeCount?: number;
}

interface Leaderboards {
  collectors: LeaderboardEntry[];
  contributors: LeaderboardEntry[];
  creators: LeaderboardEntry[];
}

export function LibraryView() {
  const { user, setAuthOpen, navigate } = useAppStore();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [botStatus, setBotStatus] = useState<{ linked: boolean; purchases: string[] } | null>(null);
  const [botAnimes, setBotAnimes] = useState<any[]>([]);
  const [botLoading, setBotLoading] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/library")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load library"))
      .finally(() => setLoading(false));

    // Load bot status
    setBotLoading(true);
    fetch("/api/bot/status")
      .then(r => r.json())
      .then(async (statusData) => {
        setBotStatus(statusData);
        if (statusData.purchases?.length > 0) {
          const catalogRes = await fetch("/api/bot/catalog");
          const catalog = await catalogRes.json();
          const purchased = Array.isArray(catalog)
            ? catalog.filter((a: any) => statusData.purchases.includes(a.slug))
            : [];
          setBotAnimes(purchased);
        }
      })
      .catch(() => {})
      .finally(() => setBotLoading(false));
  }, [user]);

  useEffect(() => {
    fetch("/api/leaderboards")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load leaderboards");
        setLeaderboards(result);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load leaderboards"));
  }, []);

  async function startLinking() {
    setLinkLoading(true);
    try {
      const res = await fetch("/api/bot/link-token", { method: "POST" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLinkUrl(data.link);
      try {
        const parsed = new URL(data.link);
        const domain = parsed.pathname.replace(/^\//, "");
        const start = parsed.searchParams.get("start");
        if (domain && start) {
          window.location.href = `tg://resolve?domain=${encodeURIComponent(domain)}&start=${encodeURIComponent(start)}`;
          setTimeout(() => {
            if (!document.hidden) window.open(data.link, "_blank");
          }, 1500);
        } else {
          window.open(data.link, "_blank");
        }
      } catch {
        window.open(data.link, "_blank");
      }
      startPolling();
    } catch {
      toast.error("Could not get the Telegram link.");
    } finally {
      setLinkLoading(false);
    }
  }

  function startPolling() {
    setPolling(true);
    const start = Date.now();
    pollRef.current = setInterval(async () => {
      if (Date.now() - start > 120000) { setPolling(false); clearInterval(pollRef.current!); return; }
      try {
        const res = await fetch("/api/bot/status");
        const d = await res.json();
        if (d.linked) {
          setPolling(false);
          clearInterval(pollRef.current!);
          setBotStatus(d);
          fetch("/api/bot/deliver-purchases", { method: "POST" })
            .then(r => r.json())
            .then(res => {
              if (res.delivered > 0) {
                toast.success(`✅ ${res.delivered} anime sent to your Telegram bot!`);
              }
            })
            .catch(() => {});
          toast.success("Telegram connected! ✅");
        }
      } catch {}
    }, 2500);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (!user) {
    return (
      <div className="text-center py-32 px-4">
        <p className="text-6xl mb-4">📚</p>
        <h1 className="text-2xl font-black mb-2">Your library lives here</h1>
        <p className="text-muted-foreground text-sm mb-6">Sign in to see your animes, favorites and watch stats</p>
        <Button className="rounded-full brand-gradient text-white font-bold h-11 px-6" onClick={() => setAuthOpen(true)}>
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-3 mb-1">
        <span className="w-10 h-10 rounded-xl brand-gradient flex items-center justify-center">
          <Clock className="w-5 h-5 text-white" />
        </span>
        My Library
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Your collection, favorites and everything you&apos;re watching
      </p>

      {/* Stats cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="glass rounded-2xl p-4 sm:p-5">
            <Package className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-black tabular-nums">{data.stats.purchaseCount}</p>
            <p className="text-xs text-muted-foreground">Animes owned</p>
          </div>
          <div className="glass rounded-2xl p-4 sm:p-5">
            <Timer className="w-5 h-5 text-cyan-400 mb-2" />
            <p className="text-2xl font-black tabular-nums">{formatDuration(data.stats.totalWatchSeconds)}</p>
            <p className="text-xs text-muted-foreground">Watch time</p>
          </div>
          <div className="glass rounded-2xl p-4 sm:p-5">
            <Trophy className="w-5 h-5 text-amber-400 mb-2" />
            <p className="text-2xl font-black tabular-nums">{data.stats.completedEpisodes}</p>
            <p className="text-xs text-muted-foreground">Episodes completed</p>
          </div>
          <div className="glass rounded-2xl p-4 sm:p-5">
            <Sparkles className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-black tabular-nums">{formatCredits(data.stats.credits)}</p>
            <p className="text-xs text-muted-foreground">Credit balance</p>
          </div>
        </div>
      )}

      <div className="glass rounded-2xl p-4 sm:p-5 mb-8">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-muted-foreground">
            You can gift an anime from your library to a friend. Credits are charged even if you already own it.
          </p>
          <Button size="sm" className="rounded-full brand-gradient text-white font-bold" onClick={() => navigate("gifts")}>
            Gifts
          </Button>
        </div>
      </div>

      <Tabs defaultValue="owned">
        <TabsList className="rounded-xl mb-5 flex-wrap h-auto gap-1">
          <TabsTrigger value="owned" className="rounded-lg">
            Owned ({data?.owned.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="favorites" className="rounded-lg">
            <Heart className="w-3.5 h-3.5 mr-1" /> Favorites ({data?.favorites.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="telegram" className="rounded-lg gap-1.5">
            <Star className="w-3.5 h-3.5" /> Stars purchases
          </TabsTrigger>
          <TabsTrigger value="leaderboards" className="rounded-lg gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Leaderboards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owned">
          {loading ? (
            <SkeletonGrid />
          ) : data && data.owned.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5">
              {data.owned.map((a) => (
                <div key={a.id} className="flex justify-center fade-in-up">
                  <AnimeCard anime={a} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              emoji="🛒"
              title="No animes yet"
              desc="Browse the catalog and grab your first anime — lots of free ones available!"
              action={() => navigate("browse")}
              actionLabel="Discover animes"
            />
          )}
        </TabsContent>

        <TabsContent value="favorites">
          {loading ? (
            <SkeletonGrid />
          ) : data && data.favorites.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5">
              {data.favorites.map((a) => (
                <div key={a.id} className="flex justify-center fade-in-up">
                  <AnimeCard anime={a} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              emoji="💜"
              title="No favorites yet"
              desc="Tap the heart on any anime to pin it here"
              action={() => navigate("browse")}
              actionLabel="Find something to love"
            />
          )}
        </TabsContent>

        {/* Telegram Bot Purchases Tab */}
        <TabsContent value="telegram">
          <div className="space-y-6">
            {data?.starsPurchases.length ? (
              <section>
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Site Stars purchases</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {data.starsPurchases.map((anime) => (
                    <div key={`${anime.id}-${anime.purchasedAt}`} className="flex justify-center">
                      <AnimeCard anime={anime} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
            {/* Telegram Status Card */}
            <div className={cn(
              "glass rounded-2xl p-5 border flex flex-col sm:flex-row sm:items-center gap-4",
              botStatus?.linked ? "border-emerald-500/30 bg-emerald-500/5" : "border-border"
            )}>
              {botStatus?.linked ? (
                <>
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold">✅ Telegram connected</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Purchased anime is sent automatically.</p>
                  </div>
                  <a href={`https://t.me/${process.env.NEXT_PUBLIC_BOT_USERNAME || "DubAniXbot"}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" className="rounded-xl gap-2">
                      <ExternalLink className="w-4 h-4" /> Open bot
                    </Button>
                  </a>
                </>
              ) : polling ? (
                <>
                  <Loader2 className="w-8 h-8 text-primary animate-spin shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold">Waiting for Telegram connection...</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Open the bot and tap /start.</p>
                  </div>
                  {linkUrl && (
                    <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="rounded-xl gap-1.5">
                        <ExternalLink className="w-3.5 h-3.5" /> Open bot
                      </Button>
                    </a>
                  )}
                </>
              ) : (
                <>
                  <Link2 className="w-8 h-8 text-muted-foreground/50 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold">Telegram not connected</p>
                    <p className="text-sm text-muted-foreground mt-0.5">Connect your Telegram account to receive anime.</p>
                  </div>
                  <Button onClick={startLinking} disabled={linkLoading} className="rounded-xl brand-gradient text-white gap-2 shrink-0">
                    {linkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Connect
                  </Button>
                </>
              )}
            </div>

            {/* Purchases List */}
            <div>
              <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Purchased anime</h3>
              {botLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden">
                      <div className="aspect-[2/3] skeleton rounded-2xl" />
                      <div className="p-2 space-y-1.5"><div className="h-3 skeleton rounded" /><div className="h-3 w-2/3 skeleton rounded" /></div>
                    </div>
                  ))}
                </div>
              ) : botAnimes.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-12 text-center">
                  <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-bold">No purchases yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Visit the anime catalog to make your first purchase.</p>
                  <Button onClick={() => navigate("browse")} className="rounded-xl brand-gradient text-white gap-2">
                    <ShoppingBag className="w-4 h-4" /> Browse anime
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {botAnimes.map((anime: any) => (
                      <button
                        key={anime.slug}
                        onClick={() => navigate("detail", { animeId: anime.slug })}
                        className="text-left rounded-2xl overflow-hidden border hover:border-primary/40 bg-secondary/20 hover:bg-secondary/40 transition-all group"
                      >
                        <div className="aspect-[2/3] overflow-hidden">
                          <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                        </div>
                        <div className="p-2">
                          <p className="text-xs font-bold line-clamp-2">{anime.title}</p>
                          <p className="text-[10px] text-primary mt-0.5 flex items-center gap-1">
                            <Star className="w-2.5 h-2.5 fill-current" /> Purchased with Stars
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 p-4 rounded-xl bg-secondary/30 border text-sm text-muted-foreground">
                    <p className="font-semibold mb-1">📦 Need to receive your anime again?</p>
                    <p>Send <code className="bg-secondary/80 px-1.5 py-0.5 rounded text-xs">/library</code> in the Telegram bot to receive your purchased anime again.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="leaderboards">
          <div className="grid gap-4 lg:grid-cols-3">
            <LeaderboardCard title="Top Collectors" entries={leaderboards?.collectors ?? []} loading={!leaderboards} scoreLabel="anime" />
            <LeaderboardCard title="Top Contributors" entries={leaderboards?.contributors ?? []} loading={!leaderboards} scoreLabel="points" />
            <LeaderboardCard title="Top Creators" entries={leaderboards?.creators ?? []} loading={!leaderboards} scoreLabel="anime" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeaderboardCard({
  title,
  entries,
  loading,
  scoreLabel,
}: {
  title: string;
  entries: LeaderboardEntry[];
  loading: boolean;
  scoreLabel: string;
}) {
  return (
    <section className="glass rounded-2xl p-4">
      <h2 className="font-black mb-4">{title}</h2>
      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : entries.length ? (
        <ol className="space-y-3">
          {entries.map((entry, index) => (
            <li key={entry.id} className="flex items-center gap-3">
              <span className="w-5 text-xs font-black text-muted-foreground">{index + 1}</span>
              <img
                src={entry.avatarUrl || "/placeholder.svg"}
                alt=""
                className="w-8 h-8 rounded-full object-cover bg-muted"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {entry.displayName || entry.username} <span className="text-[10px] text-muted-foreground">Lv.{entry.level}</span>
              </span>
              <span className="text-xs font-bold text-primary">
                {entry.postCount !== undefined
                  ? `${entry.postCount} posts · ${entry.likeCount ?? 0} likes`
                  : `${entry.score} ${scoreLabel}`}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">No qualifying activity yet.</p>
      )}
    </section>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="w-[150px] sm:w-[168px] aspect-[2/3] rounded-xl skeleton mx-auto" />
      ))}
    </div>
  );
}

function EmptyState({ emoji, title, desc, action, actionLabel }: {
  emoji: string; title: string; desc: string; action: () => void; actionLabel: string;
}) {
  return (
    <div className="text-center py-20 rounded-3xl border border-dashed">
      <p className="text-5xl mb-3">{emoji}</p>
      <p className="font-bold text-lg">{title}</p>
      <p className="text-sm text-muted-foreground mt-1 mb-5">{desc}</p>
      <Button className="rounded-full brand-gradient text-white font-bold" onClick={action}>
        {actionLabel}
      </Button>
    </div>
  );
}
