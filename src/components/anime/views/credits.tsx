"use client";

import { useEffect, useState } from "react";
import { Wallet, Zap, Gift, CreditCard, History, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppStore } from "../store";
import type { CreditPackage, CreditTx } from "../types";
import { formatCredits, timeAgo } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreditsData {
  packages: CreditPackage[];
  balance: number;
  transactions: CreditTx[];
}

const PAYMENT_METHODS = [
  { id: "card", label: "Card", icon: "💳", desc: "Visa, Mastercard" },
  { id: "paypal", label: "PayPal", icon: "🅿️", desc: "Fast checkout" },
  { id: "crypto", label: "Crypto", icon: "₿", desc: "BTC, ETH, USDT" },
];

export function CreditsView() {
  const { user, setAuthOpen, updateUser } = useAppStore();
  const [data, setData] = useState<CreditsData | null>(null);
  const [checkout, setCheckout] = useState<CreditPackage | null>(null);
  const [method, setMethod] = useState("card");
  const [processing, setProcessing] = useState(false);

  const load = () => {
    fetch("/api/credits")
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error("Failed to load credits data"));
  };

  useEffect(load, [user]);

  async function pay() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!checkout) return;
    setProcessing(true);
    // simulate payment processing
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: checkout.id, paymentMethod: method }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || "Payment failed");
        return;
      }
      updateUser({ credits: d.credits });
      toast.success(`${formatCredits(d.added)} credits added! 🎉`, {
        description: "Spend them on premium animes in Discover.",
      });
      setCheckout(null);
      load();
    } catch {
      toast.error("Network error");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-6 pb-10">
      {/* Header */}
      <div className="aurora relative overflow-hidden rounded-3xl border p-6 sm:p-10 mb-8">
        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-4xl font-black flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl brand-gradient flex items-center justify-center">
                <Wallet className="w-6 h-6 text-white" />
              </span>
              Get Credits
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-md">
              Credits are AniVerse currency. Use them to buy premium animes —
              and unlock the Exchange at <span className="font-bold text-foreground">20 purchases</span>.
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Your balance</p>
            <p className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent tabular-nums">
              {formatCredits(user?.credits ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">credits</p>
          </div>
        </div>
      </div>

      {/* Packages */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-10">
        {(data?.packages || []).map((pkg) => (
          <button
            key={pkg.id}
            onClick={() => (user ? setCheckout(pkg) : setAuthOpen(true))}
            className={cn(
              "relative rounded-3xl border p-5 text-left transition-all hover:-translate-y-1.5",
              pkg.popular
                ? "border-primary bg-gradient-to-b from-primary/15 to-transparent shadow-xl shadow-primary/15"
                : "bg-card hover:border-primary/50"
            )}
          >
            {pkg.popular && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 brand-gradient text-white text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full whitespace-nowrap">
                Most Popular
              </span>
            )}
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className={cn("w-5 h-5", pkg.popular ? "text-primary" : "text-amber-400")} />
              <span className="text-2xl font-black tabular-nums">{formatCredits(pkg.credits)}</span>
            </div>
            {pkg.bonus > 0 && (
              <p className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 inline-flex items-center gap-1 mb-2">
                <Gift className="w-3 h-3" /> +{formatCredits(pkg.bonus)} bonus
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">total {formatCredits(pkg.credits + pkg.bonus)}</p>
            <p className="text-lg font-black mt-2">${pkg.priceUsd.toFixed(2)}</p>
          </button>
        ))}
      </div>

      {/* Transaction history */}
      <div className="glass rounded-3xl p-5 sm:p-6">
        <h2 className="font-bold flex items-center gap-2 mb-4">
          <History className="w-4.5 h-4.5 text-primary" /> Transaction History
        </h2>
        {!user ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            <Button variant="link" onClick={() => setAuthOpen(true)} className="p-0 h-auto">Sign in</Button> to see your history
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
          <p className="text-sm text-muted-foreground text-center py-6">No transactions yet</p>
        )}
      </div>

      {/* Checkout dialog */}
      <Dialog open={Boolean(checkout)} onOpenChange={(open) => !processing && setCheckout(open ? checkout : null)}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Checkout
            </DialogTitle>
            <DialogDescription>Simulated payment — no real money involved</DialogDescription>
          </DialogHeader>
          {checkout && (
            <div className="space-y-5 pt-2">
              <div className="rounded-2xl border bg-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-black text-lg">{formatCredits(checkout.credits)} credits</p>
                  {checkout.bonus > 0 && (
                    <p className="text-xs text-emerald-500 font-bold">+{formatCredits(checkout.bonus)} bonus included</p>
                  )}
                </div>
                <p className="text-2xl font-black">${checkout.priceUsd.toFixed(2)}</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-semibold">Payment method</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        "rounded-xl border p-3 text-center transition",
                        method === m.id ? "border-primary bg-primary/10" : "hover:border-primary/40"
                      )}
                    >
                      <span className="text-xl block mb-1">{m.icon}</span>
                      <span className="text-[11px] font-bold block">{m.label}</span>
                      <span className="text-[9px] text-muted-foreground">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                disabled={processing}
                onClick={pay}
                className="w-full h-12 rounded-xl brand-gradient text-white font-bold text-base"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> Pay ${checkout.priceUsd.toFixed(2)}
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> This is a demo checkout — credits are granted instantly
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
