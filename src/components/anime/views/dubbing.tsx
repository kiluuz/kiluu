"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Clock3, Languages, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "../store";
import { toast } from "sonner";
import { useI18n } from "@/components/i18n-provider";

export function DubbingView() {
  const { user, navigate } = useAppStore();
  const { t } = useI18n();
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);
  const isJoined = Boolean(user && joined);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch("/api/dubbing/waitlist")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your waitlist status");
        return response.json();
      })
      .then((data: { joined?: boolean }) => {
        if (active) setJoined(Boolean(data.joined));
      })
      .catch((error: unknown) => {
        if (active) toast.error(error instanceof Error ? error.message : "Could not load your waitlist");
      })
    return () => { active = false; };
  }, [user?.id]);

  async function toggleWaitlist() {
    if (!user) {
      navigate("login");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/dubbing/waitlist", { method: isJoined ? "DELETE" : "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The request could not be completed");
      setJoined(Boolean(data.joined));
      toast.success(data.joined ? "You joined the waitlist" : "You left the waitlist");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The request could not be completed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-8">
      <h1 className="sr-only">{t("nav.dubbing")}</h1>
      <section className="relative overflow-hidden rounded-3xl border bg-card p-7 text-center shadow-xl sm:p-12">
        <div className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-600">
          <Clock3 className="h-3.5 w-3.5" /> {t("dubbing.soon")}
        </div>
        <div className="mx-auto mt-7 grid max-w-xl gap-3 text-left sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border bg-background/60 p-4">
            <Languages className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">{t("dubbing.uzbekOptions")}</span>
          </div>
          <div className="flex items-start gap-3 rounded-xl border bg-background/60 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">{t("dubbing.waitlistNote")}</span>
          </div>
        </div>
        <Button
          className="mt-8 min-w-56 rounded-full"
          onClick={() => void toggleWaitlist()}
          disabled={loading}
          variant={isJoined ? "outline" : "default"}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isJoined ? <Check className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
          {isJoined ? t("dubbing.leaveWaitlist") : t("dubbing.joinWaitlist")}
        </Button>
        {!user && <p className="mt-3 text-xs text-muted-foreground">{t("dubbing.signInHint")}</p>}
      </section>
    </div>
  );
}
