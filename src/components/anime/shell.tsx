"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sun, Moon, LogOut, Settings, ChevronRight, Plus, Coins, UserRound,
  Search, Bell, Lock,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppStore } from "./store";
import { Avatar, formatCredits } from "./ui-bits";
import { Logo } from "./logo";
import {
  useResolvedNav, NAV_GROUP_LABELS, EXCHANGE_REQUIRED,
  type NavGroup, type ResolvedNavItem,
} from "./nav-config";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AnimeSummary } from "./types";
import type { ViewName } from "./types";

/** Brand lockup — DubAniX logo (animated mark + wordmark), links home */
export function BrandLockup() {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <button
      className="flex items-center group shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      onClick={() => navigate("home")}
      aria-label="DubAniX home"
    >
      <Logo variant="full" size={38} />
    </button>
  );
}

/* ================= SEARCH (desktop inline) ================= */

function SearchBox() {
  const navigate = useAppStore((s) => s.navigate);
  const searchOpen = useAppStore((s) => s.searchOpen);
  const setSearchOpen = useAppStore((s) => s.setSearchOpen);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/animes?search=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults((data.animes || []).slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  if (!searchOpen) {
    return (
      <button
        onClick={() => setSearchOpen(true)}
        className="w-full max-w-md flex items-center gap-2.5 h-10 px-4 rounded-xl bg-background/70 border text-muted-foreground hover:text-foreground hover:border-primary/40 transition text-sm"
        aria-label="Open search"
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline truncate">Search animes...</span>
        <kbd className="ml-auto hidden md:flex items-center gap-0.5 text-[10px] font-mono opacity-60 border rounded px-1.5 py-0.5">
          /
        </kbd>
      </button>
    );
  }

  return (
    <div className="w-full max-w-md flex items-center gap-2 relative">
      <Search className="w-4 h-4 text-muted-foreground absolute left-3" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search animes, genres, studios..."
        className="pl-9 pr-10 h-10 rounded-xl bg-background/70"
        aria-label="Search"
      />
      <button
        onClick={() => {
          setSearchOpen(false);
          setQuery("");
          setResults([]);
        }}
        className="absolute right-2.5 p-1 rounded-md hover:bg-accent transition"
        aria-label="Close search"
      >
        ×
      </button>
      {(results.length > 0 || searching) && (
        <div className="absolute top-12 left-0 right-0 glass-strong rounded-2xl shadow-2xl border overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
          {searching && results.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Searching...</div>
          ) : (
            results.map((a) => (
              <button
                key={a.id}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-accent transition text-left"
                onClick={() => {
                  navigate("detail", { animeId: a.slug });
                  setSearchOpen(false);
                  setQuery("");
                  setResults([]);
                }}
              >
                <img src={a.coverImage} alt="" className="w-10 h-14 object-cover rounded-md" loading="lazy" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.year} · {a.type} · ★ {a.rating.toFixed(1)} ·{" "}
                    {a.isFree ? "Free" : `${a.price} credits`}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ================= SIDEBAR (desktop > 1100px / tablet overlay) ================= */

function NavButton({ item, onClick }: { item: ResolvedNavItem; onClick: () => void }) {
  const { def, active, badgeText, locked } = item;
  const Icon = def.icon;
  return (
    <button
      onClick={() => {
        if (locked && def.lockHint) {
          toast.info(def.lockHint, { duration: 5000, id: `lock-${def.id}` });
          return;
        }
        onClick();
      }}
      className={cn(
        "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all group",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
        locked && "opacity-60"
      )}
      aria-current={active ? "page" : undefined}
      aria-label={
        def.id === "exchange" && locked
          ? `Exchange — locked, ${item.ownedCount} of ${EXCHANGE_REQUIRED} animes owned`
          : locked
            ? `${def.label} — locked`
            : def.label
      }
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[9px] w-[3px] h-6 rounded-full brand-gradient" />
      )}
      <Icon className={cn("w-[18px] h-[18px] shrink-0", active && "drop-shadow-[0_0_6px_var(--glow)]")} />
      <span className="truncate">{def.label}</span>
      {locked && <Lock className="ml-auto w-3 h-3 shrink-0 text-muted-foreground" aria-label="locked" />}
      {badgeText && (
        <span className="ml-auto flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 tracking-wide">
          {badgeText}
        </span>
      )}
    </button>
  );
}

/**
 * Desktop left sidebar — ALL main navigation lives here (> 1100px).
 * `variant="overlay"` renders the same sidebar as an expanding overlay for
 * the tablet icon rail (768–1100px).
 */
export function Sidebar({
  variant = "fixed",
  onNavigate,
}: {
  variant?: "fixed" | "overlay";
  onNavigate?: () => void;
}) {
  const { user, view, navigate } = useAppStore();
  const { theme, setTheme } = useTheme();
  const items = useResolvedNav();

  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      useAppStore.getState().setUser(null);
      useAppStore.getState().navigate("home");
      toast.success("Signed out. See you soon!");
    } catch {
      toast.error("Could not sign out");
    }
  }

  const grouped: Record<NavGroup, ResolvedNavItem[]> = { browse: [], my: [], creator: [] };
  for (const it of items) grouped[it.def.group].push(it);

  const inner = (
    <>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border/70">
        <BrandLockup />
        <p className="mt-2.5 pl-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Stream · Collect · Gift
        </p>
      </div>

      {/* Links */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-6" aria-label="Main">
        {(["browse", "my", "creator"] as NavGroup[]).map((group) =>
          grouped[group].length === 0 ? null : (
            <div key={group} className="space-y-1">
              <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
                {NAV_GROUP_LABELS[group]}
              </p>
              {grouped[group].map((item) => (
                <NavButton
                  key={item.def.id}
                  item={item}
                  onClick={() => {
                    navigate(item.def.id as never);
                    onNavigate?.();
                  }}
                />
              ))}
            </div>
          )
        )}
      </nav>

      {/* Footer: user area */}
      <div className="border-t border-border/70 p-3 space-y-1">
        {user ? (
          <>
            <button
              onClick={() => {
                navigate("user-profile", { username: user.username });
                onNavigate?.();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-all group",
                view.name === "user-profile" ? "bg-primary/15" : "hover:bg-accent/60"
              )}
              aria-label="Open my profile"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.displayName || user.username}
                accent={user.accentColor}
                accentTo={user.accentTo}
                frame={user.avatarFrame}
                size={36}
              />
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-[13px] font-bold truncate">
                  {user.displayName || user.username}
                </span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  @{user.username} · {user.role === "CREATOR" ? "Creator" : "Viewer"}
                </span>
              </span>
            </button>
            <div className="flex items-center gap-1 px-1">
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent/60 transition"
                aria-label="Toggle theme"
              >
                <Sun className="w-4 h-4 hidden dark:block" />
                <Moon className="w-4 h-4 dark:hidden" />
                Theme
              </button>
              <button
                onClick={() => {
                  navigate("settings");
                  onNavigate?.();
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold transition",
                  view.name === "settings"
                    ? "text-primary bg-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={logout}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-semibold text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => {
              navigate("login");
              onNavigate?.();
            }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl brand-gradient text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-primary/25"
          >
            <UserRound className="w-4 h-4" />
            Sign in to DubAniX
          </button>
        )}
      </div>
    </>
  );

  if (variant === "overlay") {
    return (
      <motion.aside
        initial={false}
        className="flex fixed left-0 top-0 bottom-0 w-[264px] flex-col glass-strong border-r z-50 grain shadow-2xl"
        aria-label="Sidebar navigation"
      >
        {inner}
      </motion.aside>
    );
  }

  return (
    <aside
      className="hidden min-[1100px]:flex fixed left-0 top-0 bottom-0 w-[264px] flex-col glass-strong border-r z-50 grain"
      aria-label="Sidebar navigation"
    >
      {inner}
    </aside>
  );
}

/* ================= TOP BAR (search + actions) ================= */

const VIEW_TITLES: Partial<Record<ViewName, string>> = {
  home: "Home",
  browse: "Discover",
  schedule: "Schedule",
  dubbing: "AI Dubbing",
  community: "Community",
  "watch-together": "Watch Together",
  library: "My Library",
  gifts: "Gifts",
  exchange: "Gifts",
  credits: "Get Credits",
  studio: "Creator Studio",
  settings: "Settings",
  "user-profile": "Profile",
  detail: "Details",
  watch: "Now Playing",
  login: "Sign in",
};

/** Slim top bar — compact on mobile/tablet, search + actions on desktop. */
export function TopBar() {
  const { user, view, goBack, setProfileModalOpen, navigate } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const reducedMotion = useReducedMotion();

  const inSubView = ["detail", "watch", "user-profile", "studio", "settings"].includes(view.name);

  /* border-on-scroll for the compact bar */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const title = VIEW_TITLES[view.name];

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        "sticky top-0 z-40 glass-strong transition-[box-shadow,background-color] duration-300",
        scrolled ? "border-b shadow-[0_8px_24px_-16px_rgba(0,0,0,0.5)]" : "border-b border-transparent",
        "md:max-[1099.98px]:pl-[76px] min-[1100px]:pl-[264px]"
      )}
    >
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-6 h-14 min-[1100px]:h-16">
        {/* Mobile/tablet: back or brand (desktop brand is in sidebar).
            Brand = mark + DubAniX wordmark; on scroll the wordmark collapses
            to a sliver and the page title fades in (YouTube-style swap).
            Tablet rail carries the mark — the top bar shows the wordmark only. */}
        {inSubView ? (
          <button
            onClick={goBack}
            className="min-[1100px]:hidden p-2.5 -ml-1.5 rounded-xl hover:bg-accent transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Go back"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        ) : (
          <div className="min-[1100px]:hidden pl-1 flex items-center min-w-0">
            <Logo
              variant="full"
              size={28}
              onClick={() => navigate("home")}
              className={cn(
                "dbx-navbrand rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary",
                scrolled && "dbx-collapse"
              )}
            />
          </div>
        )}

        {/* Collapsed page title (mobile/tablet, appears on scroll) */}
        <div className="min-[1100px]:hidden flex-1 min-w-0 overflow-hidden">
          <AnimatePresence initial={false}>
            {scrolled && title && (
              <motion.p
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: 8 }}
                transition={{ duration: 0.18 }}
                className="font-display text-[15px] font-bold truncate"
              >
                {title}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Search — full width on desktop */}
        <div className="hidden min-[1100px]:block flex-1 justify-start">
          <div className="w-full max-w-xl">
            <SearchBox />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto min-[1100px]:ml-0">
          {/* Mobile/tablet search trigger → full-screen search */}
          <button
            onClick={() => useAppStore.getState().setMobileSearchOpen(true)}
            className="min-[1100px]:hidden p-2.5 rounded-xl hover:bg-accent transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open search"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          {user ? (
            <button
              onClick={() => navigate("credits")}
              className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition font-bold text-xs sm:text-sm"
              aria-label="Your credits balance"
            >
              <Coins className="w-4 h-4" />
              <span className="tabular-nums">{formatCredits(user.credits)}</span>
              <Plus className="w-3.5 h-3.5 opacity-70 hidden sm:block" />
            </button>
          ) : (
            <button
              onClick={() => navigate("login")}
              className="flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full brand-gradient text-white font-bold text-xs sm:text-sm hover:opacity-90 transition"
            >
              Sign in
            </button>
          )}

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden min-[1100px]:inline-flex p-2.5 rounded-xl hover:bg-accent transition"
            aria-label="Toggle theme"
          >
            <Sun className="w-[18px] h-[18px] hidden dark:block" />
            <Moon className="w-[18px] h-[18px] dark:hidden" />
          </button>

          <button
            className="p-2.5 rounded-xl hover:bg-accent transition relative min-h-[44px] min-w-[44px] hidden sm:inline-flex items-center justify-center"
            aria-label="Notifications"
            onClick={() => toast.info("You're all caught up! Nothing new here.", { id: "notif" })}
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
          </button>

          {user && (
            <button
              onClick={() => setProfileModalOpen(true)}
              className="rounded-full hover:ring-2 ring-primary/50 transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open my profile"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.displayName || user.username}
                accent={user.accentColor}
                accentTo={user.accentTo}
                frame={user.avatarFrame}
                size={34}
              />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/** Kept for backwards compatibility */
export const Header = TopBar;
export const TopNav = TopBar;
