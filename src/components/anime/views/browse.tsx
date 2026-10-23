"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "../store";
import type { AnimeSummary } from "../types";
import { AnimeCard } from "../ui-bits";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-provider";
import { genreTranslationKey } from "@/lib/i18n";

const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Sci-Fi", "Romance",
  "Thriller", "Supernatural", "Mystery", "Sports", "Slice of Life", "Horror", "Psychological",
];

const TYPES = ["TV", "MOVIE", "OVA"];

export function BrowseView() {
  const { view, navigate } = useAppStore();
  const { t } = useI18n();
  const [animes, setAnimes] = useState<AnimeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState<string>(view.filters?.genre || "ALL");
  const [type, setType] = useState("ALL");
  const [sort, setSort] = useState(view.filters?.sort || "trending");
  const [freeOnly, setFreeOnly] = useState(view.filters?.free === "1");

  // Debounced fetch
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (genre !== "ALL") params.set("genre", genre);
        if (type !== "ALL") params.set("type", type);
        if (sort) params.set("sort", sort);
        if (freeOnly) params.set("free", "1");
        const res = await fetch(`/api/animes?${params}`);
        const data = await res.json();
        setAnimes(data.animes || []);
      } catch {
        setAnimes([]);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [search, genre, type, sort, freeOnly]);

  const activeFilters = useMemo(
    () => (genre !== "ALL" ? 1 : 0) + (type !== "ALL" ? 1 : 0) + (freeOnly ? 1 : 0),
    [genre, type, freeOnly]
  );

  function resetFilters() {
    setGenre("ALL");
    setType("ALL");
    setSort("trending");
    setFreeOnly(false);
    setSearch("");
    navigate("browse", {});
  }

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-6 pb-10">
      <h1 className="sr-only">{t("browse.title")}</h1>
      {/* Search + filters */}
      <div className="glass rounded-2xl p-3 sm:p-4 mb-6 space-y-3">
        <div className="flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("browse.searchPlaceholder")}
              className="pl-9 h-11 rounded-xl"
              aria-label={t("browse.searchAria")}
            />
          </div>
          <div className="flex gap-2">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[140px] h-11 rounded-xl" aria-label={t("browse.sortBy")}>
                <SelectValue placeholder={t("browse.sort")} />
              </SelectTrigger>
              <SelectContent>
                  <SelectItem value="trending">🔥 {t("browse.trending")}</SelectItem>
                  <SelectItem value="rating">⭐ {t("browse.topRated")}</SelectItem>
                  <SelectItem value="newest">🆕 {t("browse.newest")}</SelectItem>
                <SelectItem value="title">🔤 A-Z</SelectItem>
                  <SelectItem value="price-low">💎 {t("browse.priceAscending")}</SelectItem>
                  <SelectItem value="price-high">💎 {t("browse.priceDescending")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[110px] h-11 rounded-xl" aria-label={t("browse.type")}>
                <SelectValue placeholder={t("browse.type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("browse.allTypes")}</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFreeOnly(!freeOnly)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-bold border transition",
              freeOnly
                ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/25"
                : "hover:border-emerald-500/50 text-muted-foreground"
            )}
          >
            {t("browse.freeOnly")}
          </button>
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(genre === g ? "ALL" : g)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition",
                genre === g
                  ? "brand-gradient text-white border-transparent shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:border-primary/50 hover:text-foreground"
              )}
            >
              {t(genreTranslationKey(g))}
            </button>
          ))}
          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="px-3 py-1.5 rounded-full text-xs font-semibold text-destructive hover:bg-destructive/10 flex items-center gap-1 transition"
            >
              <X className="w-3 h-3" /> {t("browse.clear")}
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> {t("browse.loading")}
        </div>
      ) : animes.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-bold text-lg">{t("browse.noResults")}</p>
          <p className="text-sm text-muted-foreground mt-1">{t("browse.noResultsHint")}</p>
          <Button variant="outline" onClick={resetFilters} className="mt-4 rounded-full">
            {t("browse.resetFilters")}
          </Button>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">
            {animes.length} {t(animes.length === 1 ? "browse.resultSingular" : "browse.resultPlural")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-5">
            {animes.map((a) => (
              <div key={a.id} className="flex justify-center fade-in-up">
                <AnimeCard anime={a} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
