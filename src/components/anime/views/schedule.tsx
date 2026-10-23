"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Play, ChevronRight, Tv, Sparkles, Bell, Globe, ExternalLink, Star, Calendar, Search, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { SmartImage, formatCredits } from "../ui-bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ScheduleItem } from "../types";
import { useI18n } from "@/components/i18n-provider";
import { getCached, isStale, fetchWithCache } from "@/lib/client-cache";

// AniList types
interface AniListEntry {
  scheduleId: number;
  episode: number;
  airingAt: number;
  airingAtDate: string;
  timeUntilAiring: number;
  media: {
    anilistId: number;
    title: string;
    titleRomaji: string;
    titleNative: string | null;
    coverImage: string;
    coverColor: string | null;
    bannerImage: string | null;
    format: string;
    status: string;
    genres: string[];
    score: number | null;
    totalEpisodes: number | null;
    duration: number | null;
    season: string | null;
    seasonYear: number | null;
    studio: string | null;
    siteUrl: string;
  };
}

const DAYS = [
  { short: "SUN", label: "Sunday" },
  { short: "MON", label: "Monday" },
  { short: "TUE", label: "Tuesday" },
  { short: "WED", label: "Wednesday" },
  { short: "THU", label: "Thursday" },
  { short: "FRI", label: "Friday" },
  { short: "SAT", label: "Saturday" },
] as const;

function formatCountdown(ms: number): string {
  if (ms <= 0) return "airing now";
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
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

function getSeasonName(season: string | null, t: (key: string) => string) {
  if (season === "WINTER") return t("schedule.season.winter");
  if (season === "SPRING") return t("schedule.season.spring");
  if (season === "SUMMER") return t("schedule.season.summer");
  if (season === "FALL") return t("schedule.season.fall");
  return season || "";
}

function translateStatus(status: string, t: (key: string) => string) {
  if (status === "RELEASING") return t("schedule.status.airing");
  if (status === "NOT_YET_RELEASED") return t("schedule.status.upcoming");
  if (status === "FINISHED") return t("schedule.status.finished");
  if (status === "CANCELLED") return t("schedule.status.cancelled");
  if (status === "HIATUS") return t("schedule.status.hiatus");
  return status;
}

function translateFormat(format: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    TV: t("schedule.format.tv"),
    TV_SHORT: t("schedule.format.tvShort"),
    MOVIE: t("schedule.format.movie"),
    SPECIAL: t("schedule.format.special"),
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: t("schedule.format.music"),
  };
  return labels[format] || format.replaceAll("_", " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

export function ScheduleView() {
  const { t, locale } = useI18n();
  const { navigate, user } = useAppStore();
  const [items, setItems] = useState<ScheduleItem[] | null>(() => {
    const cached = getCached<{ schedule: ScheduleItem[] }>("/api/schedule");
    return cached?.schedule || null;
  });
  const [day, setDay] = useState<number>(() => new Date().getDay());
  const [now, setNow] = useState(() => Date.now());
  const [anilistSchedule, setAnilistSchedule] = useState<Record<string, AniListEntry[]> | null>(null);
  const [anilistLoading, setAnilistLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [subscribedIds, setSubscribedIds] = useState<Set<number>>(new Set());
  const [reminderBusyIds, setReminderBusyIds] = useState<Set<number>>(new Set());
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);

  const [selectedSearchAnime, setSelectedSearchAnime] = useState<any | null>(null);
  const localeTag = locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : locale === "kk" ? "kk-KZ" : locale === "ky" ? "ky-KG" : "en-US";
  const dayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(localeTag, { weekday: "long" }).format(new Date(2024, 0, 7 + index))
  );
  const dayShortLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(localeTag, { weekday: "short" }).format(new Date(2024, 0, 7 + index))
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }
    const delay = setTimeout(() => {
      setIsSearching(true);
      fetch(`/api/anilist/search?q=${encodeURIComponent(searchQuery)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.results) setSearchResults(d.results);
          setIsSearching(false);
        })
        .catch(() => setIsSearching(false));
    }, 600);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  useEffect(() => {
    let alive = true;
    if (items && !isStale("/api/schedule")) {
      return;
    }
    fetchWithCache<{ schedule: ScheduleItem[] }>("/api/schedule")
      .then((d) => {
        if (alive) setItems(d.schedule || []);
      })
      .catch(() => {
        if (!items) toast.error("Failed to load schedule");
      });
    return () => { alive = false; };
  }, [user?.id, items]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch("/api/schedule/subscribe")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load subscriptions");
        return response.json();
      })
      .then((data: { ids?: number[] }) => {
        if (alive) setSubscribedIds(new Set(data.ids || []));
      })
      .catch((error: unknown) => {
        if (alive) toast.error(error instanceof Error ? error.message : "Could not load subscriptions");
      });
    return () => { alive = false; };
  }, [user?.id]);

  async function toggleReminder(entry: AniListEntry) {
    if (!user) {
      navigate("login");
      return;
    }
    const id = entry.media.anilistId;
    setReminderBusyIds((ids) => new Set(ids).add(id));
    try {
      const subscribed = subscribedIds.has(id);
      const response = await fetch(
        subscribed ? `/api/schedule/subscribe?anilistId=${id}` : "/api/schedule/subscribe",
        {
          method: subscribed ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          ...(subscribed ? {} : { body: JSON.stringify({ anilistId: id, title: entry.media.title }) }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update reminder");
      setSubscribedIds((ids) => {
        const next = new Set(ids);
        if (data.subscribed) next.add(id);
        else next.delete(id);
        return next;
      });
      toast.success(data.subscribed ? "Episode reminder enabled" : "Episode reminder cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update reminder");
    } finally {
      setReminderBusyIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch("/api/anilist/schedule?days=7")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (alive && d?.schedule) {
          setAnilistSchedule(d.schedule);
          setScheduleError(null);
        } else if (alive) {
          setScheduleError(d?.error || "The schedule is not available right now.");
        }
      })
      .catch(() => { if (alive) setScheduleError("Could not connect to the schedule source. Please try again later."); })
      .finally(() => { if (alive) setAnilistLoading(false); });
    return () => { alive = false; };
  }, []);

  const getLocalMatch = (entry: AniListEntry) => {
    if (!items) return null;
    const searchArr = [
      entry.media.title.toLowerCase(),
      entry.media.titleRomaji.toLowerCase(),
      entry.media.titleNative?.toLowerCase()
    ].filter(Boolean) as string[];

    return items.find((it) => {
      const itTitle = it.title.toLowerCase();
      // If any of the AniList titles include the local title or vice-versa
      return searchArr.some(s => s.includes(itTitle) || itTitle.includes(s));
    }) || null;
  };

  const enrichedSchedule = useMemo(() => {
    if (!anilistSchedule) return null;
    const result: Record<string, Array<{ entry: AniListEntry; local: ScheduleItem | null }>> = {
      "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": []
    };

    const allEntries = Object.values(anilistSchedule).flat();

    for (const entry of allEntries) {
      const date = new Date(entry.airingAt * 1000);
      const localDay = date.getDay().toString();
      result[localDay].push({
        entry,
        local: getLocalMatch(entry)
      });
    }

    // Sort each day's array by time
    for (const dayKey of Object.keys(result)) {
      result[dayKey].sort((a, b) => a.entry.airingAt - b.entry.airingAt);
    }

    return result;
  }, [anilistSchedule, items]);

  const today = new Date().getDay();
  const todaysFullList = enrichedSchedule ? (enrichedSchedule[day.toString()] || []) : [];
  const todaysList = isExpanded ? todaysFullList : todaysFullList.slice(0, 5);

  const airingToday = useMemo(() => {
    if (!enrichedSchedule) return [];
    const list = enrichedSchedule[today.toString()] || [];
    // Only those that haven't aired yet today
    return list.filter(item => {
      const airingMs = item.entry.airingAt * 1000;
      return airingMs > now;
    });
  }, [enrichedSchedule, today, now]);

  if (!enrichedSchedule && anilistLoading) {
    return (
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-10 space-y-6">
        <div className="h-10 w-72 rounded-xl skeleton" />
        <div className="grid grid-cols-7 gap-2">
          {DAYS.map((d) => (
            <div key={d.short} className="h-14 rounded-xl skeleton" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl skeleton" />
        ))}
      </div>
    );
  }

  const ongoingCount = Object.values(enrichedSchedule || {}).reduce((acc, list) => acc + list.length, 0);

  return (
    <div className="pb-10">
      <h1 className="sr-only">{t("globalSchedule")}</h1>
      {/* Header */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-6">
        <div className="flex items-center justify-end gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border rounded-full px-3.5 py-2">
            <Tv className="w-3.5 h-3.5 text-primary" />
            {ongoingCount} {t("schedule.ongoingSeries")} · {airingToday.length} {t("schedule.moreToday")}
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-2 relative max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("schedule.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchResults(null);
              setIsSearching(false);
            }}
            className="pl-10 pr-10 rounded-full h-11 bg-card/50 border-primary/20 focus-visible:border-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search Results Overlay */}
      {searchQuery.trim() && (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 mb-10 min-h-[40vh]">
          {isSearching ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> {t("schedule.searching")}
            </div>
          ) : searchResults?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground font-medium border rounded-2xl bg-card/30 border-dashed">
              {t("browse.noResults")}
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults?.map(res => {
                const msLeft = res.nextEpisode ? (res.nextEpisode.airingAt * 1000) - now : -1;
                const timeStr = res.nextEpisode ? new Date(res.nextEpisode.airingAt * 1000).toLocaleString(localeTag, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

                return (
                  <div
                    key={res.id}
                    className="flex items-center gap-4 p-3 rounded-2xl border bg-card/80 backdrop-blur cursor-pointer hover:border-primary/50 transition"
                    onClick={() => setSelectedSearchAnime(res)}
                  >
                    <div className="w-[50px] aspect-[2/3] rounded-xl overflow-hidden shrink-0">
                      <SmartImage src={res.coverImage} alt={res.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate text-base leading-tight">{res.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold">
                          {translateStatus(res.status, t)}
                        </span>
                        {res.nextEpisode && (
                          <span className="font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                            {t("schedule.episode")} {res.nextEpisode.episode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right pr-2">
                      {res.nextEpisode && msLeft > 0 ? (
                        <>
                          <div className="text-sm font-black tabular-nums">{timeStr}</div>
                          <div className="text-[10px] font-bold text-primary mt-0.5">{t("schedule.in")} {formatCountdown(msLeft)}</div>
                        </>
                      ) : res.status === "RELEASING" ? (
                        <span className="text-xs font-bold text-amber-500">{t("dubbing.soon")}</span>
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground">{t("schedule.unknown")}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Only show normal schedule if not searching */}
      {!searchQuery.trim() && (
        <>
          {scheduleError && !enrichedSchedule && (
            <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pb-6">
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                {scheduleError}
              </div>
            </div>
          )}
          {/* Airing today strip */}
      {airingToday.length > 0 && (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pb-6">
          <div className="rounded-2xl border aurora relative overflow-hidden p-4 sm:p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> {t("schedule.stillToCome")}
            </p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {airingToday.map(({ entry, local }) => {
                const msLeft = (entry.airingAt * 1000) - now;
                const cd = formatCountdown(msLeft);
                const timeStr = new Date(entry.airingAt * 1000).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
                return (
                  <div
                    key={entry.scheduleId}
                    onClick={() => local && navigate("detail", { animeId: local.slug })}
                    className={cn(
                      "group flex items-center gap-3 bg-card/80 backdrop-blur rounded-xl border p-2.5 pr-4 transition shrink-0",
                      local ? "cursor-pointer hover:border-primary/50" : "cursor-default"
                    )}
                  >
                    <div className="w-11 h-14 rounded-lg overflow-hidden shrink-0">
                      <SmartImage src={local ? local.coverImage : (entry.media.coverImage || "")} alt={entry.media.title} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-left flex flex-col justify-center">
                      <span className="block text-[13px] font-bold truncate max-w-[150px]">{local ? local.title : entry.media.title}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">
                        {timeStr}                         <span className="text-primary font-medium px-1">{t("schedule.episodeShort")} {entry.episode}</span> · {t("schedule.in")} <span className="text-primary font-bold">{cd}</span>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Weekday tabs */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 p-1.5 bg-card border rounded-2xl" role="tablist" aria-label="Day of week">
          {Array.from({ length: 7 }).map((_, idx) => {
            const dayIndex = (today + idx) % 7;
            const d = DAYS[dayIndex];
            const list = enrichedSchedule ? (enrichedSchedule[dayIndex.toString()] || []) : [];
            const count = list.length;
            const isToday = idx === 0;
            const selected = dayIndex === day;

            const tabDate = new Date();
            tabDate.setDate(tabDate.getDate() + idx);
            const dateNum = tabDate.getDate();

            return (
              <button
                key={d.short}
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setDay(dayIndex);
                  setIsExpanded(false);
                }}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 sm:py-3 rounded-xl transition-all",
                  selected
                    ? "brand-gradient text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <span className="text-[10px] font-bold tracking-widest opacity-80">{dayShortLabels[dayIndex]}</span>
                <span className={cn("relative text-lg sm:text-xl font-black leading-none", isToday && !selected && "text-primary")}>
                  {dateNum}
                  {isToday && <span className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-semibold",
                    selected ? "text-white/75" : "text-muted-foreground/70"
                  )}
                >
                  {isToday ? t("schedule.today") : `${count} ${t(count === 1 ? "schedule.showSingular" : "schedule.showPlural")}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day list */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 mt-6 space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-[0.14em]">
          {dayLabels[day]}
          {day === today && <span className="text-primary normal-case tracking-normal ml-2">— {t("schedule.today")}</span>}
        </h2>

        {todaysList.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-bold">{t("schedule.noBroadcasts")} {dayLabels[day]}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("schedule.emptyHint")}
            </p>
            <Button variant="outline" size="sm" className="rounded-full mt-4" onClick={() => navigate("browse")}>
              {t("nav.browse")}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          todaysList.map(({ entry, local }) => {
            const airingMs = entry.airingAt * 1000;
            const msLeft = airingMs - now;
            const timeStr = new Date(airingMs).toLocaleTimeString(localeTag, { hour: "2-digit", minute: "2-digit" });
            const seasonStr = getSeasonName(entry.media.season, t);

            return (
              <div
                key={entry.scheduleId}
                className={cn(
                  "group flex items-center gap-4 sm:gap-5 rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:border-primary/40 hover:shadow-lg",
                  msLeft > 0 && "airing-today"
                )}
              >
                {/* Time block */}
                <div className="flex flex-col items-center justify-center w-[74px] sm:w-[92px] shrink-0 rounded-xl bg-background border py-2.5">
                  <Clock className="w-3.5 h-3.5 text-primary mb-1" />
                  <span className="text-lg sm:text-xl font-black tabular-nums leading-none">{timeStr}</span>
                  {msLeft > 0 ? (
                    <span className="text-[9.5px] font-bold text-primary mt-1.5">{t("schedule.in")} {formatCountdown(msLeft)}</span>
                  ) : (
                    <span className="text-[9.5px] font-bold text-muted-foreground mt-1.5">{t("schedule.released")}</span>
                  )}
                </div>

                {/* Poster */}
                <div
                  className={cn("w-[58px] sm:w-[68px] aspect-[2/3] rounded-xl overflow-hidden shrink-0", "cursor-pointer glow-hover")}
                  onClick={() => {
                    if (local) navigate("detail", { animeId: local.slug });
                    else {
                      setSelectedSearchAnime({
                        id: entry.media.anilistId,
                        title: entry.media.title,
                        coverImage: entry.media.coverImage,
                        status: entry.media.status,
                        nextEpisode: {
                          episode: entry.episode,
                          airingAt: entry.airingAt,
                          timeUntilAiring: entry.timeUntilAiring
                        }
                      });
                    }
                  }}
                  aria-label={`Open ${local ? local.title : entry.media.title}`}
                >
                  <SmartImage src={local ? local.coverImage : (entry.media.coverImage || "")} alt={entry.media.title} className="w-full h-full object-cover" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div onClick={() => {
                    if (local) navigate("detail", { animeId: local.slug });
                    else {
                      setSelectedSearchAnime({
                        id: entry.media.anilistId,
                        title: entry.media.title,
                        coverImage: entry.media.coverImage,
                        status: entry.media.status,
                        nextEpisode: {
                          episode: entry.episode,
                          airingAt: entry.airingAt,
                          timeUntilAiring: entry.timeUntilAiring
                        }
                      });
                    }
                  }} className={cn("text-left w-full cursor-pointer")}>
                    <h3 className={cn("font-display text-base sm:text-lg font-black leading-tight truncate transition-colors", "group-hover:text-primary")}>
                      {local ? local.title : entry.media.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-bold text-primary px-1.5 py-0.5 rounded-md bg-primary/10">
                      {t("schedule.episode")} {entry.episode}
                    </span>
                    {(seasonStr || entry.media.seasonYear) && (
                      <span className="font-bold text-emerald-400 px-1.5 py-0.5 rounded-md bg-emerald-400/10 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {seasonStr} {entry.media.seasonYear || ""}
                      </span>
                    )}
                    {local ? (
                      <>
                        <span className="font-semibold text-foreground/80">★ {local.rating.toFixed(1)}</span>
                        <span>·</span>
                        <span>{local.type}</span>
                        <span>·</span>
                        <span>{local.genres.slice(0, 3).join(", ")}</span>
                        <span>·</span>
                        <span>
                          {local.episodeCount} ep{local.episodeCount === 1 ? "" : "s"}
                        </span>
                      </>
                    ) : (
                      <>
                        {entry.media.score && <span className="font-semibold text-foreground/80">★ {(entry.media.score / 10).toFixed(1)}</span>}
                        <span>·</span>
                        <span>{translateFormat(entry.media.format, t)}</span>
                        <span>·</span>
                        <span>{entry.media.genres.slice(0, 3).join(", ")}</span>
                        {entry.media.totalEpisodes && (
                          <>
                            <span>·</span>
                            <span>{entry.media.totalEpisodes} eps</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {local && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {local.isFree ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          {t("home.free")}
                        </span>
                      ) : local.owned ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                          {t("schedule.owned")}
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                          {formatCredits(local.price)} {t("home.credits")}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {local && (
                    <Button
                      size="sm"
                      className="rounded-full brand-gradient text-white font-bold hidden sm:inline-flex"
                      onClick={() => navigate("detail", { animeId: local.slug })}
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      {local.owned || local.isFree ? t("schedule.watch") : t("home.viewDetails")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full px-2.5"
                    aria-label={subscribedIds.has(entry.media.anilistId) ? t("notifyCancel") : t("schedule.notifyWhenReleased")}
                    aria-pressed={subscribedIds.has(entry.media.anilistId)}
                    disabled={reminderBusyIds.has(entry.media.anilistId)}
                    onClick={() => void toggleReminder(entry)}
                  >
                    <Bell className={cn("w-4 h-4", subscribedIds.has(entry.media.anilistId) && "fill-current text-primary")} />
                  </Button>
                </div>
              </div>
            );
          })
        )}

        {!isExpanded && todaysFullList.length > 5 && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              className="rounded-full px-6 font-bold"
              onClick={() => setIsExpanded(true)}
            >
              {t("schedule.showMore")} ({todaysFullList.length - 5})
            </Button>
          </div>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-6">
        {t("schedule.updatesEverySecond")}
      </p>
        </>
      )}

      {/* Anime Modal */}
      {selectedSearchAnime && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedSearchAnime(null)}>
          <div className="relative w-full max-w-lg bg-card border rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setSelectedSearchAnime(null)}
              className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="h-48 relative w-full">
              <SmartImage src={selectedSearchAnime.coverImage} alt={selectedSearchAnime.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
            </div>
            <div className="px-6 pb-8 -mt-12 relative z-10 text-center">
              <div className="w-24 h-36 mx-auto rounded-xl overflow-hidden border-4 border-card shadow-xl mb-4">
                 <SmartImage src={selectedSearchAnime.coverImage} alt={selectedSearchAnime.title} className="w-full h-full object-cover" />
              </div>
              <h2 className="text-2xl font-black mb-1 leading-tight">{selectedSearchAnime.title}</h2>
              <p className="text-sm text-muted-foreground font-semibold mb-6">{translateStatus(selectedSearchAnime.status, t)}</p>

              {selectedSearchAnime.nextEpisode ? (
                <div className="p-5 rounded-3xl border-2 border-primary/20 bg-primary/5 inline-block min-w-[280px] shadow-lg shadow-primary/5 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
                  <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-1000" style={{ width: `${Math.max(0, Math.min(100, 100 - (((selectedSearchAnime.nextEpisode.airingAt * 1000) - now) / (7 * 24 * 60 * 60 * 1000)) * 100))}%` }} />
                  <p className="text-xs font-black uppercase tracking-wider text-primary mb-1">{t("schedule.nextEpisode")}</p>
                  <h3 className="text-3xl font-black mb-3">{t("schedule.episode")} {selectedSearchAnime.nextEpisode.episode}</h3>
                  <p className="text-xs text-muted-foreground font-semibold mb-1">{t("schedule.remainingTime")}</p>
                  <div className="font-display text-2xl font-black tabular-nums text-foreground">
                    {formatDetailCountdown((selectedSearchAnime.nextEpisode.airingAt * 1000) - now)}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl border border-dashed bg-secondary/30">
                  <p className="font-bold text-muted-foreground">{t("schedule.nextEpisodeUnknown")}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
