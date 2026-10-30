export type GiftRarityId = "legendary" | "epic" | "rare" | "common";

export interface GiftRarity {
  id: GiftRarityId;
  label: string;
  min: number;
  color: string;
  stars: number;
}

/** Single source of truth for gift rarity tiers (credit price → tier). */
export const GIFT_RARITIES: readonly GiftRarity[] = [
  { id: "legendary", label: "Legendary", min: 550, color: "#ffc46b", stars: 5 },
  { id: "epic", label: "Epic", min: 400, color: "#c77dff", stars: 4 },
  { id: "rare", label: "Rare", min: 250, color: "#4dd0ff", stars: 3 },
  { id: "common", label: "Common", min: 0, color: "#9be7d0", stars: 2 },
] as const;

export function giftRarity(price: number): GiftRarity {
  const value = Number.isFinite(price) ? Math.max(0, price) : 0;
  return GIFT_RARITIES.find((rarity) => value >= rarity.min) ?? GIFT_RARITIES[GIFT_RARITIES.length - 1];
}

export function giftRarityById(id: string | null | undefined): GiftRarity | null {
  return GIFT_RARITIES.find((rarity) => rarity.id === id) ?? null;
}

/**
 * Sifat signallari narx darajasini yuqoriga ko‘taradi:
 * reyting, dub speakerlar soni va dub jamoasi obro‘si.
 */
export const COLLECTIBLE_BOOSTS = {
  rating: { high: 9, medium: 8 },
  speakers: { high: 12, medium: 6 },
  reputation: { high: 85, medium: 65 },
} as const;

export interface CollectibleSignals {
  price: number;
  rating?: number | null;
  speakerCount?: number | null;
  teamReputation?: number | null;
}

const RARITY_LADDER: readonly GiftRarityId[] = ["common", "rare", "epic", "legendary"] as const;

function priceTier(price: number): number {
  const index = GIFT_RARITIES.findIndex((rarity) => rarity.id === giftRarity(price).id);
  return RARITY_LADDER.length - 1 - index;
}

export function collectibleRarity(signals: CollectibleSignals): GiftRarity {
  let tier = priceTier(signals.price);

  const rating = Number.isFinite(signals.rating) ? Math.min(10, Math.max(0, signals.rating ?? 0)) : 0;
  if (rating >= COLLECTIBLE_BOOSTS.rating.high) tier += 2;
  else if (rating >= COLLECTIBLE_BOOSTS.rating.medium) tier += 1;

  const speakers = Math.max(0, signals.speakerCount ?? 0);
  if (speakers >= COLLECTIBLE_BOOSTS.speakers.high) tier += 2;
  else if (speakers >= COLLECTIBLE_BOOSTS.speakers.medium) tier += 1;

  const reputation = Math.min(100, Math.max(0, signals.teamReputation ?? 0));
  if (reputation >= COLLECTIBLE_BOOSTS.reputation.high) tier += 2;
  else if (reputation >= COLLECTIBLE_BOOSTS.reputation.medium) tier += 1;

  return giftRarityById(RARITY_LADDER[Math.min(RARITY_LADDER.length - 1, tier)])!;
}

/** Lower number = rarer, for "rarest first" sorting. */
export function giftRarityRank(price: number): number {
  const rarity = giftRarity(price);
  return GIFT_RARITIES.findIndex((item) => item.id === rarity.id);
}

export function giftRarityRankById(id: string | null | undefined, price: number): number {
  const rarity = giftRarityById(id) ?? giftRarity(price);
  return GIFT_RARITIES.findIndex((item) => item.id === rarity.id);
}

/** Deterministic collectible serial derived from the gift id. */
export function giftSerialNumber(giftId: string): string {
  let hash = 2166136261;
  for (let index = 0; index < giftId.length; index += 1) {
    hash ^= giftId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const serial = 1000 + (Math.abs(hash) % 9000);
  return `No. ${serial}`;
}
