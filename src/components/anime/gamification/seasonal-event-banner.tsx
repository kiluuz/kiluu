// src/components/anime/gamification/seasonal-event-banner.tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles, Clock, Flame, ShieldAlert, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SeasonalEventData {
  id: string;
  slug: string;
  title: string;
  titleUz: string;
  description?: string;
  themeColor: string;
  bannerUrl?: string;
  startsAt: string;
  endsAt: string;
  isNeverReturns: boolean;
  quests?: any[];
}

export function SeasonalEventBanner() {
  const [event, setEvent] = useState<SeasonalEventData | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    fetch("/api/seasonal-events")
      .then((r) => r.json())
      .then((d) => {
        if (d.event) setEvent(d.event);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!event) return;

    const calcTime = () => {
      const diff = new Date(event.endsAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Tadbir yakunlandi");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${days} kun ${hours} soat ${minutes} daqiqa`);
    };

    calcTime();
    const t = setInterval(calcTime, 60_000);
    return () => clearInterval(t);
  }, [event]);

  if (!event) return null;

  return (
    <div className="relative rounded-3xl overflow-hidden border p-5 sm:p-7 shadow-sm text-foreground bg-linear-to-r from-orange-500/15 via-amber-500/10 to-transparent border-orange-500/30">
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-orange-500 text-white font-black text-xs px-2.5 py-0.5 tracking-wide shadow-xs">
              🎃 MAVSUMIY TADBIR
            </Badge>
            {event.isNeverReturns && (
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500 bg-amber-500/10">
                ⭐ Cheklangan (Qaytib kelmaydi)
              </Badge>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            {event.titleUz || event.title}
          </h3>

          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {event.description}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-secondary/60 border text-xs font-bold text-muted-foreground">
            <Clock className="w-3.5 h-3.5 text-orange-500 animate-spin" />
            <span>Qolgan vaqt: <strong className="text-foreground">{timeLeft}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
