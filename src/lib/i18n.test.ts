import assert from "node:assert/strict";
import { test } from "node:test";
import { isLocale, LOCALES, t } from "./i18n";

test("all selectable languages have profile and navigation translations", () => {
  assert.deepEqual(LOCALES, ["uz", "en", "ru", "kk", "ky"]);
  for (const locale of LOCALES) {
    assert.equal(isLocale(locale), true);
    assert.notEqual(t(locale, "profile.activity"), "profile.activity");
    assert.notEqual(t(locale, "nav.community"), "nav.community");
    assert.notEqual(t(locale, "theme.change"), "theme.change");
  }
  assert.equal(isLocale("fr"), false);
});
