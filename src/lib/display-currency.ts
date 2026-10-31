export const DISPLAY_CURRENCIES = ["UZS", "KZT", "KGS", "USD"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const DISPLAY_CURRENCY_SYMBOLS: Record<DisplayCurrency, string> = {
  UZS: "so‘m",
  KZT: "₸",
  KGS: "сом",
  USD: "$",
};

const DEFAULT_RATES: Record<DisplayCurrency, number> = {
  UZS: 150,
  KZT: 6,
  KGS: 1.1,
  USD: 0.011,
};

const ENV_KEYS: Record<DisplayCurrency, string> = {
  UZS: "DA_PRICE_RATE_UZS",
  KZT: "DA_PRICE_RATE_KZT",
  KGS: "DA_PRICE_RATE_KGS",
  USD: "DA_PRICE_RATE_USD",
};

const STEPS: Record<DisplayCurrency, number> = {
  UZS: 100,
  KZT: 10,
  KGS: 1,
  USD: 0.01,
};

/** One unit of the base currency in each display currency. */
export function displayRates(env: Record<string, string | undefined> = process.env): Record<DisplayCurrency, number> {
  const rates = {} as Record<DisplayCurrency, number>;
  for (const code of DISPLAY_CURRENCIES) {
    const value = Number(env[ENV_KEYS[code]]);
    rates[code] = Number.isFinite(value) && value > 0 ? value : DEFAULT_RATES[code];
  }
  return rates;
}

export function convertPrice(
  baseAmount: number,
  code: DisplayCurrency,
  rates: Record<DisplayCurrency, number> = displayRates()
): number {
  const raw = baseAmount * rates[code];
  const step = STEPS[code];
  const rounded = Math.round(Math.round(raw / step) * step * 100) / 100;
  return Math.max(step, rounded);
}

export function formatDisplayPrice(amount: number, code: DisplayCurrency): string {
  const digits = code === "USD" ? 2 : 0;
  const text = amount.toLocaleString(code === "USD" ? "en-US" : "ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return code === "USD" ? `$${text}` : `${text} ${DISPLAY_CURRENCY_SYMBOLS[code]}`;
}
