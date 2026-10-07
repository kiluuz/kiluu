"use client";

import { useState } from "react";
import { Sparkles, Loader2, Eye, Mail, Lock, User, Clapperboard, Swords, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "./store";
import type { AuthUser } from "./types";
import { toast } from "sonner";

export function AuthModal() {
  const { authOpen, setAuthOpen, setUser } = useAppStore();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(mode: "login" | "register", e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload: Record<string, string> = {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };
    if (mode === "register") {
      payload.username = String(form.get("username") || "");
      if (payload.password !== String(form.get("confirm") || "")) {
        toast.error("Passwords do not match");
        setLoading(false);
        return;
      }
    }
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Something went wrong");
        return;
      }
      setUser(data.user as AuthUser);
      setAuthOpen(false);
      toast.success(mode === "login" ? `Welcome back, ${data.user.displayName || data.user.username}!` : "Account created! Welcome to AniVerse ✦");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={authOpen} onOpenChange={setAuthOpen}>
      <DialogContent className="sm:max-w-[440px] rounded-2xl p-0 overflow-hidden border-primary/20">
        <div className="aurora absolute inset-0 pointer-events-none" />
        <div className="relative p-6 pt-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl brand-gradient flex items-center justify-center shadow-xl shadow-primary/30 mb-3">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <DialogTitle className="text-2xl font-black">
              Welcome to <span className="gradient-text">AniVerse</span>
            </DialogTitle>
            <DialogDescription className="text-sm mt-1">
              Stream, collect and exchange premium anime
            </DialogDescription>
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid grid-cols-2 w-full mb-5 rounded-xl">
              <TabsTrigger value="login" className="rounded-lg">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={(e) => handleSubmit("login", e)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email" className="text-xs font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-email" name="email" type="email" required placeholder="you@example.com" className="pl-9 h-11 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-pass" className="text-xs font-semibold">Password</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-pass" name="password" type="password" required placeholder="••••••••" className="pl-9 h-11 rounded-xl" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl brand-gradient hover:opacity-90 text-white font-bold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
                </Button>
                <p className="text-[11px] text-center text-muted-foreground">
                  New here? You get <span className="text-amber-500 font-bold">100 free credits</span> when you register
                </p>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={(e) => handleSubmit("register", e)} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-username" className="text-xs font-semibold">Username</Label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-username" name="username" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" placeholder="coolotaku_7" className="pl-9 h-11 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email" className="text-xs font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input id="reg-email" name="email" type="email" required placeholder="you@example.com" className="pl-9 h-11 rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pass" className="text-xs font-semibold">Password</Label>
                    <Input id="reg-pass" name="password" type="password" required minLength={6} placeholder="min 6 chars" className="h-11 rounded-xl" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-confirm" className="text-xs font-semibold">Confirm</Label>
                    <Input id="reg-confirm" name="confirm" type="password" required minLength={6} placeholder="repeat" className="h-11 rounded-xl" />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl brand-gradient hover:opacity-90 text-white font-bold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
          <div className="w-16 h-16 mx-auto rounded-2xl brand-gradient flex items-center justify-center shadow-2xl shadow-primary/40 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black">
            Welcome to <span className="gradient-text">AniVerse</span>
          </h1>
          {step === "role" ? (
            <p className="text-muted-foreground mt-2 text-sm">
              One quick thing — how will you use AniVerse?
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
                  Watch, collect and exchange animes. Build your library, join watch parties and make friends.
                </p>
                <ul className={`mt-3 space-y-1 text-[11px] ${choice === "VIEWER" ? "text-white/80" : "text-muted-foreground"}`}>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Full streaming access</li>
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> Collect & exchange animes</li>
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
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : `Enter AniVerse as ${choice === "CREATOR" ? "Creator" : "Viewer"}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
