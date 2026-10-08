import type { Difficulty } from "./types.ts";
export const DIFFICULTIES: readonly Difficulty[] = ["beginner", "easy", "medium", "hard", "extreme"];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { beginner: "Beginner", easy: "Easy", medium: "Normal", hard: "Hard", extreme: "Extreme" };
export const DIFFICULTY_DESCRIPTIONS: Record<Difficulty, string> = { beginner: "Learning the ropes · slow reactions and frequent mistakes", easy: "Relaxed opposition · forgiving aim and recall", medium: "A balanced challenge · occasional mistakes", hard: "The original default challenge · smart and steady", extreme: "Exceptional aim, recall and route planning" };
export const difficultyRank = (difficulty: Difficulty) => DIFFICULTIES.indexOf(difficulty);
