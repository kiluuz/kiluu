"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check, Clock3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "../store";
import type { AnimeDetail, EpisodeItem } from "../types";
import { VideoPlayer } from "../player";
import { SmartImage, timeAgo } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

interface DetailResponse {
  anime: AnimeDetail;
  episodes: EpisodeItem[];
}

export function WatchView() {
  const { view, user, navigate, goBack } = useAppStore();
  const { t } = useI18n();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [dataForAnime, setDataForAnime] = useState<string | null>(null);
  const [localEpisodes, setLocalEpisodes] = useState<EpisodeItem[]>([]);

  const animeId = view.animeId!;
  const episodeId = view.episodeId;
  const loading = dataForAnime !== animeId || !data;

  useEffect(() => {
    let alive = true;
    fetch(`/api/animes/${animeId}`)
      .then((r) => r.json())
      .then((d: DetailResponse) => {
        if (!alive) return;
        if (d.anime) {
          setData(d);
          setDataForAnime(animeId);
          setLocalEpisodes(d.episodes);
          if (!episodeId && d.episodes[0]) {
            navigate("watch", { animeId, episodeId: d.episodes[0].id });
          }
        }
      })
      .catch(() => toast.error(t("watch.loadError")));
    return () => {
      alive = false;
    };
     
  }, [animeId, user?.id]);

  const currentEpisode = useMemo(
    () => localEpisodes.find((e) => e.id === episodeId) || localEpisodes[0],
    [localEpisodes, episodeId]
  );

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-0 sm:px-8 py-0 sm:py-6">
        <div className="aspect-video max-h-[82vh] skeleton" />
      </div>
    );
  }

  if (!data || !currentEpisode) {
    return (
      <div className="text-center py-32">
        <p className="font-bold text-lg">{t("watch.episodeNotFound")}</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("home")}>{t("watch.backHome")}</Button>
      </div>
    );
  }

  const { anime } = data;
  const idx = localEpisodes.findIndex((e) => e.id === currentEpisode.id);
  const next = localEpisodes[idx + 1];
  const prev = localEpisodes[idx - 1];

  if (!anime.owned && !anime.isFree) {
    return (
      <div className="max-w-[900px] mx-auto px-4 py-24 text-center">
        <p className="text-6xl mb-4">🔒</p>
        <h1 className="text-2xl font-black mb-2">{t("watch.lockedTitle")}</h1>
        <p className="text-muted-foreground mb-6">
          {t("watch.purchaseUnlock", { title: anime.title, price: anime.price })}
        </p>
        <div className="flex gap-3 justify-center">
          <Button className="rounded-full brand-gradient text-white font-bold" onClick={() => navigate("detail", { animeId: anime.slug })}>
            {t("watch.viewDetails")}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={goBack}>{t("common.back")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-0 sm:px-8 py-0 sm:py-6 pb-10">
      {/* Player */}
      <VideoPlayer
        key={currentEpisode.id}
        episode={currentEpisode}
        episodes={localEpisodes}
        title={anime.title}
        hasNext={Boolean(next)}
        onNext={() => next && navigate("watch", { animeId, episodeId: next.id })}
        onEpisodeSelect={(epId) => navigate("watch", { animeId, episodeId: epId })}
        onEnded={() => {
          if (next) {
            toast.success(t("watch.nextStarting"), {
              action: { label: t("watch.playNow"), onClick: () => navigate("watch", { animeId, episodeId: next.id }) },
            });
          } else {
            toast.success(t("watch.finished"));
          }
        }}
      />

      {/* Below player */}
      <div className="px-4 sm:px-0 mt-4 grid lg:grid-cols-[1fr_340px] gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-black text-primary bg-primary/10 border border-primary/25 rounded-full px-2.5 py-1">
              EP {String(currentEpisode.number).padStart(2, "0")}
            </span>
            <h1 className="text-lg sm:text-xl font-bold">{currentEpisode.title}</h1>
          </div>
          <button
            onClick={() => navigate("detail", { animeId: anime.slug })}
            className="text-sm text-muted-foreground hover:text-primary transition font-medium"
          >
            {anime.title} →
          </button>
          {currentEpisode.description && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{currentEpisode.description}</p>
          )}

          {/* Prev / Next */}
          <div className="flex items-center gap-3 mt-5">
            <Button
              variant="secondary"
              size="sm"
              disabled={!prev}
              onClick={() => prev && navigate("watch", { animeId, episodeId: prev.id })}
              className="rounded-full"
            >
              <ChevronLeft className="w-4 h-4" /> {t("watch.previous")}
            </Button>
            <Button
              size="sm"
              disabled={!next}
              onClick={() => next && navigate("watch", { animeId, episodeId: next.id })}
              className="rounded-full brand-gradient text-white font-bold"
            >
              {t("watch.nextEpisode")} <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("watch-together")}
              className="rounded-full ml-auto"
            >
              <Sparkles className="w-4 h-4" /> {t("nav.watch-together")}
            </Button>
          </div>
        </div>

        {/* Episode sidebar */}
        <aside className="glass rounded-2xl p-4 self-start">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Clock3 className="w-4 h-4 text-primary" /> {t("watch.upNext")}
            </h3>
            <span className="text-[10px] text-muted-foreground">{t("watch.episodeCount", { count: localEpisodes.length })}</span>
          </div>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto fancy-scroll pr-1">
            {localEpisodes.map((ep) => {
              const active = ep.id === currentEpisode.id;
              const pct = ep.progress && ep.progress.duration > 0
                ? Math.min(100, (ep.progress.position / ep.progress.duration) * 100)
                : 0;
              return (
                <button
                  key={ep.id}
                  onClick={() => navigate("watch", { animeId, episodeId: ep.id })}
                  className={cn(
                    "w-full flex items-center gap-2.5 p-2 rounded-xl transition text-left",
                    active ? "bg-primary/15 border border-primary/30" : "hover:bg-accent border border-transparent"
                  )}
                >
                  <div className="relative w-16 aspect-video rounded-lg overflow-hidden shrink-0">
                    <SmartImage src={anime.coverImage} alt="" className="w-full h-full object-cover" />
                    {pct > 0 && (
                      <div className="absolute bottom-0 inset-x-0 h-[3px] bg-black/50">
                        <div className="h-full brand-gradient" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-bold truncate", active && "text-primary")}>
                      EP {String(ep.number).padStart(2, "0")}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{ep.title}</p>
                  </div>
                  {ep.progress?.completed && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
