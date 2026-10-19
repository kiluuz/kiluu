import sharp from "sharp";
import { unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { deleteR2Object, putR2Object, r2KeyFromPublicUrl } from "@/lib/r2";

/**
 * Kiluu media pipeline — Midnight Cinema edition.
 * Magic-bytes validation, EXIF stripping, responsive variants, LQIP blur.
 */

export type SniffedImageType = "jpeg" | "png" | "webp" | "gif" | null;

/** Validate real file type by magic bytes — never trust extensions. */
export function sniffImageType(buf: Buffer): SniffedImageType {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e &&
    buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a &&
    buf[6] === 0x1a && buf[7] === 0x0a
  ) return "png";
  // GIF87a / GIF89a
  if (buf.subarray(0, 3).toString("ascii") === "GIF") return "gif";
  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "webp";
  return null;
}

/** Detect whether a GIF/WebP is animated (contains multiple frames). */
export async function isAnimated(buf: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(buf, { animated: true }).metadata();
    return (meta.pages ?? 1) > 1;
  } catch {
    return false;
  }
}

export interface MediaVariant {
  width: number;
  url: string; // public URL
}

export interface ProcessedMedia {
  mainUrl: string; // largest variant URL
  animatedUrl: string | null; // original animation (gif) if kept
  variants: MediaVariant[];
  lqip: string; // tiny base64 blur-up data-uri
  width: number;
  height: number;
}

export interface BannerCrop {
  x: number; // in natural image px
  y: number;
  width: number; // 3:1 crop region in natural px
  height: number;
}

export interface AvatarCrop {
  x: number;
  y: number;
  size: number; // square side in natural px
}

/** Delete every file of a previous upload (URLs like /uploads/xxx) */
export async function deleteUploadedByUrl(urls: (string | null | undefined)[]) {
  await Promise.all(urls.filter((url): url is string => Boolean(url)).map(async (url) => {
    if (url.startsWith("/uploads/")) {
      await unlink(path.join(process.cwd(), "public", url.replace(/^\//, ""))).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
      return;
    }
    const key = r2KeyFromPublicUrl(url);
    if (key) await deleteR2Object(key);
  }));
}

async function writeVariants(
  pipeline: ReturnType<typeof sharp>,
  userId: string,
  kind: "banner" | "avatar",
  widths: number[],
  aspect: number | null // w/h; null = keep natural (avatar square)
): Promise<{ variants: MediaVariant[]; lqip: string }> {
  const stamp = Date.now().toString(36) + randomBytes(3).toString("hex");

  const variants: MediaVariant[] = [];

  for (const w of widths) {
    const name = `${kind}-${stamp}-${w}.webp`;
    const key = `images/${kind}/${userId}/${name}`;
    const { data, info } = await pipeline.clone().resize(
      aspect ? { width: w, height: Math.round(w / aspect), fit: "cover" } : { width: w, height: w, fit: "cover" }
    ).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    const url = await putR2Object(key, data, "image/webp");
    variants.push({ width: info.width, url });
  }

  // LQIP: 16px wide blur webp -> data-uri
  const lqipBuf = await pipeline.clone()
    .resize({ width: 16, height: aspect ? Math.max(1, Math.round(16 / aspect)) : 16, fit: "cover" })
    .webp({ quality: 30 })
    .toBuffer();

  return { variants, lqip: `data:image/webp;base64,${lqipBuf.toString("base64")}` };
}

/** Process an uploaded banner: validate, strip EXIF, crop 3:1, build variants. */
export async function processBanner(
  buf: Buffer,
  userId: string,
  crop: BannerCrop | null,
  keepAnimated: boolean
): Promise<ProcessedMedia> {
  const type = sniffImageType(buf);
  if (!type) throw new Error("Unsupported file type. Use JPG, PNG, WebP or GIF.");
  if (buf.length > 8 * 1024 * 1024) throw new Error("File too large. Max 8 MB.");

  const animated = type === "gif" ? await isAnimated(buf) : false;
  if (animated && !keepAnimated) {
    throw new Error("Animated banners are a Premium feature.");
  }

  const base = sharp(buf, { animated: false, limitInputPixels: 30000 * 30000 }); // strips EXIF by re-encode
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Could not read image dimensions.");
  if (meta.width < 600 || meta.height < 200) throw new Error("Image too small. Banner needs at least 600×200.");

  // Apply crop if provided; normalize to 3:1
  let cx = 0, cy = 0, cw = meta.width, ch = meta.height;
  if (crop && crop.width > 0 && crop.height > 0) {
    cx = Math.max(0, Math.min(Math.round(crop.x), meta.width - 1));
    cy = Math.max(0, Math.min(Math.round(crop.y), meta.height - 1));
    cw = Math.min(Math.round(crop.width), meta.width - cx);
    ch = Math.min(Math.round(crop.height), meta.height - cy);
  } else {
    // center-crop 3:1
    const target = meta.width / 3;
    if (target <= meta.height) {
      ch = Math.round(target); cw = meta.width; cy = Math.round((meta.height - ch) / 2);
    } else {
      cw = Math.round(meta.height * 3); ch = meta.height; cx = Math.round((meta.width - cw) / 2);
    }
  }
  // force exact 3:1 on the extracted region
  const cropAspect = cw / ch;
  if (Math.abs(cropAspect - 3) > 0.01) {
    if (cropAspect > 3) { cw = Math.round(ch * 3); } else { ch = Math.round(cw / 3); }
  }

  const cropped = sharp(buf, { animated: false }).extract({ left: cx, top: cy, width: cw, height: ch });

  const { variants, lqip } = await writeVariants(cropped, userId, "banner", [1500, 750, 400], 3);

  // Keep the animation as a separate original-quality file when allowed
  let animatedUrl: string | null = null;
  if (animated && keepAnimated) {
    const name = `banner-anim-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}.gif`;
    const key = `images/banner/${userId}/${name}`;
    const animatedBuffer = await sharp(buf, { animated: true })
      .resize({ width: Math.min(1500, meta.width), withoutEnlargement: true })
      .gif({ loop: 0 })
      .toBuffer();
    animatedUrl = await putR2Object(key, animatedBuffer, "image/gif");
  }

  const main = variants[0];
  return {
    mainUrl: main.url,
    animatedUrl,
    variants,
    lqip,
    width: main.width,
    height: Math.round(main.width / 3),
  };
}

/** Process an uploaded avatar: validate, square crop, round-safe variants. */
export async function processAvatar(buf: Buffer, userId: string, crop: AvatarCrop | null): Promise<ProcessedMedia> {
  const type = sniffImageType(buf);
  if (!type) throw new Error("Unsupported file type. Use JPG, PNG, WebP or GIF.");
  if (type === "gif") throw new Error("Avatars must be static images (JPG, PNG, WebP).");
  if (buf.length > 8 * 1024 * 1024) throw new Error("File too large. Max 8 MB.");

  const base = sharp(buf, { animated: false, limitInputPixels: 30000 * 30000 });
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Could not read image dimensions.");
  if (meta.width < 128 || meta.height < 128) throw new Error("Image too small. Avatar needs at least 128×128.");

  let sx = 0, sy = 0, ssize = Math.min(meta.width, meta.height);
  if (crop && crop.size > 0) {
    ssize = Math.min(Math.round(crop.size), Math.min(meta.width, meta.height));
    sx = Math.max(0, Math.min(Math.round(crop.x), meta.width - ssize));
    sy = Math.max(0, Math.min(Math.round(crop.y), meta.height - ssize));
  } else {
    sx = Math.round((meta.width - ssize) / 2);
    sy = Math.round((meta.height - ssize) / 2);
  }

  const cropped = sharp(buf, { animated: false }).extract({ left: sx, top: sy, width: ssize, height: ssize });
  const { variants, lqip } = await writeVariants(cropped, userId, "avatar", [512, 256, 128], null);

  const main = variants[0];
  return {
    mainUrl: main.url,
    animatedUrl: null,
    variants,
    lqip,
    width: main.width,
    height: main.width,
  };
}
