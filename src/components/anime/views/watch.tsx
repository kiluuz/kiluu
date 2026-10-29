"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "../store";
import type { AnimeDetail, EpisodeItem } from "../types";
import { SmartImage } from "../ui-bits";
import { useBotStatus } from "../bot-hooks";
import { LinkTelegramModal } from "../bot-ui";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";

interface DetailResponse {
  anime: AnimeDetail;
  episodes: EpisodeItem[];
}

export function WatchView() {
  const { view, user, navigate, goBack, setAuthOpen } = useAppStore();
  const { t } = useI18n();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [dataForAnime, setDataForAnime] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [opening, setOpening] = useState(false);
  const bot = useBotStatus(Boolean(user));

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
        }
      })
      .catch(() => toast.error(t("watch.loadError")));
    return () => {
      alive = false;
    };
  }, [animeId, user?.id]);

  const currentEpisode =
    data?.episodes.find((e) => e.id === episodeId) || data?.episodes[0];

  if (loading) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-10">
        <div className="aspect-video rounded-3xl skeleton" />
      </div>
    );
  }

  if (!data || !currentEpisode) {
    return (
      <div className="text-center py-32">
        <p className="font-bold text-lg">{t("watch.episodeNotFound")}</p>
        <Button variant="outline" className="mt-4 rounded-full" onClick={() => navigate("home")}>
          {t("watch.backHome")}
        </Button>
      </div>
    );
  }

  const { anime } = data;
  const episodeNumber = currentEpisode.number;

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

  async function openInTelegram() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!bot.linked) {
      setShowLinkModal(true);
      return;
    }
    setOpening(true);
    try {
      const res = await fetch("/api/bot/deliver-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: anime.slug, episode_number: episodeNumber }),
      });
      const data = await res.json().catch(() => ({}));
      const delivered = typeof data.delivered === "number" ? data.delivered : res.ok ? 1 : 0;
      if (res.ok && delivered > 0) {
        toast.success(`✅ Episode ${episodeNumber} added to your bot library — open /my_library in the bot.`);
      } else {
        toast.error(data.error || "Could not deliver the episode. Opening the bot — try /my_library.");
      }
    } catch {
      toast.error("Could not deliver the episode. Opening the bot — try /my_library.");
    } finally {
      setOpening(false);
    }
    bot.refresh();

    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "DubAniXbot";
    window.location.href = `tg://resolve?domain=${botUsername}`;
    setTimeout(() => {
      if (!document.hidden) {
        window.open(`https://t.me/${botUsername}`, "_blank");
      }
    }, 1500);
  }

  return (
    <div className="max-w-[720px] mx-auto px-4 py-6 sm:py-12">
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition mb-4 font-medium"
      >
        <ChevronLeft className="w-4 h-4" /> {t("common.back")}
      </button>

      <div className="glass-strong rounded-3xl overflow-hidden shadow-2xl">
        <div className="relative aspect-video">
          <SmartImage src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
          <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6">
            <span className="text-[11px] font-black text-white bg-primary rounded-full px-2.5 py-1">
              EP {String(currentEpisode.number).padStart(2, "0")}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-2 leading-tight">{anime.title}</h1>
            <p className="text-sm text-white/70 mt-0.5 truncate">{currentEpisode.title}</p>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4">
            <Send className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Watching happens in the Telegram bot</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Episodes are delivered by the Kiluu bot. Open the bot, send <strong>/my_library</strong>,
                and pick this anime. On the website, only <strong>Watch Together</strong> plays video.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <Button
              onClick={openInTelegram}
              disabled={opening}
              className="flex-1 h-12 rounded-full brand-gradient text-white font-bold gap-2 shadow-lg shadow-primary/25"
            >
              {opening ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {opening ? "Sending..." : bot.linked ? "Send episode & open Telegram" : "Connect Telegram"}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("watch-together")}
              className="h-12 rounded-full font-bold gap-2 px-5"
            >
              <Sparkles className="w-4 h-4" /> {t("nav.watch-together")}
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <button
              onClick={() => navigate("detail", { animeId: anime.slug })}
              className="hover:text-primary transition font-semibold"
            >
              {anime.title} · all episodes →
            </button>
            <span>{data.episodes.length} episodes</span>
          </div>
        </div>
      </div>

      <LinkTelegramModal
        open={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onLinked={() => bot.refresh()}
        animeTitle={anime.title}
      />
    </div>
  );
}
