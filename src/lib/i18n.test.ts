import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
    "gifts.creatorBlocked",
    "profile.created",
    "profile.memberOf",
    "profile.members",
    "profile.topRated",
    "profile.teamLeader",
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

test("every supported locale ships the same key set", () => {
  const dictionaries = new Map(
    LOCALES.map((locale) => [locale, JSON.parse(readFileSync(`messages/${locale}.json`, "utf8")) as Record<string, string>])
  );
  const reference = Object.keys(dictionaries.get("en")!).sort();
  for (const locale of LOCALES) {
    const keys = Object.keys(dictionaries.get(locale)!).sort();
    assert.deepEqual(keys, reference, `${locale} key set differs from en`);
  }
});

test("creator studio and dub team copy exists in every supported locale", () => {
  for (const locale of LOCALES) {
    for (const key of ["studio.publishAnime", "studio.dubCastTitle", "studio.errTeam", "studio.captionLabel", "studio.deleteConfirmTitle", "studio.publishFailed"]) {
      assert.notEqual(t(locale, key), key, `${locale} is missing ${key}`);
    }
    for (const key of ["dub.panelTitle", "dub.teamGateHint", "dub.creditsTitle", "dub.error.TEAM_LEADER_ONLY"]) {
      assert.notEqual(t(locale, key), key, `${locale} is missing ${key}`);
    }
    for (const key of ["new", "bronze", "silver", "gold", "mythic"]) {
      assert.ok(t(locale, `dub.title.${key}`).length > 0, `${locale} is missing dub.title.${key}`);
    }
    for (const lang of LOCALES) {
      assert.notEqual(t(locale, `dub.lang.${lang}`), `dub.lang.${lang}`, `${locale} is missing dub.lang.${lang}`);
    }
  }
  assert.equal(t("en", "dub.error.TEAM_LEADER_ONLY"), "Only the team leader can delete this anime");
});
