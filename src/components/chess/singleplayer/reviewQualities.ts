import { classifyMove, type MoveQuality } from "@/utils/chessAnalysis";

export const qualityList: MoveQuality[] = [
  "Best",
  "Excellent",
  "Good",
  "Inaccuracy",
  "Mistake",
  "Blunder",
];

/** Engine evaluation text ("+0.35", "M3", "-M2") back to a centipawn-like score. */
function evaluationScore(evaluation: string) {
  const mate = /^(-)?M(\d+)$/.exec(evaluation);
  if (mate) return mate[1] ? -100000 + Number(mate[2]) * 100 : 100000 - Number(mate[2]) * 100;
  const pawns = Number.parseFloat(evaluation);
  return Number.isFinite(pawns) ? pawns * 100 : 0;
}

/** Grades an engine alternative against the top line of the same position. */
export function alternativeQuality(suggestions: { evaluation: string }[], index: number): MoveQuality {
  if (index === 0) return "Best";
  const loss = evaluationScore(suggestions[0].evaluation) - evaluationScore(suggestions[index].evaluation);
  return classifyMove(Math.max(0, loss), false);
}
