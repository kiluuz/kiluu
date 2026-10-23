import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const frames = await db.frame.findMany({
    where: { isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({
    frames: frames.map((frame) => ({
      id: frame.id,
      type: frame.type,
      slug: frame.slug,
      name: frame.name,
      imageUrl: frame.imageUrl,
      imageWidth: frame.imageWidth,
      imageHeight: frame.imageHeight,
      version: frame.version,
      rarity: frame.rarity,
      priceCredits: frame.priceCredits,
      acquisition: frame.acquisition,
      missionKey: frame.missionKey,
      scale: Number(frame.scale),
      safe: {
        left: Number(frame.textInsetLeft ?? 20),
        right: Number(frame.textInsetRight ?? 15),
        top: Number(frame.textInsetTop ?? 25),
        bottom: Number(frame.textInsetBottom ?? 20),
      },
      textAlign: frame.textAlign,
      maxFontPx: frame.maxFontPx,
      minFontPx: frame.minFontPx,
      textColor: frame.textColor,
    })),
  }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
