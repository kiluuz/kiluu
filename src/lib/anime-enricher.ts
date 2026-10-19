import { db } from "@/lib/db";

export interface EnrichedAnimeData {
  title: string;
  altTitle?: string;
  description: string;
  coverImage: string;
  bannerImage: string;
  genres: string[];
  year: number;
  rating: number;
  status: "ONGOING" | "COMPLETED" | "UPCOMING";
  type: "TV" | "MOVIE" | "OVA";
}

/**
 * Clean query string from Uzbek/Russian season words for AniList search
 * e.g. "Qora Clover (2-fasl)" -> "Black Clover" or "Qora Clover"
 * "Black Clover 2 season" -> "Black Clover"
 */
function cleanSearchQuery(raw: string): string {
  let cleaned = raw
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\b(fasl|mavsum|sezon|season|qism|seriya|episodes?|dublyaj|uzbek|rus)\b/gi, "")
    .replace(/\b\d+\s*(?:fasl|mavsum|sezon|season)\b/gi, "")
    .trim();

  // Common uzbek title translations for popular anime
  const TRANSLATIONS: Record<string, string> = {
    "qora clover": "Black Clover",
    "qora yonbosh": "Black Clover",
    "sehrgarlik jangi": "Jujutsu Kaisen",
    "titanlar hujumi": "Attack on Titan",
    "iblislar qotili": "Demon Slayer",
    "yakka daraja": "Solo Leveling",
    "o'lim daftari": "Death Note",
    "olim daftari": "Death Note",
    "qahramonlik akademiyasi": "My Hero Academia",
  };

  const lower = cleaned.toLowerCase();
  for (const [key, val] of Object.entries(TRANSLATIONS)) {
    if (lower.includes(key)) {
      return val;
    }
  }

  return cleaned || raw;
}

/**
 * Fetch official anime posters, banner, and metadata from AniList GraphQL
 */
async function fetchFromAniList(searchQuery: string): Promise<EnrichedAnimeData | null> {
  const query = `
    query ($search: String) {
      Media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          english
          romaji
          native
        }
        coverImage {
          extraLarge
          large
          medium
        }
        bannerImage
        description(asHtml: false)
        genres
        seasonYear
        startDate {
          year
        }
        averageScore
        status
        format
      }
    }
  `;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search: searchQuery },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const media = json?.data?.Media;
    if (!media) return null;

    const cover = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || "";
    const banner = media.bannerImage || cover;

    let cleanDesc = media.description || "";
    cleanDesc = cleanDesc.replace(/<[^>]*>/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (!cleanDesc) cleanDesc = `${media.title?.english || searchQuery} anime seriali.`;

    let status: "ONGOING" | "COMPLETED" | "UPCOMING" = "COMPLETED";
    if (media.status === "RELEASING") status = "ONGOING";
    else if (media.status === "NOT_YET_RELEASED") status = "UPCOMING";

    let type: "TV" | "MOVIE" | "OVA" = "TV";
    if (media.format === "MOVIE") type = "MOVIE";
    else if (media.format === "OVA" || media.format === "ONA") type = "OVA";

    const rating = media.averageScore ? Math.round((media.averageScore / 10) * 10) / 10 : 8.0;
    const year = media.seasonYear || media.startDate?.year || new Date().getFullYear();

    return {
      title: media.title?.english || media.title?.romaji || searchQuery,
      altTitle: media.title?.romaji !== media.title?.english ? media.title?.romaji : media.title?.native,
      description: cleanDesc,
      coverImage: cover,
      bannerImage: banner,
      genres: Array.isArray(media.genres) && media.genres.length > 0 ? media.genres : ["Action", "Adventure"],
      year,
      rating,
      status,
      type,
    };
  } catch (err) {
    console.error("AniList fetch error:", err);
    return null;
  }
}

/**
 * Fallback to Kitsu API if AniList doesn't return results
 */
async function fetchFromKitsu(searchQuery: string): Promise<EnrichedAnimeData | null> {
  try {
    const url = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(searchQuery)}&page[limit]=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/vnd.api+json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const item = json?.data?.[0];
    if (!item) return null;

    const attr = item.attributes;
    const cover = attr.posterImage?.large || attr.posterImage?.original || attr.posterImage?.medium || "";
    const banner = attr.coverImage?.large || attr.coverImage?.original || cover;

    let status: "ONGOING" | "COMPLETED" | "UPCOMING" = "COMPLETED";
    if (attr.status === "current") status = "ONGOING";
    else if (attr.status === "upcoming") status = "UPCOMING";

    const rating = attr.averageRating ? Math.round((parseFloat(attr.averageRating) / 10) * 10) / 10 : 8.0;
    const year = attr.startDate ? parseInt(attr.startDate.split("-")[0]) || new Date().getFullYear() : new Date().getFullYear();

    return {
      title: attr.canonicalTitle || attr.titles?.en || attr.titles?.en_jp || searchQuery,
      altTitle: attr.titles?.ja_jp || attr.titles?.en_jp,
      description: attr.synopsis || `${searchQuery} animesi.`,
      coverImage: cover,
      bannerImage: banner,
      genres: ["Action", "Adventure"],
      year,
      rating,
      status,
      type: attr.subtype === "movie" ? "MOVIE" : "TV",
    };
  } catch (err) {
    console.error("Kitsu fetch error:", err);
    return null;
  }
}

/**
 * Auto-enrich anime information and high-res images by title or slug
 */
export async function autoEnrichAnime(query: string): Promise<EnrichedAnimeData> {
  const cleaned = cleanSearchQuery(query);

  // 1. Try AniList with cleaned query
  let result = await fetchFromAniList(cleaned);

  // 2. If not found, try raw query
  if (!result && cleaned !== query) {
    result = await fetchFromAniList(query);
  }

  // 3. Fallback to Kitsu
  if (!result) {
    result = await fetchFromKitsu(cleaned);
  }

  // 4. Default fallback if neither API returned
  if (!result) {
    const isBlackClover = /black.?clover|qora.?clover/i.test(query);
    const cover = isBlackClover
      ? "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx97940-fyh8o7gNbha0.png"
      : "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=80";
    const banner = isBlackClover
      ? "https://s4.anilist.co/file/anilistcdn/media/anime/banner/97940-1URQdQ4U1a0b.jpg"
      : "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&auto=format&fit=crop&q=80";

    return {
      title: isBlackClover ? "Qora Clover (Black Clover)" : query,
      altTitle: isBlackClover ? "Black Clover" : undefined,
      description: isBlackClover
        ? "Sehrgarlik dunyosida hech qanday sehrsiz tug'ilgan Asta eng buyuk Sehrgarlar Qiroli bo'lishga ahd qiladi! Qora Buqalar otryadi bilan aqlbovar qilmas janglar!"
        : `${query} — an interesting and popular anime series.`,
      coverImage: cover,
      bannerImage: banner,
      genres: ["Action", "Adventure", "Fantasy", "Shounen"],
      year: isBlackClover ? 2017 : new Date().getFullYear(),
      rating: 8.5,
      status: "COMPLETED",
      type: "TV",
    };
  }

  return result;
}

/**
 * Slugify helper
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ensure an anime exists in the website database.
 * If not, automatically fetches images from AniList/web and creates it!
 */
export async function ensureAnimeInDatabase(params: {
  title: string;
  slug?: string;
  price?: number;
  isFree?: boolean;
  status?: string;
  coverImage?: string;
  bannerImage?: string;
  description?: string;
}) {
  const searchSlug = params.slug ? slugify(params.slug) : slugify(params.title);

  // Check if already in db
  let existing = await db.anime.findUnique({
    where: { slug: searchSlug },
  });

  if (!existing && params.title) {
    existing = await db.anime.findFirst({
      where: {
        OR: [
          { title: { equals: params.title.trim() } },
          { slug: { equals: slugify(params.title) } },
        ],
      },
    });
  }

  if (existing) {
    const updateData: any = {};
    if (params.price && params.price > 0 && existing.price === 0) {
      updateData.price = params.price;
    }
    if (params.coverImage && !existing.coverImage) {
      updateData.coverImage = params.coverImage;
    }
    if (params.description && !existing.description) {
      updateData.description = params.description;
    }
    if (Object.keys(updateData).length > 0) {
      existing = await db.anime.update({
        where: { id: existing.id },
        data: updateData,
      });
    }
    const ver = await db.animeVersion.findFirst({ where: { animeId: existing.id } });
    if (!ver) {
      await db.animeVersion.create({
        data: {
          animeId: existing.id,
          kind: existing.source === "CREATOR" ? "creator" : "official",
          creatorId: existing.creatorId,
          price: existing.price,
          status: "published",
        },
      });
    }
    return { anime: existing, created: false };
  }

  // Not in DB — auto-fetch posters and details!
  const enriched = await autoEnrichAnime(params.title || params.slug || "Anime");

  const finalSlug = searchSlug || slugify(enriched.title);
  const isFree = params.isFree ?? false;
  const price = isFree ? 0 : (params.price ?? 100);

  const anime = await db.anime.create({
    data: {
      slug: finalSlug,
      title: params.title?.trim() || enriched.title,
      altTitle: enriched.altTitle || null,
      description: params.description?.trim() || enriched.description,
      coverImage: params.coverImage || enriched.coverImage,
      bannerImage: params.bannerImage || enriched.bannerImage,
      genres: enriched.genres.join(","),
      year: enriched.year,
      rating: enriched.rating,
      status: (params.status as any) || enriched.status,
      type: enriched.type,
      isFree,
      price,
      trending: 10,
      featured: false,
      source: "OFFICIAL",
      moderationStatus: "APPROVED",
      hidden: false,
    },
  });
  await db.animeVersion.create({
    data: {
      animeId: anime.id,
      kind: "official",
      price,
      status: "published",
    },
  });

  return { anime, created: true };
}
