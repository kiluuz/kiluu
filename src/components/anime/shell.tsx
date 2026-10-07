"use client";

import { useEffect, useRef, useState } from "react";
import {
  Home, Compass, Users, Clock, Repeat, Wallet, Video,
  Search, Bell, Sun, Moon, Menu, X, Sparkles, LogOut,
  Settings, Clapperboard, ChevronRight, Plus, Coins,
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
  { id: "credits", label: "Get Credits", icon: Wallet },
] as const;

const MOBILE_NAV = [
  { id: "home", label: "Home", icon: Home },
  { id: "browse", label: "Discover", icon: Compass },
  { id: "watch-together", label: "Party", icon: Video },
  { id: "community", label: "Community", icon: Users },
] as const;

export function Sidebar() {
  const { user, view, navigate, setProfileModalOpen } = useAppStore();
  return (
    <aside className="hidden lg:flex flex-col w-[240px] shrink-0 border-r bg-sidebar h-screen sticky top-0 z-30">
      {/* Logo */}
      <div className="p-5 pb-4">
        <button
          className="flex items-center gap-2.5 group"
          onClick={() => navigate("home")}
          aria-label="AniVerse home"
        >
          <div className="w-9 h-9 rounded-xl brand-gradient flex items-center justify-center shadow-lg shadow-primary/25 group-hover:scale-105 transition">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="text-left">
            <span className="font-black text-lg leading-none gradient-text">AniVerse</span>
            <span className="block text-[9px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">
              premium anime
            </span>
          </div>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-1" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = view.name === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id as never)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                active
                  ? "brand-gradient text-white shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
              aria-current={active ? "page" : undefined}
            >
              <item.icon className={cn("w-4.5 h-4.5", active ? "text-white" : "group-hover:scale-110 transition")} />
              {item.label}
              {item.id === "exchange" && user && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  20+
                </span>
              )}
            </button>
          );
        })}

        {user?.role === "CREATOR" && (
          <>
            <div className="pt-4 pb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Creator
            </div>
            <button
              onClick={() => navigate("studio")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                view.name === "studio"
                  ? "brand-gradient text-white shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Clapperboard className="w-4.5 h-4.5" />
              Creator Studio
            </button>
          </>
        )}
      </nav>

      {/* User card bottom */}
      <div className="p-3 border-t">
        {user ? (
          <button
            onClick={() => setProfileModalOpen(true)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-accent transition group"
            aria-label="Open my profile"
          >
            <Avatar src={user.avatarUrl} name={user.displayName || user.username} accent={user.accentColor} size={36} />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition">
                {user.displayName || user.username}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {user.role === "CREATOR" ? "✦ Creator" : "Viewer"} · @{user.username}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
          </button>
        ) : (
          <div className="text-xs text-muted-foreground px-2 py-1">Sign in to unlock everything</div>
        )}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { view, navigate, user, setAuthOpen } = useAppStore();
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass border-t rounded-t-2xl"
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
        {/* Library or Sign in */}
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

export function Header() {
  const { user, navigate, setProfileModalOpen, setAuthOpen, searchOpen, setSearchOpen, view, goBack } = useAppStore();
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

  return (
    <header className="sticky top-0 z-40 glass border-b">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-14 sm:h-16">
        {/* Mobile logo */}
        <button
          className="lg:hidden flex items-center gap-2 shrink-0"
          onClick={() => navigate("home")}
          aria-label="AniVerse home"
        >
          <div className="w-8 h-8 rounded-lg brand-gradient flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-black text-base gradient-text hidden sm:block">AniVerse</span>
        </button>

        {/* Back button when in sub views on mobile */}
        {["detail", "watch", "user-profile", "studio", "settings"].includes(view.name) && (
          <button
            onClick={goBack}
            className="lg:hidden p-1.5 rounded-lg hover:bg-accent transition"
            aria-label="Go back"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
        )}

        {/* Search trigger */}
        {searchOpen ? (
          <div className="flex-1 flex items-center gap-2 relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search animes, genres, studios..."
              className="pl-9 pr-10 h-10 rounded-xl bg-background/60"
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
            {/* Results dropdown */}
            {(results.length > 0 || searching) && (
              <div className="absolute top-12 left-0 right-0 glass rounded-2xl shadow-2xl border overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
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
                      { }
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
            className="flex-1 max-w-md flex items-center gap-2.5 h-10 px-4 rounded-xl bg-background/60 border text-muted-foreground hover:text-foreground hover:border-primary/40 transition text-sm"
            aria-label="Open search"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search animes...</span>
            <kbd className="ml-auto hidden md:flex items-center gap-0.5 text-[10px] font-mono opacity-60 border rounded px-1.5 py-0.5">
              /
            </kbd>
          </button>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Credits pill */}
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

          {/* Theme toggle */}
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

          {/* Bell */}
          <button
            className="p-2.5 rounded-xl hover:bg-accent transition relative hidden sm:block"
            aria-label="Notifications"
            onClick={() => toast.info("You're all caught up! Nothing new here.", { id: "notif" })}
          >
            <Bell className="w-[18px] h-[18px]" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-fuchsia-500 live-dot" />
          </button>

          {/* Profile / Avatar */}
          {user ? (
            <button
              onClick={() => {
                // Desktop opens the Discord-style mini modal; mobile goes to the full profile page
                if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
                  setProfileModalOpen(true);
                } else {
                  navigate("user-profile", { username: user.username });
                }
              }}
              className="rounded-full hover:ring-2 ring-primary/50 transition"
              aria-label="Open my profile"
            >
              <Avatar
                src={user.avatarUrl}
                name={user.displayName || user.username}
                accent={user.accentColor}
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
