export const ANIME_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Mystery",
  "Horror",
  "Slice of Life",
  "Sports",
  "Thriller",
  "Supernatural",
  "Isekai",
  "Psychological",
  "Historical",
  "Music",
  "Mecha",
  "Martial Arts",
  "School",
  "Suspense",
] as const;

export type AnimeGenre = (typeof ANIME_GENRES)[number];

export function parseFavoriteGenres(value: unknown): AnimeGenre[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > ANIME_GENRES.length) {
    return null;
  }

  const genres = [...new Set(value)];
  if (genres.some((genre) => typeof genre !== "string" || !ANIME_GENRES.includes(genre as AnimeGenre))) {
    return null;
  }

  return genres as AnimeGenre[];
}

export function rankAnimeByFavoriteGenres<T extends { genres: string; trending: number; rating: number }>(
  animes: T[],
  favoriteGenres: readonly string[]
): T[] {
  const preferences = new Set(favoriteGenres.map((genre) => genre.trim().toLowerCase()));
  const matchCount = (genres: string) =>
    genres.split(",").map((genre) => genre.trim().toLowerCase())
      .filter((genre) => preferences.has(genre)).length;

  return [...animes].sort((a, b) =>
    matchCount(b.genres) - matchCount(a.genres) ||
    b.trending - a.trending ||
    b.rating - a.rating
  );
}
