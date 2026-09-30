import type { GameBot } from "../go/bot.ts";
import { applyShogiMove, getLegalShogiMoves, type ShogiMove, type ShogiPieceType, type ShogiState } from "./rules.ts";
const VALUES: Record<ShogiPieceType, number> = { K: 10000, R: 10, B: 9, G: 6, S: 5, N: 4, L: 3, P: 1 };
function evaluate(state: ShogiState, perspective: "black" | "white") {
  let score = 0;
  state.board.forEach((piece) => { if (piece) score += (piece.color === perspective ? 1 : -1) * (VALUES[piece.type] + (piece.promoted ? 2 : 0)); });
  (["black", "white"] as const).forEach((color) => Object.entries(state.hands[color]).forEach(([type, count]) => { score += (color === perspective ? 1 : -1) * VALUES[type as ShogiPieceType] * (count ?? 0); }));
  return score;
}
export const shogiBot: GameBot<ShogiState, ShogiMove> = {
  async chooseMove(state, difficulty, signal) {
    await new Promise<void>((resolve, reject) => { const timer = globalThis.setTimeout(resolve, 80); signal?.addEventListener("abort", () => { globalThis.clearTimeout(timer); reject(new DOMException("Bot calculation cancelled", "AbortError")); }, { once: true }); });
    if (signal?.aborted) throw new DOMException("Bot calculation cancelled", "AbortError");
    const moves = getLegalShogiMoves(state);
    if (!moves.length) throw new Error("No legal Shogi move");
    const scored = moves.map((move) => {
      const next = applyShogiMove(state, move);
      let score = evaluate(next, state.currentPlayer);
      if (next.status === "finished") score += 100000;
      if (next.check) score += 4;
      if (move.type === "move" && move.promote) score += 2;
      if (difficulty !== "easy") score += getLegalShogiMoves(next).length * 0.015;
      return { move, score: score + Math.random() * (difficulty === "easy" ? 8 : difficulty === "medium" ? 2 : 0.25) };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].move;
  },
};
