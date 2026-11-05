import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalGenre, genreFilterTerms, normalizeGenre } from "@/lib/genre-match";

test("genre keys ignore case, punctuation and script", () => {
  assert.equal(normalizeGenre("Romantika"), "romantika");
  assert.equal(normalizeGenre("Slice of Life"), "sliceoflife");
  assert.equal(normalizeGenre("G‘ayritabiiy"), "gayritabiiy");
  assert.equal(normalizeGenre("kundalik hayot."), "kundalikhayot");
  assert.equal(normalizeGenre("Романтика"), "romantika");
  assert.equal(normalizeGenre("Ғылыми фантастика"), "gylymifantastika");
});

test("a genre chip matches whatever case the viewer typed", () => {
  assert.equal(canonicalGenre("Romance"), "Romance");
  assert.equal(canonicalGenre("romance"), "Romance");
  assert.equal(canonicalGenre("ROMANTIKA"), "Romance");
});

test("one or two mistyped letters still resolve to the genre", () => {
  assert.equal(canonicalGenre("ramantika"), "Romance");
  assert.equal(canonicalGenre("advanture"), "Adventure");
  assert.equal(canonicalGenre("kamedia"), "Comedy");
  assert.equal(canonicalGenre("isekay"), "Isekai");
});

test("locale labels and transliterations resolve to the same genre", () => {
  assert.equal(canonicalGenre("sarguzasht"), "Adventure");
  assert.equal(canonicalGenre("экшен"), "Action");
  assert.equal(canonicalGenre("kundalik hayot"), "Slice of Life");
  assert.equal(canonicalGenre("мактаб"), "School");
  assert.equal(canonicalGenre("sci fi"), "Sci-Fi");
});

test("partial words match the genre they start", () => {
  assert.equal(canonicalGenre("romant"), "Romance");
  assert.equal(canonicalGenre("dram"), "Drama");
  assert.equal(canonicalGenre("fant"), "Fantasy");
});

test("words that are not genres stay unmatched", () => {
  assert.equal(canonicalGenre("naruto"), null);
  assert.equal(canonicalGenre("abc"), null);
  assert.equal(canonicalGenre(""), null);
});

test("a chip pulls in its labels in every script, not other genres", () => {
  const terms = genreFilterTerms("Romance", ["Action", "Romance", "Ramantika", "romantika", "kundalik hayot."]);
  assert.deepEqual(new Set(terms), new Set(["Romance", "Romantika", "Романтика", "Ramantika", "romantika"]));
});

test("a chip includes its own labels plus the stored typos", () => {
  const terms = genreFilterTerms("Romance", ["Action", "Ramantika", "romantika"]);
  assert.ok(terms.includes("Romance"));
  assert.ok(terms.includes("Romantika"));
  assert.ok(terms.includes("Ramantika"));
  assert.ok(terms.includes("romantika"));
  assert.ok(!terms.includes("Action"));
});

test("non-genre filters keep their existing exact behaviour", () => {
  assert.deepEqual(genreFilterTerms("naruto", ["Romance"]), []);
});

test("multi-word genres match the stored label with trailing punctuation", () => {
  const terms = genreFilterTerms("Slice of Life", ["kundalik hayot."]);
  assert.ok(terms.includes("Slice of Life"));
  assert.ok(terms.includes("kundalik hayot."));
});
