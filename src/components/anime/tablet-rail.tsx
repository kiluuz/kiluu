"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PanelLeftClose, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useAppStore } from "./store";
import { useResolvedNav, EXCHANGE_REQUIRED } from "./nav-config";
import { Sidebar } from "./shell";
import { Avatar } from "./ui-bits";
import { Logo } from "./logo";
import { toast } from "sonner";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ============================================================
   TABLET RAIL — collapsed icon rail (768–1100px)
   Icon + tooltip + active indicator line; badges as dots.
   Expands on hover (mouse) or tap (chevron) into the full
   sidebar as an overlay. No bottom dock on tablet.
   ============================================================ */

function RailButton({ id, onNavigate }: { id: import("./types").ViewName; onNavigate: () => void }) {
  const items = useResolvedNav();
  const navigate = useAppStore((s) => s.navigate);
  const item = items.find((i) => i.def.id === id);
  if (!item) return null;
  const { def, active, badgeText, locked } = item;
  const Icon = def.icon;
  const label = `${def.label}${badgeText ? ` · ${def.id === "exchange" ? `${item.ownedCount}/${EXCHANGE_REQUIRED}` : badgeText}` : ""}`;

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        <button
          onClick={() => {
            if (locked && def.lockHint) {
              toast.info(def.lockHint, { duration: 5000, id: `lock-${def.id}` });
              return;
            }
            onNavigate();
            navigate(def.id as never);
          }}
          className={cn(
            "relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.94]",
            active
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
          )}
          aria-current={active ? "page" : undefined}
          aria-label={locked ? `${def.label} — locked` : def.label}
        >
          {active && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[7px] w-[3px] h-6 rounded-full brand-gradient" />
          )}
          <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.4 : 2} />
          {badgeText && (
            <span
              className="absolute -top-1 -right-1 rounded-full bg-primary px-1 text-[7px] leading-3 font-black text-primary-foreground border border-background"
              aria-label={badgeText}
            >
              {badgeText}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8} className="text-xs font-semibold">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function TabletRail() {
  const user = useAppStore((s) => s.user);
  const navigate = useAppStore((s) => s.navigate);
  const setProfileModalOpen = useAppStore((s) => s.setProfileModalOpen);
  const { theme, setTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();
  const items = useResolvedNav();

  /* Esc closes the overlay */
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  function scheduleOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setExpanded(true), 260);
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setExpanded(false), 200);
  }
  function cancelTimers() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }

  return (
    <TooltipProvider delayDuration={250}>
      {/* collapsed rail */}
      <nav
        aria-label="Tablet navigation"
        onMouseEnter={reducedMotion ? undefined : scheduleOpen}
        onMouseLeave={scheduleClose}
        className="hidden md:max-[1099.98px]:flex fixed left-0 top-0 bottom-0 w-[76px] flex-col items-center glass-strong border-r z-50 py-3"
      >
        <button
          onClick={() => navigate("home")}
          className="mb-4 p-1.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="DubAniX home"
        >
          <Logo variant="mark" size={34} />
        </button>

        <div className="flex-1 flex flex-col items-center gap-1 overflow-y-auto no-scrollbar w-full px-2">
          {items.map((it) => (
            <RailButton
              key={it.def.id}
              id={it.def.id}
              onNavigate={() => {
                cancelTimers();
                setExpanded(false);
              }}
            />
          ))}
        </div>

        {/* rail footer */}
        <div className="flex flex-col items-center gap-1.5 pt-3 w-full px-2">
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/60 transition outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Toggle theme"
          >
            <Sun className="w-5 h-5 hidden dark:block" />
            <Moon className="w-5 h-5 dark:hidden" />
          </button>
          {user ? (
            <button
              onClick={() => setProfileModalOpen(true)}
              className="rounded-full hover:ring-2 ring-primary/50 transition outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open my profile"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.displayName || user.username}
                accent={user.accentColor}
                accentTo={user.accentTo}
                frame={user.avatarFrame}
                size={38}
              />
            </button>
          ) : (
            <button
              onClick={() => navigate("login")}
              className="w-12 h-12 rounded-2xl brand-gradient flex items-center justify-center text-white outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Sign in"
            >
              <span className="text-[13px] font-black">?</span>
            </button>
          )}
          <button
            onClick={() => { cancelTimers(); setExpanded((v) => !v); }}
            className={cn(
              "w-12 h-11 rounded-2xl flex items-center justify-center transition outline-none focus-visible:ring-2 focus-visible:ring-ring",
              expanded ? "text-primary bg-primary/15" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
            )}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={expanded}
          >
            <PanelLeftClose
              className={cn("w-5 h-5 transition-transform duration-300", expanded ? "rotate-180" : "")}
            />
          </button>
        </div>
      </nav>

      {/* expanded overlay sidebar */}
      <AnimatePresence>
        {expanded && (
          <>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="hidden md:max-[1099.98px]:block fixed inset-0 z-[45] bg-black/45 backdrop-blur-[2px]"
              onClick={() => setExpanded(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={reducedMotion ? false : { x: -280, opacity: 0.5 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reducedMotion ? undefined : { x: -280, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="hidden md:max-[1099.98px]:block"
              onMouseEnter={cancelTimers}
              onMouseLeave={scheduleClose}
            >
              <Sidebar
                variant="overlay"
                onNavigate={() => {
                  cancelTimers();
                  setExpanded(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TooltipProvider>
  );
}
