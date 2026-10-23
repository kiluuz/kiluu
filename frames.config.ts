export type FrameType = "avatar" | "name";
export type FrameRarity = "common" | "rare" | "epic" | "legendary";

export interface FrameConfig {
  file: string;
  slug: string;
  type: FrameType;
  name: string;
  rarity: FrameRarity;
  priceCredits: number | null;
  missionKey?: string;
  scale?: number;
  version?: number;
  imageWidth?: number;
  imageHeight?: number;
  safe?: { left: number; right: number; top: number; bottom: number };
  textAlign?: "left" | "center" | "right";
  maxFontPx?: number;
  minFontPx?: number;
  textColor?: string;
}

export const FRAMES: FrameConfig[] = [
  { file: "imageframe1.png", slug: "sakura-bento", type: "avatar", name: "Sakura Bento", rarity: "common", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "imageframe2.png", slug: "misty-kitsune", type: "avatar", name: "Misty Kitsune", rarity: "rare", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "imageframe3.png", slug: "titan-wood", type: "avatar", name: "Titan's Oath", rarity: "legendary", priceCredits: null, missionKey: "frame-hard", version: 3, scale: 1.42 },
  { file: "imageframe4.png", slug: "autumn-fox", type: "avatar", name: "Autumn Fox", rarity: "epic", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "imageframe5.png", slug: "frost-ring", type: "avatar", name: "Frost Ring", rarity: "common", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "imageframe6.png", slug: "moonlit-shinobi", type: "avatar", name: "Moonlit Shinobi", rarity: "epic", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "imageframe7.png", slug: "aqua-phoenix", type: "avatar", name: "Aqua Phoenix", rarity: "epic", priceCredits: null, missionKey: "frame-medium", version: 3, scale: 1.42 },
  { file: "imageframe8.png", slug: "wisteria-charm", type: "avatar", name: "Wisteria Charm", rarity: "legendary", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "imageframe9.png", slug: "moon-bunny", type: "avatar", name: "Moon Bunny", rarity: "rare", priceCredits: null, missionKey: "frame-easy", version: 3, scale: 1.42 },
  { file: "imageframe10.png", slug: "butterfly-crest", type: "avatar", name: "Butterfly Crest", rarity: "rare", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "imageframe11.png", slug: "pumpkin-moon", type: "avatar", name: "Pumpkin Moon", rarity: "rare", priceCredits: 0, version: 3, scale: 1.42 },
  { file: "nameframe1.png", slug: "vermilion-fan", type: "name", name: "Vermilion Fan", rarity: "rare", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 231, safe: { left: 30, right: 28, top: 38, bottom: 28 }, textAlign: "left", maxFontPx: 22, minFontPx: 14, textColor: "#211b17" },
  { file: "nameframe2.png", slug: "scarlet-shatter", type: "name", name: "Scarlet Shatter", rarity: "legendary", priceCredits: null, missionKey: "frame-hard", version: 3, imageWidth: 518, imageHeight: 292, safe: { left: 27, right: 20.56, top: 31.6, bottom: 31.6 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fff" },
  { file: "nameframe3.png", slug: "midnight-wing", type: "name", name: "Midnight Wing", rarity: "rare", priceCredits: null, missionKey: "frame-easy", version: 3, imageWidth: 518, imageHeight: 151, safe: { left: 29.76, right: 20.56, top: 36.2, bottom: 31.6 }, textAlign: "right", maxFontPx: 22, minFontPx: 14, textColor: "#f8fafc" },
  { file: "nameframe4.png", slug: "crimson-swordsman", type: "name", name: "Crimson Swordsman", rarity: "legendary", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 250, safe: { left: 43.56, right: 15.04, top: 48.16, bottom: 22.4 }, textAlign: "right", maxFontPx: 22, minFontPx: 14, textColor: "#fff8e8" },
  { file: "nameframe5.png", slug: "sakura-cloud", type: "name", name: "Sakura Cloud", rarity: "common", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 261, safe: { left: 48.16, right: 13.2, top: 35.28, bottom: 31.6 }, textAlign: "right", maxFontPx: 22, minFontPx: 14, textColor: "#37344a" },
  { file: "nameframe6.png", slug: "ember-koi", type: "name", name: "Ember Koi", rarity: "epic", priceCredits: null, missionKey: "frame-medium", version: 5, imageWidth: 518, imageHeight: 293, safe: { left: 32, right: 28, top: 20, bottom: 40 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fffaf0" },
  { file: "nameframe7.png", slug: "sunset-festival", type: "name", name: "Sunset Festival", rarity: "rare", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 168, safe: { left: 31.6, right: 20.5, top: 35.28, bottom: 13.2 }, textAlign: "right", maxFontPx: 22, minFontPx: 14, textColor: "#fff5e8" },
  { file: "nameframe8.webp", slug: "ivory-cloud", type: "name", name: "Ivory Cloud", rarity: "common", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 193, safe: { left: 37.12, right: 18.72, top: 27.92, bottom: 31.6 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fff" },
  { file: "nameframe9.png", slug: "astral-brush", type: "name", name: "Astral Brush", rarity: "epic", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 159, safe: { left: 38, right: 20, top: 33.44, bottom: 29.76 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#30251d" },
  { file: "nameframe10.png", slug: "ink-and-katana", type: "name", name: "Ink & Katana", rarity: "rare", priceCredits: 0, version: 4, imageWidth: 518, imageHeight: 191, safe: { left: 29.76, right: 13.2, top: 31.6, bottom: 31.6 }, textAlign: "right", maxFontPx: 22, minFontPx: 14, textColor: "#fff5df" },
  { file: "nameframe11.png", slug: "winter-flame", type: "name", name: "Winter Flame", rarity: "rare", priceCredits: 0, version: 5, imageWidth: 518, imageHeight: 194, safe: { left: 25, right: 20, top: 32, bottom: 35 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#211b17" },
  { file: "nameframe12.png", slug: "blush-whisper", type: "name", name: "Blush Whisper", rarity: "common", priceCredits: 0, version: 5, imageWidth: 518, imageHeight: 167, safe: { left: 27, right: 13, top: 38, bottom: 18 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#211b17" },
  { file: "nameframe13.png", slug: "lotus-ember", type: "name", name: "Lotus Ember", rarity: "epic", priceCredits: 0, version: 5, imageWidth: 518, imageHeight: 123, safe: { left: 29, right: 10, top: 38, bottom: 25 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#51243a" },
  { file: "nameframe14.png", slug: "stillwater-plate", type: "name", name: "Stillwater Plate", rarity: "rare", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 270, safe: { left: 35, right: 7, top: 28, bottom: 36 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fffaf0" },
];

export function frameById(id: string | null | undefined): FrameConfig | undefined {
  return id ? FRAMES.find((frame) => frame.slug === id) : undefined;
}
