// src/components/anime/gamification/weekly-poll-card.tsx
"use client";

import { useEffect, useState } from "react";
import { Trophy, Star, Check, Sparkles, Clock, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "../store";
import { SmartImage } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  candidateId: string;
  title: string;
  coverImage: string;
  rating: number;
  percentage?: number | null;
  votesCount?: number;
  isWinner?: boolean;
}

interface PollData {
  id: string;
  weekKey: string;
  startsAt: string;
  endsAt: string;
  status: string;
  winnerAnimeId?: string | null;
  isClosed: boolean;
  myVoteAnimeId?: string | null;
  candidates: Candidate[];
}

export function WeeklyPollCard() {
  const { user, setAuthOpen, navigate } = useAppStore();
  const [poll, setPoll] = useState<PollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingAnimeId, setVotingAnimeId] = useState<string | null>(null);

  const fetchPoll = async () => {
    try {
      const res = await fetch("/api/weekly-poll");
      if (res.ok) {
        const d = await res.json();
        setPoll(d.poll);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoll();
  }, [user?.id]);

  const handleVote = async (animeId: string) => {
    if (!user) return setAuthOpen(true);
    setVotingAnimeId(animeId);
    try {
      const res = await fetch("/api/weekly-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ animeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || "Ovozingiz qabul qilindi!");
      setPoll((prev) => (prev ? { ...prev, myVoteAnimeId: animeId } : prev));
    } catch (e: any) {
      toast.error(e.message || "Ovoz berishda xatolik");
    } finally {
      setVotingAnimeId(null);
    }
  };

  if (loading || !poll || poll.candidates.length === 0) {
    return null;
  }

  return (
    <div className="glass rounded-3xl border p-5 sm:p-6 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-black text-base sm:text-lg">Hafta Animesi (Ovoz berish)</h3>
            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">
              {poll.isClosed ? "Yakunlangan" : "Ovoz berish faol"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            O'zingizga yoqqan animega ovoz bering. Dushanba kuni g'olib aniqlanadi va to'g'ri topganlarga mukofot beriladi!
          </p>
        </div>

        {poll.myVoteAnimeId && (
          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 text-xs px-2.5 py-1 gap-1">
            <Check className="w-3.5 h-3.5" /> Siz ovoz bergansiz
          </Badge>
        )}
      </div>

      {/* Candidates Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5 pt-1">
        {poll.candidates.map((c) => {
          const isMyVote = poll.myVoteAnimeId === c.id;
          const isWinner = c.isWinner;

          return (
            <div
              key={c.id}
              className={cn(
                "group relative rounded-2xl border p-2 flex flex-col justify-between transition-all overflow-hidden",
                isWinner
                  ? "border-amber-500 bg-amber-500/10 shadow-md ring-1 ring-amber-500/50"
                  : isMyVote
                  ? "border-emerald-500/60 bg-emerald-500/5"
                  : "bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50"
              )}
            >
              {isWinner && (
                <div className="absolute top-2 left-2 z-10 bg-amber-500 text-amber-950 font-black text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                  <Crown className="w-3 h-3" /> G'olib!
                </div>
              )}

              <div
                className="cursor-pointer"
                onClick={() => navigate("detail", { animeId: c.id })}
              >
                <div className="aspect-3/4 rounded-xl overflow-hidden bg-muted mb-2 relative">
                  <SmartImage
                    src={c.coverImage}
                    alt={c.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute bottom-1.5 right-1.5 bg-black/70 backdrop-blur-xs px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    {c.rating.toFixed(1)}
                  </div>
                </div>
                <h4 className="font-bold text-xs truncate group-hover:text-primary transition">
                  {c.title}
                </h4>
              </div>

              <div className="mt-2 pt-2 border-t border-border/40">
                {poll.isClosed ? (
                  <div className="text-center">
                    <div className="text-xs font-black text-foreground">
                      {c.percentage !== null ? `${c.percentage}%` : "—"}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {c.votesCount || 0} ovoz
                    </span>
                  </div>
                ) : isMyVote ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="w-full h-7 text-[10px] rounded-lg border-emerald-500/40 text-emerald-500 bg-emerald-500/10 font-bold"
                  >
                    <Check className="w-3 h-3 mr-1" /> Berildi
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={votingAnimeId === c.id || !!poll.myVoteAnimeId}
                    onClick={() => handleVote(c.id)}
                    className="w-full h-7 text-[10px] rounded-lg font-bold"
                  >
                    {votingAnimeId === c.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      "Ovoz berish"
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
