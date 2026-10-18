import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  const query = `
    query ($search: String) {
      Page(page: 1, perPage: 15) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          status
          nextAiringEpisode {
            airingAt
            timeUntilAiring
            episode
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { search: q }
      }),
      next: { revalidate: 60 } 
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch from AniList" }, { status: 500 });
    }

    const data = await res.json();
    const media = data?.data?.Page?.media || [];
    
    const results = media.map((m: any) => ({
      id: m.id,
      title: m.title.english || m.title.romaji,
      coverImage: m.coverImage.large,
      status: m.status,
      nextEpisode: m.nextAiringEpisode ? {
        episode: m.nextAiringEpisode.episode,
        airingAt: m.nextAiringEpisode.airingAt,
        timeUntilAiring: m.nextAiringEpisode.timeUntilAiring
      } : null
    }));

    results.sort((a: any, b: any) => {
      const getPriority = (status: string) => {
        if (status === "RELEASING") return 1;
        if (status === "NOT_YET_RELEASED") return 2;
        return 3;
      };
      const pA = getPriority(a.status);
      const pB = getPriority(b.status);
      if (pA !== pB) return pA - pB;
      if (a.nextEpisode && !b.nextEpisode) return -1;
      if (!a.nextEpisode && b.nextEpisode) return 1;
      return 0;
    });

    return NextResponse.json({ results: results.slice(0, 8) });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
