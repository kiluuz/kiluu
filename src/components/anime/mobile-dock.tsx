"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { useAppStore } from "./store";
import { useMenuItemForView, useResolvedNav } from "./nav-config";
import { NavSheet } from "./nav-sheet";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/LogoMark";
import type { LucideIcon } from "lucide-react";
import type { ViewName } from "./types";

/* ============================================================
   MOBILE DOCK — floating glass dock (< 768px)
   5 slots: Home | Discover | [raised AI Dub] | Community | Menu
   - sliding pill active indicator (spring, shared layoutId)
   - icons only; accessible labels remain available to assistive technology
   - raised center CTA with the Kiluu mark
   - hide-on-scroll + hide in player / fullscreen / keyboard / modals
   - haptic press feedback, 44px targets, safe-area aware
   ============================================================ */

const SPRING = { type: "spring", stiffness: 480, damping: 38, mass: 0.9 } as const;

function haptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
  } catch { /* no-op */ }
}

interface DockTabProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  dot?: boolean;
  onPress: () => void;
}

function DockTab({ icon: Icon, label, active, dot, onPress }: DockTabProps) {
  return (
    <button
      onClick={() => { haptic(); onPress(); }}
      className="relative flex h-14 w-full min-w-[44px] flex-col items-center justify-center rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background transition-transform active:scale-[0.94]"
      aria-current={active ? "page" : undefined}
      aria-label={label}
    >
      {active && (
        <motion.span
          layoutId="dock-active-pill"
          className="absolute inset-[3px] rounded-[18px]"
          style={{ background: "rgba(215,38,61,0.13)", border: "1px solid rgba(215,38,61,0.28)" }}
          transition={SPRING}
        />
      )}
      <span className="relative z-10 flex items-center justify-center">
        <Icon
          className={cn(
            "w-[22px] h-[22px] transition-colors",
            active ? "drop-shadow-[0_0_8px_rgba(215,38,61,0.6)]" : "text-muted-foreground"
          )}
          style={active ? { color: "#d7263d" } : undefined}
          strokeWidth={active ? 2.5 : 2}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.18 : 0}
        />
      </span>
      {dot && (
        <span className="absolute top-[7px] right-[calc(50%-18px)] w-[7px] h-[7px] rounded-full bg-emerald-500 live-dot border border-background" aria-hidden="true" />
      )}
    </button>
  );
}

export function MobileDock() {
  const view = useAppStore((s) => s.view);
  const navigate = useAppStore((s) => s.navigate);
  const immersive = useAppStore((s) => s.immersive);
  const profileModalOpen = useAppStore((s) => s.profileModalOpen);
  const mobileSearchOpen = useAppStore((s) => s.mobileSearchOpen);
  const scheduleAirsToday = useAppStore((s) => s.scheduleAirsToday);
  const items = useResolvedNav();
  const menuItem = useMenuItemForView();
  const reducedMotion = useReducedMotion();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetEverOpened, setSheetEverOpened] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const byId = (id: ViewName) => items.find((i) => i.def.id === id)!;
  const home = byId("home");
  const discover = byId("browse");
  const community = byId("community");
  const dubbing = byId("dubbing");

  const menuActive = !!menuItem || view.name === "settings" || view.name === "user-profile";

  /* ---- hide-on-scroll (transform only, rAF-throttled) ---- */
  const lastY = useRef(0);
  const ticking = useRef(false);
  useEffect(() => {
    if (reducedMotion) return; // reduced motion: dock stays put
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        const y = window.scrollY;
        const delta = y - lastY.current;
        if (Math.abs(delta) > 14) {
          setScrollHidden(delta > 0 && y > 120);
          lastY.current = y;
        }
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion]);

  /* ---- keyboard open (visual viewport shrink) ---- */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setKeyboardOpen(vv.height < window.innerHeight * 0.82);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  /* ---- fullscreen (video player etc.) ---- */
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ---- dock fully hidden in immersive contexts ---- */
  const dockHidden = immersive || profileModalOpen || mobileSearchOpen || keyboardOpen || fullscreen;

  const openSheet = useCallback(() => {
    haptic();
    setSheetEverOpened(true);
    setSheetOpen(true);
  }, []);

  return (
    <>
      <nav
        aria-label="Mobile navigation"
        className={cn(
          "md:hidden fixed left-3 right-3 z-40 select-none",
          "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
          dockHidden || scrollHidden ? "translate-y-[160%] pointer-events-none" : "translate-y-0"
        )}
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        aria-hidden={dockHidden}
        inert={dockHidden ? true : undefined}
      >
        <div
          className={cn(
            "dock-glass relative grid grid-cols-[1fr_1fr_76px_1fr_1fr] items-center rounded-[24px]",
            "shadow-[0_12px_40px_-8px_rgba(0,0,0,0.45)]"
          )}
        >
          {/* left pair */}
          <DockTab icon={home.def.icon} label={home.def.shortLabel} active={home.active} onPress={() => navigate("home")} />
          <DockTab icon={discover.def.icon} label={discover.def.shortLabel} active={discover.active} onPress={() => navigate("browse")} />

          {/* center raised AI Dub action */}
          <div className="relative flex items-center justify-center">
            <button
              onClick={() => { haptic(); navigate("dubbing"); }}
              className={cn(
                "group relative -translate-y-[18px] flex items-center justify-center w-[56px] h-[56px] rounded-full",
                "dock-cta transition-transform active:scale-[0.94] outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
              aria-label="Open AI Dubbing — coming soon"
              aria-current={dubbing.active ? "page" : undefined}
            >
              <LogoMark size={32} animated="none" decorative />
            </button>
          </div>

          {/* right pair */}
          <DockTab icon={community.def.icon} label={community.def.shortLabel} active={community.active} onPress={() => navigate("community")} />
          <DockTab
            icon={LayoutGrid}
            label="Menu"
            active={menuActive}
            dot={scheduleAirsToday && !menuActive}
            onPress={openSheet}
          />
        </div>

        {/* screen-reader summary of what lives inside the menu */}
        <p className="sr-only">
          Menu opens the full navigation sheet with Community, Watch Together, Schedule, Gifts, Get Credits,
          Creator Studio, profile and settings.
        </p>
      </nav>

      {/* Sheet is only mounted after the first open (lazy) and stays for close animations */}
      {sheetEverOpened && <NavSheet open={sheetOpen} onOpenChange={setSheetOpen} />}
    </>
  );
}
