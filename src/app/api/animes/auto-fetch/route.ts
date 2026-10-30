import { NextRequest, NextResponse } from "next/server";
import { autoEnrichAnime } from "@/lib/anime-enricher";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";

/**
 * GET /api/animes/auto-fetch?q=Black+Clover
 *
 * Automatically fetches high-definition anime cover art, banner, description,
 * genres, year, and rating from AniList / web without manual image searching.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!rateLimit(rateKey(req, "auto-fetch") + user.id, 20, 60_000)) {
    return NextResponse.json({ error: "Too many lookups" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().slice(0, 120);

  if (!q) {
    return NextResponse.json({ error: "Query 'q' is required" }, { status: 400 });
  }

  try {
    const data = await autoEnrichAnime(q);
    return NextResponse.json({ ok: true, anime: data });
  } catch {
    return NextResponse.json({ error: "Lookup failed, try again" }, { status: 500 });
  }
}
