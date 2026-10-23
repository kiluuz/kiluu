import uz from "../../messages/uz.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import kk from "../../messages/kk.json";
import ky from "../../messages/ky.json";

export const LOCALES = ["uz", "en", "ru", "kk", "ky"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const DICTS: Record<Locale, Record<string, string>> = { uz, en, ru, kk, ky };

const GENRE_KEYS: Record<string, string> = {
  Action: "browse.genre.action",
  Adventure: "browse.genre.adventure",
  Comedy: "browse.genre.comedy",
  Drama: "browse.genre.drama",
  Fantasy: "browse.genre.fantasy",
  "Sci-Fi": "browse.genre.sciFi",
  Romance: "browse.genre.romance",
  Thriller: "browse.genre.thriller",
  Supernatural: "browse.genre.supernatural",
  Mystery: "browse.genre.mystery",
  Sports: "browse.genre.sports",
  "Slice of Life": "browse.genre.sliceOfLife",
  Horror: "browse.genre.horror",
  Psychological: "browse.genre.psychological",
};

export function isLocale(v: string | null | undefined): v is Locale {
  return v !== null && v !== undefined && LOCALES.includes(v as Locale);
}

export function genreTranslationKey(genre: string): string {
  return GENRE_KEYS[genre] ?? genre;
}

export function t(
  locale: string | null | undefined,
  key: string,
  values?: Record<string, string | number>
): string {
  const loc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const message = DICTS[loc][key] ?? DICTS.en[key] ?? key;
  return values
    ? message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
        Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
      )
    : message;
}
