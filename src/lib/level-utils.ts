import { levelFromXp } from "./xp";

export interface LevelInfo {
  level: number;
  xp: number;
  nextLevelXp: number;
  titleJa: string;
  titleUz: string;
}

export interface BadgeInfo {
  id: string;
  label: string;
  color: string;
  glow?: boolean;
}

export function calculateLevel(totalXp: number): LevelInfo {
  return {
    ...levelFromXp(totalXp),
    titleJa: "",
    titleUz: "",
  };
}

export function calculateBadges(params: {
  isCreator: boolean;
  createdAnimes: number;
  purchasedAnimes: number;
  levelInfo: LevelInfo;
}): BadgeInfo[] {
  const badges: BadgeInfo[] = [{
    id: "level",
    label: `LEVEL ${params.levelInfo.level}`,
    color: "bg-primary/90 text-primary-foreground",
  }];
  if (params.isCreator && params.createdAnimes > 0) {
    badges.push({ id: "creator", label: "CREATOR", color: "bg-blue-600/90 text-white", glow: true });
  }
  if (params.purchasedAnimes >= 100) {
    badges.push({ id: "collector", label: "COLLECTOR", color: "bg-amber-400 text-amber-950 font-black", glow: true });
  }
  return badges;
}
