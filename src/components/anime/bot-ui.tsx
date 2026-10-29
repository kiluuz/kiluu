"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ExternalLink, Link2, Send, Star, CheckCircle2, Coins, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { BotAnime } from "./bot-hooks";

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US").format(price) + " UZS";
}

// ─── Telegram Link Widget ────────────────────────────────────────────────────

export function TelegramLinkWidget({ onLinked }: { onLinked: () => void }) {
  const [linking, setLinking] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [startCommand, setStartCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const maxPollTime = 2 * 60 * 1000; // 2 minutes

  async function startLinking() {
    setLinking(true);
    try {
      const res = await fetch("/api/bot/link-token", { method: "POST" });
      if (!res.ok) throw new Error("Could not get a link token");
      const data = await res.json();
      setLinkUrl(data.link);

      try {
        const parsed = new URL(data.link);
        const start = parsed.searchParams.get("start");
        if (start) {
          setStartCommand(`/start ${start}`);
        }
      } catch {}
      
      // Convert https://t.me/BotName?start=xxx → tg://resolve?domain=BotName&start=xxx
      // This opens the native Telegram app directly instead of web
      const tgDeepLink = convertToTgDeepLink(data.link);
      
      // Try native app first via tg:// protocol
      window.location.assign(tgDeepLink);
      
      // Fallback: if app isn't installed, open web version after a short delay
      setTimeout(() => {
        // Only open web fallback if the page is still visible (app didn't open)
        if (!document.hidden) {
          window.open(data.link, "_blank");
        }
      }, 1500);
      
      startPolling();
    } catch (e: any) {
      toast.error("Could not get the Telegram link");
    } finally {
      setLinking(false);
    }
  }

  /** Convert https://t.me/BotName?start=TOKEN → tg://resolve?domain=BotName&start=TOKEN */
  function convertToTgDeepLink(url: string): string {
    try {
      const parsed = new URL(url);
      // pathname = /BotName
      const domain = parsed.pathname.replace(/^\//, "");
      const start = parsed.searchParams.get("start");
      if (domain && start) {
        return `tg://resolve?domain=${encodeURIComponent(domain)}&start=${encodeURIComponent(start)}`;
      }
    } catch {}
    return url;
  }


  function startPolling() {
    setPolling(true);
    const startTime = Date.now();

    pollRef.current = setInterval(async () => {
      if (Date.now() - startTime > maxPollTime) {
        stopPolling();
        toast.error("Telegram linking expired. Please try again.");
        return;
      }
      try {
        const res = await fetch("/api/bot/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.linked) {
          stopPolling();
          // Deliver all purchased animes now that Telegram is linked
          try {
            const deliverRes = await fetch("/api/bot/deliver-purchases", { method: "POST" });
            const deliverData = await deliverRes.json();
            if (deliverData.delivered > 0) {
              toast.success(`✅ ${deliverData.delivered} anime added to your bot library!`);
            } else if (deliverData.total > 0) {
              toast.error(deliverData.error || "Could not sync purchases to the bot. Please try again.");
            }
          } catch {
            // Delivery failure is non-fatal — user can still use the app
          }
          onLinked();
        }
      } catch {}
    }, 2500);
  }


  function stopPolling() {
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (polling) {
    const tgDeepLink = linkUrl ? convertToTgDeepLink(linkUrl) : null;
    return (
      <div className="flex flex-col gap-3 p-4 rounded-2xl border border-blue-500/30 bg-blue-500/5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
          <div>
            <p className="font-bold text-sm">Waiting for Telegram connection...</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap <strong>/start</strong> in Telegram or send the command below.
            </p>
          </div>
        </div>

        {tgDeepLink && (
          <div className="flex gap-2">
            <a
              href={tgDeepLink}
              className="flex-1"
            >
              <Button size="sm" className="rounded-xl gap-1.5 w-full brand-gradient text-white font-bold">
                <Send className="w-3.5 h-3.5" /> Telegram ilovasida ochish
              </Button>
            </a>
            {linkUrl && (
              <a href={linkUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5 px-3" title="Brauzerda ochish">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            )}
          </div>
        )}

        {startCommand && (
          <div className="p-3 rounded-xl bg-background/80 border border-border/60 space-y-2 mt-1">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Send this message in the chat:</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(startCommand);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                  toast.success("Copied! Send it to the Telegram bot chat.");
                }}
                className="h-6 px-2 text-[11px] gap-1 text-primary hover:text-primary"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div
              onClick={() => {
                navigator.clipboard.writeText(startCommand);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                toast.success("Copied! Send it to the Telegram bot chat.");
              }}
              className="cursor-pointer group flex items-center justify-between bg-secondary/80 hover:bg-secondary p-2.5 rounded-lg border border-border/40 transition"
            >
              <code className="text-xs font-mono text-primary font-bold select-all break-all">
                {startCommand}
              </code>
              <Copy className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 ml-2" />
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              💡 Send this command in the Telegram chat and your account will be linked automatically.
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={linking}
          onClick={() => {
            stopPolling();
            setLinkUrl(null);
            setStartCommand(null);
            void startLinking();
          }}
          className="rounded-xl w-full"
        >
          {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Link expired? Get a new one
        </Button>
      </div>
    );
  }


  return (
    <div className="p-4 rounded-2xl border bg-secondary/30 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Link2 className="w-4 h-4" />
        </div>
        <div>
          <p className="font-bold text-sm">Connect your Telegram account</p>
          <p className="text-xs text-muted-foreground">Purchased anime is delivered through the bot</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground bg-background/60 p-2.5 rounded-xl border border-border/50">
        ⚡ Tap the button to open <strong>Telegram</strong>, then tap <strong>/start</strong>. The site and bot will link automatically.
      </p>
      <Button
        onClick={startLinking}
        disabled={linking}
        className="rounded-xl w-full gap-2 brand-gradient text-white font-bold h-11 shadow-md shadow-primary/20"
      >
        {linking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {linking ? "Ochilmoqda..." : "Telegram ilovasini ochish"}
      </Button>
    </div>
  );
}

// ─── Link Telegram Modal (Standalone) ────────────────────────────────────────

export function LinkTelegramModal({
  open,
  onClose,
  onLinked,
  animeTitle,
}: {
  open: boolean;
  onClose: () => void;
  onLinked?: () => void;
  animeTitle?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 text-primary">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black leading-tight">Connect your Telegram account</h2>
            <p className="text-sm text-muted-foreground">{animeTitle || "Kiluu Bot"}</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4 p-3 rounded-xl bg-secondary/40 border border-border/50">
          Your purchased anime is delivered through the Telegram bot. You only need to link your account <strong>once</strong>.
        </p>
        <TelegramLinkWidget
          onLinked={() => {
            toast.success("Telegram account connected! ✅");
            onLinked?.();
            onClose();
          }}
        />
        <Button variant="ghost" className="w-full mt-3 text-muted-foreground text-sm" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}


// ─── Credit Purchase Modal ────────────────────────────────────────────────────

type CreditStep = "confirm" | "buying" | "link_telegram" | "done";

interface CreditPurchaseProps {
  animeSlug: string;
  animeTitle: string;
  price: number; // credits
  userCredits: number;
  botLinked: boolean | null; // null = unknown
  versionId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreditPurchaseModal({
  animeSlug,
  animeTitle,
  price,
  userCredits,
  botLinked,
  versionId,
  onClose,
  onSuccess,
}: CreditPurchaseProps) {
  const [step, setStep] = useState<CreditStep>("confirm");
  const [error, setError] = useState<string | null>(null);

  const enough = userCredits >= price;

  async function handleBuy() {
    setError(null);
    setStep("buying");
    try {
      const res = await fetch(`/api/animes/${animeSlug}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Purchase failed");
        setStep("confirm");
        return;
      }
      // Purchase OK. If not linked to bot, show link widget so they can receive it
      if (!botLinked) {
        setStep("link_telegram");
      } else {
        setStep("done");
        setTimeout(onSuccess, 1400);
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("confirm");
    }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md glass-strong rounded-3xl p-7 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300 flex flex-col items-center text-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center animate-in zoom-in-50 duration-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-black mb-1">Purchase successful! 🎉</h2>
            <p className="text-sm text-muted-foreground">
              {animeTitle} has been added to your library.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Link Telegram step (after successful purchase) ────────────────────────
  if (step === "link_telegram") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight">Purchase complete! ✅</h2>
              <p className="text-sm text-muted-foreground">{animeTitle}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4 p-3 rounded-xl bg-secondary/40 border border-border/50">
            Link your account to receive anime through the Telegram bot. You only need to do this once.
          </p>
          <TelegramLinkWidget
            onLinked={() => {
              toast.success("Telegram connected! Sending anime to the bot...");
              setStep("done");
              setTimeout(onSuccess, 1200);
            }}
          />
          <Button
            variant="ghost"
            className="w-full mt-3 text-muted-foreground text-sm"
            onClick={() => { onSuccess(); }}
          >
            Connect later
          </Button>
        </div>
      </div>
    );
  }

  // ── Confirm / buying step ─────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black leading-tight">Purchase</h2>
            <p className="text-sm text-muted-foreground">{animeTitle}</p>
          </div>
        </div>

        {/* Price row */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/50 mb-4">
          <span className="text-sm font-semibold text-muted-foreground">Price</span>
          <span className="text-2xl font-black text-primary flex items-center gap-1">
            <Coins className="w-5 h-5" /> {price.toLocaleString()} credits
          </span>
        </div>

        {/* Balance row */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-secondary/30 mb-5 text-sm">
          <span className="text-muted-foreground font-medium">Your balance</span>
          <span className={cn("font-black", enough ? "text-emerald-400" : "text-rose-400")}>
            {userCredits.toLocaleString()} credits
          </span>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-rose-400 mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            {error}
          </p>
        )}

        {/* Not enough credits note */}
        {!enough && !error && (
          <p className="text-sm text-amber-400 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            Not enough credits. You need {(price - userCredits).toLocaleString()} more.
          </p>
        )}

        {/* Info */}
        <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/20 mb-5 space-y-1">
          <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> How it works
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
            <li>Deducted from your credit balance</li>
            <li>Anime will be sent to your Telegram bot</li>
            <li>One payment unlocks all episodes</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-2xl"
            onClick={onClose}
            disabled={step === "buying"}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 rounded-2xl brand-gradient text-white font-bold gap-2"
            disabled={!enough || step === "buying"}
            onClick={handleBuy}
          >
            {step === "buying" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Coins className="w-4 h-4" />
            )}
            {step === "buying" ? "Processing..." : "Buy with credits"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Payment Modal (Telegram Stars) ─────────────────────────────────────────

type PaymentStep = "confirm" | "needs_link" | "waiting" | "pending_link" | "done";

export function PaymentModal({
  anime,
  onClose,
  onSuccess,
}: {
  anime: BotAnime;
  onClose: () => void;
  onSuccess: (pendingLink: boolean) => void;
}) {
  const [step, setStep] = useState<PaymentStep>("confirm");
  const [loading, setLoading] = useState(false);
  const [invoiceLink, setInvoiceLink] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function handlePay() {
    setLoading(true);
    try {
      // Step 1: Create order and get Stars invoice link from bot
      const checkoutRes = await fetch("/api/bot/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anime_slug: anime.slug }),
      });
      const checkout = await checkoutRes.json();

      // If user not linked → show link widget inside modal (no error toast)
      if (!checkoutRes.ok && checkout.needsLink) {
        setStep("needs_link");
        setLoading(false);
        return;
      }

      if (!checkoutRes.ok) throw new Error(checkout.error || "Checkout failed");

      setOrderId(checkout.orderId);
      setInvoiceLink(checkout.invoiceLink);

      // Step 2: Open the Telegram Stars invoice in Telegram
      window.open(checkout.invoiceLink, "_blank");

      // Step 3: Poll for order completion (bot webhook will update DB)
      setStep("waiting");
      startPolling(checkout.orderId);
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  function startPolling(oid: string) {
    const start = Date.now();
    const MAX = 10 * 60 * 1000; // 10 minutes

    pollRef.current = setInterval(async () => {
      if (Date.now() - start > MAX) {
        clearInterval(pollRef.current!);
        toast.error("Payment timed out. If you completed the payment, refresh the page.");
        onClose();
        return;
      }

      try {
        const res = await fetch("/api/bot/order-status?orderId=" + oid);
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "COMPLETED") {
          clearInterval(pollRef.current!);
          setStep("done");
          setTimeout(() => onSuccess(false), 1500);
        } else if (data.status === "PAID_PENDING_GRANT") {
          // Payment done, grant in progress or pending link
          clearInterval(pollRef.current!);
          if (data.linked === false) {
            setStep("pending_link");
          } else {
            setStep("done");
            setTimeout(() => onSuccess(false), 1500);
          }
        }
      } catch {}
    }, 3000);
  }

  // ── Needs Link step ───────────────────────────────────────────────────────
  if (step === "needs_link") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Send className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight">Avval Telegramni ulang</h2>
              <p className="text-sm text-muted-foreground">{anime.title}</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4 p-3 rounded-xl bg-secondary/40 border border-border/50">
            Link your site and bot <strong>once</strong> to receive anime through Telegram. It only takes a few seconds.
          </p>
          <TelegramLinkWidget
            onLinked={() => {
              toast.success("Telegram connected! You can continue to payment.");
              setStep("confirm");
            }}
          />
          <Button variant="ghost" className="w-full mt-3 text-muted-foreground text-sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ── Confirm step ──────────────────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-yellow-500/15 flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-black leading-tight">Telegram Stars</h2>
              <p className="text-sm text-muted-foreground">{anime.title}</p>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary/50 mb-5">
            <span className="text-sm font-semibold text-muted-foreground">Price</span>
            <span className="text-2xl font-black text-primary">{formatPrice(anime.price)}</span>
          </div>

          {/* Info */}
          <div className="p-3 rounded-xl bg-blue-500/8 border border-blue-500/20 mb-5 space-y-1.5">
            <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-current" />
              Telegram Stars haqida
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 ml-5 list-disc">
              <li>To'lov Telegram orqali amalga oshiriladi</li>
              <li>Anime is sent directly to your bot</li>
              <li>One payment unlocks all episodes</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 rounded-2xl brand-gradient text-white font-bold gap-2"
              disabled={loading}
              onClick={handlePay}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Star className="w-4 h-4 fill-current" />
              )}
              Telegram orqali to'lash
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting for payment step ───────────────────────────────────────────────
  if (step === "waiting") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-black mb-1">Waiting for payment...</h2>
              <p className="text-sm text-muted-foreground">
                Telegram orqali Stars to'lovini amalga oshiring.
                <br />This page will update automatically after payment.
              </p>
            </div>
            {invoiceLink && (
              <a href={invoiceLink} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="outline" className="w-full rounded-2xl gap-2">
                  <ExternalLink className="w-4 h-4" />
                  Open in Telegram
                </Button>
              </a>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending link step ─────────────────────────────────────────────────────
  if (step === "pending_link") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
          <h2 className="text-xl font-black mb-2">Payment successful! ✅</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Connect your Telegram account to receive anime. Once linked, anime is sent to your bot automatically.
          </p>
          <TelegramLinkWidget
            onLinked={() => {
              setStep("done");
              setTimeout(() => onSuccess(false), 1000);
            }}
          />
          <Button variant="ghost" className="w-full mt-3 text-muted-foreground" onClick={() => onSuccess(true)}>
            Connect later
          </Button>
        </div>
      </div>
    );
  }

  // ── Done step ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center animate-in zoom-in-50 duration-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-xl font-black mb-1">Purchase successful! 🎉</h2>
            <p className="text-sm text-muted-foreground">
              Sending anime to your Telegram bot...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
