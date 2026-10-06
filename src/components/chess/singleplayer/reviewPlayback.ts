import type { MoveReview } from "../../../utils/chessAnalysis.ts";

export const REVIEW_SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4] as const;
export const playbackDelay = (speed: number) => 1100 / speed;

/** Missing a forced mate counts even when a non-mating winning advantage remains. */
export function isMissedWin(review: Pick<MoveReview, "missedMate" | "centipawnLoss">, before: number | null, after: number | null) {
  return review.missedMate || before !== null && after !== null && after <= 0.75 &&
    before >= 5 && review.centipawnLoss >= 80;
}
