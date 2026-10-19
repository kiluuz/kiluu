"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  Search, Coins, Plus, ChevronRight, Lock, Settings as SettingsIcon,
  LogOut, LogIn, Sun, Moon, Monitor, Globe, Crown,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { useAppStore } from "./store";
import { useResolvedNav, EXCHANGE_REQUIRED, type NavGroup, type ResolvedNavItem } from "./nav-config";
import { Avatar, formatCredits } from "./ui-bits";
import { cn } from "@/lib/utils";
import type { ViewName } from "./types";
import { LOCALES, type Locale } from "@/lib/i18n";
import { useI18n } from "@/components/i18n-provider";

/* ============================================================
   NAV SHEET — "Menu" bottom sheet (mobile)
   Draggable (vaul): swipe down / scrim / Esc to close, snap points
   half/full, focus trap + scroll lock (radix dialog core).
   Header: user card + credit balance chip. Body: grouped tile grid
   with badges, lock states and a mini progress ring for Exchange.
   Footer: theme / language / notifications / settings / log out.
   ============================================================ */

const LANGS: { code: Locale; name: string }[] = [
  { code: "uz", name: "O'zbekcha" },
  { code: "en", name: "English" },
  { code: "ru", name: "Русский" },
  { code: "kk", name: "Қазақша" },
  { code: "ky", name: "Кыргызча" },
];

/** Mini progress ring — owned/20 toward Exchange unlock */
function ProgressRing({ value, max }: { value: number; max: number }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" aria-hidden="true">
      <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted-foreground/25" />
      <circle
        cx="9" cy="9" r={r} fill="none" strokeWidth="2.5" strokeLinecap="round"
        className="text-primary origin-center -rotate-90"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
      />
    </svg>
  );
}

function NavTile({ item, index, onGo }: { item: ResolvedNavItem; index: number; onGo: (id: ViewName) => void }) {
  const { def, active, badgeText, locked, ownedCount, dot } = item;
  const user = useAppStore((s) => s.user);
  const Icon = def.icon;
  const isCreatorBadge = def.id === "studio";
  const reducedMotion = useReducedMotion();

  return (
    <motion.button
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, duration: 0.28, ease: "easeOut" }}
      onClick={() => {
        if (locked && def.lockHint) {
          const guestExchange = def.id === "exchange" && !user;
          toast.info(
            guestExchange
              ? `Sign in and start collecting — the Exchange unlocks once you own ${EXCHANGE_REQUIRED} animes.`
              : def.lockHint,
            { duration: 5000, id: `lock-${def.id}` }
          );
          return;
        }
        onGo(def.id);
      }}
      className={cn(
        "relative flex flex-col gap-2.5 rounded-2xl border p-3 text-left min-h-[76px] justify-between",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all active:scale-[0.97]",
        active
          ? "border-primary/45 bg-primary/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          : "border-border/70 bg-card/50 hover:bg-accent/50"
      )}
      aria-current={active ? "page" : undefined}
      aria-label={
        def.id === "exchange"
          ? `Exchange${locked ? ` — locked, ${ownedCount} of ${EXCHANGE_REQUIRED} animes owned` : ""}`
          : def.id === "dubbing"
            ? "AI Dubbing — coming soon"
            : def.label
      }
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn(
          "relative flex items-center justify-center w-10 h-10 rounded-xl",
          active ? "bg-primary/20 text-primary" : "bg-secondary text-foreground/80",
          locked && "opacity-60"
        )}>
          <Icon className="w-5 h-5" strokeWidth={active ? 2.3 : 2} />
          {dot && (
            <span
              className="absolute -top-0.5 -right-0.5 w-[8px] h-[8px] rounded-full bg-emerald-500 live-dot border-2 border-card"
              aria-hidden="true"
            />
          )}
        </span>
        {badgeText && (
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 tracking-wide">
            {badgeText}
            <span className="sr-only"> badge</span>
          </span>
        )}
        {isCreatorBadge && !locked && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <Crown className="w-2.5 h-2.5" /> Creator
          </span>
        )}
      </div>
      <span className="flex items-center gap-1.5 text-[12px] font-bold leading-tight">
        <span className="truncate">{def.label}</span>
        {locked && <Lock className="w-3 h-3 shrink-0 text-muted-foreground" aria-label="locked" />}
      </span>
      {def.id === "exchange" && (
        <span className="flex items-center gap-1.5 -mt-1.5 text-[10px] text-muted-foreground font-semibold">
          <ProgressRing value={ownedCount} max={EXCHANGE_REQUIRED} />
          {locked ? `${ownedCount}/${EXCHANGE_REQUIRED} owned` : "Market unlocked"}
        </span>
      )}
      {def.id === "dubbing" && (
        <span className="flex items-center gap-1 -mt-1.5 text-[10px] text-muted-foreground font-semibold">
          AI dubbing is coming soon
        </span>
      )}
    </motion.button>
  );
}

export function NavSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, view, navigate } = useAppStore();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const items = useResolvedNav();
  const [langOpen, setLangOpen] = useState(false);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const go = useCallback(
    (id: ViewName) => {
      close();
      // let the sheet start closing before the view swaps underneath
      requestAnimationFrame(() => navigate(id));
    },
    [close, navigate]
  );

  function cycleTheme() {
    const order = ["light", "dark", "system"] as const;
    const next = order[(order.indexOf((theme ?? "dark") as (typeof order)[number]) + 1) % order.length];
    setTheme(next);
  }

  function pickLang(code: Locale) {
    setLocale(code);
  }

  async function logout() {
    close();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      useAppStore.getState().setUser(null);
      useAppStore.getState().navigate("home");
      toast.success("Signed out. See you soon!");
    } catch {
      toast.error("Could not sign out");
    }
  }

  const grouped = useMemo(() => {
    const g: Record<NavGroup, ResolvedNavItem[]> = { browse: [], my: [], creator: [] };
    for (const it of items) g[it.def.group].push(it);
    return g;
  }, [items]);

  let tileIndex = 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} snapPoints={[0.55, 1]} fadeFromIndex={0} repositionInputs={false}>
      <DrawerContent
        className="nav-sheet rounded-t-[28px]"
        style={{ height: "94dvh", maxHeight: "none", marginTop: 0 }}
      >
        <DrawerTitle className="sr-only">Navigation menu</DrawerTitle>
        <DrawerDescription className="sr-only">
          All Kiluu destinations, your account and quick settings
        </DrawerDescription>
        <div className="flex flex-col h-full min-h-0">
          {/* ---- header: user card + credits ---- */}
          <div className="px-5 pt-1.5 pb-3 space-y-3">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    close();
                    requestAnimationFrame(() => navigate("user-profile", { username: user.username }));
                  }}
                  className="flex flex-1 min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring transition active:scale-[0.98]"
                  aria-label="Open my profile"
                >
                  <Avatar
                    src={user.avatarUrl}
                    name={user.displayName || user.username}
                    accent={user.accentColor}
                    accentTo={user.accentTo}
                    frame={user.avatarFrame}
                    size={42}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold truncate">{user.displayName || user.username}</span>
                    </span>
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11.5px] text-muted-foreground truncate">@{user.username}</span>
                      {user.role === "CREATOR" && (
                        <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0">
                          <Crown className="w-2.5 h-2.5" /> Creator
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
                <button
                  onClick={() => go("credits")}
                  className="flex items-center gap-1.5 h-[52px] px-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 font-bold text-[13px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring transition active:scale-[0.97]"
                  aria-label={`Credit balance: ${formatCredits(user.credits)} credits. Get more credits.`}
                >
                  <Coins className="w-4 h-4" />
                  {formatCredits(user.credits)}
                  <Plus className="w-3.5 h-3.5 opacity-70" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => go("login")}
                className="w-full flex items-center gap-3 rounded-2xl brand-gradient p-3 text-white font-bold text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring transition active:scale-[0.98]"
              >
                <LogIn className="w-4.5 h-4.5" />
                Sign in to Kiluu
                <ChevronRight className="w-4 h-4 ml-auto opacity-80" />
              </button>
            )}

            {/* search trigger */}
            <button
              onClick={() => {
                close();
                requestAnimationFrame(() => useAppStore.getState().setMobileSearchOpen(true));
              }}
              className="w-full flex items-center gap-2.5 h-11 px-4 rounded-xl bg-background/70 border text-muted-foreground text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring transition"
              aria-label="Open search"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="truncate">Search animes, genres, studios…</span>
              <kbd className="ml-auto text-[10px] font-mono opacity-60 border rounded px-1.5 py-0.5">/</kbd>
            </button>
          </div>

          {/* ---- body: grouped tiles (scrollable) ---- */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-4 no-scrollbar">
            {(["browse", "my", "creator"] as NavGroup[]).map((group) =>
              grouped[group].length === 0 ? null : (
                <section key={group} className="mb-4" aria-label={t(`nav.group.${group}`)}>
                  <p className="pb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                    {t(`nav.group.${group}`)}
                  </p>
                  <div className="grid grid-cols-2 min-[400px]:grid-cols-3 gap-2">
                    {grouped[group].map((item) => (
                      <NavTile key={item.def.id} item={item} index={tileIndex++} onGo={go} />
                    ))}
                  </div>
                </section>
              )
            )}
          </div>

          {/* ---- footer row ---- */}
          <div className="border-t border-border/70 px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
            {langOpen && (
              <div className="flex flex-wrap gap-1.5 pb-2.5" role="group" aria-label="Interface language">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => pickLang(l.code)}
                    aria-pressed={locale === l.code}
                    className={cn(
                      "px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition",
                      locale === l.code
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-card/50 border-border/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-stretch justify-between gap-1" role="toolbar" aria-label="Quick settings">
              <button
                onClick={cycleTheme}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl min-h-[44px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={t("theme.change")}
              >
                {theme === "system" ? <Monitor className="w-[18px] h-[18px]" /> : theme === "light" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
                <span className="text-[9.5px] font-bold capitalize">{theme ?? "dark"}</span>
              </button>
              <button
                onClick={() => setLangOpen((v) => !v)}
                aria-expanded={langOpen}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl min-h-[44px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Interface language"
              >
                <Globe className="w-[18px] h-[18px]" />
                <span className="text-[9.5px] font-bold uppercase">{locale}</span>
              </button>
              <button
                onClick={() => go("settings")}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl min-h-[44px] transition outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view.name === "settings" ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
                aria-label="Settings"
                aria-current={view.name === "settings" ? "page" : undefined}
              >
                <SettingsIcon className="w-[18px] h-[18px]" />
                <span className="text-[9.5px] font-bold">Settings</span>
              </button>
              {user ? (
                <button
                  onClick={logout}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl min-h-[44px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Sign out"
                >
                  <LogOut className="w-[18px] h-[18px]" />
                  <span className="text-[9.5px] font-bold">Sign out</span>
                </button>
              ) : (
                <button
                  onClick={() => go("login")}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl min-h-[44px] text-primary hover:bg-primary/10 transition outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Sign in"
                >
                  <LogIn className="w-[18px] h-[18px]" />
                  <span className="text-[9.5px] font-bold">Sign in</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
