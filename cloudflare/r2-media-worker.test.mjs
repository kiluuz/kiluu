import assert from "node:assert/strict";
import { test } from "node:test";
import worker from "./r2-media-worker.mjs";

const secret = "test-r2-worker-signing-secret";

async function signature(scope, expiry) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${scope}\n${expiry}`),
  ));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function object(body, contentType) {
  return {
    body: new Blob([body]).stream(),
    text: async () => body,
    writeHttpMetadata(headers) {
      headers.set("Content-Type", contentType);
    },
  };
}

test("media worker signs HLS playlists and segments while allowing image reads", async () => {
  const objects = new Map([
    ["images/avatar/1.webp", object("image-bytes", "image/webp")],
    ["hls/my-anime/1/index.m3u8", object("#EXTM3U\n#EXTINF:6,\nsegment_00001.ts\n", "application/vnd.apple.mpegurl")],
    ["hls/my-anime/1/segment_00001.ts", object("segment-bytes", "video/mp2t")],
  ]);
  const env = {
    R2_HLS_SIGNING_SECRET: secret,
    MEDIA_BUCKET: { get: async (key) => objects.get(key) || null },
  };

  const image = await worker.fetch(new Request("https://media.example.test/images/avatar/1.webp"), env);
  assert.equal(image.status, 200);
  assert.equal(await image.text(), "image-bytes");

  const scope = "hls/my-anime/1";
  const expiry = String(Math.floor(Date.now() / 1000) + 60);
  const sig = await signature(scope, expiry);
  const playlistUrl = `https://media.example.test/${scope}/index.m3u8?exp=${expiry}&sig=${sig}`;
  const playlistResponse = await worker.fetch(new Request(playlistUrl), env);
  assert.equal(playlistResponse.status, 200);
  const playlist = await playlistResponse.text();
  assert.ok(playlist.includes(`/hls/my-anime/1/segment_00001.ts?exp=${expiry}&sig=${sig}`));

  const segment = await worker.fetch(new Request(
    `https://media.example.test/${scope}/segment_00001.ts?exp=${expiry}&sig=${sig}`,
  ), env);
  assert.equal(segment.status, 200);
  assert.equal(await segment.text(), "segment-bytes");
});

test("media worker rejects expired or modified HLS signatures", async () => {
  const env = {
    R2_HLS_SIGNING_SECRET: secret,
    MEDIA_BUCKET: { get: async () => object("#EXTM3U\n", "application/vnd.apple.mpegurl") },
  };
  const scope = "hls/my-anime/1";
  const expired = String(Math.floor(Date.now() / 1000) - 1);
  const validSignature = await signature(scope, expired);
  const expiredResponse = await worker.fetch(new Request(
    `https://media.example.test/${scope}/index.m3u8?exp=${expired}&sig=${validSignature}`,
  ), env);
  assert.equal(expiredResponse.status, 401);

  const changedResponse = await worker.fetch(new Request(
    `https://media.example.test/${scope}/index.m3u8?exp=${Math.floor(Date.now() / 1000) + 60}&sig=${"0".repeat(64)}`,
  ), env);
  assert.equal(changedResponse.status, 403);
});
