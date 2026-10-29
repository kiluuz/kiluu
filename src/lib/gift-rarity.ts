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

/** Lower number = rarer, for "rarest first" sorting. */
export function giftRarityRank(price: number): number {
  const rarity = giftRarity(price);
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
