"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, X, ChevronRight, TrendingUp, Clock } from "lucide-react";
import { useAppStore } from "./store";
import { cn } from "@/lib/utils";
import type { AnimeSummary } from "./types";

/* ============================================================
   MOBILE SEARCH — full-screen command-style search
   Poster-thumbnail results, popular while empty, debounced,
   Esc to close, body scroll locked while open.
   ============================================================ */

export function MobileSearch() {
  const open = useAppStore((s) => s.mobileSearchOpen);
  const setOpen = useAppStore((s) => s.setMobileSearchOpen);
  const navigate = useAppStore((s) => s.navigate);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AnimeSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();

  /* focus + reset whenever opened */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  /* body scroll lock while open */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* Esc closes */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  /* debounced search — empty query shows popular (trending order) */
  useEffect(() => {
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const q = query.trim();
        const res = await fetch(`/api/animes?sort=trending${q ? `&search=${encodeURIComponent(q)}` : ""}`);
        const data = await res.json();
        setResults((data.animes || []).slice(0, 12));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, query.trim() ? 280 : 0);
    return () => clearTimeout(t);
  }, [query]);

  function go(a: AnimeSummary) {
    setOpen(false);
    setQuery("");
    requestAnimationFrame(() => navigate("detail", { animeId: a.slug }));
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Search animes"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] bg-background flex flex-col outline-none"
        >
          {/* top bar: back + input */}
          <div className="flex items-center gap-2 px-3 pt-[calc(env(safe-area-inset-top,0px)+10px)] pb-3 border-b border-border/70">
            <button
              onClick={() => setOpen(false)}
              className="p-2.5 rounded-xl hover:bg-accent transition min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 flex items-center gap-2.5 h-12 px-4 rounded-2xl bg-secondary/70 border border-border focus-within:border-primary/50 transition">
              <Search className="w-[18px] h-[18px] text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search animes, genres, studios…"
                className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground"
                aria-label="Search query"
                enterKeyHint="search"
              />
              {query && (
                <button onClick={() => setQuery("")} className="p-1 rounded-md hover:bg-accent transition" aria-label="Clear query">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* results */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3" role="listbox" aria-label="Search results">
            {!query.trim() && (
              <p className="flex items-center gap-2 px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
                <TrendingUp className="w-3.5 h-3.5" /> Popular right now
              </p>
            )}
            {query.trim() && searching && results.length === 0 && (
              <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground justify-center">
                <Clock className="w-4 h-4 animate-pulse" /> Searching…
              </p>
            )}
            {results.map((a, i) => (
              <motion.button
                key={a.id}
                role="option"
                aria-selected={false}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.025, 0.25), duration: 0.22 }}
                onClick={() => go(a)}
                className={cn(
                  "w-full flex items-center gap-3.5 p-2.5 rounded-2xl hover:bg-accent/60 active:bg-accent transition text-left",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <img
                  src={a.coverImage}
                  alt=""
                  className="w-11 h-[62px] object-cover rounded-lg border border-border/60 shrink-0"
                  loading="lazy"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-bold truncate">{a.title}</span>
                  <span className="block text-[11.5px] text-muted-foreground truncate">
                    {a.year} · {a.type} · ★ {a.rating.toFixed(1)}
                  </span>
                  <span className={cn(
                    "inline-block mt-1 text-[9.5px] font-black px-1.5 py-0.5 rounded-full border tracking-wide",
                    a.isFree
                      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                      : "bg-primary/10 text-primary border-primary/30"
                  )}>
                    {a.isFree ? "FREE" : `${a.price} CR`}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </motion.button>
            ))}
            {query.trim() && !searching && results.length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-bold">No results for “{query.trim()}”</p>
                <p className="text-[12.5px] text-muted-foreground mt-1">Try a different title, genre or studio.</p>
              </div>
            )}
            <div className="h-[calc(env(safe-area-inset-bottom,0px)+24px)]" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
