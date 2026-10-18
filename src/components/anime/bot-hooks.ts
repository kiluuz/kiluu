"use client";

import { useEffect, useRef, useState } from "react";

export interface BotAnime {
  slug: string;
  title: string;
  description: string;
  poster: string;
  price: number;
  is_active: boolean;
  episode_count: number;
  episodes?: number[];
  episode_prices?: Record<string, number>; // "1" -> 100, "2" -> 150
}

// Module-level cache so multiple components share the same data
let cache: BotAnime[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 45_000; // 45 seconds

let inflightPromise: Promise<BotAnime[] | null> | null = null;

let botReachable = true; // false if last fetch failed

async function fetchBotCatalog(): Promise<BotAnime[] | null> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;
  if (inflightPromise) return inflightPromise;
  
  inflightPromise = fetch("/api/bot/catalog")
    .then(async (r) => {
      if (!r.ok) { botReachable = false; return null; }
      const data = await r.json();
      const result = Array.isArray(data) ? data : [];
      cache = result;
      cacheTime = Date.now();
      botReachable = true;
      return result;
    })
    .catch(() => { botReachable = false; return null; })
    .finally(() => { inflightPromise = null; }) as Promise<BotAnime[] | null>;
  
  return inflightPromise;
}

/** Returns a map of slug -> BotAnime for O(1) lookups.
 * map=null means still loading OR bot is unreachable (treat as unknown, not "unavailable"). */
export function useBotCatalog(): { map: Record<string, BotAnime> | null; loading: boolean; botError: boolean } {
  const [map, setMap] = useState<Record<string, BotAnime> | null>(() => {
    // Hydrate from cache immediately if available
    if (cache) {
      return Object.fromEntries(cache.map((a) => [a.slug, a]));
    }
    return null;
  });
  const [loading, setLoading] = useState(!cache);
  const [botError, setBotError] = useState(false);

  useEffect(() => {
    if (cache && Date.now() - cacheTime < CACHE_TTL) {
      setMap(Object.fromEntries(cache.map((a) => [a.slug, a])));
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchBotCatalog().then((animes) => {
      if (animes === null) {
        // Bot unreachable — keep map null so UI falls back to "allow purchase"
        setBotError(true);
      } else {
        setMap(Object.fromEntries(animes.map((a) => [a.slug, a])));
        setBotError(false);
      }
      setLoading(false);
    });
  }, []);

  return { map, loading, botError };
}

export interface BotStatus {
  linked: boolean;
  purchases: string[];           // slug list (whole-anime purchases)
  episodePurchases: Record<string, number[]>; // slug -> [ep numbers]
}

export function useBotStatus(enabled: boolean) {
  const [status, setStatus] = useState<BotStatus | null>(null);
  
  const refresh = () => {
    if (!enabled) return;
    fetch("/api/bot/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setStatus({
          linked: d.linked ?? false,
          purchases: d.purchases ?? [],
          episodePurchases: d.episode_purchases ?? {},
        });
      })
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
  }, [enabled]);
  
  return {
    linked: status?.linked ?? false,
    purchases: status?.purchases ?? [],
    episodePurchases: status?.episodePurchases ?? {},
    status,
    refresh,
  };
}

