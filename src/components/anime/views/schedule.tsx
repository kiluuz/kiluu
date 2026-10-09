"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Play, ChevronRight, Tv, Sparkles, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "../store";
import { SmartImage, formatCredits } from "../ui-bits";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ScheduleItem } from "../types";

const DAYS = [
  { short: "SUN", label: "Sunday" },
  { short: "MON", label: "Monday" },
  { short: "TUE", label: "Tuesday" },
  { short: "WED", label: "Wednesday" },
  { short: "THU", label: "Thursday" },
  { short: "FRI", label: "Friday" },
  { short: "SAT", label: "Saturday" },
] as const;

/** ms until the next occurrence of (dayOfWeek, "HH:MM") */
function msUntilNext(day: number, time: string, now: Date): number {
  const [h, m] = time.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  let diff = target.getTime() - now.getTime();
  const currentDay = now.getDay();
  const daysAhead = (day - currentDay + 7) % 7;
  if (diff <= 0 || daysAhead > 0) {
    // if today's slot already passed, roll forward
    target.setDate(target.getDate() + (diff <= 0 && daysAhead === 0 ? 7 : daysAhead));
    diff = target.getTime() - now.getTime();
  }
  return diff;
}

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

export function ScheduleView() {
  const { navigate, user } = useAppStore();
  const [items, setItems] = useState<ScheduleItem[] | null>(null);
  const [day, setDay] = useState<number>(() => new Date().getDay());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setItems(d.schedule || []);
      })
      .catch(() => toast.error("Failed to load schedule"));
    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Tick every 30s for live countdowns
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const byDay = useMemo(() => {
    const map: Record<number, ScheduleItem[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    (items || []).forEach((it) => map[it.airDay]?.push(it));
    // sort by air time
    Object.values(map).forEach((list) =>
      list.sort((a, b) => (a.airTime > b.airTime ? 1 : -1))
    );
    return map;
  }, [items]);

  const today = new Date().getDay();
  const todaysList = byDay[day] || [];

  const airingToday = useMemo(() => {
    const now2 = new Date(now);
    return (byDay[today] || []).filter((it) => msUntilNext(it.airDay, it.airTime, now2) > 0);
  }, [byDay, today, now]);

  if (!items) {
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

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-8 pb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
              <CalendarDays className="w-8 h-8 text-primary" />
              Broadcast Schedule
            </h1>
            <p className="text-muted-foreground text-sm mt-2">
              Weekly airing times for ongoing series —{" "}
              <span className="text-foreground font-semibold">Asia/Tashkent (GMT+5)</span>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-card border rounded-full px-3.5 py-2">
            <Tv className="w-3.5 h-3.5 text-primary" />
            {items.length} ongoing series · {airingToday.length} more today
          </div>
        </div>
      </div>

      {/* Airing today strip */}
      {airingToday.length > 0 && (
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 pb-6">
          <div className="rounded-2xl border aurora relative overflow-hidden p-4 sm:p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-primary flex items-center gap-2 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Still to come today
            </p>
            <div className="flex gap-3 overflow-x-auto no-scrollbar">
              {airingToday.map((it) => {
                const cd = formatCountdown(msUntilNext(it.airDay, it.airTime, new Date(now)));
                return (
                  <button
                    key={it.id}
                    onClick={() => navigate("detail", { animeId: it.slug })}
                    className="group flex items-center gap-3 bg-card/80 backdrop-blur rounded-xl border p-2.5 pr-4 hover:border-primary/50 transition shrink-0"
                  >
                    <div className="w-11 h-14 rounded-lg overflow-hidden shrink-0">
                      <SmartImage src={it.coverImage} alt={it.title} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-left">
                      <span className="block text-[13px] font-bold truncate max-w-[150px]">{it.title}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {it.airTime} · in <span className="text-primary font-bold">{cd}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Weekday tabs */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 p-1.5 bg-card border rounded-2xl" role="tablist" aria-label="Day of week">
          {DAYS.map((d, i) => {
            const count = (byDay[i] || []).length;
            const isToday = i === today;
            const selected = i === day;
            return (
              <button
                key={d.short}
                role="tab"
                aria-selected={selected}
                onClick={() => setDay(i)}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 sm:py-3 rounded-xl transition-all",
                  selected
                    ? "brand-gradient text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                <span className="text-[10px] font-bold tracking-widest opacity-80">{d.short}</span>
                <span className={cn("relative text-lg sm:text-xl font-black leading-none", isToday && !selected && "text-primary")}>
                  {count > 0 ? count : "–"}
                  {isToday && <span className="absolute -top-1 -right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />}
                </span>
                <span
                  className={cn(
                    "text-[9px] font-semibold",
                    selected ? "text-white/75" : "text-muted-foreground/70"
                  )}
                >
                  {isToday ? "today" : "shows"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day list */}
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 mt-6 space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-[0.14em]">
          {DAYS[day].label}
          {day === today && <span className="text-primary normal-case tracking-normal ml-2">— today</span>}
        </h2>

        {todaysList.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="font-bold">No broadcasts on {DAYS[day].label}s</p>
            <p className="text-sm text-muted-foreground mt-1">
              Perfect day to raid your library or start something new.
            </p>
            <Button variant="outline" size="sm" className="rounded-full mt-4" onClick={() => navigate("browse")}>
              Browse animes
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          todaysList.map((it) => {
            const cd = formatCountdown(msUntilNext(it.airDay, it.airTime, new Date(now)));
            const isNextToday = day === today;
            return (
              <div
                key={it.id}
                className={cn(
                  "group flex items-center gap-4 sm:gap-5 rounded-2xl border bg-card p-3 sm:p-4 transition-all hover:border-primary/40 hover:shadow-lg",
                  isNextToday && "airing-today"
                )}
              >
                {/* Time block */}
                <div className="flex flex-col items-center justify-center w-[74px] sm:w-[92px] shrink-0 rounded-xl bg-background border py-2.5">
                  <Clock className="w-3.5 h-3.5 text-primary mb-1" />
                  <span className="text-lg sm:text-xl font-black tabular-nums leading-none">{it.airTime}</span>
                  {isNextToday && (
                    <span className="text-[9.5px] font-bold text-primary mt-1.5">in {cd}</span>
                  )}
                </div>

                {/* Poster */}
                <button
                  className="w-[58px] sm:w-[68px] aspect-[2/3] rounded-xl overflow-hidden shrink-0 glow-hover"
                  onClick={() => navigate("detail", { animeId: it.slug })}
                  aria-label={`Open ${it.title}`}
                >
                  <SmartImage src={it.coverImage} alt={it.title} className="w-full h-full object-cover" />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate("detail", { animeId: it.slug })} className="text-left w-full">
                    <h3 className="text-[15px] sm:text-lg font-bold truncate group-hover:text-primary transition-colors">
                      {it.title}
                    </h3>
                  </button>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="font-semibold text-foreground/80">★ {it.rating.toFixed(1)}</span>
                    <span>·</span>
                    <span>{it.type}</span>
                    <span>·</span>
                    <span>{it.genres.slice(0, 3).join(", ")}</span>
                    <span>·</span>
                    <span>
                      {it.episodeCount} ep{it.episodeCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {it.isFree ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        FREE
                      </span>
                    ) : it.owned ? (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                        OWNED
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        {formatCredits(it.price)} CREDITS
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="rounded-full brand-gradient text-white font-bold hidden sm:inline-flex"
                    onClick={() => navigate("detail", { animeId: it.slug })}
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    {it.owned || it.isFree ? "Watch" : "Details"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full px-2.5"
                    aria-label="Remind me"
                    onClick={() => toast.success(`We'll nudge you before ${it.title} airs ⏰`)}
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
