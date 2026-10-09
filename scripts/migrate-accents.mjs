import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const result = await db.user.updateMany({
  where: { accentColor: "#a855f7" },
  data: { accentColor: "#f97316" },
});
console.log(`Migrated ${result.count} users from purple to Midnight Cinema orange`);
await db.$disconnect();
