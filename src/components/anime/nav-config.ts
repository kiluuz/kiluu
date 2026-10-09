"use client";

import {
  Home, Compass, Users, Clock, Repeat, Wallet, Video, AudioLines,
  CalendarDays, Clapperboard, type LucideIcon,
} from "lucide-react";
import { useAppStore } from "./store";
import type { ViewName } from "./types";

/* ============================================================
   NAVIGATION CONFIG — single source of truth
   Consumed by: desktop Sidebar, tablet Rail, mobile Dock,
   mobile Menu sheet. Add/edit a destination here and every
   surface updates.
   ============================================================ */

export type NavGroup = "browse" | "my" | "creator";

export interface NavItemDef {
  /** matches ViewName in the app store */
  id: ViewName;
  label: string;
  /** compact label for the dock (max ~9 chars) */
  shortLabel: string;
  icon: LucideIcon;
  group: NavGroup;
  /** shows as one of the 4 side slots in the mobile dock */
  mobilePrimary?: boolean;
  /** the raised center action in the mobile dock */
  mobileCenter?: boolean;
  /** badge kind — resolved at render time from live store data */
  badge?: "uz" | "exchange";
  /** lock rule — locked items explain instead of navigating */
  lock?: "exchange";
  /** only rendered for CREATOR accounts (parity with desktop sidebar) */
  creatorOnly?: boolean;
  /** friendly explanation when the item is locked */
  lockHint?: string;
}

export const EXCHANGE_REQUIRED = 20;

export const NAV_ITEMS: readonly NavItemDef[] = [
  { id: "home",           label: "Home",          shortLabel: "Home",     icon: Home,         group: "browse", mobilePrimary: true },
  { id: "browse",         label: "Discover",      shortLabel: "Discover", icon: Compass,      group: "browse", mobilePrimary: true },
  { id: "schedule",       label: "Schedule",      shortLabel: "Schedule", icon: CalendarDays, group: "browse" },
  { id: "dubbing",        label: "AI Dubbing",    shortLabel: "AI Dub",   icon: AudioLines,   group: "browse", mobileCenter: true, badge: "uz" },
  { id: "community",      label: "Community",     shortLabel: "Community",icon: Users,        group: "browse" },
  { id: "watch-together", label: "Watch Together",shortLabel: "Together", icon: Video,        group: "browse" },
  { id: "library",        label: "My Library",    shortLabel: "Library",  icon: Clock,        group: "my",    mobilePrimary: true },
  { id: "exchange",       label: "Exchange",      shortLabel: "Exchange", icon: Repeat,       group: "my",    badge: "exchange", lock: "exchange",
    lockHint: `The Exchange unlocks once you own ${EXCHANGE_REQUIRED} animes. Keep collecting to open the market!` },
  { id: "credits",        label: "Get Credits",   shortLabel: "Credits",  icon: Wallet,       group: "my" },
  { id: "studio",         label: "Creator Studio",shortLabel: "Studio",   icon: Clapperboard, group: "creator", creatorOnly: true,
    lockHint: "You picked the Viewer path at sign-up — Creator Studio is for Creator accounts." },
] as const;

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  browse: "Browse",
  my: "My Stuff",
  creator: "Creator",
};

export function itemsForGroup(group: NavGroup): NavItemDef[] {
  return NAV_ITEMS.filter((i) => i.group === group);
}

/** Everything reachable in the sheet. Creator Studio is hidden only for
 *  guests (no role yet); logged-in viewers see it locked with an explanation. */
export function visibleItems(isCreator: boolean, isGuest: boolean): NavItemDef[] {
  return NAV_ITEMS.filter((i) => !i.creatorOnly || isCreator || !isGuest);
}

/* ---------------- resolved state per item ---------------- */

export interface ResolvedNavItem {
  def: NavItemDef;
  active: boolean;
  badgeText?: string;
  /** exchange lock */
  locked: boolean;
  ownedCount: number;
  /** dot indicator (e.g. something airs today) */
  dot?: boolean;
}

/** Resolve live state (active view, badges, locks) for any nav surface. */
export function useResolvedNav(): ResolvedNavItem[] {
  const view = useAppStore((s) => s.view);
  const user = useAppStore((s) => s.user);
  const scheduleAirsToday = useAppStore((s) => s.scheduleAirsToday);
  const isCreator = user?.role === "CREATOR";
  const owned = user?.ownedCount ?? 0;

  return visibleItems(isCreator, !user).map((def) => {
    const active = view.name === def.id;
    const locked =
      (def.lock === "exchange" && (!user || owned < EXCHANGE_REQUIRED)) ||
      (!!def.creatorOnly && !!user && !isCreator);
    const badgeText = def.badge === "uz" ? "UZ" : def.badge === "exchange" && user ? `${EXCHANGE_REQUIRED}+` : undefined;
    const dot = def.id === "schedule" ? scheduleAirsToday : undefined;
    return { def, active, badgeText, locked, ownedCount: owned, dot };
  });
}

/** The item currently shown inside the Menu sheet that matches the active view
 *  (so the Menu dock slot can mirror "you are here"). Returns null when the
 *  current view is a dock primary or a deep page (detail/watch/profile). */
export function useMenuItemForView(): ResolvedNavItem | null {
  const view = useAppStore((s) => s.view);
  const items = useResolvedNav();
  const dockIds = new Set(NAV_ITEMS.filter((i) => i.mobilePrimary || i.mobileCenter).map((i) => i.id));
  return items.find((i) => i.def.id === view.name && !dockIds.has(i.def.id)) ?? null;
}
