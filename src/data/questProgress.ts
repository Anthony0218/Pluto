import type { DailyChallenge } from "./dashboard";

export type PuzzleProgressEntry = {
  completedAt: string;
  mistakes: number;
  puzzle: { category: string; difficulty: string };
};

export function puzzleQuestProgress(quest: DailyChallenge, completions: PuzzleProgressEntry[]): number {
  const end = Date.parse(quest.expires_at);
  if (!Number.isFinite(end)) return 0;
  const matching = completions.filter(entry => {
    const completed = Date.parse(entry.completedAt);
    if (completed < end - 86_400_000 || completed >= end) return false;
    if (quest.difficulty === "Advanced+" && !["Advanced", "Really Hard"].includes(entry.puzzle.difficulty)) return false;
    if (quest.difficulty && quest.difficulty !== "Advanced+" && entry.puzzle.difficulty !== quest.difficulty) return false;
    if (quest.progress_type === "puzzle_perfect" && entry.mistakes !== 0) return false;
    return true;
  });
  if (quest.progress_type === "puzzle_categories") return new Set(matching.map(entry => entry.puzzle.category)).size;
  return matching.length;
}
