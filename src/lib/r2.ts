import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHmac } from "node:crypto";

let clientCache: { key: string; client: S3Client } | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getR2Config() {
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  const accessKeyId = requiredEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requiredEnv("R2_SECRET_ACCESS_KEY");
  const cacheKey = `${accountId}:${accessKeyId}:${secretAccessKey}`;
  if (!clientCache || clientCache.key !== cacheKey) {
    clientCache?.client.destroy();
    clientCache = {
      key: cacheKey,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
  }
  return {
    accountId,
    bucket: requiredEnv("R2_BUCKET_NAME"),
    publicBaseUrl: requiredEnv("R2_PUBLIC_BASE_URL").replace(/\/+$/, ""),
    client: clientCache.client,
  };
}

export function publicMediaUrl(key: string): string {
  if (!key || key.startsWith("/") || key.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Invalid R2 object key");
  }
  const { publicBaseUrl } = getR2Config();
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function putR2Object(key: string, body: Buffer, contentType: string): Promise<string> {
  const { client, bucket } = getR2Config();
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return publicMediaUrl(key);
}

export async function deleteR2Object(key: string): Promise<void> {
  const { client, bucket } = getR2Config();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function r2ObjectExists(key: string): Promise<boolean> {
  const { client, bucket } = getR2Config();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "$metadata" in error &&
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
    ) {
      return false;
    }
    throw error;
  }
}

export function r2KeyFromPublicUrl(value: string): string | null {
  const configuredBaseUrl = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (!configuredBaseUrl) return null;
  const baseUrl = configuredBaseUrl.replace(/\/+$/, "");
  let url: URL;
  let base: URL;
  try {
    url = new URL(value);
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.origin !== base.origin || base.pathname !== "/" || url.search || url.hash) return null;
  const key = url.pathname.slice(1).split("/").map((part) => {
    try {
      return decodeURIComponent(part);
    } catch {
      return "";
    }
  }).join("/");
  return key.startsWith("images/") ? key : null;
}

export function isCommunityPostImageUrl(value: string): boolean {
  if (/^\/uploads\/post\/[\w.-]+$/.test(value)) return true;
  const key = r2KeyFromPublicUrl(value);
  return key !== null && /^images\/post\/[\w.-]+$/.test(key);
}

export function createSignedHlsUrl(key: string): string {
  const parts = key.split("/");
  if (parts.length < 4 || parts[0] !== "hls" || parts.some((part) =>
    !part || part === "." || part === ".." || !/^[a-zA-Z0-9._-]+$/.test(part)
  )) {
    throw new Error("Invalid HLS object key");
  }
  const { publicBaseUrl } = getR2Config();
  const scope = parts.slice(0, 3).join("/");
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const signature = createHmac("sha256", requiredEnv("R2_HLS_SIGNING_SECRET"))
    .update(`${scope}\n${expiresAt}`)
    .digest("hex");
  return `${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}?exp=${expiresAt}&sig=${signature}`;
}
