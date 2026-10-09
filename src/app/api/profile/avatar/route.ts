import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { processAvatar, deleteUploadedByUrl } from "@/lib/media";

// POST /api/profile/avatar — square crop + webp variants
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

    let crop: { x: number; y: number; size: number } | null = null;
    const rawCrop = form.get("crop");
    if (typeof rawCrop === "string") {
      try {
        const parsed = JSON.parse(rawCrop);
        if (parsed && typeof parsed === "object") {
          crop = {
            x: Number(parsed.x) || 0,
            y: Number(parsed.y) || 0,
            size: Number(parsed.size) || 0,
          };
        }
      } catch { /* ignore */ }
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const processed = await processAvatar(buf, user.id, crop);

    await deleteUploadedByUrl([user.avatarUrl]);

    const updated = await db.user.update({
      where: { id: user.id },
      data: { avatarUrl: processed.mainUrl },
    });

    return NextResponse.json({
      user: toPublicUser(updated),
      avatar: {
        url: processed.mainUrl,
        variants: processed.variants.map((v) => ({ width: v.width, url: v.url })),
        lqip: processed.lqip,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Avatar upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// DELETE /api/profile/avatar — reset to generated initial avatar
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await deleteUploadedByUrl([user.avatarUrl]);
    const updated = await db.user.update({
      where: { id: user.id },
      data: { avatarUrl: "" },
    });
    return NextResponse.json({ user: toPublicUser(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to remove avatar";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
