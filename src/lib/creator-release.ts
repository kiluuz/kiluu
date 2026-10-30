import { db } from "@/lib/db";

/**
 * Publish qilingan anime birinchi qism (video) tushgacha katalogda yashirin turadi.
 * Qism paydo bo'lgan payt u avtomatik chiqadi — jamoa qo'shimcha ruxsat bermaydi.
 * Admin tomonidan REJECTED / TAKEDOWN qilingan kartochkalarga tegilmaydi.
 */
export async function releaseAnimeOnFirstEpisode(animeId: string): Promise<boolean> {
  const anime = await db.anime.findUnique({
    where: { id: animeId },
    select: { id: true, moderationStatus: true, _count: { select: { episodes: true } } },
  });
  if (!anime || anime.moderationStatus !== "PENDING" || anime._count.episodes === 0) return false;

  await db.$transaction([
    db.anime.update({ where: { id: anime.id }, data: { moderationStatus: "APPROVED", hidden: false } }),
    db.animeVersion.updateMany({
      where: { animeId: anime.id, kind: "creator", status: "pending" },
      data: { status: "published" },
    }),
  ]);
  return true;
}
