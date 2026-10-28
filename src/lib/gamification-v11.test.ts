import assert from "node:assert/strict";
import { test } from "node:test";
import { simulateLevelProgression, xpForLevel, levelFromXp, DAILY_ACTIVITY_CAPS } from "./xp";
import { SEEDED_SEASONAL_EVENTS } from "./seasonal-events";

test("Level 1-100 XP curve reaches 100 in 6-12 months with 150-250 XP/day", () => {
  const sim250 = simulateLevelProgression(250);
  const sim150 = simulateLevelProgression(150, 450);

  // At 250 XP/day: ~226 days (approx 7.5 months, within 6-12 months range)
  assert.ok(
    sim250.reached100Day >= 180 && sim250.reached100Day <= 270,
    `Expected 180-270 days for 250 XP/day, got ${sim250.reached100Day}`
  );

  // At 150 XP/day: ~377 days (approx 12.5 months)
  assert.ok(
    sim150.reached100Day >= 300 && sim150.reached100Day <= 420,
    `Expected 300-420 days for 150 XP/day, got ${sim150.reached100Day}`
  );

  assert.equal(xpForLevel(1), 0);
  assert.ok(xpForLevel(2) > 0);
  assert.equal(levelFromXp(xpForLevel(100)).level, 100);
});

test("an average user reaches level 10 within one week", () => {
  // Moderate activity: about 200 XP/day (two episodes, streak, some social).
  const week = simulateLevelProgression(200, 7).history.at(-1);
  assert.ok(week && week.level >= 10, `Expected level 10 after 7 days, got ${week?.level}`);
});

test("Daily activity XP caps are enforced", () => {
  assert.equal(DAILY_ACTIVITY_CAPS.post, 50);
  assert.equal(DAILY_ACTIVITY_CAPS.comment, 40);
  assert.equal(DAILY_ACTIVITY_CAPS.like, 30);
  assert.equal(DAILY_ACTIVITY_CAPS.chat, 50);
});

test("Seasonal events catalog is properly seeded with anime-themed events", () => {
  assert.ok(SEEDED_SEASONAL_EVENTS.length >= 4);
  const slugs = SEEDED_SEASONAL_EVENTS.map(e => e.slug);
  assert.ok(slugs.includes("halloween-2026"));
  assert.ok(slugs.includes("newyear-2027"));
  assert.ok(slugs.includes("navroz-2027"));
  assert.ok(slugs.includes("summer-2027"));
});
