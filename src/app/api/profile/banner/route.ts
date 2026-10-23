import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, toPublicUser } from "@/lib/auth";
import { deleteUploadedByUrl } from "@/lib/media";

// Banner uploads are disabled; users can select from the preset gallery.
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Banner uploads are disabled. Choose a preset banner instead." }, { status: 403 });
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
