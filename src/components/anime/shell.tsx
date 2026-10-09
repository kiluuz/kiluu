"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home, Compass, Users, Clock, Repeat, Wallet, Video,
  Search, Bell, Sun, Moon, Sparkles, LogOut,
  Settings, Clapperboard, ChevronRight, Plus, Coins, Menu, X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAppStore } from "./store";
import { Avatar, formatCredits } from "./ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AnimeSummary } from "./types";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Discover", icon: Compass },
  { id: "community", label: "Community", icon: Users },
  { id: "watch-together", label: "Watch Together", icon: Video },
  { id: "library", label: "My Library", icon: Clock },
  { id: "exchange", label: "Exchange", icon: Repeat },
] as const;

const MOBILE_NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Discover", icon: Compass },
  { id: "watch-together", label: "Party", icon: Video },
  { id: "community", label: "Community", icon: Users },
] as const;

/** Brand lockup — logo mark + wordmark + inline kana (not stacked, properly sized) */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <button
      className="flex items-center gap-3 group shrink-0"
      onClick={() => navigate("home")}
      aria-label="AniVerse home"
    >
      <div className="relative w-9 h-9 rounded-xl brand-gradient flex items-center justify-center shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
        <Sparkles className="w-[18px] h-[18px] text-white" />
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-background flex items-center justify-center" aria-hidden>
          <span className="w-1.5 h-1.5 rounded-full bg-primary live-dot" />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-black gradient-text tracking-tight", compact ? "text-base" : "text-xl")}>
          AniVerse
        </span>
        <span
          className={cn(
            "hidden sm:inline font-medium text-muted-foreground/70 tracking-[0.18em] select-none",
            compact ? "text-[9px]" : "text-[10px]"
          )}
          lang="ja"
        >
          アニバース
        </span>
      </div>
    </button>
  );
}

/** Desktop top navigation bar — opaque, sticky, cinematic */
export function TopNav() {
  const { user, view, navigate, setProfileModalOpen, setAuthOpen, searchOpen, setSearchOpen, goBack } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);
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

  const inSubView = ["detail", "watch", "user-profile", "studio", "settings"].includes(view.name);

  return (
    <header className="sticky top-0 z-40 glass-strong border-b">
      <div className="max-w-[1280px] mx-auto flex items-center gap-4 lg:gap-6 px-4 sm:px-6 h-16">
        {/* Mobile: back or logo */}
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
        <div className="hidden lg:block">
          <BrandLockup />
        </div>

        {/* Desktop nav links — clear gap from logo, refined active pill */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const active = view.name === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id as never)}
                className={cn(
                  "relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] font-semibold transition-all group",
                  active
                    ? "bg-accent text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className={cn("w-4 h-4", active && "drop-shadow-[0_0_6px_var(--glow)]")} />
                {item.label}
                {item.id === "exchange" && user && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                    20+
                  </span>
                )}
              </button>
            );
          })}
          {user?.role === "CREATOR" && (
            <button
              onClick={() => navigate("studio")}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13.5px] font-semibold transition-all",
                view.name === "studio"
                  ? "bg-accent text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
              )}
            >
              <Clapperboard className="w-4 h-4" />
              Studio
            </button>
          )}
        </nav>

        {/* Search */}
        <div className="flex-1 flex justify-end">
          {searchOpen ? (
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
                <X className="w-4 h-4" />
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
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="w-full max-w-xs xl:max-w-sm flex items-center gap-2.5 h-10 px-4 rounded-xl bg-background/70 border text-muted-foreground hover:text-foreground hover:border-primary/40 transition text-sm"
              aria-label="Open search"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline truncate">Search animes...</span>
              <kbd className="ml-auto hidden md:flex items-center gap-0.5 text-[10px] font-mono opacity-60 border rounded px-1.5 py-0.5">
                /
              </kbd>
            </button>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
            <Button
              size="sm"
              className="brand-gradient hover:opacity-90 rounded-full h-9 hidden sm:inline-flex"
              onClick={() => setAuthOpen(true)}
            >
              Sign in
            </Button>
          )}

          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2.5 rounded-xl hover:bg-accent transition"
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="w-[18px] h-[18px]" />
            ) : (
              <Moon className="w-[18px] h-[18px]" />
            )}
          </button>

          <button
            className="p-2.5 rounded-xl hover:bg-accent transition relative hidden sm:block"
            aria-label="Notifications"
            onClick={() => toast.info("You're all caught up! Nothing new here.", { id: "notif" })}
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
          </button>

          {user ? (
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
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-9 sm:hidden"
              onClick={() => setAuthOpen(true)}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const { view, navigate, user, setAuthOpen } = useAppStore();
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
            onClick={() => setAuthOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-[62px] text-primary"
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[9.5px] font-semibold">Sign in</span>
          </button>
        )}
      </div>
    </nav>
  );
}

/** Kept for backwards compatibility — old imports alias to the new top nav */
export const Sidebar = TopNav;
export const Header = TopNav;
