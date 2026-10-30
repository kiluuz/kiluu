import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { purchaseAnimeAtomic } from "@/lib/economy";
import { officialVersionId } from "@/lib/owns";
import { getBotAnime } from "@/lib/bot-api";
import { rateLimit } from "@/lib/rate-limit";
import { rateKey } from "@/lib/client-ip";
import { randomBytes } from "crypto";
import { log } from "@/lib/logger";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to purchase" }, { status: 401 });
  if (!rateLimit(rateKey(req, "buy") + user.id, 20, 60_000)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const episodeNumber = typeof body.episodeNumber === "number" && body.episodeNumber > 0 ? body.episodeNumber : 0;
  const versionIdIn = typeof body.versionId === "string" ? body.versionId : null;
  const clientKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : randomBytes(12).toString("hex");

  const anime = await db.anime.findFirst({ where: { OR: [{ id }, { slug: id }] } });
  if (!anime) return NextResponse.json({ error: "Anime not found" }, { status: 404 });
  if (anime.hidden) return NextResponse.json({ error: "Not available" }, { status: 404 });

  const versionId = versionIdIn || (await officialVersionId(anime.id));
  if (!versionId) return NextResponse.json({ error: "No version for sale" }, { status: 400 });
  const version = await db.animeVersion.findUnique({ where: { id: versionId } });
  if (!version || version.status !== "published") {
    return NextResponse.json({ error: "Version not for sale" }, { status: 400 });
  }

  // Episode prices live in the bot catalog; never trust the client-supplied value.
  let price = version.price;
  if (episodeNumber > 0) {
    const botAnime = await getBotAnime(anime.slug, 4_000).catch(() => null);
    const episodePrices = (botAnime?.episode_prices ?? {}) as Record<string, unknown>;
    const perEpisode = Number(episodePrices[String(episodeNumber)]);
    const basePrice = Number(botAnime?.price);
    const resolved =
      Number.isFinite(perEpisode) && perEpisode > 0
        ? perEpisode
        : Number.isFinite(basePrice) && basePrice > 0
          ? basePrice
          : version.price;
    price = Math.round(resolved);
  }

  if (anime.isFree || version.price === 0) {
    return NextResponse.json({ error: "This version is free" }, { status: 400 });
  }
  if (!Number.isInteger(price) || price <= 0 || price > 100_000) {
    return NextResponse.json({ error: "This episode is not for sale" }, { status: 400 });
  }

  try {
    const result = await purchaseAnimeAtomic({
      userId: user.id,
      animeId: anime.id,
      versionId,
      slug: anime.slug,
      episodeNumber,
      price,
      title: anime.title,
      idempotencyKey: `buy-${user.id}-${versionId}-${episodeNumber}-${clientKey}`,
    });
    return NextResponse.json({
      success: true,
      credits: result.credits,
      versionId,
      episodeNumber,
      pricePaid: price,
    });
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code === "ALREADY_OWNED") {
      return NextResponse.json({ error: "Already owned", alreadyOwned: true }, { status: 409 });
    }
    if (code === "INSUFFICIENT") {
      return NextResponse.json({ error: "Not enough credits", needMore: (e as { need?: number }).need }, { status: 400 });
    }
    if (code === "PRICE_MISMATCH") {
      return NextResponse.json({ error: "Price changed, refresh" }, { status: 409 });
    }
    if (code === "INVALID_PRICE") {
      return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    }
    log.error("Anime credit purchase failed", {
      anime: id,
      code: typeof code === "string" ? code : undefined,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
  }
}
