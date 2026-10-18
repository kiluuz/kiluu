import { NextRequest, NextResponse } from "next/server";
import { autoEnrichAnime } from "@/lib/anime-enricher";

/**
 * GET /api/animes/auto-fetch?q=Black+Clover
 *
 * Automatically fetches high-definition anime cover art, banner, description,
 * genres, year, and rating from AniList / web without manual image searching.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Query 'q' is required" }, { status: 400 });
  }

  try {
    const data = await autoEnrichAnime(q);
    return NextResponse.json({ ok: true, anime: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
