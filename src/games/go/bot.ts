import { applyGoMove, getGoGroup, getLegalGoMoves, type GoMove, type GoState } from "./rules.ts";
export type BotDifficulty = "easy" | "medium" | "hard";
export interface GameBot<State, Move> { chooseMove(state: State, difficulty: BotDifficulty, signal?: AbortSignal): Promise<Move>; }
const abortError = () => new DOMException("Bot calculation cancelled", "AbortError");
export const goBot: GameBot<GoState, GoMove> = {
  async chooseMove(state, difficulty, signal) {
    await new Promise<void>((resolve, reject) => { const timer = globalThis.setTimeout(resolve, 100); signal?.addEventListener("abort", () => { globalThis.clearTimeout(timer); reject(abortError()); }, { once: true }); });
    if (signal?.aborted) throw abortError();
    const moves = getLegalGoMoves(state).filter((move) => move.type === "place");
    if (!moves.length) {
      if (state.status !== "playing") throw new Error("Cannot move in a finished game");
      return { type: "pass" };
    }
    const center = (state.boardSize - 1) / 2;
    const ranked = moves.map((move) => {
      if (move.type !== "place") return { move, score: -Infinity };
      const next = applyGoMove(state, move), captures = next.captures[state.currentPlayer] - state.captures[state.currentPlayer];
      const liberties = getGoGroup(next.board, next.boardSize, move.row * next.boardSize + move.col).liberties.size;
      const selfAtari = liberties === 1 && captures === 0 ? 45 : 0;
      const score = captures * 100 + liberties * 3 - selfAtari + state.boardSize - Math.abs(move.row - center) - Math.abs(move.col - center) + Math.random() * (difficulty === "easy" ? 30 : difficulty === "medium" ? 7 : 1.5);
      return { move, score };
    }).sort((a, b) => b.score - a.score);
    const occupied = state.board.filter(Boolean).length / state.board.length;
    if (occupied > 0.9 && ranked[0].score < 12) return { type: "pass" };
    return ranked[0].move;
  },
};
