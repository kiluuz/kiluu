"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAppStore } from "./store";
import { TopNav, MobileNav } from "./shell";
import { AuthModal, Onboarding } from "./auth";
import { ProfileModal } from "./profile-card";
import { HomeView } from "./views/home";
import { BrowseView } from "./views/browse";
import { DetailView } from "./views/detail";
import { WatchView } from "./views/watch";
import { LibraryView } from "./views/library";
import { CommunityView } from "./views/community";
import { WatchTogetherView } from "./views/watch-together";
import { CreditsView } from "./views/credits";
import { ExchangeView } from "./views/exchange";
import { ProfileFullView } from "./profile";
import { StudioView } from "./views/studio";
import { SettingsView } from "./views/settings";
import type { AuthUser } from "./types";
import { cn } from "@/lib/utils";

/* ============ MULTILINGUAL WELCOME LOADER ============ */
const WELCOME_LANGS = [
  { text: "Welcome", lang: "en", label: "English" },
  { text: "Қош келдіңіз", lang: "kk", label: "Қазақша" },
  { text: "Кош келдиңиз", lang: "ky", label: "Кыргызча" },
  { text: "Добро пожаловать", lang: "ru", label: "Русский" },
  { text: "Xush kelibsiz", lang: "uz", label: "Oʻzbekcha" },
  { text: "ようこそ", lang: "ja", label: "日本語" },
  { text: "환영합니다", lang: "ko", label: "한국어" },
];

function WelcomeLoader({ done }: { done: boolean }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % WELCOME_LANGS.length), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-all duration-700 grain relative",
        done ? "opacity-0 pointer-events-none scale-[1.02]" : "opacity-100"
      )}
      aria-hidden={done}
      role="status"
      aria-label="Loading AniVerse"
    >
      {/* Ember glow backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[70vw] h-[70vw] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[40vw] h-[40vw] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl brand-gradient flex items-center justify-center shadow-2xl shadow-primary/40 animate-pulse">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
        </div>

        <div className="h-16 flex items-center justify-center">
          {WELCOME_LANGS.map((l, i) => (
            <span
              key={l.lang}
              lang={l.lang}
              className={cn(
                "absolute text-2xl sm:text-3xl font-bold tracking-tight transition-all duration-500",
                i === idx
                  ? "opacity-100 translate-y-0 blur-0"
                  : "opacity-0 translate-y-3 blur-[2px] pointer-events-none"
              )}
            >
              <span className="gradient-text">{l.text}</span>
            </span>
          ))}
        </div>

        {/* progress shimmer */}
        <div className="w-44 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/3 brand-gradient rounded-full animate-[ticker_1.2s_ease-in-out_infinite_alternate]" />
        </div>

        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/70 font-semibold">
          AniVerse · アニバース
        </p>
      </div>
    </div>
  );
}

export default function AnimeApp() {
  const { view, user, setUserLoading, setUser } = useAppStore();
  const [loaderDone, setLoaderDone] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);

  // Load session on mount
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser((d.user as AuthUser) || null);
      })
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, [setUser, setUserLoading]);

  // Loader: keep visible at least ~2.8s so all 7 languages can greet
  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 2800);
    return () => clearTimeout(t);
  }, []);

  const loading = useAppStore((s) => s.userLoading);
  const done = !loading && minTimePassed;

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => setLoaderDone(true), 750);
      return () => clearTimeout(t);
    }
  }, [done]);

  // Keyboard shortcut for search (/)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" && !useAppStore.getState().searchOpen) {
        e.preventDefault();
        useAppStore.getState().setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {!loaderDone && <WelcomeLoader done={done} />}

      <TopNav />

      <main className="flex-1 w-full pb-20 lg:pb-0">
        {view.name === "home" && <HomeView />}
        {view.name === "browse" && <BrowseView />}
        {view.name === "detail" && <DetailView />}
        {view.name === "watch" && <WatchView />}
        {view.name === "library" && <LibraryView />}
        {view.name === "community" && <CommunityView />}
        {view.name === "watch-together" && <WatchTogetherView />}
        {view.name === "credits" && <CreditsView />}
        {view.name === "exchange" && <ExchangeView />}
        {view.name === "user-profile" && view.username && <ProfileFullView username={view.username} />}
        {view.name === "studio" && <StudioView />}
        {view.name === "settings" && <SettingsView />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t px-6 py-4 hidden lg:block">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between text-[11px] text-muted-foreground">
          <span>
            <span className="font-black gradient-text text-sm mr-1.5">AniVerse</span>
            Stream · Collect · Exchange · Watch Together
          </span>
          <span>Made with 🔥 for anime fans · Midnight Cinema v2</span>
        </div>
      </footer>

      <MobileNav />
      <AuthModal />
      <ProfileModal />
      <Onboarding />
    </div>
  );
}
