type CloudflareEnvelope<T> = {
  success: boolean;
  errors?: { message?: string }[];
  result?: T;
};

function streamConfig() {
  const accountId = process.env.CF_STREAM_ACCOUNT_ID;
  const apiToken = process.env.CF_STREAM_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Stream is not configured");
  }
  return { accountId, apiToken };
}

function streamApiUrl(accountId: string, id?: string) {
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream`;
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

async function streamRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json()) as CloudflareEnvelope<T>;
  if (!response.ok || !body.success || !body.result) {
    throw new Error(body.errors?.map((error) => error.message).filter(Boolean).join("; ") || "Cloudflare Stream request failed");
  }
  return body.result;
}

export async function uploadCloudflareStreamVideo(file: File): Promise<string> {
  const { accountId, apiToken } = streamConfig();
  const form = new FormData();
  form.set("file", file, file.name || "episode.mp4");
  form.set("requireSignedURLs", "true");

  const result = await streamRequest<{ uid: string }>(streamApiUrl(accountId), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
    body: form,
  });
  if (!result.uid) throw new Error("Cloudflare Stream did not return a video ID");
  return result.uid;
}

export async function createCloudflarePlaybackUrl(streamId: string): Promise<string> {
  const { accountId, apiToken } = streamConfig();
  const result = await streamRequest<{ token: string }>(`${streamApiUrl(accountId, streamId)}/token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
  });
  if (!result.token) throw new Error("Cloudflare Stream did not return a playback token");
  const hostname = process.env.CF_STREAM_CUSTOMER_SUBDOMAIN || "videodelivery.net";
  return `https://${hostname}/${encodeURIComponent(result.token)}/manifest/video.m3u8`;
}
