import assert from "node:assert/strict";
import { test } from "node:test";
import { ANIME_GENRES, parseFavoriteGenres, rankAnimeByFavoriteGenres } from "@/lib/anime-preferences";

test("favorite anime genres accepts multiple supported genres and removes duplicates", () => {
  assert.deepEqual(parseFavoriteGenres(["Action", "Romance", "Action"]), ["Action", "Romance"]);
});

test("favorite anime genres rejects empty and unsupported selections", () => {
  assert.equal(parseFavoriteGenres([]), null);
  assert.equal(parseFavoriteGenres(["Made-up genre"]), null);
  assert.equal(parseFavoriteGenres(["Action", 42]), null);
});

test("genre choices cover common anime categories", () => {
  for (const genre of ["Action", "Romance", "Fantasy", "Comedy", "Horror", "Sci-Fi"]) {
    assert.ok(ANIME_GENRES.includes(genre as (typeof ANIME_GENRES)[number]));
  }
});

test("personalized anime ranking favors genre overlap, then trending and rating", () => {
  const ranked = rankAnimeByFavoriteGenres(
    [
      { id: "trend", genres: "Action", trending: 100, rating: 8 },
      { id: "match", genres: "Action,Romance", trending: 10, rating: 7 },
      { id: "rating", genres: "Romance", trending: 100, rating: 9 },
    ],
    ["Action", "Romance"]
  );
  assert.deepEqual(ranked.map((anime) => anime.id), ["match", "rating", "trend"]);
});
