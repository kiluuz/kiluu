"use client";

import { useEffect, useState } from "react";
import { Clock, Heart, Repeat, Sparkles, Film, Trophy, Timer, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "../store";
import type { AnimeSummary } from "../types";
import { AnimeCard, formatDuration, formatCredits } from "../ui-bits";
import { toast } from "sonner";

interface LibraryData {
  owned: (AnimeSummary & { purchasedAt: string; episodeCount: number })[];
  favorites: (AnimeSummary & { episodeCount: number })[];
  stats: {
    purchaseCount: number;
    totalWatchSeconds: number;
    completedEpisodes: number;
    exchangeUnlocked: boolean;
    credits: number;
  };
}

export function LibraryView() {
  const { user, setAuthOpen, navigate } = useAppStore();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetch("/api/library")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load library"))
      .finally(() => setLoading(false));
  }, [user]);

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

  const exchangeProgress = data ? Math.min(100, (data.stats.purchaseCount / 20) * 100) : 0;

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

      {/* Exchange unlock progress */}
      {data && !data.stats.exchangeUnlocked && (
        <div className="glass rounded-2xl p-4 sm:p-5 mb-8 aurora relative overflow-hidden">
          <div className="relative flex items-center gap-4 flex-wrap sm:flex-nowrap">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Repeat className="w-6 h-6 text-amber-500" />
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-bold text-sm">Exchange Marketplace</p>
                <p className="text-xs font-bold text-amber-500 tabular-nums">
                  {data.stats.purchaseCount} / 20 animes
                </p>
              </div>
              <Progress value={exchangeProgress} className="h-2.5 [&>div]:brand-gradient" />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Buy {20 - data.stats.purchaseCount} more animes to unlock trading with other collectors
              </p>
            </div>
            <Button
              size="sm"
              className="rounded-full brand-gradient text-white font-bold shrink-0"
              onClick={() => navigate("browse")}
            >
              <Film className="w-4 h-4" /> Browse animes
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="owned">
        <TabsList className="rounded-xl mb-5">
          <TabsTrigger value="owned" className="rounded-lg">
            Owned ({data?.owned.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="favorites" className="rounded-lg">
            <Heart className="w-3.5 h-3.5 mr-1" /> Favorites ({data?.favorites.length ?? 0})
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
      </Tabs>
    </div>
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
