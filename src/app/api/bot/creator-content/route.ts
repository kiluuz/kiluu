import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { botRequestAuthorized } from "@/lib/bot-secret";
import { canonicalRole } from "@/lib/rbac";
import { APP_CONFIG } from "@/lib/config";
import { releaseAnimeOnFirstEpisode } from "@/lib/creator-release";

const Identity = z.object({
  site_user_id: z.string().min(1).max(64),
  telegram_id: z.union([z.string(), z.number()]).transform(String),
});

const CreateAnime = Identity.extend({
  action: z.literal("create_anime"),
  upload_key: z.string().min(8).max(128),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(20).max(5000),
  cover_image: z.string().url().max(1000),
  genres: z.array(z.string().trim().min(1).max(40)).min(1).max(12),
  year: z.number().int().min(1900).max(2200),
  status: z.enum(["ONGOING", "COMPLETED", "UPCOMING"]),
  type: z.enum(["TV", "MOVIE", "OVA"]),
  is_free: z.boolean(),
  price: z.number().int().min(0).max(10000),
});

/**
 * Kartochka tahririda poster — doim tashqi rasm havolasi. Bot o'z serverida
 * rasm uzatmaydi, shuning uchun bu yerda ham faqat to'g'ridan-to'g'ri
 * http(s) manzil qabul qilinadi.
 */
const ImageUrl = z.string().trim().max(1000).refine(
  (value) => /^https?:\/\/\S+$/.test(value),
  { message: "cover_image must be a direct http(s) image link" },
);

const UpdateAnime = Identity.extend({
  action: z.literal("update_anime"),
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(20).max(5000).optional(),
  cover_image: ImageUrl.optional(),
  genres: z.array(z.string().trim().min(1).max(40)).min(1).max(12).optional(),
  year: z.number().int().min(1900).max(2200).optional(),
  status: z.enum(["ONGOING", "COMPLETED", "UPCOMING"]).optional(),
  type: z.enum(["TV", "MOVIE", "OVA"]).optional(),
  is_free: z.boolean().optional(),
  price: z.number().int().min(0).max(10000).optional(),
});

const CreateEpisode = Identity.extend({
  action: z.literal("create_episode"),
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  number: z.number().int().min(1).max(9999),
  title: z.string().trim().min(1).max(120),
  telegram_message_id: z.number().int().positive(),
  duration: z.number().int().min(0).max(86400).default(0),
});

const DeleteAnime = Identity.extend({
  action: z.literal("delete_anime"),
  slug: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
});

const DeleteEpisode = Identity.extend({
  action: z.literal("delete_episode"),
  episode_id: z.string().min(1).max(64).optional(),
  telegram_message_id: z.number().int().positive().optional(),
});

async function linkedCreator(siteUserId: string, telegramId: string) {
  const user = await db.user.findFirst({
    where: { id: siteUserId, telegramId },
    select: { id: true, role: true },
  });
  if (!user || canonicalRole(user.role) !== "creator") return null;
  return user;
}

export async function GET(req: NextRequest) {
  if (!botRequestAuthorized(req.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Identity.safeParse({
    site_user_id: req.nextUrl.searchParams.get("site_user_id"),
    telegram_id: req.nextUrl.searchParams.get("telegram_id"),
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid identity" }, { status: 400 });

  const user = await linkedCreator(parsed.data.site_user_id, parsed.data.telegram_id);
  if (!user) return NextResponse.json({ error: "Creator role and linked Telegram account required" }, { status: 403 });

  const animes = await db.anime.findMany({
    where: { creatorId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      year: true,
      status: true,
      type: true,
      isFree: true,
      price: true,
      moderationStatus: true,
      hidden: true,
      _count: { select: { episodes: true } },
    },
  });
  return NextResponse.json({
    animes: animes.map(({ _count, ...anime }) => ({ ...anime, episode_count: _count.episodes })),
  });
}

export async function POST(req: NextRequest) {
  if (!botRequestAuthorized(req.headers.get("x-api-key"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const action = z.object({ action: z.string() }).safeParse(body);
  if (!action.success) return NextResponse.json({ error: "Action is required" }, { status: 400 });

  if (action.data.action === "create_anime") {
    const parsed = CreateAnime.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid anime details", details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    if (!input.is_free && input.price < 10) {
      return NextResponse.json({ error: "Paid anime must cost at least 10 credits" }, { status: 400 });
    }
    const user = await linkedCreator(input.site_user_id, input.telegram_id);
    if (!user) return NextResponse.json({ error: "Creator role and linked Telegram account required" }, { status: 403 });

    const baseSlug = input.title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "creator-anime";
    const uploadSuffix = createHash("sha256")
      .update(`${user.id}:${input.upload_key}`)
      .digest("hex")
      .slice(0, 10);
    const slug = `${baseSlug}-${uploadSuffix}`;
    const existing = await db.anime.findUnique({
      where: { slug },
      select: { id: true, slug: true, title: true, creatorId: true },
    });
    if (existing) {
      if (existing.creatorId !== user.id || existing.title !== input.title) {
        return NextResponse.json({ error: "Upload key conflicts with an existing anime" }, { status: 409 });
      }
      return NextResponse.json({
        anime: { id: existing.id, slug: existing.slug, title: existing.title },
        pending: true,
        already_exists: true,
      });
    }
    try {
      const anime = await db.$transaction(async (tx) => {
        const created = await tx.anime.create({
          data: {
            slug,
            title: input.title,
            description: input.description,
            coverImage: input.cover_image.replace(/\/poster\/pending(?=\?|$)/, `/poster/${slug}`),
            bannerImage: input.cover_image.replace(/\/poster\/pending(?=\?|$)/, `/poster/${slug}`),
            genres: input.genres.join(","),
            year: input.year,
            status: input.status,
            type: input.type,
            isFree: input.is_free,
            price: input.is_free ? 0 : input.price,
            creatorId: user.id,
            source: "CREATOR",
            moderationStatus: "PENDING",
            hidden: true,
          },
          select: { id: true, slug: true, title: true },
        });
        await tx.animeVersion.create({
          data: {
            animeId: created.id,
            kind: "creator",
            creatorId: user.id,
            price: input.is_free ? 0 : input.price,
            status: "pending",
          },
        });
        return created;
      });
      return NextResponse.json({ anime, pending: true }, { status: 201 });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        const duplicate = await db.anime.findUnique({
          where: { slug },
          select: { id: true, slug: true, title: true, creatorId: true },
        });
        if (duplicate?.creatorId === user.id && duplicate.title === input.title) {
          return NextResponse.json({
            anime: { id: duplicate.id, slug: duplicate.slug, title: duplicate.title },
            pending: true,
            already_exists: true,
          });
        }
        return NextResponse.json({ error: "Anime slug already exists" }, { status: 409 });
      }
      console.error("Bot creator anime creation failed", error);
      return NextResponse.json({ error: "Could not save creator anime" }, { status: 500 });
    }
  }

  if (action.data.action === "update_anime") {
    const parsed = UpdateAnime.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid anime update", details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const sentValues = [
      input.title, input.description, input.cover_image, input.genres,
      input.year, input.status, input.type, input.is_free, input.price,
    ];
    if (!sentValues.some((value) => value !== undefined)) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }
    const user = await linkedCreator(input.site_user_id, input.telegram_id);
    if (!user) return NextResponse.json({ error: "Creator role and linked Telegram account required" }, { status: 403 });

    const anime = await db.anime.findFirst({
      where: { slug: input.slug, creatorId: user.id },
      select: {
        id: true,
        title: true,
        description: true,
        coverImage: true,
        bannerImage: true,
        genres: true,
        year: true,
        status: true,
        type: true,
        isFree: true,
        price: true,
      },
    });
    if (!anime) return NextResponse.json({ error: "Anime not found in your Creator Studio" }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.cover_image !== undefined) {
      data.coverImage = input.cover_image;
      // Banner kartochkadagi posterdan ko'chirilgan bo'lsa, yangi poster bilan birga yangilanadi.
      if (anime.bannerImage === anime.coverImage) data.bannerImage = input.cover_image;
    }
    if (input.genres !== undefined) data.genres = input.genres.join(",");
    if (input.year !== undefined) data.year = input.year;
    if (input.status !== undefined) data.status = input.status;
    if (input.type !== undefined) data.type = input.type;
    if (input.is_free !== undefined) data.isFree = input.is_free;

    const isFree = input.is_free ?? anime.isFree;
    const nextPrice = isFree ? 0 : (input.price ?? anime.price);
    if (!isFree && nextPrice < APP_CONFIG.minAnimePrice) {
      return NextResponse.json({ error: `Paid anime must cost at least ${APP_CONFIG.minAnimePrice} credits` }, { status: 400 });
    }
    if (input.price !== undefined || isFree !== anime.isFree) data.price = nextPrice;

    try {
      const updated = await db.$transaction(async (tx) => {
        const record = await tx.anime.update({
          where: { id: anime.id },
          data,
          select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            coverImage: true,
            genres: true,
            year: true,
            status: true,
            type: true,
            isFree: true,
            price: true,
            moderationStatus: true,
            hidden: true,
            _count: { select: { episodes: true } },
          },
        });
        // Sotish narxi AnimeVersion'dan o'qiladi, shuning uchun uni ham tenglashtiramiz.
        if (data.price !== undefined) {
          await tx.animeVersion.updateMany({
            where: { animeId: anime.id, kind: "creator" },
            data: { price: nextPrice },
          });
        }
        return record;
      });
      const { _count, ...animeCard } = updated;
      return NextResponse.json({ anime: { ...animeCard, episode_count: _count.episodes } });
    } catch (error) {
      console.error("Bot creator anime update failed", error);
      return NextResponse.json({ error: "Could not update creator anime" }, { status: 500 });
    }
  }

  if (action.data.action === "create_episode") {
    const parsed = CreateEpisode.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid episode details", details: parsed.error.flatten() }, { status: 400 });
    const input = parsed.data;
    const user = await linkedCreator(input.site_user_id, input.telegram_id);
    if (!user) return NextResponse.json({ error: "Creator role and linked Telegram account required" }, { status: 403 });
    const anime = await db.anime.findFirst({
      where: { slug: input.slug, creatorId: user.id },
      include: { catalogVersions: { where: { kind: "creator" }, select: { id: true }, take: 1 } },
    });
    if (!anime) return NextResponse.json({ error: "Anime not found in your Creator Studio" }, { status: 404 });
    const versionId = anime.catalogVersions[0]?.id ?? null;
    if (!versionId) return NextResponse.json({ error: "Creator anime version is missing" }, { status: 409 });
    const existingEpisode = await db.episode.findFirst({
      where: { versionId, number: input.number },
      select: { id: true },
    });
    if (existingEpisode) return NextResponse.json({ error: "This episode number already exists" }, { status: 409 });
    try {
      const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE_URL || process.env.STREAM_SERVER_URL || "https://kiluu-stream.onrender.com";
      const initialVideoUrl = input.telegram_message_id
        ? `${streamBase.replace(/\/+$/, "")}/stream/${input.telegram_message_id}`
        : "telegram";

      const episode = await db.episode.create({
        data: {
          animeId: anime.id,
          versionId,
          number: input.number,
          title: input.title,
          videoUrl: initialVideoUrl,
          duration: input.duration,
          telegramMessageId: String(input.telegram_message_id),
        },
        select: { id: true, number: true, title: true },
      });
      const released = await releaseAnimeOnFirstEpisode(anime.id);
      return NextResponse.json({ episode, released: released || undefined }, { status: 201 });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return NextResponse.json({ error: "This episode number already exists" }, { status: 409 });
      }
      console.error("Bot creator episode creation failed", error);
      return NextResponse.json({ error: "Could not save creator episode" }, { status: 500 });
    }
  }

  if (action.data.action === "delete_anime") {
    const parsed = DeleteAnime.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid anime identity" }, { status: 400 });
    const user = await linkedCreator(parsed.data.site_user_id, parsed.data.telegram_id);
    if (!user) return NextResponse.json({ error: "Creator role and linked Telegram account required" }, { status: 403 });
    const anime = await db.anime.findFirst({
      where: {
        slug: parsed.data.slug,
        creatorId: user.id,
      },
      select: { id: true },
    });
    if (!anime) return NextResponse.json({ error: "Anime cannot be rolled back" }, { status: 409 });
    const [purchases, episodes] = await Promise.all([
      db.purchase.count({ where: { animeId: anime.id } }),
      db.episode.count({ where: { animeId: anime.id } }),
    ]);
    if (purchases || episodes) return NextResponse.json({ error: "Anime already has dependent records" }, { status: 409 });
    await db.anime.delete({ where: { id: anime.id } });
    return NextResponse.json({ ok: true });
  }

  if (action.data.action === "delete_episode") {
    const parsed = DeleteEpisode.safeParse(body);
    if (
      !parsed.success ||
      (!parsed.data.episode_id && !parsed.data.telegram_message_id) ||
      (parsed.data.episode_id && parsed.data.telegram_message_id)
    ) return NextResponse.json({ error: "Provide exactly one episode identity" }, { status: 400 });
    const user = await linkedCreator(parsed.data.site_user_id, parsed.data.telegram_id);
    if (!user) return NextResponse.json({ error: "Creator role and linked Telegram account required" }, { status: 403 });
    const episode = await db.episode.findFirst({
      where: {
        ...(parsed.data.episode_id ? { id: parsed.data.episode_id } : {
          telegramMessageId: String(parsed.data.telegram_message_id),
        }),
        anime: { creatorId: user.id },
        videoUrl: "telegram",
      },
      select: { id: true },
    });
    if (!episode) return NextResponse.json({ ok: true, already_removed: true });
    await db.episode.delete({ where: { id: episode.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
