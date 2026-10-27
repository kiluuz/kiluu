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
    return NextResponse.json({ error: "This episode has no video stream yet" }, { status: 409 });
  }

  try {
    // Prefer HLS whenever it is configured: iPhone Safari cannot play many
    // MP4 files (HEVC/hev1, non-faststart), but it plays HLS natively.
    if (result.episode.hlsKey) {
      try {
        if (await r2ObjectExists(result.episode.hlsKey)) {
          const streamUrl = createSignedHlsUrl(result.episode.hlsKey);
          return NextResponse.json(
            { streamUrl, expiresInSeconds: 24 * 60 * 60 },
            { headers: { "Cache-Control": "private, no-store" } },
          );
        }
        console.warn("HLS object missing, trying other sources", result.episode.hlsKey);
      } catch (error) {
        // Non-fatal: storage may be temporarily unreachable; a direct source
        // can still work.
        console.error("R2 availability check failed", error);
      }
    }
    if (result.episode.streamId) {
      try {
        const streamUrl = await createCloudflarePlaybackUrl(result.episode.streamId);
        return NextResponse.json(
          { streamUrl, expiresInSeconds: 3600 },
          { headers: { "Cache-Control": "private, no-store" } },
        );
      } catch (error) {
        console.error("Cloudflare playback token error", error);
      }
    }
    if (result.episode.videoUrl && (result.episode.videoUrl.startsWith("http://") || result.episode.videoUrl.startsWith("https://"))) {
      return NextResponse.json(
        { streamUrl: result.episode.videoUrl, expiresInSeconds: 24 * 60 * 60 },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const streamBase = process.env.NEXT_PUBLIC_STREAM_BASE_URL || process.env.STREAM_SERVER_URL;
    if (result.episode.telegramMessageId && streamBase) {
      const cleanBase = streamBase.replace(/\/+$/, "");
      return NextResponse.json(
        { streamUrl: `${cleanBase}/stream/${result.episode.telegramMessageId}`, expiresInSeconds: 24 * 60 * 60 },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json({ error: "This episode has no browser HLS stream yet" }, { status: 409 });
  } catch (error) {
    console.error("Playback source resolution error", error);
    return NextResponse.json({ error: "Video streaming is temporarily unavailable" }, { status: 503 });
  }
}
