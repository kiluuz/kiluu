"use client";

import { create } from "zustand";
import type { AuthUser, View, ViewName } from "./types";

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
  navigate: (name: ViewName, params?: Omit<View, "name">) => void;
  goBack: () => void;
  setProfileModalOpen: (open: boolean) => void;
  openProfileCard: (username: string) => void;
  closeProfileCard: () => void;
  setAuthOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
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
  setUser: (user) => set({ user }),
  updateUser: (patch) => {
    const current = get().user;
    if (current) set({ user: { ...current, ...patch } });
  },
  setUserLoading: (userLoading) => set({ userLoading }),
  navigate: (name, params = {}) => {
    const current = get().view;
    set({
      view: { name, ...params },
      viewHistory: current.name === name && current.animeId === params.animeId ? get().viewHistory : [...get().viewHistory.slice(-9), current],
      profileModalOpen: false,
      profileCardUser: null,
      searchOpen: false,
    });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  },
  goBack: () => {
    const history = get().viewHistory;
    if (history.length > 0) {
      const prev = history[history.length - 1];
      set({ view: prev, viewHistory: history.slice(0, -1) });
    } else {
      set({ view: { name: "home" } });
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
}));

/** Open the Discord-style profile card from anywhere (avatar/name clicks) */
export function useOpenProfile() {
  const openProfileCard = useAppStore((s) => s.openProfileCard);
  return (username: string) => openProfileCard(username);
}
