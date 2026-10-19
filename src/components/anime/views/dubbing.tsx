"use client";

import { useEffect, useState } from "react";
import { AudioLines, Bell, Check, Clock3, Languages, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "../store";
import { toast } from "sonner";

export function DubbingView() {
  const { user, navigate } = useAppStore();
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
      <section className="relative overflow-hidden rounded-3xl border bg-card p-7 text-center shadow-xl sm:p-12">
        <div className="absolute inset-x-0 top-0 h-1 brand-gradient" />
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <AudioLines className="h-8 w-8" />
        </div>
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-600">
          <Clock3 className="h-3.5 w-3.5" /> Soon
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">AI Dubbing</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          We are working on AI dubbing. Join the waitlist and we will notify you when it is available.
          Dubbing and credit charges are not available yet.
        </p>
        <div className="mx-auto mt-7 grid max-w-xl gap-3 text-left sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border bg-background/60 p-4">
            <Languages className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">Uzbek dubbing options will be announced when they are ready.</span>
          </div>
          <div className="flex items-start gap-3 rounded-xl border bg-background/60 p-4">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span className="text-sm text-muted-foreground">Joining the waitlist is free, and you can leave at any time.</span>
          </div>
        </div>
        <Button
          className="mt-8 min-w-56 rounded-full"
          onClick={() => void toggleWaitlist()}
          disabled={loading}
          variant={isJoined ? "outline" : "default"}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isJoined ? <Check className="mr-2 h-4 w-4" /> : <Bell className="mr-2 h-4 w-4" />}
          {isJoined ? "Leave waitlist" : "Join waitlist"}
        </Button>
        {!user && <p className="mt-3 text-xs text-muted-foreground">Sign in to join the waitlist.</p>}
      </section>
    </div>
  );
}
