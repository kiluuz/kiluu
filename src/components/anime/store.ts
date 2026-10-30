"use client";

import { create } from "zustand";
import type { AuthUser, View, ViewName } from "./types";

export interface NavigateOptions {
  replace?: boolean;
  skipPushState?: boolean;
}

export function viewToPath(view: View): string {
  switch (view.name) {
    case "home":
      return "/app";
    case "schedule":
      return "/schedule";
    case "browse": {
      const q = new URLSearchParams();
      if (view.filters?.genre) q.set("genre", view.filters.genre);
      const qs = q.toString();
      return qs ? `/browse?${qs}` : "/browse";
    }
    case "dubbing":
      return "/dubbing";
    case "library":
      return "/library";
    case "community":
      return view.filters?.club ? `/community?club=${encodeURIComponent(view.filters.club)}` : "/community";
    case "watch-together":
      return "/watch-together";
    case "credits":
      return "/credits";
    case "gifts":
      return "/gifts";
    case "exchange":
      return "/gifts";
    case "studio":
      return "/studio";
    case "settings":
      return "/settings";
    case "login":
      return "/login";
    case "bot-admin":
      return "/bot-admin";
    case "admin-users":
      return "/admin/users";
    case "payouts":
      return "/payouts";
    case "admin-payments":
      return "/admin/payments";
    case "detail":
      return view.animeId ? `/anime/${encodeURIComponent(view.animeId)}` : "/";
    case "watch":
      return view.animeId
        ? `/watch/${encodeURIComponent(view.animeId)}${view.episodeId ? `/${encodeURIComponent(view.episodeId)}` : ""}`
        : "/";
    case "user-profile":
      return view.username ? `/user/${encodeURIComponent(view.username)}` : "/";
    default:
      return "/";
  }
}

export function pathToView(pathname: string, search: string = ""): View {
  const cleanPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(search);

  if (cleanPath === "/app") {
    return { name: "home" };
  }
  if (cleanPath === "/" || cleanPath === "") {
    return { name: "home" };
  }
  if (cleanPath === "/schedule") {
    return { name: "schedule" };
  }
  if (cleanPath === "/browse") {
    const genre = params.get("genre");
    return { name: "browse", filters: genre ? { genre } : undefined };
  }
  if (cleanPath === "/dubbing") {
    return { name: "dubbing" };
  }
  if (cleanPath === "/library") {
    return { name: "library" };
  }
  if (cleanPath === "/community") {
    const club = params.get("club");
    return club ? { name: "community", filters: { club } } : { name: "community" };
  }
  if (cleanPath === "/watch-together") {
    return { name: "watch-together" };
  }
  if (cleanPath === "/credits") {
    return { name: "credits" };
  }
  if (cleanPath === "/gifts" || cleanPath === "/exchange") {
    return { name: "gifts" };
  }
  if (cleanPath === "/studio") {
    return { name: "studio" };
  }
  if (cleanPath === "/settings") {
    return { name: "settings" };
  }
  if (cleanPath === "/login") {
    return { name: "login" };
  }
  if (cleanPath === "/bot-admin") {
    return { name: "bot-admin" };
  }
  if (cleanPath === "/admin/users") {
    return { name: "admin-users" };
  }
  if (cleanPath === "/payouts") {
    return { name: "payouts" };
  }
  if (cleanPath === "/admin/payments") {
    return { name: "admin-payments" };
  }

  const animeMatch = cleanPath.match(/^\/anime\/([^/]+)$/);
  if (animeMatch) {
    return { name: "detail", animeId: decodeURIComponent(animeMatch[1]) };
  }

  const watchMatch = cleanPath.match(/^\/watch\/([^/]+)(?:\/([^/]+))?$/);
  if (watchMatch) {
    return {
      name: "watch",
      animeId: decodeURIComponent(watchMatch[1]),
      episodeId: watchMatch[2] ? decodeURIComponent(watchMatch[2]) : undefined,
    };
  }

  const userMatch = cleanPath.match(/^\/user\/([^/]+)$/);
  if (userMatch) {
    return { name: "user-profile", username: decodeURIComponent(userMatch[1]) };
  }

  return { name: "home" };
}

interface AppStore {
  user: AuthUser | null;
  userLoading: boolean;
  view: View;
  viewHistory: View[];
  profileModalOpen: boolean;
  profileCardUser: string | null;
  authOpen: boolean;
  searchOpen: boolean;
  setUser: (user: AuthUser | null) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  setUserLoading: (loading: boolean) => void;
  navigate: (name: ViewName, params?: Omit<View, "name">, options?: NavigateOptions) => void;
  goBack: () => void;
  setProfileModalOpen: (open: boolean) => void;
  openProfileCard: (username: string) => void;
  closeProfileCard: () => void;
  setAuthOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  /** full-screen mobile search overlay (poster thumbnails) */
  setMobileSearchOpen: (open: boolean) => void;
  /** true inside the video player / fullscreen / watch-party room — hides the dock */
  setImmersive: (immersive: boolean) => void;
  /** any anime airs today — drives the Schedule nav dot */
  setScheduleAirsToday: (airs: boolean) => void;
  mobileSearchOpen: boolean;
  immersive: boolean;
  scheduleAirsToday: boolean;
}

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  userLoading: true,
  view: { name: "home" },
  viewHistory: [],
  profileModalOpen: false,
  profileCardUser: null,
  authOpen: false,
  searchOpen: false,
  mobileSearchOpen: false,
  immersive: false,
  scheduleAirsToday: false,
  setUser: (user) => set({ user }),
  updateUser: (patch) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...patch } });
  },
  setUserLoading: (userLoading) => set({ userLoading }),
  navigate: (name, params = {}, options = {}) => {
    const nextView: View = { name, ...params };
    const current = get().view;
    set({
      view: nextView,
      viewHistory: current.name === name && current.animeId === params.animeId ? get().viewHistory : [...get().viewHistory.slice(-9), current],
      profileModalOpen: false,
      profileCardUser: null,
      searchOpen: false,
      mobileSearchOpen: false,
    });
    if (typeof window !== "undefined") {
      const nextPath = viewToPath(nextView);
      if (!options.skipPushState) {
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== nextPath) {
          if (options.replace) {
            window.history.replaceState({ view: nextView }, "", nextPath);
          } else {
            window.history.pushState({ view: nextView }, "", nextPath);
          }
        }
      }
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  },
  goBack: () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    const history = get().viewHistory;
    if (history.length > 0) {
      const prev = history[history.length - 1];
      get().navigate(prev.name, prev);
    } else {
      get().navigate("home");
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  },
  setProfileModalOpen: (profileModalOpen) => {
    const me = get().user;
    set({
      profileModalOpen,
      profileCardUser: profileModalOpen ? me?.username ?? null : null,
    });
  },
  openProfileCard: (username) => set({ profileModalOpen: true, profileCardUser: username }),
  closeProfileCard: () => set({ profileModalOpen: false, profileCardUser: null }),
  setAuthOpen: (authOpen) => {
    // Full-page split login — "Sign in" now navigates to the login view
    if (authOpen) {
      get().navigate("login");
    } else if (get().view.name === "login") {
      set({ view: { name: "home" } });
    }
  },
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setMobileSearchOpen: (mobileSearchOpen) => set({ mobileSearchOpen }),
  setImmersive: (immersive) => set({ immersive }),
  setScheduleAirsToday: (scheduleAirsToday) => set({ scheduleAirsToday }),
}));

/** Open the Discord-style profile card from anywhere (avatar/name clicks) */
export function useOpenProfile() {
  const openProfileCard = useAppStore((s) => s.openProfileCard);
  return (username: string) => openProfileCard(username);
}
