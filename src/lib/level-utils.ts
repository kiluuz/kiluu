import { levelFromXp } from "./xp";

const LEVEL_MILESTONES = [
  { level: 100, titleJa: "無限", titleUz: "Cheksizlik" },
  { level: 91, titleJa: "最強", titleUz: "Eng kuchli" },
  { level: 81, titleJa: "王者", titleUz: "Hukmdor" },
  { level: 71, titleJa: "将軍", titleUz: "Oliy qo‘mondon" },
  { level: 61, titleJa: "隊長", titleUz: "Kapitan" },
  { level: 51, titleJa: "伝説", titleUz: "Afsona" },
  { level: 41, titleJa: "英雄", titleUz: "Qahramon" },
  { level: 31, titleJa: "黒影", titleUz: "Qora soya" },
  { level: 20, titleJa: "上忍", titleUz: "Elita ninja" },
  { level: 11, titleJa: "剣士", titleUz: "Qilichboz" },
  { level: 5, titleJa: "生徒", titleUz: "O‘quvchi" },
  { level: 1, titleJa: "見習い", titleUz: "Shogird" },
];

export interface LevelInfo {
  level: number;
  xp: number;
  intoLevel: number;
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
  const levelInfo = levelFromXp(totalXp);
  const milestone = LEVEL_MILESTONES.find(({ level }) => level <= levelInfo.level);

  return {
    ...levelInfo,
    titleJa: milestone?.titleJa ?? "見習い",
    titleUz: milestone?.titleUz ?? "Shogird",
  };
}

export function calculateBadges(params: {
  isCreator: boolean;
  createdAnimes: number;
  purchasedAnimes: number;
  levelInfo: LevelInfo;
}): BadgeInfo[] {
  const badges: BadgeInfo[] = [];
  if (!params.isCreator) {
    badges.push({
      id: "level_title",
      label: params.levelInfo.titleJa,
      color: "bg-primary/90 text-primary-foreground",
    });
  }
  if (params.isCreator && params.createdAnimes > 0) {
    badges.push({ id: "creator", label: "CREATOR", color: "bg-blue-600/90 text-white", glow: true });
  }
  if (params.purchasedAnimes >= 100) {
    badges.push({ id: "collector", label: "COLLECTOR", color: "bg-amber-400 text-amber-950 font-black", glow: true });
  }
  return badges;
}
