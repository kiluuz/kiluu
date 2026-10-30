"use client";

import { useEffect, useState } from "react";
import {
  Banknote, Loader2, ArrowDownToLine, Clock, CheckCircle2,
  XCircle, AlertTriangle, Wallet, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { formatCredits, timeAgo } from "../ui-bits";

interface PayoutConfig {
  rate: number;
  minMinor: number;
  currency: string;
  methods: string[];
}

interface PayoutRequest {
  id: string;
  credits: number;
  amountMinor: number;
  currency: string;
  method: string;
  detailsMasked: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface PayoutsData {
  balance: number;
  config: PayoutConfig;
  eligible: boolean;
  requests: PayoutRequest[];
}

const ERROR_KEYS: Record<string, string> = {
  INSUFFICIENT: "payouts.error.insufficient",
  BELOW_MIN: "payouts.error.belowMin",
  TOO_MANY_PENDING: "payouts.error.tooMany",
  BAD_DETAILS: "payouts.error.details",
  BAD_METHOD: "payouts.error.method",
  BAD_CREDITS: "payouts.error.credits",
  TOO_MANY_REQUESTS: "payouts.error.rate",
  FORBIDDEN: "payouts.locked",
};

function formatMoney(minor: number, currency: string) {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency}`;
}

export function PayoutsView() {
  const { user, setUser, setAuthOpen } = useAppStore();
  const { t } = useI18n();
  const [loadedData, setLoadedData] = useState<{ userId: string | null; value: PayoutsData } | null>(null);
  const data = loadedData?.userId === (user?.id ?? null) ? loadedData.value : null;
  const [creditsInput, setCreditsInput] = useState("");
  const [method, setMethod] = useState("uzcard");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/payouts", { cache: "no-store" });
        if (!res.ok) return;
        const result = (await res.json()) as PayoutsData;
        if (active) setLoadedData({ userId: user?.id ?? null, value: result });
      } catch {
        /* keep the last snapshot */
      }
    };
    void load();
    return () => { active = false; };
  }, [user?.id]);

  async function refresh() {
    const [payRes, meRes] = await Promise.all([
      fetch("/api/payouts", { cache: "no-store" }),
      fetch("/api/auth/me", { cache: "no-store" }),
    ]);
    const pay = payRes.ok ? ((await payRes.json()) as PayoutsData) : null;
    const me = meRes.ok ? await meRes.json().catch(() => null) : null;
    if (pay) setLoadedData({ userId: user?.id ?? null, value: pay });
    if (me?.user) setUser(me.user);
  }

  async function submit() {
    if (!data) return;
    const credits = Number(creditsInput);
    setSubmitting(true);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits, method, details }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(t(ERROR_KEYS[payload?.error] ?? "payouts.error.generic"));
        return;
      }
      toast.success(t("payouts.submitted"));
      setCreditsInput("");
      setDetails("");
      await refresh();
    } catch {
      toast.error(t("auth.networkErrorShort"));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    setCancellingId(id);
    try {
      const res = await fetch(`/api/payouts/${id}/cancel`, { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(t(ERROR_KEYS[payload?.error] ?? "payouts.error.generic"));
        return;
      }
      toast.success(t("payouts.cancelledToast"));
      await refresh();
    } catch {
      toast.error(t("auth.networkErrorShort"));
    } finally {
      setCancellingId(null);
    }
  }

  if (!user) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-8 py-10">
        <div className="glass rounded-3xl p-8 text-center">
          <Wallet className="w-10 h-10 mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">
            <Button variant="link" className="p-0 h-auto" onClick={() => setAuthOpen(true)}>{t("auth.signIn")}</Button>{" "}
            {t("payouts.signIn")}
          </p>
        </div>
      </div>
    );
  }

  if (data && !data.eligible) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-8 py-10">
        <div className="glass rounded-3xl p-8 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500" />
          <h1 className="text-xl font-black">{t("payouts.locked")}</h1>
          <p className="text-sm text-muted-foreground">{t("payouts.lockedHint")}</p>
        </div>
      </div>
    );
  }

  const config = data?.config;
  const credits = Number(creditsInput) || 0;
  const amountMinor = config ? Math.round(credits * config.rate * 100) : 0;
  const belowMin = Boolean(config && amountMinor > 0 && amountMinor < config.minMinor);
  const canSubmit =
    Boolean(data) &&
    Number.isInteger(credits) &&
    credits > 0 &&
    details.trim().length >= 4 &&
    !belowMin &&
    credits <= (data?.balance ?? 0) &&
    !submitting;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            <Banknote className="w-7 h-7 text-primary" /> {t("nav.payouts")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("payouts.subtitle")}</p>
        </div>
        <div className="rounded-2xl border bg-card/60 px-5 py-3 sm:text-right">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t("payouts.balance")}</p>
          <p className="text-3xl font-black tabular-nums text-amber-500">{formatCredits(data?.balance ?? user.credits)}</p>
          <p className="text-xs text-muted-foreground">{t("credits.credits")}</p>
        </div>
      </div>

      {!data ? (
        <div className="glass rounded-3xl p-10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
          <div className="glass rounded-3xl p-5 sm:p-6 space-y-4">
            <h2 className="font-bold flex items-center gap-2">
              <ArrowDownToLine className="w-4.5 h-4.5 text-primary" /> {t("payouts.requestTitle")}
            </h2>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">{t("payouts.creditsLabel")}</label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={data.balance}
                value={creditsInput}
                onChange={(event) => setCreditsInput(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1000"
                className="rounded-xl tabular-nums"
              />
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span className="text-muted-foreground">
                  {t("payouts.amountToReceive")}: <strong className="text-foreground">{formatMoney(amountMinor, config?.currency || "RUB")}</strong>
                </span>
                <button
                  type="button"
                  className="text-primary font-bold"
                  onClick={() => setCreditsInput(String(data.balance))}
                >
                  {t("payouts.max")}
                </button>
              </div>
              {belowMin && config && (
                <p className="text-[11px] text-amber-500 mt-1">
                  {t("payouts.error.belowMin")} · {formatMoney(config.minMinor, config.currency)}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">{t("payouts.methodLabel")}</label>
              <div className="grid grid-cols-3 gap-2">
                {(config?.methods || []).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-xs font-bold transition",
                      method === m ? "border-primary bg-primary/10 text-primary" : "bg-card hover:border-primary/40"
                    )}
                  >
                    {t(`payouts.method.${m}`)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">{t("payouts.detailsLabel")}</label>
              <Input
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={t("payouts.detailsPlaceholder")}
                maxLength={200}
                className="rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" /> {t("payouts.detailsHint")}
              </p>
            </div>

            <Button
              disabled={!canSubmit}
              onClick={submit}
              className="w-full h-11 rounded-xl brand-gradient text-white font-bold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
              {submitting ? t("payouts.submitting") : t("payouts.submit")}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">{t("payouts.holdNote")}</p>
          </div>

          <div className="space-y-4">
            <div className="glass rounded-3xl p-5 space-y-2 text-sm">
              <p className="font-bold">{t("payouts.rateTitle")}</p>
              <p className="text-2xl font-black text-primary">
                1 {t("credits.credits")} = {config?.rate} {config?.currency}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("payouts.min", { amount: formatMoney(config?.minMinor ?? 0, config?.currency || "RUB") })}
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-xs text-muted-foreground flex gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{t("payouts.securityNote")}</span>
            </div>
          </div>
        </div>
      )}

      <div className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-bold flex items-center gap-2 mb-4">
          <Clock className="w-4.5 h-4.5 text-primary" /> {t("payouts.history")}
        </h2>
        {data && data.requests.length > 0 ? (
          <div className="space-y-2">
            {data.requests.map((request) => (
              <div key={request.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border bg-card/40">
                <StatusIcon status={request.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">
                    {formatCredits(request.credits)} {t("credits.credits")} → {formatMoney(request.amountMinor, request.currency)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t(`payouts.method.${request.method}`)} · {request.detailsMasked} · {timeAgo(request.createdAt)}
                  </p>
                  {request.adminNote && <p className="text-[11px] text-muted-foreground mt-0.5">“{request.adminNote}”</p>}
                </div>
                <div className="flex items-center gap-2 sm:shrink-0">
                  <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full", statusClass(request.status))}>
                    {t(`payouts.status.${request.status}`)}
                  </span>
                  {request.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-8 text-[11px]"
                      disabled={cancellingId === request.id}
                      onClick={() => cancel(request.id)}
                    >
                      {cancellingId === request.id ? <Loader2 className="w-3 h-3 animate-spin" /> : t("payouts.cancel")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">{t("payouts.empty")}</p>
        )}
      </div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "paid") return "bg-emerald-500/15 text-emerald-500";
  if (status === "rejected") return "bg-rose-500/15 text-rose-500";
  if (status === "cancelled") return "bg-muted text-muted-foreground";
  return "bg-amber-500/15 text-amber-500";
}

function StatusIcon({ status }: { status: string }) {
  const cls = "w-9 h-9 rounded-full flex items-center justify-center shrink-0";
  if (status === "paid") return <span className={cn(cls, "bg-emerald-500/15 text-emerald-500")}><CheckCircle2 className="w-4.5 h-4.5" /></span>;
  if (status === "rejected") return <span className={cn(cls, "bg-rose-500/15 text-rose-500")}><XCircle className="w-4.5 h-4.5" /></span>;
  if (status === "cancelled") return <span className={cn(cls, "bg-muted text-muted-foreground")}><XCircle className="w-4.5 h-4.5" /></span>;
  return <span className={cn(cls, "bg-amber-500/15 text-amber-500")}><Clock className="w-4.5 h-4.5" /></span>;
}
