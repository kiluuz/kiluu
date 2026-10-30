import { db } from "@/lib/db";
import { ensureAchievementsSeeded } from "./achievements";

const PACKAGES = [
  { id: "starter", name: "Starter", credits: 200, starsPrice: 50, priceDa: 100, bonus: 0, popular: false, sortOrder: 1 },
  { id: "basic", name: "Basic", credits: 550, starsPrice: 150, priceDa: 300, bonus: 50, popular: true, sortOrder: 2 },
  { id: "plus", name: "Plus", credits: 1200, starsPrice: 300, priceDa: 600, bonus: 200, popular: false, sortOrder: 3 },
  { id: "pro", name: "Pro", credits: 2600, starsPrice: 600, priceDa: 1200, bonus: 600, popular: false, sortOrder: 4 },
  { id: "mega", name: "Mega", credits: 7000, starsPrice: 1500, priceDa: 3000, bonus: 2000, popular: false, sortOrder: 5 },
];

export async function ensureRuntimeSeed() {
  await ensureAchievementsSeeded();
  const n = await db.creditPackage.count();
  if (n === 0) {
    for (const p of PACKAGES) {
      await db.creditPackage.create({ data: p });
    }
  }
  const cfg = await db.platformConfig.findUnique({ where: { key: "creator_share" } });
  if (!cfg) {
    await db.platformConfig.create({ data: { key: "creator_share", value: "70" } });
    await db.platformConfig.create({ data: { key: "platform_share", value: "30" } });
  }
}
