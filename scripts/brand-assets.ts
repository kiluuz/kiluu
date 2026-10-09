/**
 * DubAniX brand asset generator.
 * Produces: favicon.svg, favicon.ico (16/32/48), apple-touch-icon.png (180),
 * icon-192.png / icon-512.png (regular + maskable safe padding), og-image.png (1200x630).
 *
 * Run: bun scripts/brand-assets.ts
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const PUB = path.resolve(process.cwd(), "public");

/* ---------- exact static favicon mark (from spec) ---------- */
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d1c"/><stop offset="1" stop-color="#ffa23a"/></linearGradient></defs><rect width="64" height="64" rx="17" fill="url(#g)"/><g fill="#fff"><rect x="14" y="15" width="6.5" height="34" rx="3.25"/><rect x="23" y="15" width="6.5" height="34" rx="3.25"/><rect x="32" y="16" width="6.5" height="32" rx="3.25" opacity=".95"/><rect x="41" y="19" width="6.5" height="26" rx="3.25" opacity=".8"/><rect x="50" y="25" width="6.5" height="14" rx="3.25" opacity=".6"/></g></svg>`;

/* ---------- maskable variant: full-bleed bg, bars scaled to safe zone ---------- */
const BARS = [
  { x: 14, y: 15, h: 34, o: 1 },
  { x: 23, y: 15, h: 34, o: 1 },
  { x: 32, y: 16, h: 32, o: 0.95 },
  { x: 41, y: 19, h: 26, o: 0.8 },
  { x: 50, y: 25, h: 14, o: 0.6 },
];
const barsSvg = (scale: number, cx = 32, cy = 32) =>
  BARS.map((b) => {
    const x = cx + (b.x - cx) * scale;
    const y = cy + (b.y - cy) * scale;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${(6.5 * scale).toFixed(2)}" height="${(b.h * scale).toFixed(2)}" rx="${(3.25 * scale).toFixed(2)}" opacity="${b.o}"/>`;
  }).join("");

const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d1c"/><stop offset="1" stop-color="#ffa23a"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><g fill="#fff">${barsSvg(0.66)}</g></svg>`;

/* ---------- ICO container wrapping PNGs ---------- */
function buildIco(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries: Buffer[] = [];
  const blobs: Buffer[] = [];
  for (const p of pngs) {
    const e = Buffer.alloc(16);
    const dim = p.size >= 256 ? 0 : p.size;
    e.writeUInt8(dim, 0);
    e.writeUInt8(dim, 1);
    e.writeUInt8(0, 2); // palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(p.data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += p.data.length;
    entries.push(e);
    blobs.push(p.data);
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

/* ---------- og:image 1200x630 (textLength-locked so font metrics can't break layout) ---------- */
function ogSvg(): string {
  const ink = "#12100d";
  const markSize = 150;
  const gap = 33;
  const dubaniW = 330;
  const xW = 58;
  const total = markSize + gap + dubaniW + 2 + xW;
  const startX = Math.round((1200 - total) / 2);
  const markX = startX;
  const wmX = startX + markSize + gap;
  const k = markSize / 64; // 64-viewBox -> 150px
  const bars = BARS.map((b) => {
    const x = markX + b.x * k;
    const y = 196 + b.y * k; // mark top at y=196, vertically centered ~270
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(6.5 * k).toFixed(1)}" height="${(b.h * k).toFixed(1)}" rx="${(3.25 * k).toFixed(1)}" opacity="${b.o}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="og" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff4d1c"/><stop offset="1" stop-color="#ffa23a"/>
    </linearGradient>
    <linearGradient id="xg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff4d1c"/><stop offset="1" stop-color="#ffa23a"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="#ff4d1c" stop-opacity="0.30"/>
      <stop offset="0.55" stop-color="#ff4d1c" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#ff4d1c" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${ink}"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <!-- mark -->
  <rect x="${markX}" y="196" width="${markSize}" height="${markSize}" rx="${Math.round(17 * k)}" fill="url(#og)"/>
  <g fill="#fff">${bars}</g>
  <!-- wordmark: DubAni (600, .92) + X (gradient) -->
  <text x="${wmX}" y="308" font-family="Unbounded" font-weight="600" font-size="76"
        fill="#ffffff" fill-opacity="0.92" letter-spacing="-3.04"
        textLength="${dubaniW}" lengthAdjust="spacingAndGlyphs">DubAni</text>
  <text x="${wmX + dubaniW + 2}" y="308" font-family="Unbounded" font-weight="800" font-size="76"
        fill="url(#xg)" letter-spacing="-3.04"
        textLength="${xW}" lengthAdjust="spacingAndGlyphs">X</text>
  <!-- tagline -->
  <text x="600" y="432" text-anchor="middle" font-family="Shippori Mincho" font-weight="600" font-size="34"
        fill="#ffa23a" letter-spacing="10.2" textLength="88" lengthAdjust="spacingAndGlyphs">吹替</text>
  <text x="600" y="478" text-anchor="middle" font-family="Unbounded" font-weight="600" font-size="17"
        fill="#9a96a8" letter-spacing="5" textLength="330" lengthAdjust="spacingAndGlyphs">VOICE IT YOUR WAY</text>
</svg>`;
}

async function main() {
  await mkdir(PUB, { recursive: true });

  /* 1) favicon.svg + logo.svg (exact static mark) */
  await writeFile(path.join(PUB, "favicon.svg"), FAVICON_SVG, "utf8");
  await writeFile(path.join(PUB, "logo.svg"), FAVICON_SVG, "utf8");

  /* 2) PNG renders from the SVG mark */
  const mk = async (svg: string, size: number): Promise<Buffer> =>
    sharp(Buffer.from(svg), { density: (72 * size) / 64 }).resize(size, size).png().toBuffer();

  const png16 = await mk(FAVICON_SVG, 16);
  const png32 = await mk(FAVICON_SVG, 32);
  const png48 = await mk(FAVICON_SVG, 48);

  /* 3) favicon.ico (16/32/48) */
  await writeFile(path.join(PUB, "favicon.ico"), buildIco([
    { size: 16, data: png16 },
    { size: 32, data: png32 },
    { size: 48, data: png48 },
  ]));

  /* 4) apple-touch-icon 180 (regular mark) */
  await writeFile(path.join(PUB, "apple-touch-icon.png"), await mk(FAVICON_SVG, 180));

  /* 5) PWA icons 192/512 — regular + maskable (safe padding) */
  for (const size of [192, 512]) {
    await writeFile(path.join(PUB, `icon-${size}.png`), await mk(FAVICON_SVG, size));
    await writeFile(path.join(PUB, `icon-${size}-maskable.png`), await mk(MASKABLE_SVG, size));
  }

  /* 6) og:image 1200x630 */
  const og = await sharp(Buffer.from(ogSvg())).png().toBuffer();
  await writeFile(path.join(PUB, "og-image.png"), og);
  const meta = await sharp(og).metadata();
  console.log(`og-image: ${meta.width}x${meta.height}`);

  /* 7) manifest */
  const manifest = {
    name: "DubAniX",
    short_name: "DubAniX",
    description: "Premium anime streaming — stream, collect, exchange, watch together. Voice it your way.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#12100d",
    theme_color: "#ff4d1c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
  await writeFile(path.join(PUB, "manifest.webmanifest"), JSON.stringify(manifest, null, 2), "utf8");

  console.log("DubAniX brand assets written to public/:");
  for (const f of [
    "favicon.svg", "favicon.ico", "apple-touch-icon.png",
    "icon-192.png", "icon-192-maskable.png", "icon-512.png", "icon-512-maskable.png",
    "og-image.png", "manifest.webmanifest", "logo.svg",
  ]) {
    console.log("  -", f);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
