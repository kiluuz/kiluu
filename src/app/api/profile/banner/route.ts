import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { processBanner, deleteUploadedByUrl } from "@/lib/media";

// POST /api/profile/banner — multipart upload with 3:1 crop + variants
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Max 8 MB." }, { status: 400 });
    }

    let crop: { x: number; y: number; width: number; height: number } | null = null;
    const rawCrop = form.get("crop");
    if (typeof rawCrop === "string") {
      try {
        const parsed = JSON.parse(rawCrop);
        if (parsed && typeof parsed === "object") {
          crop = {
            x: Number(parsed.x) || 0,
            y: Number(parsed.y) || 0,
            width: Number(parsed.width) || 0,
            height: Number(parsed.height) || 0,
          };
        }
      } catch { /* ignore bad crop, fall back to center */ }
    }

    let showcase: { unlocked?: unknown } = {};
    try {
      showcase = user.showcase ? JSON.parse(user.showcase) as { unlocked?: unknown } : {};
    } catch {
      showcase = {};
    }
    const animatedAllowed = Array.isArray(showcase.unlocked) && showcase.unlocked.includes("animatedBanner");

    const buf = Buffer.from(await file.arrayBuffer());
    const processed = await processBanner(buf, user.id, crop, animatedAllowed);

    // delete previous uploaded files of this user's banner
    const oldFiles = [user.bannerUrl];
    try {
      if (user.showcase) {
        const sc = JSON.parse(user.showcase);
        if (sc && typeof sc === "object" && typeof sc.prevBanner === "string") oldFiles.push(sc.prevBanner);
      }
    } catch { /* ignore */ }
    await deleteUploadedByUrl(oldFiles);

    const bannerUrl = processed.animatedUrl || processed.mainUrl;
    const updated = await db.user.update({
      where: { id: user.id },
      data: { bannerUrl, bannerPreset: "" },
    });

    return NextResponse.json({
      user: toPublicUser(updated),
      banner: {
        url: bannerUrl,
        staticUrl: processed.mainUrl,
        animatedUrl: processed.animatedUrl,
        variants: processed.variants.map((v) => ({ width: v.width, url: v.url })),
        lqip: processed.lqip,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Banner upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// DELETE /api/profile/banner — remove banner entirely
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await deleteUploadedByUrl([user.bannerUrl]);
    const updated = await db.user.update({
      where: { id: user.id },
      data: { bannerUrl: "", bannerPreset: "" },
    });
    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to remove banner";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
