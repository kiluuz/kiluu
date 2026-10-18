import assert from "node:assert/strict";
import { test } from "node:test";
import { createSignedHlsUrl, isCommunityPostImageUrl, publicMediaUrl, r2KeyFromPublicUrl } from "@/lib/r2";

const originalEnv = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME,
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  hlsSecret: process.env.R2_HLS_SIGNING_SECRET,
};

test("R2 media URLs are built under the configured media Worker and user HLS paths are scoped", () => {
  process.env.R2_ACCOUNT_ID = "account";
  process.env.R2_ACCESS_KEY_ID = "access";
  process.env.R2_SECRET_ACCESS_KEY = "secret";
  process.env.R2_BUCKET_NAME = "media";
  process.env.R2_PUBLIC_BASE_URL = "https://media.example.test";
  process.env.R2_HLS_SIGNING_SECRET = "test-signing-secret";
  try {
    assert.equal(publicMediaUrl("images/post/1.webp"), "https://media.example.test/images/post/1.webp");
    assert.equal(r2KeyFromPublicUrl("https://media.example.test/images/post/1.webp"), "images/post/1.webp");
    assert.equal(r2KeyFromPublicUrl("https://other.example.test/images/post/1.webp"), null);
    assert.equal(isCommunityPostImageUrl("https://media.example.test/images/post/1.webp"), true);
    assert.equal(isCommunityPostImageUrl("https://media.example.test/images/avatar/1.webp"), false);
    assert.equal(isCommunityPostImageUrl("https://other.example.test/images/post/1.webp"), false);
    assert.equal(isCommunityPostImageUrl("/uploads/post/legacy.webp"), true);
    assert.throws(() => createSignedHlsUrl("hls/anime/1/../secret.m3u8"), /Invalid HLS object key/);
    const signed = new URL(createSignedHlsUrl("hls/my-anime/1/index.m3u8"));
    assert.equal(signed.pathname, "/hls/my-anime/1/index.m3u8");
    assert.match(signed.searchParams.get("sig") || "", /^[a-f0-9]{64}$/);
    assert.ok(Number(signed.searchParams.get("exp")) > Math.floor(Date.now() / 1000));
  } finally {
    for (const [name, value] of Object.entries({
      R2_ACCOUNT_ID: originalEnv.accountId,
      R2_ACCESS_KEY_ID: originalEnv.accessKeyId,
      R2_SECRET_ACCESS_KEY: originalEnv.secretAccessKey,
      R2_BUCKET_NAME: originalEnv.bucketName,
      R2_PUBLIC_BASE_URL: originalEnv.publicBaseUrl,
      R2_HLS_SIGNING_SECRET: originalEnv.hlsSecret,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
