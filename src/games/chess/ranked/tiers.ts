export type RankFamily = "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Master" | "Grandmaster";
export type RankTier = { name: string; family: RankFamily; minimum: number; maximum: number | null; nextAt: number | null; progress: number };

const families: { name: RankFamily; start: number; step: number; levels: number }[] = [
  { name: "Silver", start: 800, step: 100, levels: 5 },
  { name: "Gold", start: 1300, step: 100, levels: 5 },
  { name: "Platinum", start: 1800, step: 100, levels: 5 },
  { name: "Diamond", start: 2300, step: 50, levels: 5 },
];
const numerals = ["V", "IV", "III", "II", "I"];

export function getChessRank(rating: number): RankTier {
  const elo = Math.max(0, Math.floor(Number.isFinite(rating) ? rating : 0));
  if (elo >= 2700) return { name: "Grandmaster", family: "Grandmaster", minimum: 2700, maximum: null, nextAt: null, progress: 1 };
  if (elo >= 2550) return { name: "Master", family: "Master", minimum: 2550, maximum: 2699, nextAt: 2700, progress: (elo - 2550) / 150 };
  if (elo < 800) {
    const level = elo < 400 ? 0 : Math.min(4, Math.floor((elo - 400) / 100) + 1);
    const minimum = level === 0 ? 0 : 400 + (level - 1) * 100;
    const nextAt = level === 0 ? 400 : minimum + 100;
    return { name: `Bronze ${numerals[level]}`, family: "Bronze", minimum, maximum: nextAt - 1, nextAt, progress: (elo - minimum) / (nextAt - minimum) };
  }
  for (const family of families) {
    if (elo < family.start || elo >= family.start + family.step * family.levels) continue;
    const level = Math.min(family.levels - 1, Math.floor((elo - family.start) / family.step));
    const minimum = family.start + level * family.step;
    const nextAt = family.start + (level + 1) * family.step;
    return { name: `${family.name} ${numerals[level]}`, family: family.name, minimum, maximum: nextAt - 1, nextAt, progress: Math.max(0, Math.min(1, (elo - minimum) / (nextAt - minimum))) };
  }
  return { name: "Diamond I", family: "Diamond", minimum: 2500, maximum: 2549, nextAt: 2550, progress: (elo - 2500) / 50 };
}
