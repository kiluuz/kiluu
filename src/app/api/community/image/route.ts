import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveUpload } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { MEDIA_ATTACHMENTS_ENABLED } from "@/lib/media-upload";

export async function POST(req: NextRequest) {
  if (!MEDIA_ATTACHMENTS_ENABLED) {
    return NextResponse.json({ error: "Image posts are temporarily disabled" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to upload images" }, { status: 401 });
  if (user.communityBlocked) return NextResponse.json({ error: "Your community access is restricted" }, { status: 403 });
  if (!rateLimit(`community-image:${user.id}`, 10, 60 * 60_000)) {
    return NextResponse.json({ error: "Upload limit reached. Please try again later." }, { status: 429 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    const imageUrl = await saveUpload(file, "post");
    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
