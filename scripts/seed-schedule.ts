/**
 * Seed broadcast schedule fields (airDay, airTime) for ONGOING animes.
 * Times are prime-time slots in Tashkent evening hours (18:00-23:30).
 * Also updates the seed.ts source so fresh DBs get the same data.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// slug -> [airDay (0=Sun..6=Sat), airTime]
const SCHEDULE: Record<string, [number, string]> = {
  "demon-slayer": [0, "22:00"], // Sunday
  "jujutsu-kaisen": [4, "21:30"], // Thursday
  "one-piece": [0, "10:30"], // Sunday morning classic
  "frieren-beyond-journeys-end": [5, "23:00"], // Friday late
  "chainsaw-man": [2, "22:30"], // Tuesday
  "spy-x-family": [6, "18:30"], // Saturday
  "hunter-x-hunter": [3, "19:00"], // Wednesday
  "tokyo-revengers": [6, "21:00"], // Saturday
  "my-hero-academia": [6, "17:30"], // Saturday
  "dragon-ball-super": [1, "11:00"], // Monday
  "bleach-tybw": [1, "22:00"], // Monday
  "made-in-abyss": [3, "23:30"], // Wednesday late
};

async function main() {
  const ongoing = await db.anime.findMany({
    where: { status: "ONGOING" },
    select: { id: true, slug: true, title: true },
  });
  console.log(`ONGOING animes: ${ongoing.length}`);
  for (const a of ongoing) {
    const sched = SCHEDULE[a.slug];
    if (sched) {
      await db.anime.update({
        where: { id: a.id },
        data: { airDay: sched[0], airTime: sched[1] },
      });
      console.log(`  ${a.slug} -> day ${sched[0]} @ ${sched[1]}`);
    }
  }
  const withSched = await db.anime.count({ where: { airDay: { not: null } } });
  console.log(`Animes with schedule: ${withSched}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
