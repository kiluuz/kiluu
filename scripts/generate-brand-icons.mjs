import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../kiluu-b-icon.svg", import.meta.url));
const publicDir = new URL("../public/", import.meta.url);

async function render(size, padding = 0, background = { r: 0, g: 0, b: 0, alpha: 0 }) {
  const innerSize = Math.round(size * (1 - padding * 2));
  const image = await sharp(svg)
    .resize(innerSize, innerSize, { fit: "contain" })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: image, left: Math.floor((size - innerSize) / 2), top: Math.floor((size - innerSize) / 2) }])
    .png()
    .toBuffer();
}

for (const size of [192, 512]) {
  const icon = await render(size);
  await writeFile(new URL(`icon-${size}.png`, publicDir), icon);
  if (size === 512) await writeFile(new URL("kiluu-b-square.png", publicDir), icon);
  await writeFile(
    new URL(`icon-${size}-maskable.png`, publicDir),
    await render(size, 0.1, { r: 21, g: 17, b: 14, alpha: 1 }),
  );
}
await writeFile(new URL("apple-touch-icon.png", publicDir), await render(180));

const icoSizes = [16, 32, 48];
const pngs = await Promise.all(icoSizes.map((size) => render(size)));
const header = Buffer.alloc(6 + icoSizes.length * 16);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(icoSizes.length, 4);
let offset = header.length;
for (let index = 0; index < icoSizes.length; index += 1) {
  const size = icoSizes[index];
  const image = pngs[index];
  const entry = 6 + index * 16;
  header[entry] = size;
  header[entry + 1] = size;
  header[entry + 2] = 0;
  header[entry + 3] = 0;
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
}
await writeFile(new URL("favicon.ico", publicDir), Buffer.concat([header, ...pngs]));
