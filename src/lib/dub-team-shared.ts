export const DUB_ROLES = ["voice", "director", "sound"] as const;
export type DubRole = (typeof DUB_ROLES)[number];

export const DUB_ROLE_LABELS: Record<DubRole, string> = {
  voice: "Ovoz aktyori",
  director: "Rejissyor",
  sound: "Ovoz muhandisi",
};

export const DUB_LANGUAGES = ["uz", "kk", "ky", "ru"] as const;

export const DUB_LANGUAGE_LABELS: Record<string, string> = {
  uz: "O‘zbekcha",
  kk: "Qozoqcha",
  ky: "Qirg‘izcha",
  ru: "Ruscha",
};

/** Jamoa darajasi — reputation 0..100 asosida ko‘rsatiladigan unvon. */
export function dubTeamTitle(reputation: number, verified = false): { label: string; color: string } {
  if (verified && reputation >= 85) return { label: "Afsonaviy jamoa", color: "#ffc46b" };
  if (reputation >= 75) return { label: "Oltin jamoa", color: "#ffc46b" };
  if (reputation >= 50) return { label: "Kumush jamoa", color: "#cfd8e3" };
  if (reputation >= 25) return { label: "Bronza jamoa", color: "#e6a06c" };
  return { label: "Yangi jamoa", color: "#9be7d0" };
}
