import { randomBytes } from "crypto";
import { sniffImageType } from "@/lib/media";
import { putR2Object } from "@/lib/r2";

const MAX_IMAGE = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extFor(sniff: string, mime: string): string {
  if (sniff === "jpeg") return "jpg";
  if (sniff === "png") return "png";
  if (sniff === "webp") return "webp";
  if (sniff === "gif") return "gif";
  return mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
}

export async function saveUpload(file: File, kind: "avatar" | "banner" | "cover" | "post"): Promise<string> {
  if (file.size > MAX_IMAGE) {
    throw new Error("File too large (max 8MB)");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const sniffed = sniffImageType(buf);
  if (!sniffed) {
    throw new Error("Unsupported image type");
  }
  if (file.type && !ALLOWED.has(file.type) && !["image/jpg"].includes(file.type)) {
    // MIME is a hint only; magic bytes already validated
  }
  const ext = extFor(sniffed, file.type || "");
  const key = `images/${kind}/${kind}-${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  const mime = `image/${sniffed === "jpeg" ? "jpeg" : sniffed}`;
  return putR2Object(key, buf, mime);
}

export function isDurableMediaUrl(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("/uploads/")) return true;
  if (/^https?:\/\/api\.telegram\.org\//i.test(src)) return false;
  if (/file_id=/i.test(src)) return false;
  return /^https?:\/\//i.test(src) || /^\/(?!\/)/.test(src);
}
