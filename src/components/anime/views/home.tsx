"use client";

import { useEffect, useState } from "react";
import { Play, Plus, Star, Flame, Trophy, Sparkles, Clock3, Gift, Shuffle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "../store";
import type { AnimeSummary, HomeData } from "../types";
import { AnimeCard, ContinueCard, SectionHeader, ScrollRow, SmartImage, RankedCard, WideCard, formatCredits } from "../ui-bits";
import { toast } from "sonner";

export function HomeView() {
  const { navigate, user, setAuthOpen } = useAppStore();
  const [data, setData] = useState<HomeData | null>(null);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/home")
      .then((r) => r.json())
      .then((d) => {
        if (alive && d) setData(d);
      })
      .catch(() => toast.error("Failed to load home data"));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Hero auto-rotate
  useEffect(() => {
    if (!data?.featured?.length) return;
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % data.featured.length), 7000);
    return () => clearInterval(t);
  }, [data?.featured?.length]);

  if (!data) {
    return <HomeSkeleton />;
  }

  const hero: AnimeSummary | undefined = data.featured[heroIdx];

  function handleWatch(a: AnimeSummary) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (a.isFree || a.owned) {
      navigate("detail", { animeId: a.slug });
    } else {
      navigate("detail", { animeId: a.slug });
    }
  }

  async function surpriseMe() {
    try {
      const res = await fetch("/api/animes");
      const d = await res.json();
      const all = d.animes || [];
      if (all.length) {
        const pick = all[Math.floor(Math.random() * all.length)];
        navigate("detail", { animeId: pick.slug });
      }
    } catch {
      toast.error("Could not pick an anime");
    }
  }

  return (
    <div className="pb-8">
      {/* ===== HERO ===== */}
      {hero && (
        <section className="relative h-[64vh] min-h-[420px] max-h-[600px] w-full overflow-hidden" aria-label="Featured anime">
          <div className="absolute inset-0">
            {data.featured.map((a, i) => {
              const src = a.bannerImage || a.coverImage;
              const valid = typeof src === "string" && /^https?:\/\/|^\//.test(src);
              return (
                <div key={a.id} className={`absolute inset-0 transition-opacity duration-1000 ${i === heroIdx ? "opacity-100" : "opacity-0"}`}>
                  {valid ? (
                    <img src={src} alt={a.title} className="w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <SmartImage src={null} alt={a.title} className="w-full h-full" />
                  )}
                </div>
              );
            })}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-transparent" />
          </div>

          <div className="relative h-full max-w-[1280px] mx-auto px-4 sm:px-8 flex flex-col justify-end pb-10 sm:pb-14 pt-24">
            <div key={hero.id} className="fade-in-up max-w-2xl">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <Badge className="brand-gradient text-white border-0 gap-1 font-bold">
                  <Sparkles className="w-3 h-3" /> #{heroIdx + 1} Featured
                </Badge>
                {hero.isFree ? (
                  <Badge className="bg-emerald-500/90 border-0 font-bold">FREE</Badge>
                ) : (
                  <Badge className="bg-amber-500/90 border-0 font-bold gap-1">
                    <Star className="w-3 h-3 fill-white" /> {formatCredits(hero.price)} credits
                  </Badge>
                )}
                <Badge variant="secondary" className="font-semibold">{hero.type}</Badge>
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-[1.05] mb-3 drop-shadow-lg">
                {hero.title}
              </h1>
              <div className="flex items-center gap-3 text-sm mb-4 flex-wrap">
                <span className="flex items-center gap-1 font-bold">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  {hero.rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">{hero.year}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{hero.genres.slice(0, 3).join(" · ")}</span>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground line-clamp-2 sm:line-clamp-3 max-w-xl mb-6">
                {hero.description}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  size="lg"
                  onClick={() => handleWatch(hero)}
                  className="h-12 px-7 rounded-full brand-gradient hover:opacity-90 text-white font-bold text-base shadow-xl shadow-primary/30"
                >
                  <Play className="w-5 h-5 fill-white" />
                  {hero.owned || hero.isFree ? "Watch Now" : "View Details"}
                </Button>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => navigate("detail", { animeId: hero.slug })}
                  className="h-12 px-6 rounded-full glass font-semibold"
                >
                  <Info className="w-4 h-4" />
                  More Info
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={surpriseMe}
                  className="h-12 px-5 rounded-full hidden sm:flex"
                  title="Random anime"
                >
                  <Shuffle className="w-4 h-4" />
                  Surprise Me
                </Button>
              </div>
            </div>

            {/* Hero dots */}
            <div className="flex gap-2 mt-7">
              {data.featured.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setHeroIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === heroIdx ? "w-8 brand-gradient" : "w-3 bg-foreground/20 hover:bg-foreground/40"
                  }`}
                  aria-label={`Go to featured ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 space-y-9 mt-6">
        {/* ===== CONTINUE WATCHING ===== */}
        {data.continueWatching.length > 0 && (
          <section aria-label="Continue watching">
            <SectionHeader
              title="Continue Watching"
              icon={<Clock3 className="w-5 h-5 text-primary" />}
              actionLabel="My Library"
              onAction={() => navigate("library")}
            />
            <ScrollRow>
              {data.continueWatching.map((c) => (
                <ContinueCard key={c.episodeId} item={c} />
              ))}
            </ScrollRow>
          </section>
        )}

        {/* ===== FREE ANIMES BANNER ===== */}
        {data.freeAnimes.length > 0 && (
          <section
            className="rounded-3xl border p-5 sm:p-7 aurora relative overflow-hidden"
            aria-label="Free animes"
          >
            <div className="relative flex items-center justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2.5">
                  <Gift className="w-6 h-6 text-emerald-400" />
                  Free to Watch
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  No credits needed — just press play and enjoy
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("browse", { filters: { free: "1" } })}
                className="rounded-full"
              >
                See all free
              </Button>
            </div>
            <ScrollRow>
              {data.freeAnimes.map((a) => (
                <AnimeCard key={a.id} anime={a} />
              ))}
            </ScrollRow>
          </section>
        )}

        {/* ===== TRENDING ===== */}
        {data.trending.length > 0 && (
          <section aria-label="Trending now">
            <SectionHeader
              title="Trending Now"
              icon={<Flame className="w-5 h-5 text-orange-500" />}
              actionLabel="Discover more"
              onAction={() => navigate("browse")}
            />
            <ScrollRow>
              {data.trending.map((a, i) => (
                <RankedCard key={a.id} anime={a} rank={i + 1} />
              ))}
            </ScrollRow>
          </section>
        )}

        {/* ===== TOP 10 ===== */}
        {data.topRated.length > 0 && (
          <section aria-label="Top rated">
            <SectionHeader
              title="Hall of Fame"
              icon={<Trophy className="w-5 h-5 text-amber-400" />}
            />
            <ScrollRow>
              {data.topRated.map((a, i) => (
                <RankedCard key={a.id} anime={a} rank={i + 1} />
              ))}
            </ScrollRow>
          </section>
        )}

        {/* ===== NEW RELEASES ===== */}
        {data.newReleases.length > 0 && (
          <section aria-label="New releases">
            <SectionHeader
              title="Fresh Drops"
              icon={<Sparkles className="w-5 h-5 text-primary" />}
              actionLabel="Discover"
              onAction={() => navigate("browse", { filters: { sort: "newest" } })}
            />
            <ScrollRow>
              {data.newReleases.map((a, i) => (
                <WideCard key={a.id} anime={a} tag={i === 0 ? "FRESH DROP" : a.status === "ONGOING" ? "NEW EPISODES" : undefined} />
              ))}
            </ScrollRow>
          </section>
        )}

        {/* ===== GENRE PILLS ===== */}
        {data.genres.length > 0 && (
          <section aria-label="Browse genres" className="pb-4">
            <SectionHeader title="Explore Genres" />
            <div className="flex flex-wrap gap-2.5">
              {data.genres.map((g, i) => (
                <button
                  key={g}
                  onClick={() => navigate("browse", { filters: { genre: g } })}
                  className="px-4 py-2 rounded-full border bg-card hover:border-primary/60 hover:text-primary hover:-translate-y-0.5 transition-all text-sm font-semibold shadow-sm"
                  style={{ transitionDelay: `${i * 10}ms` }}
                >
                  {g}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="pb-10">
      <div className="h-[64vh] min-h-[420px] max-h-[600px] skeleton" />
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 mt-8 space-y-9">
        {[0, 1, 2].map((r) => (
          <div key={r}>
            <div className="h-7 w-48 rounded-lg skeleton mb-4" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="w-[150px] sm:w-[168px] aspect-[2/3] rounded-xl skeleton" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
