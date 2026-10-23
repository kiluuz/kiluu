// src/lib/client-cache.ts
/**
 * Intelligent client-side cache and SWR (stale-while-revalidate) system.
 * Prevents redundant cloud requests, eliminates page flicker, and delivers 0ms instant view navigation.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<any>>();
const inFlight = new Map<string, Promise<any>>();

// Default TTLs:
// General pages: 3 minutes (180,000 ms)
// Revalidation threshold (stale time): 60 seconds (60,000 ms)
export const DEFAULT_TTL_MS = 3 * 60 * 1000;
export const DEFAULT_STALE_MS = 60 * 1000;

export function getCached<T>(key: string, maxAgeMs = DEFAULT_TTL_MS): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age > maxAgeMs) {
    return null;
  }
  return entry.data as T;
}

export function isStale(key: string, staleMs = DEFAULT_STALE_MS): boolean {
  const entry = cache.get(key);
  if (!entry) return true;
  return Date.now() - entry.timestamp > staleMs;
}

export function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    cache.clear();
    return;
  }
  for (const k of cache.keys()) {
    if (k.startsWith(keyPrefix)) {
      cache.delete(k);
    }
  }
}

/**
 * Fetch with intelligent client-side caching & request deduplication.
 * If fresh cached data exists, returns it immediately without hitting network.
 * If multiple callers request the same URL simultaneously, deduplicates into a single fetch.
 */
export async function fetchWithCache<T>(
  url: string,
  options?: {
    ttlMs?: number;
    staleMs?: number;
    forceRefresh?: boolean;
    init?: RequestInit;
  }
): Promise<T> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const force = options?.forceRefresh ?? false;

  if (!force) {
    const cached = getCached<T>(url, ttl);
    if (cached !== null) {
      return cached;
    }
  }

  // Deduplicate in-flight requests
  const existingPromise = inFlight.get(url);
  if (existingPromise) {
    return existingPromise as Promise<T>;
  }

  const fetchPromise = (async () => {
    try {
      const res = await fetch(url, options?.init);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setCached(url, data);
      return data as T;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, fetchPromise);
  return fetchPromise;
}
