"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, isLocale, t as translate, type Locale } from "@/lib/i18n";

const KEY = "dubanix.lang";
const CHANGE_EVENT = "kiluu-locale-change";
let memoryLocale: Locale = DEFAULT_LOCALE;

function getLocaleSnapshot(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLocale(saved)) {
      memoryLocale = saved;
      return saved;
    }
  } catch {
    // Use the in-memory selection when storage is unavailable.
  }
  return memoryLocale;
}

function subscribeToLocale(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLocale, getLocaleSnapshot, () => DEFAULT_LOCALE);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    memoryLocale = l;
    try {
      localStorage.setItem(KEY, l);
    } catch {
      // Keep the selection for this session when storage is unavailable.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string) => translate(locale, key),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
