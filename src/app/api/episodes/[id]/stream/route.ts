import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCloudflarePlaybackUrl } from "@/lib/cloudflare-stream";
import { getOwnedHlsEpisode } from "@/lib/watch-parties";
import { createSignedHlsUrl, r2ObjectExists } from "@/lib/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await getOwnedHlsEpisode(db, user.id, id);
  if ("error" in result) {
    if (result.error === "NOT_FOUND") return NextResponse.json({ error: "Episode not found" }, { status: 404 });
    if (result.error === "FORBIDDEN") return NextResponse.json({ error: "Purchase required" }, { status: 403 });
    return NextResponse.json({ error: "This episode has no browser HLS stream yet" }, { status: 409 });
  }

  try {
    if (result.episode.hlsKey) {
      if (!(await r2ObjectExists(result.episode.hlsKey))) {
        return NextResponse.json({ error: "HLS files have not been uploaded to R2 yet" }, { status: 404 });
      }
      const streamUrl = createSignedHlsUrl(result.episode.hlsKey);
      return NextResponse.json(
        { streamUrl, expiresInSeconds: 24 * 60 * 60 },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const streamId = result.episode.streamId;
    if (!streamId) {
      return NextResponse.json({ error: "This episode has no browser HLS stream yet" }, { status: 409 });
    }
    const streamUrl = await createCloudflarePlaybackUrl(streamId);
    return NextResponse.json(
      { streamUrl, expiresInSeconds: 3600 },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Cloudflare playback token error", error);
    return NextResponse.json({ error: "Video streaming is temporarily unavailable" }, { status: 503 });
  }
}
