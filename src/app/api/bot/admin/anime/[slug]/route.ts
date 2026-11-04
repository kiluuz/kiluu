import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteBotAnime } from "@/lib/bot-api";
import { isAdminUser } from "@/lib/config";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { slugify } from "@/lib/anime-enricher";

export const runtime = "nodejs";

// DELETE /api/bot/admin/anime/[slug]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const slug = decodeURIComponent((await params).slug);
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  let botDeleted = true;
  try {
    await deleteBotAnime(slug);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.startsWith("Bot API 404")) {
      log.error("bot anime delete failed", { slug, error: message });
      return NextResponse.json({ error: message }, { status: 502 });
    }
    botDeleted = false;
  }

  // Bot slugs keep "_" where the site card uses "-".
  const siteSlugs = [...new Set([slug, slugify(slug)])];
  const siteRows = await db.anime.deleteMany({ where: { slug: { in: siteSlugs } } });

  log.info("anime deleted from bot catalog", {
    slug,
    adminId: user!.id,
    botDeleted,
    siteRowsDeleted: siteRows.count,
  });
  return NextResponse.json({ ok: true, slug, botDeleted, siteRowsDeleted: siteRows.count });
}
