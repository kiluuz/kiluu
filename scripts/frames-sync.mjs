import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { FRAMES } from "../frames.config.ts";
import { putR2Object, publicMediaUrl } from "../src/lib/r2.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "frames-src");
const outputDir = path.join(root, "public", "frames");
const prisma = new PrismaClient();
const force = process.argv.includes("--force");

async function inferTextColor(imagePath, safe) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const left = Math.round(info.width * safe.left / 100);
  const right = Math.round(info.width * (100 - safe.right) / 100);
  const top = Math.round(info.height * safe.top / 100);
  const bottom = Math.round(info.height * (100 - safe.bottom) / 100);
  let luminance = 0;
  let count = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const alpha = data[offset + 3] / 255;
      if (alpha < 0.65) continue;
      const channels = [data[offset], data[offset + 1], data[offset + 2]].map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      luminance += (0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]) * alpha;
      count += alpha;
    }
  }
  return count / ((right - left) * (bottom - top)) < 0.2
    ? "var(--foreground)"
    : luminance / count > 0.52 ? "#211b17" : "#fffaf0";
}

async function writeVersionedFrame(frame, typePath, version) {
  const sourceBytes = await readFile(path.join(sourceDir, frame.file));
  let image = sharp(sourceBytes).rotate().ensureAlpha();
  const webpPath = path.join(outputDir, `${frame.slug}.v${version}.webp`);
  const largeWebpPath = path.join(outputDir, `${frame.slug}.v${version}@2x.webp`);
  if (frame.type === "avatar") {
    const cutouts = [
      Buffer.from('<svg width="256" height="256"><circle cx="128" cy="128" r="95" fill="white"/></svg>'),
      Buffer.from('<svg width="384" height="384"><circle cx="192" cy="192" r="142" fill="white"/></svg>'),
    ];
    const centerPixels = [
      Buffer.from('<svg width="256" height="256"><circle cx="128" cy="128" r="2" fill="white"/></svg>'),
      Buffer.from('<svg width="384" height="384"><circle cx="192" cy="192" r="3" fill="white"/></svg>'),
    ];
    const small = image.clone().resize(256, 256, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    const large = image.clone().resize(384, 384, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    const [smallBase, largeBase] = await Promise.all([
      small.png().toBuffer({ resolveWithObject: true }),
      large.png().toBuffer({ resolveWithObject: true }),
    ]);
    const sourceMeta = await image.metadata();
    const center = await image.clone().extract({
      left: Math.floor(sourceMeta.width / 2),
      top: Math.floor(sourceMeta.height / 2),
      width: 1,
      height: 1,
    }).ensureAlpha().raw().toBuffer();
    const hasOpaqueCenterBackground = center[3] > 64;
    const smallRendered = hasOpaqueCenterBackground
      ? await sharp(smallBase.data).composite([{ input: cutouts[0], blend: "dest-out" }]).png().toBuffer({ resolveWithObject: true })
      : center[3] > 0
        ? await sharp(smallBase.data).composite([{ input: centerPixels[0], blend: "dest-out" }]).png().toBuffer({ resolveWithObject: true })
        : smallBase;
    const largeRendered = hasOpaqueCenterBackground
      ? await sharp(largeBase.data).composite([{ input: cutouts[1], blend: "dest-out" }]).png().toBuffer({ resolveWithObject: true })
      : center[3] > 0
        ? await sharp(largeBase.data).composite([{ input: centerPixels[1], blend: "dest-out" }]).png().toBuffer({ resolveWithObject: true })
        : largeBase;
    const withMargin = ({ data, info }, quality) => sharp(data).extend({
      top: Math.round(info.height * 0.04),
      bottom: Math.round(info.height * 0.04),
      left: Math.round(info.width * 0.04),
      right: Math.round(info.width * 0.04),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).webp({ quality, alphaQuality: 72 }).toBuffer();
    let smallWebp = await withMargin(smallRendered, 72);
    for (const quality of [68, 64, 60, 56, 52, 48, 44]) {
      if (smallWebp.length <= 25 * 1024) break;
      smallWebp = await withMargin(smallRendered, quality);
    }
    if (smallWebp.length > 25 * 1024) {
      throw new Error(`Avatar frame ${frame.slug} exceeds the 25 KB target`);
    }
    const largeWebp = await withMargin(largeRendered, 72);
    const centerPixel = await sharp(smallWebp).extract({
      left: Math.floor((smallRendered.info.width + 2 * Math.round(smallRendered.info.width * 0.04)) / 2),
      top: Math.floor((smallRendered.info.height + 2 * Math.round(smallRendered.info.height * 0.04)) / 2),
      width: 1,
      height: 1,
    }).ensureAlpha().raw().toBuffer();
    if (centerPixel[3] !== 0) throw new Error(`Avatar frame ${frame.slug} has an opaque center`);
    await Promise.all([
      writeFile(webpPath, smallWebp),
      writeFile(largeWebpPath, largeWebp),
      putR2Object(`frames/${typePath}/${frame.slug}.v${version}.webp`, smallWebp, "image/webp"),
      putR2Object(`frames/${typePath}/${frame.slug}.v${version}@2x.webp`, largeWebp, "image/webp"),
    ]);
  } else {
    const trimmed = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 8 })
      .resize({ width: 480, fit: "inside", withoutEnlargement: false });
    const { data, info } = await trimmed.png().toBuffer({ resolveWithObject: true });
    const webp = await sharp(data).extend({
      top: Math.round(info.height * 0.04),
      bottom: Math.round(info.height * 0.04),
      left: Math.round(info.width * 0.04),
      right: Math.round(info.width * 0.04),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).webp({ quality: 75, alphaQuality: 80 }).toBuffer();
    if (webp.length > 30 * 1024) throw new Error(`Name frame ${frame.slug} exceeds the 30 KB target`);
    await Promise.all([
      writeFile(webpPath, webp),
      putR2Object(`frames/${typePath}/${frame.slug}.v${version}.webp`, webp, "image/webp"),
    ]);
  }
  await Promise.all([
    rm(path.join(outputDir, `${frame.slug}.png`), { force: true }),
    rm(path.join(outputDir, `${frame.slug}.webp`), { force: true }),
  ]);
  return webpPath;
}

try {
  await mkdir(outputDir, { recursive: true });
  const rows = [];
  for (const [sortOrder, frame] of FRAMES.entries()) {
    const typePath = frame.type === "avatar" ? "avatar" : "name";
    const version = frame.version ?? 2;
    const webpPath = path.join(outputDir, `${frame.slug}.v${version}.webp`);
    const largeWebpPath = path.join(outputDir, `${frame.slug}.v${version}@2x.webp`);
    let derivativesExist = true;
    try {
      await access(webpPath);
      if (frame.type === "avatar") await access(largeWebpPath);
    } catch {
      derivativesExist = false;
    }
    const imagePath = force || !derivativesExist
      ? await writeVersionedFrame(frame, typePath, version)
      : webpPath;
    const imageUrl = publicMediaUrl(`frames/${typePath}/${frame.slug}.v${version}.webp`);
    const metadata = await sharp(imagePath).metadata();
    const fileStats = await stat(imagePath);
    const safe = frame.safe;
    const textColor = frame.type === "name"
      ? await inferTextColor(imagePath, safe)
      : frame.textColor ?? null;
    await prisma.frame.upsert({
      where: { id: frame.slug },
      create: {
        id: frame.slug,
        type: frame.type,
        slug: frame.slug,
        name: frame.name,
        imageUrl,
        imageWidth: metadata.width,
        imageHeight: metadata.height,
        version,
        rarity: frame.rarity,
        priceCredits: frame.priceCredits,
        acquisition: frame.missionKey ? "mission" : "shop",
        missionKey: frame.missionKey ?? null,
        scale: frame.scale ?? 1.42,
        textInsetLeft: safe?.left,
        textInsetRight: safe?.right,
        textInsetTop: safe?.top,
        textInsetBottom: safe?.bottom,
        textAlign: frame.textAlign ?? "center",
        maxFontPx: frame.maxFontPx ?? 16,
        minFontPx: frame.minFontPx ?? 11,
        textColor,
        isActive: true,
        sortOrder,
      },
      update: {
        type: frame.type,
        name: frame.name,
        imageUrl,
        imageWidth: metadata.width,
        imageHeight: metadata.height,
        version,
        rarity: frame.rarity,
        priceCredits: frame.priceCredits,
        acquisition: frame.missionKey ? "mission" : "shop",
        missionKey: frame.missionKey ?? null,
        scale: frame.scale ?? 1.42,
        textInsetLeft: safe?.left,
        textInsetRight: safe?.right,
        textInsetTop: safe?.top,
        textInsetBottom: safe?.bottom,
        textAlign: frame.textAlign ?? "center",
        maxFontPx: frame.maxFontPx ?? 16,
        minFontPx: frame.minFontPx ?? 11,
        textColor,
        isActive: true,
        sortOrder,
      },
    });
    rows.push({
      slug: frame.slug,
      type: frame.type,
      aspect: frame.type === "name" ? `${metadata.width}/${metadata.height}` : "1/1",
      safe: safe ? `${safe.left}/${safe.top}/${safe.right}/${safe.bottom}` : "",
      textAlign: frame.textAlign ?? "center",
      maxFontPx: frame.maxFontPx ?? 16,
      kb: (fileStats.size / 1024).toFixed(1),
      priceOrMission: frame.missionKey ?? frame.priceCredits,
    });
  }
  console.table(rows);
} finally {
  await prisma.$disconnect();
}
