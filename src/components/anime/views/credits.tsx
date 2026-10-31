"use client";

import { useEffect, useState } from "react";
import {
  Zap, Gift, History, Loader2, Sparkles, Copy, ExternalLink,
  Clock, CheckCircle2, ShieldCheck, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppStore } from "../store";
import type { CreditPackage, CreditTx } from "../types";
import { formatCredits, timeAgo } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { FramesShop } from "../frame-shop";
import { convertPrice, formatDisplayPrice, type DisplayCurrency } from "@/lib/display-currency";

export interface CreditsData {
  packages: CreditPackage[];
  balance: number;
  transactions: CreditTx[];
  payment?: {
    provider: string;
    currency: string;
    donationUrl: string;
    display?: { currencies: DisplayCurrency[]; rates: Record<DisplayCurrency, number> };
  };
}

export interface DonationIntent {
  id: string;
  code: string;
  amountMinor: number;
  credits: number;
  currency: string;
  status: "pending" | "completed" | "expired" | "cancelled";
  expiresAt: string;
  donateUrl: string;
  creditsGranted: number | null;
}

const ERROR_KEYS: Record<string, string> = {
  PAYMENTS_UNAVAILABLE: "credits.daUnavailable",
  TOO_MANY_PENDING: "credits.daTooMany",
  INVALID_PACKAGE: "credits.daError",
  TOO_MANY_REQUESTS: "credits.daRate",
};

function formatMoney(minor: number, currency: string) {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency}`;
}

function minutesLeft(expiresAt: string, now: number) {
  const diff = new Date(expiresAt).getTime() - now;
  if (diff <= 0) return "00:00";
  const total = Math.floor(diff / 1000);
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function TopUpSection({
  data,
  priceCurrency,
  onCompleted,
}: {
  data: CreditsData | null;
  priceCurrency: DisplayCurrency;
  onCompleted: () => Promise<void> | void;
}) {
  const { user, setAuthOpen } = useAppStore();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"credits" | "frames">("credits");
  const [topUp, setTopUp] = useState<{ pkg: CreditPackage; intent: DonationIntent } | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const intentStatus = topUp?.intent.status;

  useEffect(() => {
    if (intentStatus !== "pending") return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [intentStatus, topUp?.intent.id]);

  useEffect(() => {
    if (!topUp || topUp.intent.status !== "pending") return;
    let active = true;
    const intentId = topUp.intent.id;

    const check = async () => {
      try {
        const res = await fetch(`/api/credits/donation-intent/${intentId}`, { cache: "no-store" });
        if (!res.ok) return;
        const fresh = (await res.json()) as DonationIntent;
        if (!active) return;
        setTopUp((current) => (current && current.intent.id === fresh.id ? { ...current, intent: fresh } : current));
        if (fresh.status === "completed") {
          const granted = fresh.creditsGranted ?? fresh.credits;
          toast.success(t("credits.daSuccess", { count: formatCredits(granted) }));
          await onCompleted();
        }
      } catch {
        /* transient network error — keep polling */
      }
    };

    void check();
    const id = setInterval(check, 4000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [topUp?.intent.id, intentStatus, onCompleted, t]);

  async function startTopUp(pkg: CreditPackage) {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    setCreatingId(pkg.id);
    try {
      const res = await fetch("/api/credits/donation-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(t(ERROR_KEYS[d.error] ?? "credits.daError"));
        return;
      }
      setNow(Date.now());
      setTopUp({ pkg, intent: d });
    } catch {
      toast.error(t("auth.networkErrorShort"));
    } finally {
      setCreatingId(null);
    }
  }

  async function copyCode() {
    if (!topUp) return;
    try {
      await navigator.clipboard.writeText(topUp.intent.code);
      toast.success(t("credits.daCopied"));
    } catch {
      toast.error(t("credits.daCopyFailed"));
    }
  }

  const rates = data?.payment?.display?.rates;
  const priceOf = (base: number) =>
    formatDisplayPrice(convertPrice(base, priceCurrency, rates), priceCurrency);
  const approxOf = (minor: number, currency: string) => {
    if (currency !== (data?.payment?.currency ?? "RUB")) return null;
    return priceOf(minor / 100);
  };

  return (
    <section className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> {t("payouts.topUpTitle")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">{t("payouts.topUpHint")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={activeTab === "credits" ? "default" : "outline"}
            className="rounded-full h-8 text-[11px]"
            onClick={() => setActiveTab("credits")}
          >
            {t("credits.credits")}
          </Button>
          <Button
            size="sm"
            variant={activeTab === "frames" ? "default" : "outline"}
            className="rounded-full h-8 text-[11px]"
            onClick={() => setActiveTab("frames")}
          >
            Frames
          </Button>
        </div>
      </div>

      {activeTab === "frames" ? (
        <FramesShop />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {(data?.packages || []).map((pkg) => (
              <button
                key={pkg.id}
                disabled={creatingId === pkg.id}
                onClick={() => startTopUp(pkg)}
                className={cn(
                  "relative rounded-3xl border p-5 text-left transition-all hover:-translate-y-1.5 disabled:opacity-70",
                  pkg.popular
                    ? "border-primary bg-gradient-to-b from-primary/15 to-transparent shadow-xl shadow-primary/15"
                    : "bg-card hover:border-primary/50"
                )}
              >
                {pkg.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 brand-gradient text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap">
                    {t("credits.popular")}
                  </span>
                )}
                <div className="flex items-center gap-1.5 mb-2">
                  <Zap className={cn("w-5 h-5", pkg.popular ? "text-primary" : "text-amber-400")} />
                  <span className="text-2xl font-black tabular-nums">{formatCredits(pkg.credits)}</span>
                </div>
                {pkg.bonus > 0 && (
                  <p className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 inline-flex items-center gap-1 mb-2">
                    <Gift className="w-3 h-3" /> +{formatCredits(pkg.bonus)} {t("credits.bonus")}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{t("credits.total")} {formatCredits(pkg.credits + pkg.bonus)}</p>
                <p className="text-lg font-black mt-2 flex items-center gap-1.5">
                  {creatingId === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {pkg.priceDa && pkg.priceDa > 0 ? priceOf(pkg.priceDa) : "—"}
                </p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            {t("credits.daSecured")}
          </p>

          <div>
            <h3 className="font-bold flex items-center gap-2 mb-4">
              <History className="w-4.5 h-4.5 text-primary" /> {t("credits.history")}
            </h3>
            {!user ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                <Button variant="link" onClick={() => setAuthOpen(true)} className="p-0 h-auto">{t("auth.signIn")}</Button> {t("credits.signInToHistory")}
              </p>
            ) : data && data.transactions.length > 0 ? (
              <div className="space-y-2 max-h-96 overflow-y-auto fancy-scroll pr-1">
                {data.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-accent/50 transition">
                    <span className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0",
                      tx.amount > 0 ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
                    )}>
                      {tx.amount > 0 ? "+" : "−"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{tx.description}</p>
                      <p className="text-[11px] text-muted-foreground">{timeAgo(tx.createdAt)} · {tx.type}</p>
                    </div>
                    <span className={cn("font-black tabular-nums text-sm shrink-0", tx.amount > 0 ? "text-emerald-500" : "text-rose-500")}>
                      {tx.amount > 0 ? "+" : ""}{formatCredits(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">{t("credits.noTransactions")}</p>
            )}
          </div>
        </div>
      )}

      <Dialog open={Boolean(topUp)} onOpenChange={(open) => { if (!open) setTopUp(null); }}>
        <DialogContent className="sm:max-w-[460px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" /> {t("credits.daTitle")}
            </DialogTitle>
            <DialogDescription>{t("credits.daDescription")}</DialogDescription>
          </DialogHeader>

          {topUp && topUp.intent.status === "completed" ? (
            <div className="space-y-4 py-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-black">{t("credits.daSuccessTitle")}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("credits.daSuccess", { count: formatCredits(topUp.intent.creditsGranted ?? topUp.intent.credits) })}
                </p>
              </div>
              <Button className="w-full h-11 rounded-xl" onClick={() => setTopUp(null)}>{t("credits.daClose")}</Button>
            </div>
          ) : topUp && topUp.intent.status === "expired" ? (
            <div className="space-y-4 py-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/15 flex items-center justify-center">
                <Clock className="w-9 h-9 text-amber-500" />
              </div>
              <p className="text-sm text-muted-foreground">{t("credits.daExpired")}</p>
              <Button className="w-full h-11 rounded-xl brand-gradient text-white" onClick={() => { const pkg = topUp.pkg; setTopUp(null); void startTopUp(pkg); }}>
                {t("credits.daNewCode")}
              </Button>
            </div>
          ) : topUp ? (
            <div className="space-y-5 pt-2">
              <div className="rounded-2xl border bg-card p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">{t("credits.daAmount")}</p>
                  <p className="text-2xl font-black">{formatMoney(topUp.intent.amountMinor, topUp.intent.currency)}</p>
                  {approxOf(topUp.intent.amountMinor, topUp.intent.currency) && (
                    <p className="text-[11px] text-muted-foreground">≈ {approxOf(topUp.intent.amountMinor, topUp.intent.currency)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{formatCredits(topUp.intent.credits)} {t("credits.credits")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">{t("credits.daExpires")}</p>
                  <p className="text-xl font-black tabular-nums text-amber-500">{minutesLeft(topUp.intent.expiresAt, now)}</p>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold mb-2">{t("credits.daCode")}</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-2xl sm:text-3xl font-black tracking-[0.14em] tabular-nums">{topUp.intent.code}</code>
                  <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={copyCode} aria-label={t("credits.daCopy")}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">{t("credits.daCodeHint")}</p>
              </div>

              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p className="flex gap-2"><span className="font-black text-primary">1.</span> {t("credits.daStep1")}</p>
                <p className="flex gap-2"><span className="font-black text-primary">2.</span> {t("credits.daStep2")}</p>
                <p className="flex gap-2"><span className="font-black text-primary">3.</span> {t("credits.daStep3", { amount: formatMoney(topUp.intent.amountMinor, topUp.intent.currency) })}</p>
              </div>

              <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{t("credits.daWarning")}</span>
              </div>

              <a href={topUp.intent.donateUrl} target="_blank" rel="noopener noreferrer" className="block">
                <Button className="w-full h-12 rounded-xl brand-gradient text-white font-bold text-base">
                  <ExternalLink className="w-5 h-5" /> {t("credits.daOpen")}
                </Button>
              </a>

              <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("credits.daWaiting")}
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
