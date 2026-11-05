import { ANIME_GENRES } from "@/lib/anime-preferences";

/**
 * Genres reach the database from three places — the upload bot, the creator
 * studio and hand-edited rows — so the stored text is a mix of English,
 * transliterated Russian and whatever spelling a creator typed ("Ramantika",
 * "kamedia", "Advanture", "kundalik hayot."). Comparing raw strings therefore
 * loses most of the catalogue, which is what makes the Discover filters look
 * broken. Everything below compares genres by a script- and punctuation-free
 * key, then falls back to a small edit distance so one mistyped letter still
 * resolves to the right genre.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ы: "y", ь: "", ъ: "",
  э: "e", ю: "yu", я: "ya", ә: "ae", і: "i", ї: "i", є: "e", ґ: "g", ђ: "d",
  љ: "l", њ: "n", ћ: "t", џ: "dz", ў: "u", ғ: "g", қ: "k", ң: "ng", ө: "o",
  ұ: "u", ү: "u", һ: "h",
};

const GENRE_ALIASES: Record<string, string[]> = {
  Action: ["Action", "Jangari", "Aksiya", "Экшен", "Экшн"],
  Adventure: ["Adventure", "Sarguzasht", "Приключения", "Шытырман оқиға", "Укмуштуу окуялар"],
  Comedy: ["Comedy", "Komediya", "Kamedia", "Комедия"],
  Drama: ["Drama", "Драма"],
  Fantasy: ["Fantasy", "Fantastika", "Фэнтези", "Фантастика"],
  "Sci-Fi": ["Sci-Fi", "SciFi", "Science Fiction", "Ilmiy fantastika", "Научная фантастика", "Ғылыми фантастика", "Илимий фантастика"],
  Romance: ["Romance", "Romantika", "Романтика"],
  Thriller: ["Thriller", "Triller", "Триллер"],
  Supernatural: ["Supernatural", "Paranormal", "G‘ayritabiiy", "Сверхъестественное", "Тылсым", "Табияттан тыш"],
  Mystery: ["Mystery", "Sirli", "Детектив"],
  Sports: ["Sports", "Sport", "Спорт"],
  "Slice of Life": ["Slice of Life", "Slice-of-Life", "Daily Life", "Kundalik hayot", "Повседневность", "Күнделікті өмір", "Күнүмдүк жашоо"],
  Horror: ["Horror", "Dahshat", "Ужасы", "Қорқынышты", "Коркунучтуу"],
  Psychological: ["Psychological", "Psixologik", "Психологическое", "Психологиялық", "Психологиялык"],
  Isekai: ["Isekai", "Isekay", "Исекай", "Parallel World"],
  Historical: ["Historical", "History", "Tarixiy", "Историческое"],
  Music: ["Music", "Musiqiy", "Музыка"],
  Mecha: ["Mecha", "Robotlar", "Роботы"],
  "Martial Arts": ["Martial Arts", "Jang san'ati", "Боевые искусства"],
  School: ["School", "Maktab", "Школа", "Мектеп"],
  Suspense: ["Suspense", "Hayajonli", "Напряжение"],
};

/** Compact comparison key: transliterated, lower-cased, letters and digits only. */
export function normalizeGenre(value: string): string {
  const lowered = String(value || "").toLowerCase().normalize("NFD");
  let out = "";
  for (const char of lowered) {
    const transliterated = CYRILLIC_TO_LATIN[char];
    if (transliterated !== undefined) {
      out += transliterated;
      continue;
    }
    const code = char.charCodeAt(0);
    if (code >= 0x300 && code <= 0x36f) continue; // combining accents
    if (/[a-z0-9]/.test(char)) out += char;
  }
  return out;
}

interface GenreAlias {
  canonical: string;
  label: string;
  key: string;
}

const GENRE_ALIASES_INDEXED: GenreAlias[] = [];
const ALIAS_BY_KEY = new Map<string, GenreAlias>();

for (const canonical of new Set<string>([...ANIME_GENRES, ...Object.keys(GENRE_ALIASES)])) {
  for (const label of [...(GENRE_ALIASES[canonical] ?? []), canonical]) {
    const key = normalizeGenre(label);
    if (!key) continue;
    const entry: GenreAlias = { canonical, label, key };
    GENRE_ALIASES_INDEXED.push(entry);
    if (!ALIAS_BY_KEY.has(key)) ALIAS_BY_KEY.set(key, entry);
  }
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/** One mistyped letter is forgiven from 5 characters up, two only from 9. */
function toleranceFor(key: string): number {
  if (key.length <= 4) return 0;
  if (key.length <= 8) return 1;
  return 2;
}

/** The catalogue genre a free-text word refers to, or null when it is not a genre. */
const resolvedGenres = new Map<string, string | null>();

export function canonicalGenre(value: string): string | null {
  const input = String(value || "");
  if (!resolvedGenres.has(input)) resolvedGenres.set(input, resolveGenre(input));
  return resolvedGenres.get(input) ?? null;
}

function resolveGenre(input: string): string | null {
  const key = normalizeGenre(input);
  if (!key) return null;

  const exact = ALIAS_BY_KEY.get(key);
  if (exact) return exact.canonical;

  if (key.length >= 4) {
    const started = GENRE_ALIASES_INDEXED
      .filter((entry) => entry.key.startsWith(key))
      .sort((a, b) => a.key.length - b.key.length);
    if (started.length) return started[0].canonical;
  }

  const tolerance = toleranceFor(key);
  if (!tolerance) return null;
  let best: { canonical: string; distance: number } | null = null;
  for (const entry of GENRE_ALIASES_INDEXED) {
    if (entry.key.length <= 4) continue;
    const distance = editDistance(key, entry.key);
    if (distance > tolerance) continue;
    if (!best || distance < best.distance) best = { canonical: entry.canonical, distance };
  }
  return best?.canonical ?? null;
}

/**
 * Every `genres contains …` term that should pull in anime of this genre: the
 * canonical name, its known labels and the spellings this catalogue actually
 * holds. Returns [] for words that are not a genre, so callers keep their
 * existing behaviour instead of silently widening the result set.
 */
export function genreFilterTerms(query: string, storedTokens: readonly string[]): string[] {
  const canonical = canonicalGenre(query);
  if (!canonical) return [];
  const terms = new Set<string>([canonical, ...(GENRE_ALIASES[canonical] ?? [])]);
  for (const token of storedTokens) {
    const trimmed = token.trim();
    if (trimmed && canonicalGenre(trimmed) === canonical) terms.add(trimmed);
  }
  return [...terms].filter((term) => term.length >= 3);
}
