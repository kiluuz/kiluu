import { db } from "@/lib/db";

const CACHE_TTL = 5 * 60_000;
const MAX_COMBOS = 500;

let cache: { at: number; tokens: string[] } | null = null;

/**
 * The genre spellings the catalogue currently holds, so filters can match the
 * typos creators actually typed. Cached because Discover is a hot path and the
 * set of distinct combos changes only when animes are published.
 */
export async function storedGenreTokens(): Promise<string[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL) return cache.tokens;
  try {
    const rows = await db.anime.findMany({
      where: { hidden: false, moderationStatus: "APPROVED" },
      select: { genres: true },
      distinct: ["genres"],
      orderBy: { genres: "asc" },
      take: MAX_COMBOS,
    });
    const tokens = [
      ...new Set(rows.flatMap((row) => String(row.genres || "").split(",").map((token) => token.trim()))),
    ].filter(Boolean);
    cache = { at: now, tokens };
    return tokens;
  } catch {
    return cache?.tokens ?? [];
  }
}
