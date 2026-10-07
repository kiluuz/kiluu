"use client";

import { useEffect } from "react";
import { useAppStore } from "./store";
import { Sidebar, Header, MobileNav } from "./shell";
import { AuthModal, Onboarding } from "./auth";
import { ProfileModal } from "./profile";
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

export default function AnimeApp() {
  const { view, user, setUserLoading, setUser } = useAppStore();

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
    <div className="min-h-screen flex bg-background">
      <Sidebar />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 pb-20 lg:pb-0">
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
          <div className="max-w-[1400px] mx-auto flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              <span className="font-black gradient-text text-sm mr-1.5">AniVerse</span>
              Stream · Collect · Exchange · Watch Together
            </span>
            <span>Made with 💜 for anime fans · v1.0</span>
          </div>
        </footer>
      </div>

      <MobileNav />
      <AuthModal />
      <ProfileModal />
      <Onboarding />
    </div>
  );
}
