// src/lib/seasonal-events.ts
// DubAniX Mavsumiy tadbirlar (Seasonal Events) tizimi (11-QISM)

import { db } from "./db";

export const SEEDED_SEASONAL_EVENTS = [
  {
    slug: "halloween-2026",
    title: "Halloween Spooktacular 2026",
    titleUz: "Xellouin 2026: Dahshatli Kecha",
    description: "Anime olamida eng sirli va sehrli fasl boshlandi! Maxsus vazifalarni bajaring va eksklyuziv 'Qovoq ramkasi'ni qo'lga kiriting.",
    themeColor: "#f97316",
    bannerUrl: "/frames/halloween.webp",
    startsAt: new Date("2026-10-24T00:00:00.000Z"),
    endsAt: new Date("2026-11-04T23:59:59.000Z"),
    isNeverReturns: true,
    configJson: JSON.stringify({
      exclusiveFrame: "frame:halloween_2026",
      specialEmote: ":pumpkin:",
    }),
  },
  {
    slug: "newyear-2027",
    title: "New Year Celebration 2027",
    titleUz: "Yangi Yil 2027 Qorli Fest",
    description: "Yangi yil quvonchini anime bilan kutib oling! Qorbobo sovg'alari va cheklangan 'Muzlagan ramka'.",
    themeColor: "#38bdf8",
    bannerUrl: "/frames/newyear.webp",
    startsAt: new Date("2026-12-25T00:00:00.000Z"),
    endsAt: new Date("2027-01-08T23:59:59.000Z"),
    isNeverReturns: true,
    configJson: JSON.stringify({
      exclusiveFrame: "frame:ice_2027",
      specialEmote: ":snowflake:",
    }),
  },
  {
    slug: "navroz-2027",
    title: "Navruz Spring Festival 2027",
    titleUz: "Navro'z Bahoriy Fest 2027",
    description: "Bahoriy uyg'onish va yangilanish fasli! Jamiyatda baham ko'ring va milliy naqshli maxsus nishonlarni oching.",
    themeColor: "#10b981",
    bannerUrl: "/frames/navroz.webp",
    startsAt: new Date("2027-03-18T00:00:00.000Z"),
    endsAt: new Date("2027-03-28T23:59:59.000Z"),
    isNeverReturns: true,
    configJson: JSON.stringify({
      exclusiveFrame: "frame:navroz_spring",
      specialEmote: ":sumalak:",
    }),
  },
  {
    slug: "summer-2027",
    title: "Summer Heat Wave 2027",
    titleUz: "Yozgi Anime To'lqini 2027",
    description: "Yozgi ta'tilda eng qiziqarli animelarni birgalikda tomosha qiling!",
    themeColor: "#f59e0b",
    bannerUrl: "/frames/summer.webp",
    startsAt: new Date("2027-06-15T00:00:00.000Z"),
    endsAt: new Date("2027-07-15T23:59:59.000Z"),
    isNeverReturns: true,
    configJson: JSON.stringify({
      exclusiveFrame: "frame:sun_fire",
      specialEmote: ":sun:",
    }),
  },
];

export async function ensureSeasonalEventsSeeded() {
  const count = await db.seasonalEvent.count();
  if (count > 0) return;

  for (const ev of SEEDED_SEASONAL_EVENTS) {
    await db.seasonalEvent.upsert({
      where: { slug: ev.slug },
      update: {},
      create: ev,
    });
  }
}

export async function getActiveSeasonalEvent() {
  await ensureSeasonalEventsSeeded();

  const now = new Date();
  const active = await db.seasonalEvent.findFirst({
    where: {
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    include: {
      quests: {
        where: { isActive: true },
      },
    },
  });

  return active;
}
