import { NextResponse } from "next/server";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

// AniList GraphQL query — next 7 days airing schedule
// airingAt is a Unix timestamp
const SCHEDULE_QUERY = `
query ($from: Int, $to: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
    }
    airingSchedules(
      airingAt_greater: $from
      airingAt_lesser: $to
      sort: TIME
    ) {
      id
      episode
      airingAt
      timeUntilAiring
      media {
        id
        idMal
        title {
          romaji
          english
          native
        }
        coverImage {
          extraLarge
          large
          color
        }
        bannerImage
        format
        status
        genres
        averageScore
        episodes
        duration
        season
        seasonYear
        studios(isMain: true) {
          nodes {
            name
          }
        }
        siteUrl
        isAdult
      }
    }
  }
}
`;

async function fetchAniListPage(from: number, to: number, page: number) {
  const res = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: SCHEDULE_QUERY,
      variables: { from, to, page },
    }),
    next: { revalidate: 600 },
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) throw new Error(`AniList error: ${res.status}`);
  const payload = await res.json();
  if (payload?.errors?.length || !payload?.data?.Page) {
    throw new Error("AniList returned an invalid schedule response");
  }
  return payload;
}

// GET /api/anilist/schedule — proxies AniList airing schedule for next N days
// ?days=7 (default 7, max 14)
export async function GET(req: Request) {
  const url = new URL(req.url);
  const rawDays = url.searchParams.get("days") || "7";
  const parsedDays = Number(rawDays);
  if (!Number.isInteger(parsedDays) || parsedDays < 1 || parsedDays > 14) {
    return NextResponse.json({ ok: false, error: "days must be an integer between 1 and 14" }, { status: 400 });
  }
  const days = parsedDays;

  const now = Math.floor(Date.now() / 1000 / 600) * 600;
  const end = now + days * 24 * 60 * 60;

  try {
    // Fetch pages until no more results
    const allSchedules: unknown[] = [];
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage && page <= 5) {
      const data = await fetchAniListPage(now, end, page);
      const pageData = data?.data?.Page;
      const schedules = pageData.airingSchedules;
      if (!Array.isArray(schedules)) throw new Error("AniList schedule data is missing");
      // Filter out adult content and add to list
      const filtered = schedules.filter(
        (s: { media?: { isAdult?: boolean } }) => !s.media?.isAdult
      );
      allSchedules.push(...filtered);

      hasNextPage = pageData.pageInfo?.hasNextPage === true;
      page++;

      // If we have enough results (200+), stop
      if (allSchedules.length >= 200) break;
    }

    // Group by day in the platform's documented default timezone.
    const byDay: Record<string, typeof allSchedules> = {
      "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [],
    };

    for (const item of allSchedules as Array<{
      id: number;
      episode: number;
      airingAt: number;
      timeUntilAiring: number;
      media: {
        id: number;
        title: { romaji: string; english: string | null; native: string | null };
        coverImage: { extraLarge: string; large: string; color: string | null };
        bannerImage: string | null;
        format: string;
        status: string;
        genres: string[];
        averageScore: number | null;
        episodes: number | null;
        duration: number | null;
        season: string | null;
        seasonYear: number | null;
        studios: { nodes: { name: string }[] };
        siteUrl: string;
        isAdult: boolean;
      };
    }>) {
      const date = new Date(item.airingAt * 1000);
      const dayOfWeek = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Tashkent",
        weekday: "short",
      }).format(date);
      const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dayOfWeek).toString();

      byDay[dayIndex].push({
        scheduleId: item.id,
        episode: item.episode,
        airingAt: item.airingAt,
        airingAtDate: date.toISOString(),
        timeUntilAiring: item.timeUntilAiring,
        media: {
          anilistId: item.media.id,
          title: item.media.title.english || item.media.title.romaji,
          titleRomaji: item.media.title.romaji,
          titleNative: item.media.title.native,
          coverImage: item.media.coverImage.extraLarge || item.media.coverImage.large,
          coverColor: item.media.coverImage.color,
          bannerImage: item.media.bannerImage,
          format: item.media.format,
          status: item.media.status,
          genres: item.media.genres.slice(0, 3),
          score: item.media.averageScore,
          totalEpisodes: item.media.episodes,
          duration: item.media.duration,
          season: item.media.season,
          seasonYear: item.media.seasonYear,
          studio: item.media.studios?.nodes?.[0]?.name || null,
          siteUrl: item.media.siteUrl,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      days,
      totalEntries: allSchedules.length,
      schedule: byDay,
    });
  } catch (err) {
    console.error("AniList schedule fetch error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch from AniList" },
      { status: 502 }
    );
  }
}
