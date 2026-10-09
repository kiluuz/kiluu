"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";
import { Sidebar, TopBar, MobileNav } from "./shell";
import { Onboarding } from "./auth";
import { ProfileModal } from "./profile-card";
import { WelcomeLoader } from "./welcome-loader";
import { Logo } from "./logo";
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
import { LoginView } from "./views/login";
import { ScheduleView } from "./views/schedule";
import { DubbingView } from "./views/dubbing";
import type { AuthUser } from "./types";

export default function AnimeApp() {
  const { view, setUserLoading, setUser } = useAppStore();

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

  const loading = useAppStore((s) => s.userLoading);

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

  // Full-page login — no chrome
  if (view.name === "login") {
    return (
      <div className="min-h-screen bg-background">
        <WelcomeLoader appReady={!loading} />
        <LoginView />
        <Onboarding />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <WelcomeLoader appReady={!loading} />

      <Sidebar />
      <TopBar />

      <main className="flex-1 w-full lg:pl-[264px] pb-20 lg:pb-0">
        {view.name === "home" && <HomeView />}
        {view.name === "browse" && <BrowseView />}
        {view.name === "schedule" && <ScheduleView />}
        {view.name === "dubbing" && <DubbingView />}
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
      <footer className="mt-auto border-t px-6 py-5 hidden lg:block lg:ml-[264px]">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Logo variant="full" size={24} />
            <span className="h-4 w-px bg-border" aria-hidden="true" />
            <span className="flex items-baseline gap-2">
              <span className="font-semibold text-[13px] text-[#ffa23a]" lang="ja" style={{ letterSpacing: ".3em" }}>
                吹替
              </span>
              <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Voice it your way</span>
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Stream · Collect · Exchange · Watch Together
          </span>
        </div>
      </footer>

      <MobileNav />
      <ProfileModal />
      <Onboarding />
    </div>
  );
}
