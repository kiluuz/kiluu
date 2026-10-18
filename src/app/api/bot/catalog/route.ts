import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getBotCatalog } from "@/lib/bot-api";
import { ensureAnimeInDatabase } from "@/lib/anime-enricher";

/**
 * GET /api/bot/catalog
 * ?only_active=false  — admin only, returns all animes including inactive
 *
 * For public/user requests always returns only active animes.
 */
export async function GET(req: NextRequest) {
  try {
    const onlyActiveParam = req.nextUrl.searchParams.get("only_active");
    let onlyActive = true;

    if (onlyActiveParam === "false") {
      // Admin-only: verify the requester is a CREATOR
      const user = await getCurrentUser();
      const { isAdminUser } = await import("@/lib/config");
      if (!isAdminUser(user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      onlyActive = false;
    }

    const data = await getBotCatalog(onlyActive);

    // Auto-sync missing animes into local SQLite database in background
    if (Array.isArray(data) && data.length > 0) {
      for (const item of data) {
        if (!item.slug && !item.title) continue;
        ensureAnimeInDatabase({
          title: item.title || item.slug,
          slug: item.slug,
          price: item.price,
          coverImage: item.poster,
          description: item.description,
        }).catch(() => {});
      }
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch bot catalog", error);
    // Return empty array so UI degrades gracefully (catalog shows empty, not broken)
    return NextResponse.json([], { status: 200 });
  }
}
