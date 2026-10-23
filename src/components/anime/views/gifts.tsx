"use client";

import { useEffect, useState } from "react";
import { Gift, Loader2, Check, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore } from "../store";
import { SmartImage, formatCredits, timeAgo } from "../ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";

interface GiftRow {
  id: string;
  status: string;
  message: string | null;
  pricePaid: number;
  expiresAt: string;
  createdAt: string;
  incoming: boolean;
  recipientUsername: string;
  anime: { id: string; slug: string; title: string; coverImage: string | null };
  sender: { username: string; displayName: string | null; avatarUrl: string | null };
}

const GIFT_STATUS_KEYS: Record<string, string> = {
  PENDING: "gifts.status.pending",
  CLAIMED: "gifts.status.claimed",
  DECLINED: "gifts.status.declined",
  EXPIRED: "gifts.status.expired",
  REFUNDED: "gifts.status.refunded",
};

export function GiftsView() {
  const { t } = useI18n();
  const { user, setAuthOpen, navigate, updateUser } = useAppStore();
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [animeId, setAnimeId] = useState("");
  const [catalog, setCatalog] = useState<Array<{ id: string; title: string; price: number }>>([]);
  const [sending, setSending] = useState(false);

  const load = () => {
    fetch("/api/gifts")
      .then((r) => r.json())
      .then((d) => setGifts(d.gifts || []))
      .catch(() => toast.error(t("gifts.loadError")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    load();
    fetch("/api/animes?limit=40")
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : d.animes || d.items || [];
        setCatalog(
          list
            .filter((a: { price?: number; isFree?: boolean }) => !a.isFree && (a.price || 0) > 0)
            .map((a: { id: string; title: string; price: number }) => ({
              id: a.id,
              title: a.title,
              price: a.price,
            }))
        );
      })
      .catch(() => {});
  }, [user]);

  async function send() {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (!username.trim() || !animeId) {
      toast.error(t("gifts.chooseRecipientAndAnime"));
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/gifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), animeId }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || t("gifts.sendError"));
        return;
      }
      if (typeof d.credits === "number") updateUser({ credits: d.credits });
      toast.success(t("gifts.sent"));
      setUsername("");
      load();
    } catch {
      toast.error(t("gifts.networkError"));
    } finally {
      setSending(false);
    }
  }

  async function act(id: string, action: "claim" | "decline") {
    try {
      const res = await fetch(`/api/gifts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error || t("gifts.actionError"));
        return;
      }
      toast.success(action === "claim" ? t("gifts.claimed") : t("gifts.declined"));
      load();
    } catch {
      toast.error(t("gifts.networkError"));
    }
  }

  if (!user) {
    return (
      <div className="max-w-[720px] mx-auto px-4 py-16 text-center">
        <Gift className="w-10 h-10 mx-auto mb-3 text-primary" />
        <p className="font-bold text-lg mb-2">{t("nav.gifts")}</p>
        <Button onClick={() => setAuthOpen(true)}>{t("signIn")}</Button>
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="sr-only">{t("nav.gifts")}</h1>
      <div className="glass rounded-2xl p-4 mb-8 space-y-3">
        <p className="text-sm font-bold">{t("gifts.send")}</p>
        <Input
          placeholder="@username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-xl"
        />
        <select
          value={animeId}
          onChange={(e) => setAnimeId(e.target.value)}
          className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
        >
          <option value="">{t("gifts.chooseAnime")}</option>
          {catalog.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title} — {formatCredits(a.price)} kr
            </option>
          ))}
        </select>
        <Button disabled={sending} onClick={send} className="rounded-xl brand-gradient text-white">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t("gifts.send")}
        </Button>
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin mx-auto" />
      ) : gifts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">{t("gifts.empty")}</p>
      ) : (
        <div className="space-y-3">
          {gifts.map((g) => (
            <div key={g.id} className="glass rounded-2xl p-3 flex gap-3 items-center">
              <button onClick={() => navigate("detail", { animeId: g.anime.slug })} className="shrink-0">
                <SmartImage src={g.anime.coverImage} alt={g.anime.title} className="w-12 h-16 object-cover rounded-lg" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{g.anime.title}</p>
                <p className="text-[11px] text-muted-foreground">
                  {g.incoming ? `${t("gifts.from")} @${g.sender.username}` : `${t("gifts.to")} @${g.recipientUsername}`} · {timeAgo(g.createdAt)}
                </p>
                <p className={cn("text-[11px] font-bold mt-0.5", g.status === "PENDING" ? "text-amber-500" : "text-muted-foreground")}>
                  {t(GIFT_STATUS_KEYS[g.status] ?? g.status)} · {formatCredits(g.pricePaid)} {t("home.credits")}
                </p>
              </div>
              {g.incoming && g.status === "PENDING" && (
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-8 rounded-lg" aria-label={t("gifts.claim")} onClick={() => act(g.id, "claim")}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg" aria-label={t("gifts.decline")} onClick={() => act(g.id, "decline")}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
