/* ============ AniVerse profile asset catalog — Midnight Cinema ============ */

/** Scenic anime-style preset banners (free gallery) */
export const BANNER_PRESETS = [
  { id: "scenic-1", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/5f93419b1097.jpg", label: "Sakura Night" },
  { id: "scenic-2", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f257ec9f6c6e.jpg", label: "Twilight Field" },
  { id: "scenic-3", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/a638def63892.jpg", label: "Neon Alley" },
  { id: "scenic-4", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b469814fd1a8.jpg", label: "Moonlit Sea" },
  { id: "scenic-5", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/c95e91088a9b.jpg", label: "Mountain Dusk" },
  { id: "scenic-6", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0d5cb215bc2b.jpg", label: "City Rain" },
  { id: "scenic-7", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/bf4a960507c9.jpg", label: "Starlit Sky" },
  { id: "scenic-8", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f5c5b4da77ac.jpg", label: "Autumn Path" },
  { id: "scenic-9", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/dfb6a6c05e1e.jpg", label: "Festival Lights" },
];

/** Single-source preset lookup */
export function presetBannerUrl(id: string): string | null {
  return BANNER_PRESETS.find((b) => b.id === id)?.url ?? null;
}

export const AVATAR_PRESETS = [
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/58562083409c.webp",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8aa14633c6b7.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/bc71bf91aa57.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ced6309cf467.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/11fc1ac70b3e.jpg",
  "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/5e30ef0e1367.jpg",
];

/** Dual-color gradient accent presets — Discord-style profile themes */
export const ACCENT_PRESETS: { from: string; to: string; label: string }[] = [
  { from: "#f97316", to: "#f43f5e", label: "Ember" },
  { from: "#f59e0b", to: "#ef4444", label: "Sunset" },
  { from: "#ec4899", to: "#8b5cf6", label: "Sakura" },
  { from: "#06b6d4", to: "#3b82f6", label: "Frost" },
  { from: "#10b981", to: "#06b6d4", label: "Matcha" },
  { from: "#8b5cf6", to: "#6366f1", label: "Wisteria" },
  { from: "#ef4444", to: "#991b1b", label: "Oni" },
  { from: "#eab308", to: "#65a30d", label: "Citrus" },
  { from: "#f43f5e", to: "#be123c", label: "Camellia" },
  { from: "#38bdf8", to: "#818cf8", label: "Periwinkle" },
];

/** Avatar frames — some free, premium ones unlock with credits */
export interface AvatarFrameDef {
  id: string;
  label: string;
  css: string;
  price: number; // 0 = free
  premium?: boolean;
}

export const AVATAR_FRAMES: AvatarFrameDef[] = [
  { id: "none", label: "None", css: "", price: 0 },
  { id: "ember", label: "Ember", css: "conic-gradient(from 140deg, #f97316, #fbbf24, #f43f5e, #f97316)", price: 0 },
  { id: "gold", label: "Kintsugi Gold", css: "conic-gradient(from 0deg, #fbbf24, #fef3c7, #d97706, #fbbf24)", price: 300, premium: true },
  { id: "neon", label: "Neo-Tokyo", css: "conic-gradient(from 200deg, #06b6d4, #8b5cf6, #ec4899, #06b6d4)", price: 300, premium: true },
  { id: "sakura", label: "Sakura Dream", css: "conic-gradient(from 90deg, #fda4af, #f472b6, #c084fc, #fda4af)", price: 500, premium: true },
];

/* ============ ACHIEVEMENTS CATALOG ============ */
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface AchievementDef {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  rarity: Rarity;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "join", emoji: "🎬", name: "AniVerse Citizen", desc: "Joined AniVerse", rarity: "common" },
  { id: "first", emoji: "💎", name: "First Purchase", desc: "Bought your first anime", rarity: "common" },
  { id: "curator", emoji: "📚", name: "Curator", desc: "Favorited 10 animes", rarity: "common" },
  { id: "collector", emoji: "🏆", name: "Collector", desc: "Own 10 animes", rarity: "rare" },
  { id: "critic", emoji: "🍿", name: "Couch Critic", desc: "Watched 10 hours", rarity: "rare" },
  { id: "voice", emoji: "📣", name: "Voice of Community", desc: "Published 5 posts", rarity: "rare" },
  { id: "social", emoji: "🤝", name: "Social Butterfly", desc: "Got 5 followers", rarity: "rare" },
  { id: "exchange", emoji: "🔄", name: "Exchange Master", desc: "Own 20 animes & unlock trading", rarity: "epic" },
  { id: "marathon", emoji: "🌠", name: "Marathon Otaku", desc: "Watched 50 hours", rarity: "epic" },
  { id: "creator", emoji: "🎥", name: "Creator", desc: "Became a Creator", rarity: "epic" },
  { id: "trendsetter", emoji: "👑", name: "Trendsetter", desc: "Got 20 followers", rarity: "legendary" },
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/** Creator Studio — cover banner gallery for episode/anime uploads */
export const COVER_BANNER_PRESETS: { title: string; url: string }[] = [
  { title: "Abyss", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3277f864a857.jpg" },
  { title: "Aot", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ea9deb52ab76.jpg" },
  { title: "Bebop", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/d10316cc7a75.jpg" },
  { title: "Bleach", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/2ae73367c38e.jpg" },
  { title: "Chainsaw", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/294385561539.jpg" },
  { title: "Dbz", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/c9c5016eea14.jpg" },
  { title: "Deathnote", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/85c54441219b.jpg" },
  { title: "Demonslayer", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/32342b98c809.jpg" },
  { title: "Edgerunners", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8688968b52ab.jpg" },
  { title: "Fma", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/553a8ca91506.jpg" },
  { title: "Frieren", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/55c2c2d4ca42.jpg" },
  { title: "Hxh", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/2c1cb8067e47.jpg" },
  { title: "Jjk", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/13e0bbb56a6a.jpg" },
  { title: "Mha", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/39d15583d9a9.jpg" },
  { title: "Mob", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0c61d1f5457b.jpg" },
  { title: "Naruto", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/4feca8b15a78.jpg" },
  { title: "Onepiece", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f836130be8bb.jpg" },
  { title: "Sao", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/2cf9f61db429.jpg" },
  { title: "Spirited", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/37f4291d5630.jpg" },
  { title: "Spyfamily", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/13fae1133382.jpg" },
  { title: "Steins", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3d4a86bc29f8.jpg" },
  { title: "Tokyorev", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/168a2004f127.jpeg" },
  { title: "Violet", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/d4ab88c6837a.jpg" },
  { title: "Yourname", url: "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/e9343f43065d.jpg" },
];
