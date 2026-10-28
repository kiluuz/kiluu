// src/components/anime/views/referral-view.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Copy,
  Check,
  Share2,
  Trophy,
  Coins,
  Sparkles,
  ShieldCheck,
  Send,
  Loader2,
  Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { FramedAvatar } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReferralData {
  code: string;
  totalInvited: number;
  qualifiedCount: number;
  monthlyMaxLimit: number;
  telegramShareLink: string;
  webShareLink: string;
  rewards: Array<{
    id: string;
    status: string;
    createdAt: string;
    referred: {
      username: string;
      displayName: string | null;
      avatarUrl: string | null;
      createdAt: string;
    };
  }>;
}

interface LeaderboardItem {
  rank: number;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    avatarFrame?: string | null;
  };
  count: number;
}

export function ReferralView() {
  const { user, setAuthOpen } = useAppStore();

  const [data, setData] = useState<ReferralData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [inputCode, setInputCode] = useState("");
  const [binding, setBinding] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "leaderboard">("stats");

  const handleBindCode = async () => {
    if (!inputCode.trim()) return;
    setBinding(true);
    try {
      const res = await fetch("/api/referrals/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: inputCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Referral muvaffaqiyatli bog'landi!");
      setInputCode("");
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi");
    } finally {
      setBinding(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    Promise.all([
      fetch("/api/referrals").then((r) => r.json()),
      fetch("/api/referrals/leaderboard").then((r) => r.json()),
    ])
      .then(([refData, leadData]) => {
        if (refData.stats) setData(refData.stats);
        if (leadData.leaderboard) setLeaderboard(leadData.leaderboard);
      })
      .catch((e) => console.error("Referral fetch error:", e))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const copyToClipboard = (text: string, isCode = false) => {
    navigator.clipboard.writeText(text);
    if (isCode) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    toast.success("Nusxa olindi!");
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary mx-auto flex items-center justify-center text-3xl shadow-sm">
          👥
        </div>
        <h2 className="text-2xl font-black">Do'stlarni taklif qilish</h2>
        <p className="text-sm text-muted-foreground">
          Do'stlaringizni taklif qiling va har bir malakali do'st uchun XP hamda bepul kreditlar yutib oling!
        </p>
        <Button onClick={() => setAuthOpen(true)} className="rounded-2xl px-6 font-bold">
          Hisobga kirish
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="rounded-3xl border p-6 sm:p-8 bg-linear-to-r from-primary/15 via-primary/5 to-secondary/30 relative overflow-hidden shadow-sm">
        <div className="max-w-xl space-y-2">
          <Badge className="bg-primary text-primary-foreground font-black text-xs px-2.5 py-0.5">
            🎁 REFERRAL DASTURI
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Do'stlaringizni taklif qiling, birgalikda yuting!
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Har bir malakali do'stingiz uchun sizga <strong>+100 XP</strong> va <strong>+10 kredit</strong>, do'stingizga esa <strong>+50 XP</strong> va <strong>+5 kredit</strong> beriladi!
          </p>
        </div>
      </div>

      {/* Share Links Card */}
      {data && (
        <div className="glass rounded-3xl border p-5 sm:p-6 space-y-4">
          <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
            <Share2 className="w-4 h-4 text-primary" /> Sizning taklif havolangiz
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Telegram Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Telegram Bot orqali taklif
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={data.telegramShareLink}
                  className="rounded-xl text-xs bg-secondary/40 font-mono"
                />
                <Button
                  size="sm"
                  onClick={() => copyToClipboard(data.telegramShareLink)}
                  className="rounded-xl px-3 shrink-0"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Referral Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">
                Shaxsiy referral kodingiz
              </label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={data.code}
                  className="rounded-xl text-xs bg-secondary/40 font-mono font-black tracking-wider text-center"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(data.code, true)}
                  className="rounded-xl px-3 shrink-0"
                >
                  {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enter Friend's Referral Code Card */}
      <div className="glass rounded-3xl border p-5 sm:p-6 space-y-3 bg-card/60">
        <div className="space-y-1">
          <h3 className="font-black text-sm sm:text-base flex items-center gap-2">
            <Gift className="w-4 h-4 text-primary" /> Sizni do'stingiz taklif qildimi?
          </h3>
          <p className="text-xs text-muted-foreground">
            Do'stingiz bergan referral kodini kiriting va ikkalangiz ham bonus kredit va XP oling!
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 max-w-md">
          <Input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            placeholder="KILUU-XXXXXX"
            className="rounded-xl text-xs font-mono font-bold tracking-wider uppercase bg-secondary/40"
          />
          <Button
            onClick={handleBindCode}
            disabled={binding || !inputCode.trim()}
            className="rounded-xl font-bold px-5 text-xs shrink-0"
          >
            {binding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Kodni faollashtirish"
            )}
          </Button>
        </div>
      </div>

      {/* Stats Counter */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-2xl border p-4 text-center">
            <p className="text-2xl font-black text-foreground">{data.totalInvited}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Jami ro'yxatdan o'tganlar</p>
          </div>
          <div className="glass rounded-2xl border p-4 text-center border-primary/30 bg-primary/5">
            <p className="text-2xl font-black text-primary">{data.qualifiedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Malakali (Mukofotlangan)</p>
          </div>
          <div className="glass rounded-2xl border p-4 text-center">
            <p className="text-2xl font-black text-foreground">
              {data.qualifiedCount} / {data.monthlyMaxLimit}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Oylik limit progressi</p>
          </div>
        </div>
      )}

      {/* How it works info */}
      <div className="p-4 rounded-2xl bg-secondary/40 border text-xs space-y-2">
        <h4 className="font-bold flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-primary" /> Do'st qachon "malakali" hisoblanadi?
        </h4>
        <p className="text-muted-foreground leading-relaxed">
          Taklif qilingan do'stingiz ro'yxatdan o'tishi bilan hisobga olinadi. Mukofot esa u <strong>birinchi epizodni tomosha qilganda</strong> yoki <strong>birinchi xaridni amalga oshirganda</strong> avtomatik ravishda ikkala hisobga qo'shiladi. Telegram bog'lash shart emas.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab("stats")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition",
            activeTab === "stats"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Takliflar tarixi
        </button>
        <button
          onClick={() => setActiveTab("leaderboard")}
          className={cn(
            "px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5",
            activeTab === "leaderboard"
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Trophy className="w-3.5 h-3.5 text-amber-500" /> Yetakchilar
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "stats" ? (
        data && data.rewards.length > 0 ? (
          <div className="glass rounded-3xl border overflow-hidden divide-y divide-border/40">
            {data.rewards.map((r) => (
              <div key={r.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center font-bold">
                    {r.referred.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold">{r.referred.displayName || r.referred.username}</p>
                    <p className="text-[10px] text-muted-foreground">@{r.referred.username}</p>
                  </div>
                </div>

                <Badge
                  className={cn(
                    "text-[10px]",
                    r.status === "rewarded"
                      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                      : r.status === "declined"
                      ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
                      : "bg-amber-500/15 text-amber-500 border-amber-500/30"
                  )}
                >
                  {r.status === "rewarded"
                    ? "✓ Mukofotlandi"
                    : r.status === "declined"
                    ? "Rad etildi"
                    : r.status === "qualified"
                    ? "Oylik limitda"
                    : "Faollik kutilmoqda..."}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 rounded-3xl border border-dashed text-xs text-muted-foreground">
            Hali taklif qilingan do'stlar mavjud emas. Yuqoridagi havolani do'stlaringizga ulashing!
          </div>
        )
      ) : (
        <div className="glass rounded-3xl border overflow-hidden divide-y divide-border/40">
          {leaderboard.map((item) => (
            <div key={item.rank} className="p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center font-black text-xs",
                    item.rank === 1
                      ? "bg-amber-500 text-amber-950"
                      : item.rank === 2
                      ? "bg-slate-300 text-slate-900"
                      : item.rank === 3
                      ? "bg-amber-700 text-amber-100"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {item.rank}
                </span>
                <span className="font-bold">
                  {item.user.displayName || item.user.username}
                </span>
              </div>
              <span className="font-black text-primary">
                {item.count} ta do'st
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
