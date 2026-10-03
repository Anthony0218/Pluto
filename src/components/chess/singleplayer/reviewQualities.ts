import { classifyMove, evaluationScore, type MoveQuality } from "@/utils/chessAnalysis";

export const qualityList: MoveQuality[] = [
  "Book",
  "Best",
  "Excellent",
  "Good",
  "Inaccuracy",
  "Mistake",
  "Blunder",
];

/** Grades an engine alternative against the top line of the same position. */
export function alternativeQuality(suggestions: { evaluation: string }[], index: number): MoveQuality {
  if (index === 0) return "Best";
  const loss = evaluationScore(suggestions[0].evaluation) - evaluationScore(suggestions[index].evaluation);
  return classifyMove(Math.max(0, loss), false);
}
