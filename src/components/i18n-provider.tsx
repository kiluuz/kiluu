"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, isLocale, t as translate, type Locale } from "@/lib/i18n";

const KEY = "dubanix.lang";
const COOKIE = "kiluu-locale";

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setCurrentLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    let initialLocaleTimer: number | undefined;
    let savedLocale: string | null = null;
    try {
      savedLocale = localStorage.getItem(KEY);
    } catch {
      // The server-provided cookie remains the locale source of truth.
    }
    const hasLocaleCookie = document.cookie
      .split("; ")
      .some((cookie) => cookie.startsWith(`${COOKIE}=`));
    if (!hasLocaleCookie && isLocale(savedLocale) && savedLocale !== initialLocale) {
      document.cookie = `${COOKIE}=${savedLocale}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
      initialLocaleTimer = window.setTimeout(() => setCurrentLocale(savedLocale), 0);
    }

    const syncLocale = (event: StorageEvent) => {
      if (event.key !== KEY || !isLocale(event.newValue)) return;
      setCurrentLocale(event.newValue);
      document.cookie = `${COOKIE}=${event.newValue}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    };
    window.addEventListener("storage", syncLocale);
    return () => {
      if (initialLocaleTimer !== undefined) window.clearTimeout(initialLocaleTimer);
      window.removeEventListener("storage", syncLocale);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // The cookie still persists the locale when storage is unavailable.
    }
    document.cookie = `${COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setCurrentLocale(l);
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string, values?: Record<string, string | number>) => translate(locale, key, values),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
