"use client";

import {
  Home, Compass, Users, Clock, Gift, Wallet, Video, AudioLines,
  CalendarDays, Clapperboard, Settings2, type LucideIcon,
} from "lucide-react";
import { useAppStore } from "./store";
import type { ViewName } from "./types";
import { useI18n } from "@/components/i18n-provider";

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
  badge?: "soon";
  lock?: string;
  /** only rendered for CREATOR accounts (parity with desktop sidebar) */
  creatorOnly?: boolean;
  adminOnly?: boolean;
  /** friendly explanation when the item is locked */
  lockHint?: string;
}

export const EXCHANGE_REQUIRED = 20;

export const NAV_ITEMS: readonly NavItemDef[] = [
  { id: "home",           label: "Home",          shortLabel: "Home",     icon: Home,         group: "browse", mobilePrimary: true },
  { id: "browse",         label: "Discover",      shortLabel: "Discover", icon: Compass,      group: "browse", mobilePrimary: true },
  { id: "schedule",       label: "Schedule",      shortLabel: "Schedule", icon: CalendarDays, group: "browse" },
  { id: "dubbing",        label: "AI Dubbing",    shortLabel: "AI Dub",   icon: AudioLines,   group: "browse", mobileCenter: true, badge: "soon" },
  { id: "community",      label: "Community",     shortLabel: "Community",icon: Users,        group: "browse" },
  { id: "watch-together", label: "Watch Together",shortLabel: "Together", icon: Video,        group: "browse" },
  { id: "library",        label: "My Library",    shortLabel: "Library",  icon: Clock,        group: "my",    mobilePrimary: true },
  { id: "gifts",          label: "Gifts",         shortLabel: "Gifts",    icon: Gift,         group: "my" },
  { id: "credits",        label: "Get Credits",   shortLabel: "Credits",  icon: Wallet,       group: "my" },
  { id: "studio",         label: "Creator Studio",shortLabel: "Studio",   icon: Clapperboard, group: "creator", creatorOnly: true,
    lockHint: "You picked the Viewer path at sign-up — Creator Studio is for Creator accounts." },
  { id: "bot-admin",      label: "Bot Admin",      shortLabel: "Admin",    icon: Settings2,    group: "creator", adminOnly: true,
    lockHint: "Admin panel is for admin accounts only." },
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
export function visibleItems(isCreator: boolean, isGuest: boolean, isAdmin = false): NavItemDef[] {
  return NAV_ITEMS.filter((i) => {
    if (i.adminOnly) return isAdmin;
    if (i.creatorOnly) return isCreator || isAdmin || !isGuest;
    return true;
  });
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
  const { t } = useI18n();
  const isCreator = user?.role === "CREATOR" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";
  const owned = user?.ownedCount ?? 0;

  return visibleItems(isCreator, !user, isAdmin).map((def) => {
    const active = view.name === def.id;
    const locked =
      (!!def.creatorOnly && !!user && !isCreator) ||
      (!!def.adminOnly && !!user && !isAdmin);
    const badgeText = def.badge === "soon" ? "Soon" : undefined;
    const dot = def.id === "schedule" ? scheduleAirsToday : undefined;
    return {
      def: {
        ...def,
        label: t(`nav.${def.id}`),
        shortLabel: t(`nav.${def.id}`),
      },
      active,
      badgeText,
      locked,
      ownedCount: owned,
      dot,
    };
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
