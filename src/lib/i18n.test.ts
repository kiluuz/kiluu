import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_LOCALE, isLocale, LOCALES, t } from "./i18n";

test("all selectable languages have profile and navigation translations", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.equal(t(null, "nav.home"), "Home");
  assert.deepEqual(LOCALES, ["uz", "en", "ru", "kk", "ky"]);
  for (const locale of LOCALES) {
    assert.equal(isLocale(locale), true);
    assert.notEqual(t(locale, "profile.activity"), "profile.activity");
    assert.notEqual(t(locale, "nav.community"), "nav.community");
    assert.notEqual(t(locale, "theme.change"), "theme.change");
  }
  assert.equal(isLocale("fr"), false);
});

test("all selectable languages have translations for the main app views", () => {
  const keys = [
    "browse.title",
    "browse.subtitle",
    "browse.genre.action",
    "home.forYourTaste",
    "home.continueWatching",
    "settings.title",
    "dubbing.description",
    "scheduleSubtitle",
    "schedule.searchPlaceholder",
    "schedule.status.airing",
    "community.title",
    "community.category.watchparties",
    "community.composerPlaceholder",
    "gifts.description",
    "gifts.status.claimed",
    "library.guestTitle",
    "library.telegramDelivered",
  ];
  for (const locale of LOCALES) {
    for (const key of keys) {
      assert.notEqual(t(locale, key), key, `${locale} is missing ${key}`);
    }
  }
  assert.equal(t("uz", "browse.title"), "Kashf etish");
  assert.equal(t("ru", "browse.title"), "Каталог");
});
