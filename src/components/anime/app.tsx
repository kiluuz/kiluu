"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";
import { Sidebar, TopBar } from "./shell";
import { TabletRail } from "./tablet-rail";
import { MobileDock } from "./mobile-dock";
import { MobileSearch } from "./mobile-search";
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

  // Keyboard shortcut for search (/) — full-screen overlay below 1100px, inline box on desktop
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "/" && !useAppStore.getState().searchOpen) {
        e.preventDefault();
        if (window.matchMedia("(max-width: 1099.98px)").matches) {
          useAppStore.getState().setMobileSearchOpen(true);
        } else {
          useAppStore.getState().setSearchOpen(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Does anything air today? → drives the Schedule notification dot in the nav
  useEffect(() => {
    let alive = true;
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const today = new Date().getDay();
        const airs = Array.isArray(d?.schedule) && d.schedule.some((a: { airDay?: number }) => a?.airDay === today);
        useAppStore.getState().setScheduleAirsToday(Boolean(airs));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // The video player view is immersive — the mobile dock hides completely
  useEffect(() => {
    useAppStore.getState().setImmersive(view.name === "watch");
  }, [view.name]);

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
      <TabletRail />
      <TopBar />

      <main className="flex-1 w-full md:max-[1099.98px]:pl-[76px] min-[1100px]:pl-[264px] pb-[calc(116px+env(safe-area-inset-bottom,0px))] md:pb-0">
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
      <footer className="mt-auto border-t px-6 py-5 hidden min-[1100px]:block min-[1100px]:ml-[264px]">
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

      <MobileDock />
      <MobileSearch />
      <ProfileModal />
      <Onboarding />
    </div>
  );
}
