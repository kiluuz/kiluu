import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isCreator } from "@/lib/rbac";
import { APP_CONFIG } from "@/lib/config";
import {
  assertPublishTeam,
  createDubCreditRow,
  dubErrorInfo,
  prepareDubCast,
  recomputeTeamReputation,
  type DubCastInput,
} from "@/lib/dub-teams";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreator(user)) {
    return NextResponse.json({ error: "Only creators can access the studio" }, { status: 403 });
  }

  const animes = await db.anime.findMany({
    where: { creatorId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { episodes: true, purchases: true, favorites: true } },
      catalogVersions: { select: { id: true, status: true, price: true, kind: true } },
      dubTeam: { select: { id: true, name: true, reputation: true, verified: true, _count: { select: { members: true } } } },
      dubCredits: { select: { language: true, speakerCount: true } },
    },
  });

  const earnings = await db.creditTransaction.aggregate({
    where: { userId: user.id, type: "BONUS", description: { contains: "Creator share" } },
    _sum: { amount: true },
  });

  return NextResponse.json({
    earnings: earnings._sum.amount ?? 0,
    animes: animes.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      coverImage: a.coverImage,
      status: a.status,
      type: a.type,
      isFree: a.isFree,
      price: a.price,
      year: a.year,
      rating: a.rating,
      episodeCount: a._count.episodes,
      purchaseCount: a._count.purchases,
      favoriteCount: a._count.favorites,
      moderationStatus: a.moderationStatus,
      hidden: a.hidden,
      versions: a.catalogVersions,
      dubTeam: a.dubTeam
        ? { id: a.dubTeam.id, name: a.dubTeam.name, memberCount: a.dubTeam._count.members, reputation: a.dubTeam.reputation, verified: a.dubTeam.verified }
        : null,
      dubCredits: a.dubCredits,
      createdAt: a.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isCreator(user)) {
    return NextResponse.json({ error: "Only creators can publish animes" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      title, altTitle, description, coverImage, bannerImage,
      genres, year, studio, status, type, isFree, price, releaseDate,
      dubTeamId, dubLanguage, dubCast,
    } = body;

    let publishTeam: Awaited<ReturnType<typeof assertPublishTeam>>;
    try {
      publishTeam = await assertPublishTeam(dubTeamId, user.id);
    } catch (error) {
      const info = dubErrorInfo(error);
      return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
    }

    if (!title || typeof title !== "string" || title.trim().length < 2 || title.trim().length > 120) {
      return NextResponse.json({ error: "Title must be 2-120 characters" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.trim().length < 20 || description.trim().length > 5000) {
      return NextResponse.json({ error: "Description must be 20-5000 characters" }, { status: 400 });
    }
    const isSafeImage = (value: unknown): value is string =>
      typeof value === "string" && (value.startsWith("/uploads/") || /^https?:\/\//.test(value));
    if (!isSafeImage(coverImage)) {
      return NextResponse.json({ error: "Upload a cover image" }, { status: 400 });
    }
    if (bannerImage !== undefined && bannerImage !== null && bannerImage !== "" && !isSafeImage(bannerImage)) {
      return NextResponse.json({ error: "Invalid banner image URL" }, { status: 400 });
    }
    const cleanGenres = Array.isArray(genres)
      ? genres.filter((genre: unknown): genre is string => typeof genre === "string" && genre.trim().length > 0 && genre.length <= 30).slice(0, 10)
      : [];
    if (cleanGenres.length === 0) {
      return NextResponse.json({ error: "Pick at least one genre" }, { status: 400 });
    }
    const currentYear = new Date().getFullYear();
    const parsedYear = Number.parseInt(String(year), 10);
    const safeYear = Number.isFinite(parsedYear) && parsedYear >= 1900 && parsedYear <= currentYear + 5
      ? parsedYear
      : currentYear;
    const isFreeBool = isFree === true;
    const priceInt = isFreeBool ? 0 : Math.max(0, Math.min(10000, Number.parseInt(String(price), 10) || 0));
    if (!isFreeBool && priceInt < APP_CONFIG.minAnimePrice) {
      return NextResponse.json({ error: `Paid animes must cost at least ${APP_CONFIG.minAnimePrice} credits` }, { status: 400 });
    }
    const releaseDateValue =
      status === "UPCOMING" && typeof releaseDate === "string" && releaseDate
        ? new Date(releaseDate)
        : null;
    if (releaseDateValue && Number.isNaN(releaseDateValue.getTime())) {
      return NextResponse.json({ error: "Invalid release date" }, { status: 400 });
    }

    // Dub e'loni shu bir qadamda biriktiriladi: til + speaker/personaj juftliklari.
    const teamMembers = await db.dubTeamMember.findMany({
      where: { teamId: publishTeam.team.id },
      select: { id: true, name: true },
    });
    let preparedCast: ReturnType<typeof prepareDubCast>;
    try {
      preparedCast = prepareDubCast(
        Array.isArray(dubCast) ? (dubCast as DubCastInput[]) : [],
        dubLanguage,
        teamMembers
      );
    } catch (error) {
      const info = dubErrorInfo(error);
      return NextResponse.json({ error: info.message, code: info.code }, { status: info.status });
    }

    let slug = slugify(title);
    if (!slug) slug = `anime-${Date.now().toString(36)}`;
    const slugExists = await db.anime.findUnique({ where: { slug } });
    if (slugExists) slug = `${slug}-${Date.now().toString(36)}`;

    const anime = await db.$transaction(async (tx) => {
      const created = await tx.anime.create({
        data: {
          slug,
          title: title.trim(),
          altTitle: typeof altTitle === "string" && altTitle.trim() ? altTitle.trim().slice(0, 120) : null,
          description: description.trim(),
          coverImage,
          bannerImage: isSafeImage(bannerImage) ? bannerImage : coverImage,
          genres: cleanGenres.join(","),
          year: safeYear,
          studio: typeof studio === "string" && studio.trim() ? studio.trim().slice(0, 120) : null,
          status: ["ONGOING", "COMPLETED", "UPCOMING"].includes(status) ? status : "ONGOING",
          type: ["TV", "MOVIE", "OVA"].includes(type) ? type : "TV",
          isFree: isFreeBool,
          price: priceInt,
          creatorId: user.id,
          dubTeamId: publishTeam.team.id,
          source: "CREATOR",
          moderationStatus: "PENDING",
          hidden: true,
          trending: 0,
          releaseDate: releaseDateValue,
        },
      });
      const version = await tx.animeVersion.create({
        data: {
          animeId: created.id,
          kind: "creator",
          creatorId: user.id,
          price: priceInt,
          status: "pending",
        },
      });
      await createDubCreditRow(tx, {
        teamId: publishTeam.team.id,
        animeId: created.id,
        versionId: version.id,
        prepared: preparedCast,
      });
      return created;
    });

    await recomputeTeamReputation(publishTeam.team.id);

    return NextResponse.json(
      {
        anime,
        pending: true,
        dubTeam: { id: publishTeam.team.id, name: publishTeam.team.name, memberCount: publishTeam.linkedMemberCount },
        dubCredit: { language: preparedCast.language, speakerCount: preparedCast.speakerCount },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("publish anime error", e);
    return NextResponse.json({ error: "Failed to publish anime" }, { status: 500 });
  }
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}
