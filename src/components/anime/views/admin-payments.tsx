"use client";

import { useEffect, useState } from "react";
import {
  Loader2, CheckCircle2, XCircle, Link2, Unlink, AlertTriangle,
  CreditCard, History, ShieldAlert, RefreshCw, Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { formatCredits, timeAgo } from "../ui-bits";

interface DaStatus {
  configured: {
    clientId: boolean;
    clientSecret: boolean;
    tokenKey: boolean;
    ingestSecret: boolean;
    currency: string;
    donationUrl: string;
  };
  connected: boolean;
  account: {
    daUserId: string;
    daUserName: string | null;
    accessExpiresAt: string;
    connectedAt: string;
    updatedAt: string;
  } | null;
  events: Array<{
    donationId: string;
    amountMinor: number;
    currency: string;
    message: string | null;
    donorName: string | null;
    status: string;
    reason: string | null;
    receivedAt: string;
  }>;
  payoutQueue: { count: number; amountMinor: number; credits: number };
}

interface AdminPayout {
  id: string;
  credits: number;
  amountMinor: number;
  currency: string;
  method: string;
  details: string;
  detailsMasked: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
  user: { id: string; username: string; displayName: string | null; email: string };
  processedBy: { username: string; displayName: string | null } | null;
}

const ENV_ROWS = [
  ["clientId", "DONATIONALERTS_CLIENT_ID"],
  ["clientSecret", "DONATIONALERTS_CLIENT_SECRET"],
  ["tokenKey", "DONATIONALERTS_TOKEN_KEY"],
  ["ingestSecret", "DONATIONALERTS_INGEST_SECRET"],
] as const;

const PAYOUT_TABS = ["pending", "paid", "rejected", "cancelled", "all"] as const;

function formatMoney(minor: number, currency: string) {
  return `${(minor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency}`;
}

function statusClass(status: string) {
  if (status === "paid" || status === "processed") return "bg-emerald-500/15 text-emerald-500";
  if (status === "rejected" || status === "wrong_currency") return "bg-rose-500/15 text-rose-500";
  if (status === "pending") return "bg-amber-500/15 text-amber-500";
  return "bg-muted text-muted-foreground";
}

export function AdminPaymentsView() {
  const { user } = useAppStore();
  const { t } = useI18n();
  const [status, setStatus] = useState<DaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof PAYOUT_TABS)[number]>("pending");
  const [payouts, setPayouts] = useState<AdminPayout[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("da");
    const error = params.get("daError");
    if (!connected && !error) return;
    if (connected === "connected") toast.success(t("adminPay.connectedToast"));
    if (error) toast.error(t(`adminPay.error.${error}`));
    params.delete("da");
    params.delete("daError");
    const search = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [t]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/donationalerts", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as DaStatus;
        if (active) setStatus(data);
      } catch {
        /* keep last snapshot */
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/payouts?status=${tab}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (active && res.ok) setPayouts((data?.requests || []) as AdminPayout[]);
      } catch {
        /* keep last snapshot */
      } finally {
        if (active) setPayoutsLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [isAdmin, tab]);

  async function refreshStatus() {
    const res = await fetch("/api/admin/donationalerts", { cache: "no-store" });
    if (res.ok) setStatus((await res.json()) as DaStatus);
  }

  async function disconnect() {
    if (!window.confirm(t("adminPay.disconnectConfirm"))) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/donationalerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      if (!res.ok) {
        toast.error(t("adminPay.error.generic"));
        return;
      }
      toast.success(t("adminPay.disconnectedToast"));
      await refreshStatus();
    } finally {
      setDisconnecting(false);
    }
  }

  async function processPayout(id: string, action: "paid" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/payouts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: notes[id] || undefined }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(t(`payouts.error.${payload?.error}`) === `payouts.error.${payload?.error}` ? t("payouts.error.generic") : t(`payouts.error.${payload?.error}`));
        return;
      }
      toast.success(action === "paid" ? t("adminPay.paidToast") : t("adminPay.rejectedToast"));
      setNotes((current) => ({ ...current, [id]: "" }));
      const res2 = await fetch(`/api/admin/payouts?status=${tab}`, { cache: "no-store" });
      if (res2.ok) {
        const data = await res2.json();
        setPayouts((data?.requests || []) as AdminPayout[]);
      }
      await refreshStatus();
    } catch {
      toast.error(t("payouts.error.generic"));
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-[720px] mx-auto px-4 sm:px-8 py-10">
        <div className="glass rounded-3xl p-8 text-center space-y-3">
          <ShieldAlert className="w-10 h-10 mx-auto text-rose-500" />
          <h1 className="text-xl font-black">{t("adminPay.forbidden")}</h1>
        </div>
      </div>
    );
  }

  const configured = status?.configured;
  const allConfigured = Boolean(
    configured?.clientId && configured?.clientSecret && configured?.tokenKey && configured?.ingestSecret
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 pb-10 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
          <CreditCard className="w-7 h-7 text-primary" /> {t("adminPay.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("adminPay.subtitle")}</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="glass rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold flex items-center gap-2">
              <Link2 className="w-4.5 h-4.5 text-primary" /> DonationAlerts
            </h2>
            <span
              className={cn(
                "text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full",
                status?.connected ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"
              )}
            >
              {status?.connected ? t("adminPay.connected") : t("adminPay.notConnected")}
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {ENV_ROWS.map(([key, envName]) => (
                  <div key={key} className="flex items-center justify-between gap-2 rounded-lg border bg-card/40 px-2.5 py-2">
                    <span className="font-mono text-[10px] truncate">{envName}</span>
                    {configured?.[key] ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                  </div>
                ))}
              </div>

              {!allConfigured && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-600 dark:text-amber-400 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{t("adminPay.envHint")}</span>
                </div>
              )}

              {status?.account ? (
                <div className="rounded-xl border bg-card/40 p-3 text-xs space-y-1">
                  <p className="font-bold">
                    {status.account.daUserName || `ID ${status.account.daUserId}`}
                    <span className="text-muted-foreground font-mono ml-2">#{status.account.daUserId}</span>
                  </p>
                  <p className="text-muted-foreground">{t("adminPay.connectedAt", { when: timeAgo(status.account.connectedAt) })}</p>
                  <p className="text-muted-foreground">{t("adminPay.currency", { currency: configured?.currency || "RUB" })}</p>
                </div>
              ) : null}

              <div className="flex gap-2">
                {allConfigured && !status?.connected && (
                  <a href="/api/admin/donationalerts/connect" className="flex-1">
                    <Button className="w-full rounded-xl brand-gradient text-white font-bold">
                      <Link2 className="w-4 h-4" /> {t("adminPay.connect")}
                    </Button>
                  </a>
                )}
                {status?.connected && (
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    disabled={disconnecting}
                    onClick={disconnect}
                  >
                    {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                    {t("adminPay.disconnect")}
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="rounded-xl shrink-0" onClick={refreshStatus} aria-label={t("adminPay.refresh")}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="glass rounded-3xl p-5 sm:p-6 space-y-3">
          <h2 className="font-bold flex items-center gap-2">
            <Banknote className="w-4.5 h-4.5 text-primary" /> {t("adminPay.payoutQueue")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border bg-card/40 p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">{t("adminPay.pendingCount")}</p>
              <p className="text-3xl font-black tabular-nums text-amber-500">{status?.payoutQueue.count ?? 0}</p>
            </div>
            <div className="rounded-2xl border bg-card/40 p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">{t("adminPay.pendingAmount")}</p>
              <p className="text-xl font-black tabular-nums">
                {formatMoney(status?.payoutQueue.amountMinor ?? 0, configured?.currency || "RUB")}
              </p>
              <p className="text-[11px] text-muted-foreground">{formatCredits(status?.payoutQueue.credits ?? 0)} {t("credits.credits")}</p>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{t("adminPay.payoutHint")}</p>
        </div>
      </div>

      <div className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-bold flex items-center gap-2 mb-4">
          <History className="w-4.5 h-4.5 text-primary" /> {t("adminPay.unmatchedTitle")}
        </h2>
        {status && status.events.length > 0 ? (
          <div className="space-y-2">
            {status.events.map((event) => (
              <div key={event.donationId} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border bg-card/40 text-xs">
                <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full w-fit", statusClass(event.status))}>
                  {t(`adminPay.donationStatus.${event.status}`)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold">
                    {event.donorName || "—"} · {formatMoney(event.amountMinor, event.currency)}
                    <span className="font-mono text-muted-foreground ml-2">#{event.donationId}</span>
                  </p>
                  {event.message && <p className="text-muted-foreground truncate">“{event.message}”</p>}
                  {event.reason && <p className="text-muted-foreground truncate">{event.reason}</p>}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(event.receivedAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">{t("adminPay.unmatchedEmpty")}</p>
        )}
      </div>

      <div className="glass rounded-3xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="font-bold flex items-center gap-2 mr-auto">
            <Banknote className="w-4.5 h-4.5 text-primary" /> {t("adminPay.payoutsTitle")}
          </h2>
          {PAYOUT_TABS.map((value) => (
            <Button
              key={value}
              size="sm"
              variant={tab === value ? "default" : "outline"}
              className="rounded-full h-8 text-[11px]"
              onClick={() => {
                if (value === tab) return;
                setTab(value);
                setPayoutsLoading(true);
              }}
            >
              {t(`payouts.status.${value === "all" ? "all" : value}`)}
            </Button>
          ))}
        </div>

        {payoutsLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : payouts.length > 0 ? (
          <div className="space-y-2">
            {payouts.map((payout) => (
              <div key={payout.id} className="rounded-xl border bg-card/40 p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">
                      {payout.user.displayName || `@${payout.user.username}`}
                      <span className="text-[11px] text-muted-foreground font-normal ml-2">{payout.user.email}</span>
                    </p>
                    <p className="text-xs">
                      <strong>{formatCredits(payout.credits)}</strong> {t("credits.credits")} → <strong>{formatMoney(payout.amountMinor, payout.currency)}</strong>
                      <span className="text-muted-foreground ml-2">{t(`payouts.method.${payout.method}`)}</span>
                    </p>
                    <p className="text-[11px] font-mono break-all text-muted-foreground">{payout.details}</p>
                    {payout.adminNote && <p className="text-[11px] text-muted-foreground">“{payout.adminNote}”</p>}
                  </div>
                  <div className="flex items-center gap-2 sm:shrink-0">
                    <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full", statusClass(payout.status))}>
                      {t(`payouts.status.${payout.status}`)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(payout.createdAt)}</span>
                  </div>
                </div>
                {payout.status === "pending" && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={notes[payout.id] || ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [payout.id]: event.target.value }))}
                      placeholder={t("adminPay.notePlaceholder")}
                      maxLength={300}
                      className="rounded-lg h-9 text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      className="rounded-lg h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                      disabled={busyId === payout.id}
                      onClick={() => processPayout(payout.id, "paid")}
                    >
                      {busyId === payout.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      {t("adminPay.markPaid")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-9 text-xs border-rose-500/40 text-rose-500 hover:text-rose-500"
                      disabled={busyId === payout.id}
                      onClick={() => processPayout(payout.id, "reject")}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {t("adminPay.reject")}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">{t("adminPay.noRequests")}</p>
        )}
      </div>
    </div>
  );
}
