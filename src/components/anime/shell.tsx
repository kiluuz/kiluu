"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home, Compass, Users, Clock, Repeat, Wallet, Video, AudioLines,
  Search, Bell, Sun, Moon, LogOut, CalendarDays,
  Settings, Clapperboard, ChevronRight, Plus, Coins, UserRound,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppStore } from "./store";
import { Avatar, formatCredits } from "./ui-bits";
import { Logo } from "./logo";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AnimeSummary } from "./types";

/** Brand lockup — DubAniX logo (animated mark + wordmark), links home */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <button
      className="flex items-center group shrink-0 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      onClick={() => navigate("home")}
      aria-label="DubAniX home"
    >
      {compact ? <Logo variant="mark" size={32} /> : <Logo variant="full" size={38} />}
    </button>
  );
}

/* ================= SEARCH ================= */

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

/* ================= SIDEBAR (desktop) ================= */

const MAIN_LINKS = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Discover", icon: Compass },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "dubbing", label: "AI Dubbing", icon: AudioLines, badge: "UZ" },
  { id: "community", label: "Community", icon: Users },
  { id: "watch-together", label: "Watch Together", icon: Video },
] as const;

const MY_LINKS = [
  { id: "library", label: "My Library", icon: Clock },
  { id: "exchange", label: "Exchange", icon: Repeat },
  { id: "credits", label: "Get Credits", icon: Wallet },
] as const;

function NavButton({
  id,
  label,
  icon: Icon,
  badge,
  active,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      key={id}
      onClick={onClick}
      className={cn(
        "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-semibold transition-all group",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
      )}
      aria-current={active ? "page" : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[9px] w-[3px] h-6 rounded-full brand-gradient" />
      )}
      <Icon className={cn("w-[18px] h-[18px] shrink-0", active && "drop-shadow-[0_0_6px_var(--glow)]")} />
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 tracking-wide">
          {badge}
        </span>
      )}
    </button>
  );
}

/** Desktop left sidebar — ALL main navigation lives here */
export function Sidebar() {
  const { user, view, navigate, setProfileModalOpen } = useAppStore();
  const { theme, setTheme } = useTheme();

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

  return (
    <aside
      className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[264px] flex-col glass-strong border-r z-40 grain"
      aria-label="Sidebar navigation"
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border/70">
        <BrandLockup />
        <p className="mt-2.5 pl-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Stream · Collect · Exchange
        </p>
      </div>

      {/* Links */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-6" aria-label="Main">
        <div className="space-y-1">
          <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
            Browse
          </p>
          {MAIN_LINKS.map((item) => (
            <NavButton
              key={item.id}
              {...item}
              active={view.name === item.id}
              onClick={() => navigate(item.id as never)}
            />
          ))}
        </div>

        <div className="space-y-1">
          <p className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">
            My Stuff
          </p>
          {MY_LINKS.map((item) => (
            <NavButton
              key={item.id}
              {...item}
              badge={item.id === "exchange" && user ? "20+" : undefined}
              active={view.name === item.id}
              onClick={() => navigate(item.id as never)}
            />
          ))}
          {user?.role === "CREATOR" && (
            <NavButton
              id="studio"
              label="Creator Studio"
              icon={Clapperboard}
              active={view.name === "studio"}
              onClick={() => navigate("studio")}
            />
          )}
        </div>
      </nav>

      {/* Footer: user area */}
      <div className="border-t border-border/70 p-3 space-y-1">
        {user ? (
          <>
            <button
              onClick={() => navigate("user-profile", { username: user.username })}
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
                onClick={() => navigate("settings")}
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
            onClick={() => navigate("login")}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl brand-gradient text-white font-bold text-sm hover:opacity-90 transition shadow-lg shadow-primary/25"
          >
            <UserRound className="w-4 h-4" />
            Sign in to DubAniX
          </button>
        )}
      </div>
    </aside>
  );
}

/* ================= TOP BAR (search + actions) ================= */

/** Slim top bar — search + quick actions. Nav links live in the sidebar. */
export function TopBar() {
  const { user, view, goBack, setProfileModalOpen, navigate } = useAppStore();
  const { theme, setTheme } = useTheme();

  const inSubView = ["detail", "watch", "user-profile", "studio", "settings"].includes(view.name);

  return (
    <header className="sticky top-0 z-40 glass-strong border-b lg:pl-[264px]">
      <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
        {/* Mobile: back or logo (desktop brand is in sidebar) */}
        {inSubView ? (
          <button
            onClick={goBack}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-accent transition"
            aria-label="Go back"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        ) : (
          <div className="lg:hidden">
            <BrandLockup compact />
          </div>
        )}

        {/* Search — full width on desktop */}
        <div className="flex-1 flex justify-end lg:justify-start">
          <div className="hidden lg:block w-full max-w-xl">
            <SearchBox />
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Mobile search trigger */}
          <button
            onClick={() => useAppStore.getState().setSearchOpen(true)}
            className="lg:hidden p-2.5 rounded-xl hover:bg-accent transition"
            aria-label="Open search"
          >
            <Search className="w-[18px] h-[18px]" />
          </button>

          {user ? (
            <button
              onClick={() => navigate("credits")}
              className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition font-bold text-xs sm:text-sm"
              aria-label="Your credits balance"
            >
              <Coins className="w-4 h-4" />
              <span className="tabular-nums">{formatCredits(user.credits)}</span>
              <Plus className="w-3.5 h-3.5 opacity-70" />
            </button>
          ) : (
            <button
              onClick={() => navigate("login")}
              className="flex items-center gap-1.5 h-9 px-4 rounded-full brand-gradient text-white font-bold text-sm hover:opacity-90 transition"
            >
              Sign in
            </button>
          )}

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl hover:bg-accent transition"
            aria-label="Toggle theme"
          >
            <Sun className="w-[18px] h-[18px] hidden dark:block" />
            <Moon className="w-[18px] h-[18px] dark:hidden" />
          </button>

          <button
            className="p-2.5 rounded-xl hover:bg-accent transition relative hidden sm:block"
            aria-label="Notifications"
            onClick={() => toast.info("You're all caught up! Nothing new here.", { id: "notif" })}
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
          </button>

          {user && (
            <button
              onClick={() => setProfileModalOpen(true)}
              className="rounded-full hover:ring-2 ring-primary/50 transition"
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
            </button>
          )}
        </div>
      </div>

      {/* Expanded mobile search row */}
      <MobileSearchRow />
    </header>
  );
}

function MobileSearchRow() {
  const searchOpen = useAppStore((s) => s.searchOpen);
  if (!searchOpen) return null;
  return (
    <div className="lg:hidden px-4 pb-3 -mt-1">
      <SearchBox />
    </div>
  );
}

/* ================= MOBILE BOTTOM TABS ================= */

const MOBILE_NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Discover", icon: Compass },
  { id: "schedule", label: "Schedule", icon: CalendarDays },
  { id: "dubbing", label: "AI Dub", icon: AudioLines },
] as const;

export function MobileNav() {
  const { view, navigate, user } = useAppStore();
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t rounded-t-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch justify-around px-1 py-1.5">
        {MOBILE_NAV.map((item) => {
          const active = view.name === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id as never)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[62px] transition",
                active ? "text-primary" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className={cn("w-5 h-5", active && "drop-shadow-[0_0_8px_var(--glow)]")} />
              <span className="text-[9.5px] font-semibold">{item.label}</span>
            </button>
          );
        })}
        {user ? (
          <button
            onClick={() => navigate("library")}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[62px] transition",
              view.name === "library" ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[9.5px] font-semibold">Library</span>
          </button>
        ) : (
          <button
            onClick={() => navigate("login")}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[62px] text-primary"
          >
            <Logo variant="mark" size={22} />
            <span className="text-[9.5px] font-semibold">Sign in</span>
          </button>
        )}
      </div>
    </nav>
  );
}

/** Kept for backwards compatibility */
export const Header = TopBar;
export const TopNav = TopBar;
