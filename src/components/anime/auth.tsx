"use client";

import { useState } from "react";
import { Loader2, Clapperboard, Swords, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "./store";
import { Logo } from "./logo";
import { toast } from "sonner";

/** One-time onboarding: choose Creator or Viewer */
export function Onboarding() {
  const { user, updateUser } = useAppStore();
  const [choice, setChoice] = useState<"CREATOR" | "VIEWER" | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || "");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"role" | "name">("role");

  if (!user || user.onboardingDone) return null;

  async function finish(role: "CREATOR" | "VIEWER") {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, displayName: displayName || user!.username }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save");
        return;
      }
      updateUser(data.user);
      toast.success(role === "CREATOR" ? "Creator mode unlocked! Publish your animes in the Studio." : "You're all set. Enjoy the show!");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto">
      <div className="aurora absolute inset-0 pointer-events-none" />
      <div className="relative w-full max-w-lg my-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4">
            <Logo variant="mark" size={64} animated />
          </div>
          <h1 className="text-3xl font-black">
            Welcome to <span className="gradient-text">Kiluu</span>
          </h1>
          {step === "role" ? (
            <p className="text-muted-foreground mt-2 text-sm">
              One quick thing — how will you use Kiluu?
              <br />
              <span className="text-xs opacity-70">(You choose this only once)</span>
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">Pick your display name — others will see this on your profile</p>
          )}
        </div>

        {step === "role" ? (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <button
                onClick={() => setChoice("CREATOR")}
                className={`group relative rounded-2xl border-2 p-6 text-left transition-all overflow-hidden ${
                  choice === "CREATOR"
                    ? "border-primary brand-gradient text-white shadow-xl shadow-primary/30"
                    : "border-border bg-card hover:border-primary/50 hover:-translate-y-1"
                }`}
                aria-pressed={choice === "CREATOR"}
              >
                <Clapperboard className="w-9 h-9 mb-3" />
                <h3 className="font-black text-lg">Creator</h3>
                <p className={`text-xs mt-1.5 leading-relaxed ${choice === "CREATOR" ? "text-white/85" : "text-muted-foreground"}`}>
                  Publish animes, add episodes, set prices and grow your audience. Earn from every purchase.
                </p>
                <ul className={`mt-3 space-y-1 text-[11px] ${choice === "CREATOR" ? "text-white/80" : "text-muted-foreground"}`}>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Publish unlimited animes</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Creator Studio dashboard</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Creator badge on profile</li>
                </ul>
                {choice === "CREATOR" && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
              </button>

              <button
                onClick={() => setChoice("VIEWER")}
                className={`group relative rounded-2xl border-2 p-6 text-left transition-all overflow-hidden ${
                  choice === "VIEWER"
                    ? "border-primary brand-gradient text-white shadow-xl shadow-primary/30"
                    : "border-border bg-card hover:border-primary/50 hover:-translate-y-1"
                }`}
                aria-pressed={choice === "VIEWER"}
              >
                <Swords className="w-9 h-9 mb-3" />
                <h3 className="font-black text-lg">Viewer</h3>
                <p className={`text-xs mt-1.5 leading-relaxed ${choice === "VIEWER" ? "text-white/85" : "text-muted-foreground"}`}>
                  Watch, collect and gift animes. Build your library, join watch parties and make friends.
                </p>
                <ul className={`mt-3 space-y-1 text-[11px] ${choice === "VIEWER" ? "text-white/80" : "text-muted-foreground"}`}>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Full streaming access</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Collect & gift animes</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Watch parties & community</li>
                </ul>
                {choice === "VIEWER" && (
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                )}
              </button>
            </div>
            <Button
              disabled={!choice}
              onClick={() => setStep("name")}
              className="w-full mt-5 h-12 rounded-xl font-bold brand-gradient hover:opacity-90 text-white"
            >
              Continue as {choice === "CREATOR" ? "Creator" : choice === "VIEWER" ? "Viewer" : "..."}
            </Button>
          </>
        ) : (
          <div className="rounded-2xl border bg-card p-6">
            <div className="space-y-1.5 mb-5">
              <Label htmlFor="ob-name" className="text-xs font-semibold">Display name</Label>
              <div className="relative">
                <Eye className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ob-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={32}
                  placeholder="How others see you"
                  className="pl-9 h-12 rounded-xl text-base"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("role")} className="h-11 rounded-xl">
                Back
              </Button>
              <Button
                disabled={saving || !displayName.trim()}
                onClick={() => finish(choice!)}
                className="flex-1 h-11 rounded-xl font-bold brand-gradient hover:opacity-90 text-white"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enter Kiluu as ${choice === "CREATOR" ? "Creator" : "Viewer"}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
