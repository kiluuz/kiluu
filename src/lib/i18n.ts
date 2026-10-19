import uz from "../../messages/uz.json";
import en from "../../messages/en.json";
import ru from "../../messages/ru.json";
import kk from "../../messages/kk.json";
import ky from "../../messages/ky.json";

export const LOCALES = ["uz", "en", "ru", "kk", "ky"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";

const DICTS: Record<Locale, Record<string, string>> = { uz, en, ru, kk, ky };

export function isLocale(v: string | null | undefined): v is Locale {
  return v !== null && v !== undefined && LOCALES.includes(v as Locale);
}

export function t(locale: string | null | undefined, key: string): string {
  const loc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return DICTS[loc][key] ?? DICTS.en[key] ?? key;
}
