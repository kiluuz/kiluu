"use client";

import { useState } from "react";
import { Loader2, Clapperboard, Swords, Check, Eye, Sparkles, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "./store";
import { Logo } from "./logo";
import { toast } from "sonner";
import { ANIME_GENRES } from "@/lib/anime-preferences";
import { normalizeDisplayName } from "@/lib/display-name";

/** One-time onboarding: choose Creator or Viewer */
export function Onboarding() {
  const { user, updateUser } = useAppStore();
  const [choice, setChoice] = useState<"CREATOR" | "VIEWER" | null>(null);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(user?.favoriteGenres ?? []);
  const [handle, setHandle] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || "");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"genres" | "role" | "name">("genres");

  if (!user || (user.onboardingDone && user.favoriteGenres.length > 0)) return null;
  const activeStep = step === "genres" && user.favoriteGenres.length > 0
    ? user.onboardingDone ? "genres" : "role"
    : step;

  async function saveFavoriteGenres() {
    const selected = [...new Set([...user!.favoriteGenres, ...favoriteGenres])];
    if (selected.length === 0) {
      toast.error("Choose at least one anime genre");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favoriteGenres: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to save your anime preferences");
        return;
      }
      updateUser({ ...user!, ...data.user });
      if (!user!.onboardingDone) setStep("role");
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function finish(role: "CREATOR" | "VIEWER") {
    const normalizedName = normalizeDisplayName(displayName);
    const cleanHandle = handle.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanHandle)) {
      toast.error("Username must be 3-20 characters: lowercase letters, numbers or underscore");
      return;
    }
    if (!normalizedName) {
      toast.error("Display name must be 2-20 characters");
      return;
    }
    setSaving(true);
    try {
      const payload = role === "CREATOR"
        ? { role, teamUsername: cleanHandle, teamDisplayName: normalizedName }
        : { role, username: cleanHandle, displayName: normalizedName };
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const messages: Record<string, string> = {
          INVALID_HANDLE: "Username must be 3-20 characters: lowercase letters, numbers or underscore",
          HANDLE_RESERVED: "That username is reserved — pick another one",
          HANDLE_TAKEN: "That username is already taken",
          TEAM_HANDLE_TAKEN: "That team username is already taken",
          INVALID_TEAM_NAME: "Team display name must be 2-20 characters",
        };
        toast.error(messages[data.code] || data.error || "Failed to save");
        return;
      }
      updateUser({ ...user!, ...data.user });
      toast.success(role === "CREATOR" ? "Team account created! Your Creator Studio is ready." : "You're all set. Enjoy the show!");
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
          {activeStep === "genres" ? (
            <p className="text-muted-foreground mt-2 text-sm">
              What types of anime do you like?
              <br />
              <span className="text-xs opacity-70">Choose all that apply to personalize your home page.</span>
            </p>
          ) : activeStep === "role" ? (
            <p className="text-muted-foreground mt-2 text-sm">
              One quick thing — how will you use Kiluu?
              <br />
              <span className="text-xs opacity-70">(You choose this only once)</span>
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 text-sm">
              {choice === "CREATOR"
                ? "Pick your team username and display name — this becomes your public creator account"
                : "Pick your username and display name — others will see them on your profile"}
            </p>
          )}
        </div>

        {activeStep === "genres" ? (
          <div className="rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4 text-sm font-semibold">
              <Sparkles className="w-4 h-4 text-primary" />
              Choose your favorite genres
              <span className="ml-auto text-xs text-muted-foreground">{favoriteGenres.length} selected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {ANIME_GENRES.map((genre) => {
                const selected = favoriteGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => setFavoriteGenres((genres) =>
                      selected ? genres.filter((item) => item !== genre) : [...genres, genre]
                    )}
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                      selected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
            <Button
              disabled={saving || favoriteGenres.length === 0}
              onClick={saveFavoriteGenres}
              className="w-full mt-5 h-12 rounded-xl font-bold brand-gradient hover:opacity-90 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
            </Button>
          </div>
        ) : activeStep === "role" ? (
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
                  <li className="flex items-center gap-1.5"><Check className="w-3 h-3" /> One team account for your studio</li>
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
            <div className="space-y-1.5 mb-4">
              <Label htmlFor="ob-handle" className="text-xs font-semibold">
                {choice === "CREATOR" ? "Team username" : "Username"}
              </Label>
              <div className="relative">
                <AtSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ob-handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  maxLength={20}
                  autoComplete="off"
                  placeholder={choice === "CREATOR" ? "your_team" : "your_name"}
                  className="pl-9 h-12 rounded-xl text-base"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                3–20 characters · lowercase letters, numbers and underscore
              </p>
            </div>
            <div className="space-y-1.5 mb-5">
              <Label htmlFor="ob-name" className="text-xs font-semibold">
                {choice === "CREATOR" ? "Team display name" : "Display name"}
              </Label>
              <div className="relative">
                <Eye className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ob-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ""))}
                  maxLength={20}
                  placeholder={choice === "CREATOR" ? "Your team name" : "How others see you"}
                  className="pl-9 h-12 rounded-xl text-base"
                />
              </div>
              <p className="mt-1 text-right text-[10px] text-muted-foreground">{[...displayName].length}/20</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("role")} className="h-11 rounded-xl">
                Back
              </Button>
              <Button
                disabled={saving || !displayName.trim() || handle.length < 3}
                onClick={() => finish(choice!)}
                className="flex-1 h-11 rounded-xl font-bold brand-gradient hover:opacity-90 text-white"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : choice === "CREATOR" ? (
                  "Create team account"
                ) : (
                  "Enter Kiluu"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
