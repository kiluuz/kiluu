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
  { file: "imageframe2.png", slug: "misty-kitsune", type: "avatar", name: "Misty Kitsune", rarity: "rare", priceCredits: 100, version: 3, scale: 1.42 },
  { file: "imageframe3.png", slug: "titan-wood", type: "avatar", name: "Titan's Oath", rarity: "legendary", priceCredits: null, missionKey: "mission_level_50", version: 3, scale: 1.42 },
  { file: "imageframe4.png", slug: "autumn-fox", type: "avatar", name: "Autumn Fox", rarity: "epic", priceCredits: null, missionKey: "mission_streak_50", version: 3, scale: 1.42 },
  { file: "imageframe5.png", slug: "frost-ring", type: "avatar", name: "Frost Ring", rarity: "common", priceCredits: 100, version: 3, scale: 1.42 },
  { file: "imageframe6.png", slug: "moonlit-shinobi", type: "avatar", name: "Moonlit Shinobi", rarity: "epic", priceCredits: 100, version: 3, scale: 1.42 },
  { file: "imageframe7.png", slug: "aqua-phoenix", type: "avatar", name: "Aqua Phoenix", rarity: "epic", priceCredits: null, missionKey: "mission_level_15", version: 3, scale: 1.42 },
  { file: "imageframe8.png", slug: "wisteria-charm", type: "avatar", name: "Wisteria Charm", rarity: "legendary", priceCredits: 100, version: 3, scale: 1.42 },
  { file: "imageframe9.png", slug: "moon-bunny", type: "avatar", name: "Moon Bunny", rarity: "rare", priceCredits: 100, version: 3, scale: 1.42 },
  { file: "imageframe10.png", slug: "butterfly-crest", type: "avatar", name: "Butterfly Crest", rarity: "rare", priceCredits: 100, version: 3, scale: 1.42 },
  { file: "imageframe11.png", slug: "pumpkin-moon", type: "avatar", name: "Pumpkin Moon", rarity: "rare", priceCredits: 100, version: 3, scale: 1.42 },
  { file: "nameframe1.png", slug: "vermilion-fan", type: "name", name: "Vermilion Fan", rarity: "rare", priceCredits: 100, version: 4, imageWidth: 518, imageHeight: 231, safe: { left: 24, right: 26, top: 38, bottom: 24 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#211b17" },
  { file: "nameframe2.png", slug: "scarlet-shatter", type: "name", name: "Scarlet Shatter", rarity: "legendary", priceCredits: 100, version: 3, imageWidth: 518, imageHeight: 292, safe: { left: 22, right: 22, top: 34, bottom: 30 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fff" },
  { file: "nameframe3.png", slug: "midnight-wing", type: "name", name: "Midnight Wing", rarity: "rare", priceCredits: 100, version: 3, imageWidth: 518, imageHeight: 151, safe: { left: 28, right: 22, top: 32, bottom: 28 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#f8fafc" },
  { file: "nameframe4.png", slug: "crimson-swordsman", type: "name", name: "Crimson Sword", rarity: "legendary", priceCredits: null, missionKey: "mission_streak_30", version: 3, imageWidth: 518, imageHeight: 250, safe: { left: 42, right: 8, top: 48, bottom: 22 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fff8e8" },
  { file: "nameframe5.png", slug: "sakura-cloud", type: "name", name: "Sakura Cloud", rarity: "common", priceCredits: 0, version: 3, imageWidth: 518, imageHeight: 261, safe: { left: 44, right: 8, top: 32, bottom: 32 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#37344a" },
  { file: "nameframe6.png", slug: "ember-koi", type: "name", name: "Ember Koi", rarity: "epic", priceCredits: 100, version: 5, imageWidth: 518, imageHeight: 293, safe: { left: 24, right: 24, top: 22, bottom: 36 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fffaf0" },
  { file: "nameframe7.png", slug: "sunset-festival", type: "name", name: "Sunset Festival", rarity: "rare", priceCredits: 100, version: 3, imageWidth: 518, imageHeight: 168, safe: { left: 16, right: 16, top: 34, bottom: 20 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fff5e8" },
  { file: "nameframe8.webp", slug: "ivory-cloud", type: "name", name: "Ivory Cloud", rarity: "common", priceCredits: 100, version: 3, imageWidth: 518, imageHeight: 193, safe: { left: 36, right: 16, top: 32, bottom: 30 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fff" },
  { file: "nameframe9.png", slug: "astral-brush", type: "name", name: "Astral Brush", rarity: "epic", priceCredits: null, missionKey: "mission_streak_70", version: 4, imageWidth: 518, imageHeight: 159, safe: { left: 34, right: 14, top: 26, bottom: 26 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#30251d" },
  { file: "nameframe10.png", slug: "ink-and-katana", type: "name", name: "Ink & Katana", rarity: "rare", priceCredits: 100, version: 4, imageWidth: 518, imageHeight: 191, safe: { left: 26, right: 12, top: 26, bottom: 26 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fff5df" },
  { file: "nameframe11.png", slug: "winter-flame", type: "name", name: "Winter Flame", rarity: "rare", priceCredits: 100, version: 5, imageWidth: 518, imageHeight: 194, safe: { left: 24, right: 22, top: 28, bottom: 28 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#211b17" },
  { file: "nameframe12.png", slug: "blush-whisper", type: "name", name: "Blush Whisper", rarity: "common", priceCredits: 100, version: 5, imageWidth: 518, imageHeight: 167, safe: { left: 28, right: 12, top: 38, bottom: 14 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#211b17" },
  { file: "nameframe13.png", slug: "lotus-ember", type: "name", name: "Lotus Ember", rarity: "epic", priceCredits: 100, version: 5, imageWidth: 518, imageHeight: 123, safe: { left: 28, right: 6, top: 36, bottom: 14 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#51243a" },
  { file: "nameframe14.png", slug: "stillwater-plate", type: "name", name: "Stillwater Plate", rarity: "rare", priceCredits: null, missionKey: "mission_streak_100", version: 3, imageWidth: 518, imageHeight: 270, safe: { left: 32, right: 8, top: 29, bottom: 43 }, textAlign: "center", maxFontPx: 22, minFontPx: 14, textColor: "#fffaf0" },
];

export function frameById(id: string | null | undefined): FrameConfig | undefined {
  return id ? FRAMES.find((frame) => frame.slug === id) : undefined;
}
