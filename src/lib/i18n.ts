import uz from "../../messages/uz.json";
import en from "../../messages/en.json";

export const LOCALES = ["uz", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";

const DICTS: Record<Locale, Record<string, string>> = { uz, en };

export function isLocale(v: string | null | undefined): v is Locale {
  return v === "uz" || v === "en";
}

export function t(locale: string | null | undefined, key: string): string {
  const loc: Locale = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return DICTS[loc][key] ?? DICTS.uz[key] ?? DICTS.en[key] ?? key;
}
