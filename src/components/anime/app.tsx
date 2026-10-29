"use client";

import { useEffect, useRef, useState } from "react";
import { Suspense } from "react";
import { useAppStore, pathToView } from "./store";
import { Sidebar, TopBar } from "./shell";
import { TabletRail } from "./tablet-rail";
import { MobileDock } from "./mobile-dock";
import { MobileSearch } from "./mobile-search";
import { Onboarding } from "./auth";
import { ProfileModal } from "./profile-card";
import { Logo } from "./logo";
import { PageLoader } from "@/components/brand/PageLoader";
import { HomeView } from "./views/home";
import { BrowseView } from "./views/browse";
import { DetailView } from "./views/detail";
import { WatchView } from "./views/watch";
import { LibraryView } from "./views/library";
import { CommunityView } from "./views/community";
import { WatchTogetherView } from "./views/watch-together";
import { CreditsView } from "./views/credits";
import { GiftsView } from "./views/gifts";
import { ProfileFullView } from "./profile";
import { StudioView } from "./views/studio";
import { SettingsView } from "./views/settings";
import { LoginView } from "./views/login";
import { ScheduleView } from "./views/schedule";
import { DubbingView } from "./views/dubbing";
import { BotAdminView } from "./views/bot-admin";
import type { AuthUser } from "./types";

const VIEW_LOADING_COPY: Record<string, { title: string; caption: string }> = {
  home: { title: "Home", caption: "Finding something to watch" },
  browse: { title: "Discover", caption: "Finding your next favorite" },
  schedule: { title: "Schedule", caption: "Checking upcoming releases" },
  community: { title: "Community", caption: "Gathering the conversation" },
  "watch-together": { title: "Watch Together", caption: "Joining the viewing room" },
  library: { title: "Library", caption: "Opening your collection" },
  credits: { title: "Get Credits", caption: "Loading your wallet" },
  gifts: { title: "Gifts", caption: "Finding your gifts" },
  "user-profile": { title: "Profile", caption: "Loading profile details" },
  detail: { title: "Anime", caption: "Preparing the anime page" },
  watch: { title: "Watch", caption: "Preparing your episode" },
  studio: { title: "Creator Studio", caption: "Opening your studio" },
  settings: { title: "Settings", caption: "Loading your preferences" },
};

export default function AnimeApp() {
  const { view, user, userLoading, setUserLoading, setUser } = useAppStore();
  const viewKey = `${view.name}:${view.animeId ?? ""}:${view.username ?? ""}`;
  const previousViewKey = useRef(viewKey);
  const [navigationProgress, setNavigationProgress] = useState(false);
  const [navigationLoading, setNavigationLoading] = useState(false);
  const loadingCopy = VIEW_LOADING_COPY[view.name] ?? {
    title: "Kiluu",
    caption: "Loading your anime universe",
  };

  useEffect(() => {
    if (previousViewKey.current === viewKey) return;
    previousViewKey.current = viewKey;
    setNavigationProgress(true);
    setNavigationLoading(false);
    const loaderTimer = window.setTimeout(() => setNavigationLoading(true), 200);
    const finishTimer = window.setTimeout(() => {
      setNavigationLoading(false);
      setNavigationProgress(false);
    }, 550);
    return () => {
      window.clearTimeout(loaderTimer);
      window.clearTimeout(finishTimer);
    };
  }, [viewKey]);

  // Sync browser URL with app view & handle Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const targetView = pathToView(window.location.pathname, window.location.search);
      const legacyGiftsPath = window.location.pathname === "/exchange";
      useAppStore.getState().navigate(targetView.name, targetView, {
        replace: legacyGiftsPath,
        skipPushState: !legacyGiftsPath,
      });
    };

    // On initial page load/refresh, restore state from URL
    const initialView = pathToView(window.location.pathname, window.location.search);
    if (initialView.name !== "home" || window.location.pathname !== "/") {
      const legacyGiftsPath = window.location.pathname === "/exchange";
      useAppStore.getState().navigate(initialView.name, initialView, {
        replace: true,
        skipPushState: !legacyGiftsPath,
      });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Load session on mount
  useEffect(() => {
    let active = true;
    const loadSession = async () => {
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 8_000);
          try {
            const response = await fetch("/api/auth/me", {
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal,
            });
            if (!response.ok) throw new Error(`Session request failed (${response.status})`);
            const data = await response.json();
            if (active && !useAppStore.getState().user) {
              setUser((data.user as AuthUser) || null);
            }
            return;
          } catch (error) {
            if (attempt === 1) throw error;
            await new Promise((resolve) => window.setTimeout(resolve, 500));
          } finally {
            window.clearTimeout(timer);
          }
        }
      } catch {
        if (active && !useAppStore.getState().user) setUser(null);
      } finally {
        if (active) setUserLoading(false);
      }
    };
    void loadSession();
    return () => { active = false; };
  }, [setUser, setUserLoading]);

  // Global presence heartbeat: keeps user's lastSeenAt up to date while active & visible
  useEffect(() => {
    if (!user?.id) return;
    let timer: number | undefined;
    let lastPing = 0;

    const pingPresence = async () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastPing < 45_000) return;
      lastPing = now;
      try {
        await fetch("/api/presence", { method: "POST" });
      } catch {
        // silent fallback
      }
    };

    void pingPresence();
    timer = window.setInterval(pingPresence, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void pingPresence();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!userLoading && !user && view.name !== "login") {
      useAppStore.getState().navigate("login", {}, { replace: true });
    }
  }, [user, userLoading, view.name]);

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

  // Full-page login — no chrome
  if (view.name === "login") {
    return (
      <div className="min-h-screen bg-background">
        <LoginView />
        <Onboarding key={user?.id ?? "anonymous"} />
      </div>
    );
  }

  if (userLoading) {
    return <PageLoader title="Your account" caption="Checking your account" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <LoginView />
        <Onboarding key="anonymous" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {navigationProgress && <div className="kiluu-nav-progress" aria-hidden="true" />}
      <Sidebar />
      <TabletRail />
      <TopBar />

      <main className={`relative flex-1 w-full md:max-[1099.98px]:pl-[76px] min-[1100px]:pl-[264px] pb-[calc(116px+env(safe-area-inset-bottom,0px))] md:pb-0 ${view.name === "community" ? "overflow-x-clip" : ""}`}>
        <Suspense fallback={
          <div className="kiluu-content-loader">
            <PageLoader title={loadingCopy.title} caption={loadingCopy.caption} fullScreen={false} />
          </div>
        }>
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
          {view.name === "gifts" && <GiftsView />}
          {view.name === "user-profile" && view.username && <ProfileFullView username={view.username} />}
          {view.name === "studio" && <StudioView />}
          {view.name === "settings" && <SettingsView />}
          {view.name === "bot-admin" && <BotAdminView />}
        </Suspense>
        {navigationLoading && (
          <div className="kiluu-content-loader">
            <PageLoader title={loadingCopy.title} caption={loadingCopy.caption} fullScreen={false} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t px-6 py-5 hidden min-[1100px]:block min-[1100px]:ml-[264px]">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Logo variant="full" size={24} />
            <span className="h-4 w-px bg-border" aria-hidden="true" />
            <span className="flex items-baseline gap-2">
              <span className="font-semibold text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Stream · Collect · Gift
              </span>
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Stream · Collect · Gift · Watch Together
          </span>
        </div>
      </footer>

      <MobileDock />
      <MobileSearch />
      <ProfileModal />
      <Onboarding key={user.id} />
    </div>
  );
}
