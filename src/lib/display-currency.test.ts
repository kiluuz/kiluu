import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { convertPrice, displayRates, formatDisplayPrice } from "./display-currency";

describe("display currencies", () => {
  test("uses the documented defaults when env is missing or invalid", () => {
    const rates = displayRates({ DA_PRICE_RATE_UZS: "abc", DA_PRICE_RATE_USD: "-1" });
    assert.deepEqual(rates, { UZS: 150, KZT: 6, KGS: 1.1, USD: 0.011 });
  });

  test("reads overrides from env", () => {
    const rates = displayRates({ DA_PRICE_RATE_UZS: "160", DA_PRICE_RATE_USD: "0.012" });
    assert.equal(rates.UZS, 160);
    assert.equal(rates.USD, 0.012);
    assert.equal(rates.KZT, 6);
  });

  test("rounds converted prices to sensible steps", () => {
    const rates = { UZS: 150, KZT: 6, KGS: 1.1, USD: 0.011 };
    assert.equal(convertPrice(300, "UZS", rates), 45000);
    assert.equal(convertPrice(300, "KZT", rates), 1800);
    assert.equal(convertPrice(300, "KGS", rates), 330);
    assert.equal(convertPrice(300, "USD", rates), 3.3);
    assert.equal(convertPrice(100, "KZT", rates), 600);
  });

  test("formats prices with local symbols", () => {
    const plain = (value: string) => value.replace(/\u00a0/g, " ");
    assert.equal(plain(formatDisplayPrice(45000, "UZS")), "45 000 so‘m");
    assert.equal(plain(formatDisplayPrice(1800, "KZT")), "1 800 ₸");
    assert.equal(plain(formatDisplayPrice(331, "KGS")), "331 сом");
    assert.equal(formatDisplayPrice(3.3, "USD"), "$3.30");
  });
});
