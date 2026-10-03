import type { GoState } from "./rules.ts";

/** A game can only be reviewed after its result has been recorded. */
export function canReviewGoGame(game: Pick<GoState, "status" | "result" | "moveHistory"> | null | undefined): boolean {
  return game?.status === "finished" && typeof game.result === "string" && game.result.length > 0 && Array.isArray(game.moveHistory) && game.moveHistory.length > 0;
}
