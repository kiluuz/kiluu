import { after, NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/config";
import { isCreator } from "@/lib/rbac";
import { log } from "@/lib/logger";
import { sendNewAnimeEmail } from "@/lib/email";

// POST /api/animes/[id]/notify-subscribers
// Creator yoki admin anime/versiya publish qilganda barcha subscribe bo'lgan
// userlarga DB notification va email yuboradi.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || (!isCreator(user) && !isAdminUser(user))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const kind: "new_anime" | "new_version" = body.kind === "new_version" ? "new_version" : "new_anime";

  const anime = await db.anime.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true, title: true, slug: true, coverImage: true, creatorId: true },
  });
  if (!anime) {
    return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  }

  // Faqat o'z animesi yoki admin
  if (!isAdminUser(user) && anime.creatorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Subscribe bo'lgan userlar (user + email ma'lumoti bilan)
  const subscribers = await db.animeNotify.findMany({
    where: { animeId: anime.id },
    include: {
      user: {
        select: { id: true, username: true, email: true, emailVerified: true },
      },
    },
  });

  if (subscribers.length === 0) {
    return NextResponse.json({ ok: true, notified: 0, message: "No subscribers" });
  }

  const notificationTitle =
    kind === "new_version"
      ? `"${anime.title}" uchun yangi versiya chiqdi!`
      : `"${anime.title}" Kiluu da paydo bo'ldi!`;
  const notificationBody =
    kind === "new_version"
      ? `Siz kuzatayotgan anime yangi dublyaj versiyasiga ega bo'ldi. Tomosha qiling!`
      : `Kutilgan anime endi mavjud! Hoziroq tomosha qilishni boshlang.`;

  // DB notifications (batch)
  await db.notification.createMany({
    data: subscribers.map((sub) => ({
      userId: sub.userId,
      type: kind === "new_version" ? "NEW_VERSION" : "NEW_ANIME",
      title: notificationTitle,
      body: notificationBody,
      dataJson: JSON.stringify({ animeId: anime.id, animeSlug: anime.slug }),
    })),
    skipDuplicates: true,
  });

  // Email yuborish — after() bilan async, so'rov bloklanmaydi
  const emailUsers = subscribers
    .map((sub) => sub.user)
    .filter((u) => u.email && u.emailVerified);

  after(async () => {
    let emailCount = 0;
    for (const u of emailUsers) {
      try {
        await sendNewAnimeEmail({
          to: u.email,
          username: u.username,
          animeTitle: anime.title,
          animeSlug: anime.slug,
          coverImage: anime.coverImage,
          kind,
        });
        emailCount++;
      } catch (err) {
        log.error("notify-subscribers email failed", { err: String(err), userId: u.id });
      }
    }
    log.info("notify-subscribers emails sent", { animeId: anime.id, count: emailCount });
  });

  return NextResponse.json({ ok: true, notified: subscribers.length });
}
