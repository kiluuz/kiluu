const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
};

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function decodeKey(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  try {
    const decoded = parts.map((part) => decodeURIComponent(part));
    if (decoded.some((part) => !/^[a-zA-Z0-9._-]+$/.test(part) || part === "." || part === "..")) return null;
    return decoded.join("/");
  } catch {
    return null;
  }
}

function bytesFromHex(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => parseInt(byte, 16));
}

async function isValidSignature(scope, expiry, signature, secret) {
  const actual = bytesFromHex(signature);
  if (!actual) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    actual,
    new TextEncoder().encode(`${scope}\n${expiry}`),
  );
}

function signedAssetPath(uri, manifestKey, scope, expiry, signature) {
  let resolved;
  try {
    resolved = new URL(uri, `https://media.invalid/${manifestKey}`);
  } catch {
    return null;
  }
  if (resolved.origin !== "https://media.invalid") return null;
  const key = decodeKey(resolved.pathname);
  if (!key || !key.startsWith(`${scope}/`)) return null;
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return `/${encodedKey}?exp=${expiry}&sig=${signature}`;
}

async function serveHls(request, env, key, url) {
  const segments = key.split("/");
  if (segments.length < 4 || segments[0] !== "hls") return jsonError("Not found", 404);
  const scope = segments.slice(0, 3).join("/");
  const expiry = url.searchParams.get("exp") || "";
  const signature = url.searchParams.get("sig") || "";
  const expirySeconds = Number(expiry);
  if (!Number.isSafeInteger(expirySeconds) || expirySeconds <= Math.floor(Date.now() / 1000)) {
    return jsonError("Playback link expired", 401);
  }
  if (!env.R2_HLS_SIGNING_SECRET) return jsonError("Media service is not configured", 503);
  if (!(await isValidSignature(scope, expiry, signature, env.R2_HLS_SIGNING_SECRET))) {
    return jsonError("Invalid playback link", 403);
  }

  const object = await env.MEDIA_BUCKET.get(key);
  if (!object) return jsonError("Media object not found", 404);
  const headers = new Headers(corsHeaders);
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("Accept-Ranges", "bytes");

  if (key.endsWith(".m3u8")) {
    const manifest = await object.text();
    const rewrite = (uri) => signedAssetPath(uri, key, scope, expiry, signature);
    const lines = manifest.split(/\r?\n/);
    const protectedLines = [];
    for (const line of lines) {
      if (line.trim().startsWith("#")) {
        let invalidUri = false;
        const updated = line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          const signed = rewrite(uri);
          if (!signed) {
            invalidUri = true;
            return "";
          }
          return `URI="${signed}"`;
        });
        if (invalidUri) return jsonError("Playlist contains an unsupported media URI", 502);
        protectedLines.push(updated);
      } else if (line.trim()) {
        const signed = rewrite(line.trim());
        if (!signed) return jsonError("Playlist contains an unsupported media URI", 502);
        protectedLines.push(signed);
      } else {
        protectedLines.push("");
      }
    }
    headers.set("Content-Type", "application/vnd.apple.mpegurl");
    headers.set("Cache-Control", "private, no-store");
    headers.delete("Content-Length");
    return new Response(request.method === "HEAD" ? null : protectedLines.join("\n"), { headers });
  }

  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (request.method !== "GET" && request.method !== "HEAD") {
      return jsonError("Method not allowed", 405);
    }
    const url = new URL(request.url);
    const key = decodeKey(url.pathname);
    if (!key) return jsonError("Invalid media path", 400);
    if (key.startsWith("hls/")) return serveHls(request, env, key, url);
    if (!key.startsWith("images/")) return jsonError("Not found", 404);

    const object = await env.MEDIA_BUCKET.get(key);
    if (!object) return jsonError("Not found", 404);
    const headers = new Headers(corsHeaders);
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  },
};
