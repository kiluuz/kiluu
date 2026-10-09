"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LayoutGrid, UserRound, Settings } from "lucide-react";
import { useAppStore } from "./store";
import { useMenuItemForView, useResolvedNav, EXCHANGE_REQUIRED } from "./nav-config";
import { NavSheet } from "./nav-sheet";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ViewName } from "./types";

/* ============================================================
   MOBILE DOCK — floating glass dock (< 768px)
   5 slots: Home | Discover | [raised AI Dub] | Library | Menu
   - sliding pill active indicator (spring, shared layoutId)
   - label only on the active tab
   - raised center CTA with animated DubAniX waveform + UZ badge
   - hide-on-scroll + hide in player / fullscreen / keyboard / modals
   - haptic press feedback, 44px targets, safe-area aware
   ============================================================ */

const SPRING = { type: "spring", stiffness: 480, damping: 38, mass: 0.9 } as const;

function haptic() {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
  } catch { /* no-op */ }
}

/** 5-bar DubAniX waveform (same rhythm as the Logo mark: 1.3s eq, .15s stagger) */
function WaveformBars() {
  return (
    <span className="flex items-center justify-center gap-[3px] h-[22px]" aria-hidden="true">
      {[22, 22, 20, 16, 10].map((h, i) => (
        <span
          key={i}
          className="dock-wave-bar w-[3px] rounded-full bg-white"
          style={{ height: h, opacity: [1, 1, 0.95, 0.8, 0.6][i], animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
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
          className="absolute inset-[3px] rounded-[18px] bg-primary/15 border border-primary/30"
          transition={SPRING}
        />
      )}
      <motion.span
        className="relative z-10 flex items-center justify-center"
        animate={{ y: active ? -7 : 0 }}
        transition={SPRING}
      >
        <Icon
          className={cn(
            "w-[22px] h-[22px] transition-colors",
            active ? "text-primary drop-shadow-[0_0_8px_var(--glow)]" : "text-muted-foreground"
          )}
          strokeWidth={active ? 2.5 : 2}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? 0.18 : 0}
        />
      </motion.span>
      <span
        className={cn(
          "absolute bottom-[4px] left-0 right-0 text-center text-[10.5px] leading-none font-bold truncate px-1 transition-all duration-200",
          active ? "opacity-100 translate-y-0 text-primary" : "opacity-0 translate-y-1"
        )}
      >
        {label}
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
  const library = byId("library");
  const dubbing = byId("dubbing");

  /* Menu slot mirrors the current in-menu page so the user always knows where they are */
  const settingsHere = view.name === "settings";
  const profileHere = view.name === "user-profile";
  const menuSlot: { icon: LucideIcon; label: string } =
    menuItem ? { icon: menuItem.def.icon, label: menuItem.def.shortLabel } :
    settingsHere ? { icon: Settings, label: "Settings" } :
    profileHere ? { icon: UserRound, label: "Profile" } :
    { icon: LayoutGrid, label: "Menu" };
  const menuActive = !!menuItem || settingsHere || profileHere;

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
              aria-label="Open AI Dubbing Studio (Japanese to Uzbek)"
              aria-current={dubbing.active ? "page" : undefined}
            >
              <WaveformBars />
              <span
                className="absolute -top-1 -right-1 text-[8px] font-black tracking-wide px-[5px] py-[1px] rounded-full bg-background text-primary border border-primary/40 shadow-sm"
                aria-hidden="true"
              >
                UZ
              </span>
              <span className="sr-only">Uzbek dubbing available</span>
            </button>
          </div>

          {/* right pair */}
          <DockTab icon={library.def.icon} label={library.def.shortLabel} active={library.active} onPress={() => navigate("library")} />
          <DockTab
            icon={menuSlot.icon}
            label={menuSlot.label}
            active={menuActive}
            dot={scheduleAirsToday && !menuActive}
            onPress={openSheet}
          />
        </div>

        {/* screen-reader summary of what lives inside the menu */}
        <p className="sr-only">
          Menu opens the full navigation sheet with Community, Watch Together, Schedule, Exchange, Get Credits,
          Creator Studio, profile and settings. Exchange requires {EXCHANGE_REQUIRED} owned animes.
        </p>
      </nav>

      {/* Sheet is only mounted after the first open (lazy) and stays for close animations */}
      {sheetEverOpened && <NavSheet open={sheetOpen} onOpenChange={setSheetOpen} />}
    </>
  );
}
