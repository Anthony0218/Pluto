import { createInitialGoState, type GoState } from "./rules.ts";
import { replayGo } from "./analysis.ts";
import { canReviewGoGame } from "./reviewAvailability.ts";

const key = "pluto.go.last-game.v1";
const completedKey = "pluto.go.last-completed-game.v1";
export function saveGoGame(state: GoState) {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(key, serialized);
    if (canReviewGoGame(state)) localStorage.setItem(completedKey, serialized);
  } catch { /* Play remains available when storage is full or disabled. */ }
}
export function loadGoGame(): GoState {
  for (const storageKey of [completedKey, key]) {
    try {
      const state = JSON.parse(localStorage.getItem(storageKey) ?? "null") as GoState | null;
      if (!state || ![9, 13, 19].includes(state.boardSize) || state.komi !== 6.5 || !Array.isArray(state.moveHistory) || state.moveHistory.length > 1500) continue;
      const replayed = replayGo(state).at(-1)!;
      if (canReviewGoGame(replayed)) return replayed;
      // Ranked clocks and off-turn resignations end a verified position without
      // adding a board move. Keep that result when loading the existing review.
      if (canReviewGoGame(state) && ["black", "white", "draw"].includes(state.winner ?? "") && /wins by (timeout|resignation)$/.test(state.result ?? "")) {
        return { ...replayed, status: "finished", winner: state.winner, result: state.result };
      }
    } catch { /* A corrupt saved game must not block the other completed-game slot. */ }
  }
  return createInitialGoState();
}
