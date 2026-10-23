// src/components/anime/gamification/quests-widget.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Flame,
  Shield,
  Gift,
  Check,
  RefreshCw,
  Sparkles,
  Trophy,
  Coins,
  Clock,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

interface QuestItem {
  id: string;
  key?: string;
  title: string;
  description?: string;
  category: string;
  progress: number;
  targetCount: number;
  status: "active" | "completed" | "claimed";
  xpReward: number;
  creditReward: number;
  difficulty: string;
  expiresAt: string;
}

interface StreakStatus {
  streakCount: number;
  hasClaimedToday: boolean;
  streakFreezeCount: number;
  todayDate: string;
  nextMilestone: number;
  daysToNextMilestone: number;
}

function getLocalizedQuest(q: QuestItem, t: (key: string, values?: Record<string, string | number>) => string) {
  const map: Record<string, { titleKey: string; descKey: string }> = {
    "Watch 1 episode": { titleKey: "quests.template.watch_1.title", descKey: "quests.template.watch_1.desc" },
    "1 ta epizod tomosha qil": { titleKey: "quests.template.watch_1.title", descKey: "quests.template.watch_1.desc" },
    "Join the conversation": { titleKey: "quests.template.chat_5.title", descKey: "quests.template.chat_5.desc" },
    "Chatda 5 ta xabar yoz": { titleKey: "quests.template.chat_5.title", descKey: "quests.template.chat_5.desc" },
    "Leave a comment": { titleKey: "quests.template.comment_1.title", descKey: "quests.template.comment_1.desc" },
    "Postga fikr bildir": { titleKey: "quests.template.comment_1.title", descKey: "quests.template.comment_1.desc" },
    "Spread the love": { titleKey: "quests.template.like_3.title", descKey: "quests.template.like_3.desc" },
    "3 ta postga like bos": { titleKey: "quests.template.like_3.title", descKey: "quests.template.like_3.desc" },
    "Daily Login": { titleKey: "quests.template.login_1.title", descKey: "quests.template.login_1.desc" },
    "Kunlik kirish mukofotini ol": { titleKey: "quests.template.login_1.title", descKey: "quests.template.login_1.desc" },
    "Rate an Anime": { titleKey: "quests.template.rate_1.title", descKey: "quests.template.rate_1.desc" },
    "Animega real baho ber": { titleKey: "quests.template.rate_1.title", descKey: "quests.template.rate_1.desc" },
    "Vote in Weekly Poll": { titleKey: "quests.template.poll_1.title", descKey: "quests.template.poll_1.desc" },
    "Hafta animesiga ovoz ber": { titleKey: "quests.template.poll_1.title", descKey: "quests.template.poll_1.desc" },
    "Anime Marathon": { titleKey: "quests.template.marathon_10.title", descKey: "quests.template.marathon_10.desc" },
    "Haftalik marafon: 10 ta epizod": { titleKey: "quests.template.marathon_10.title", descKey: "quests.template.marathon_10.desc" },
    "Community Star": { titleKey: "quests.template.community_2.title", descKey: "quests.template.community_2.desc" },
    "Jamoat yulduzi: 2 ta post yarat": { titleKey: "quests.template.community_2.title", descKey: "quests.template.community_2.desc" },
    "Generous Soul": { titleKey: "quests.template.gift_1.title", descKey: "quests.template.gift_1.desc" },
    "Do'stingga sovg'a yubor": { titleKey: "quests.template.gift_1.title", descKey: "quests.template.gift_1.desc" },
    "Invite a Friend": { titleKey: "quests.template.referral_1.title", descKey: "quests.template.referral_1.desc" },
    "Do'stingni taklif qil": { titleKey: "quests.template.referral_1.title", descKey: "quests.template.referral_1.desc" },
  };

  const lookup = (q.key && map[q.key]) || map[q.title];
  if (lookup) {
    const title = t(lookup.titleKey);
    const desc = t(lookup.descKey);
    return {
      title: title !== lookup.titleKey ? title : q.title,
      description: desc !== lookup.descKey ? desc : (q.description || ""),
    };
  }
  return { title: q.title, description: q.description || "" };
}

export function QuestsWidget({ compact = false }: { compact?: boolean }) {
  const { user, setAuthOpen } = useAppStore();
  const { t } = useI18n();

  const [streak, setStreak] = useState<StreakStatus | null>(null);
  const [dailyQuests, setDailyQuests] = useState<QuestItem[]>([]);
  const [weeklyQuests, setWeeklyQuests] = useState<QuestItem[]>([]);
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");
  const [loading, setLoading] = useState(true);
  const [claimingStreak, setClaimingStreak] = useState(false);
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
  const [rerollingQuestId, setRerollingQuestId] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [streakRes, questsRes] = await Promise.all([
        fetch("/api/streaks"),
        fetch("/api/quests"),
      ]);

      if (streakRes.ok) {
        const d = await streakRes.json();
        setStreak(d.status);
      }
      if (questsRes.ok) {
        const d = await questsRes.json();
        setDailyQuests(d.daily || []);
        setWeeklyQuests(d.weekly || []);
      }
    } catch (e) {
      console.warn("Failed to load quests data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.id]);

  const handleClaimStreak = async () => {
    if (!user) return setAuthOpen(true);
    setClaimingStreak(true);
    try {
      const res = await fetch("/api/streaks", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(t("quests.streakSuccess"));
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi");
    } finally {
      setClaimingStreak(false);
    }
  };

  const handleClaimQuest = async (questId: string) => {
    if (!user) return setAuthOpen(true);
    setClaimingQuestId(questId);
    try {
      const res = await fetch("/api/quests/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userQuestId: questId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(t("quests.claimSuccess"));
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Xatolik");
    } finally {
      setClaimingQuestId(null);
    }
  };

  const handleRerollQuest = async (questId: string) => {
    if (!user) return setAuthOpen(true);
    setRerollingQuestId(questId);
    try {
      const res = await fetch("/api/quests/reroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userQuestId: questId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.info(t("quests.rerollSuccess"));
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Xatolik");
    } finally {
      setRerollingQuestId(null);
    }
  };

  if (!user) {
    return (
      <div className="glass rounded-3xl p-6 border text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center text-2xl">
          🔥
        </div>
        <h3 className="font-black text-base">{t("quests.title")}</h3>
        <p className="text-xs text-muted-foreground">
          {t("quests.empty")}
        </p>
        <Button onClick={() => setAuthOpen(true)} className="rounded-xl font-bold text-xs">
          {t("quests.signIn")}
        </Button>
      </div>
    );
  }

  const currentQuests = activeTab === "daily" ? dailyQuests : weeklyQuests;

  return (
    <div className="glass rounded-3xl border overflow-hidden shadow-sm space-y-4 p-5 sm:p-6">
      {/* Streak Header Card */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-linear-to-r from-primary/15 via-primary/5 to-secondary/30 border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-2xl shadow-inner shrink-0">
            🔥
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-black text-base flex items-center gap-1.5">
                {t("quests.streak", { count: streak?.streakCount || 0 })}
              </h4>
              {streak && streak.streakFreezeCount > 0 && (
                <Badge
                  variant="outline"
                  className="text-[10px] h-4.5 px-1.5 border-cyan-500/30 text-cyan-500 bg-cyan-500/10 gap-1"
                  title="Streak muzlatgichi (uzilishdan himoya)"
                >
                  🧊 {streak.streakFreezeCount} freeze
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {streak?.hasClaimedToday
                ? t("quests.streakClaimedToday")
                : t("quests.streakNextMilestone", {
                    milestone: streak?.nextMilestone || 7,
                    days: streak?.daysToNextMilestone || 7,
                  })}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          disabled={claimingStreak || streak?.hasClaimedToday}
          onClick={handleClaimStreak}
          className={cn(
            "rounded-xl font-black text-xs h-9 px-4 shrink-0 transition-all shadow-sm",
            streak?.hasClaimedToday
              ? "bg-secondary text-muted-foreground hover:bg-secondary cursor-default"
              : "brand-gradient text-white animate-pulse"
          )}
        >
          {claimingStreak ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : streak?.hasClaimedToday ? (
            <>
              <Check className="w-3.5 h-3.5 mr-1" /> {t("quests.claimedToday")}
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> {t("quests.dailyReward")}
            </>
          )}
        </Button>
      </div>

      {/* Quests Header & Tabs */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          <h3 className="font-black text-sm">{t("quests.title")}</h3>
        </div>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsList className="h-8 rounded-xl bg-secondary/50 p-0.5 text-xs">
            <TabsTrigger value="daily" className="rounded-lg px-3 text-[11px] font-bold">
              {t("quests.dailyTab")} ({dailyQuests.filter((q) => q.status === "completed" || q.status === "claimed" || q.progress >= q.targetCount).length}/{dailyQuests.length})
            </TabsTrigger>
            <TabsTrigger value="weekly" className="rounded-lg px-3 text-[11px] font-bold">
              {t("quests.weeklyTab")} ({weeklyQuests.filter((q) => q.status === "completed" || q.status === "claimed" || q.progress >= q.targetCount).length}/{weeklyQuests.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Quests List */}
      {loading ? (
        <div className="space-y-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl skeleton" />
          ))}
        </div>
      ) : currentQuests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-xs">
          {t("quests.empty")}
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentQuests.map((q) => {
            const isCompleted = q.progress >= q.targetCount;
            const isClaimed = q.status === "claimed";
            const pct = Math.min(100, Math.round((q.progress / q.targetCount) * 100));
            const loc = getLocalizedQuest(q, t);

            return (
              <div
                key={q.id}
                className={cn(
                  "p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5",
                  isClaimed
                    ? "bg-secondary/20 border-border/40 opacity-70"
                    : isCompleted
                    ? "bg-primary/5 border-primary/40 shadow-xs"
                    : "bg-secondary/40 border-border/60 hover:bg-secondary/60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-xs truncate">{loc.title}</h4>
                      {q.difficulty === "hard" && (
                        <Badge className="text-[9px] h-4 px-1 bg-rose-500/15 text-rose-500 border-rose-500/30">
                          {t("quests.hard")}
                        </Badge>
                      )}
                    </div>
                    {loc.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {loc.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-black text-primary">
                      +{q.xpReward} XP
                    </span>
                    {q.creditReward > 0 && (
                      <span className="text-[11px] font-black text-amber-500 flex items-center">
                        +{q.creditReward} <Coins className="w-2.5 h-2.5 ml-0.5" />
                      </span>
                    )}

                    {/* Reroll button for daily active quests */}
                    {activeTab === "daily" && !isCompleted && !isClaimed && (
                      <button
                        onClick={() => handleRerollQuest(q.id)}
                        disabled={rerollingQuestId === q.id}
                        title="Vazifani almashtirish (1 marta)"
                        className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition ml-1"
                      >
                        {rerollingQuestId === q.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar & Claim button */}
                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{t("quests.progress")}</span>
                      <span className="font-semibold">
                        {q.progress} / {q.targetCount}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          isCompleted ? "bg-emerald-500" : "bg-primary"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {isClaimed ? (
                    <Badge variant="outline" className="text-[10px] h-6 px-2 text-muted-foreground border-border">
                      <Check className="w-3 h-3 mr-1" /> {t("quests.claimed")}
                    </Badge>
                  ) : isCompleted ? (
                    <Button
                      size="sm"
                      onClick={() => handleClaimQuest(q.id)}
                      disabled={claimingQuestId === q.id}
                      className="h-7 text-[10px] font-bold px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shrink-0 shadow-xs"
                    >
                      {claimingQuestId === q.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        t("quests.claimReward")
                      )}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-semibold shrink-0">
                      {t("quests.inProgress")}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
