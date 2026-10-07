import { applyGoMove, createInitialGoState, getLegalGoMoves, type GoMove, type GoState } from "@/games/go/rules";
import { parseGoCoordinate } from "@/games/go/analysis";

/** A short 9×9 game in GTP coordinates, checked against the real rules in tests/landing-motion.test.mjs. */
export const sampleGame = ["C3", "G7", "G3", "C7", "E5", "E3", "D3", "E2", "D4", "F4", "D2", "F3", "C4", "F5", "E4", "G5", "D5", "F6", "C5", "E6", "B4", "D6", "B5", "D7", "A5", "C6", "C8", "B7"];
/** Black's win rate (%) before the first move and after each move of the sample game. */
export const sampleWinrate = [50, 52, 50, 53, 51, 56, 58, 55, 57, 53, 52, 50, 46, 48, 44, 47, 52, 55, 60, 58, 63, 66, 64, 69, 72, 70, 75, 78, 80];

export function sampleStates() {
  const states: GoState[] = [createInitialGoState(9)];
  for (const point of sampleGame) states.push(applyGoMove(states[states.length - 1], parseGoCoordinate(point, 9)));
  return states;
}

export type DemoQuality = "Good" | "Inaccuracy" | "Mistake" | "Blunder" | "AI Move";
/** Classify a move by how much the mover's win rate changed. */
export function qualityOf(change: number): DemoQuality {
  if (change >= 3) return "AI Move";
  if (change > -1.5) return "Good";
  if (change > -3) return "Inaccuracy";
  if (change > -6) return "Mistake";
  return "Blunder";
}

/** Three plausible next moves near the last one, with made-up win rates around the current value. */
export function sampleCandidates(state: GoState, winrate: number): { move: GoMove; label: string; winrate: number }[] {
  const last = state.lastMove ?? { row: 4, col: 4 };
  const places = getLegalGoMoves(state).flatMap(move => move.type === "place" ? [move] : []);
  const near = places.sort((a, b) => Math.hypot(a.row - last.row, a.col - last.col) - Math.hypot(b.row - last.row, b.col - last.col)).slice(0, 3);
  const mover = state.currentPlayer === "black" ? 1 : -1;
  return near.map((move, index) => ({ move, label: "ABCDEFGHJ"[move.col] + (9 - move.row), winrate: Math.round((winrate + mover * [1.8, 0.4, -2.6][index]) * 10) / 10 }));
}

/** A modest bot: take captures, otherwise stay near the action. Not an engine; it only has to feel alive. */
export function chooseDemoMove(state: GoState): GoMove {
  const places = getLegalGoMoves(state).flatMap(move => move.type === "place" ? [move] : []);
  if (!places.length) return { type: "pass" };
  const last = state.lastMove;
  const scored = places.map(move => {
    const captured = applyGoMove(state, move).moveHistory.at(-1)?.captured ?? 0;
    const nearness = last ? 3 - Math.min(3, Math.hypot(move.row - last.row, move.col - last.col)) : 0;
    const centre = 2 - Math.min(2, Math.hypot(move.row - 4, move.col - 4) / 2);
    return { move, score: captured * 10 + nearness + centre + Math.random() * 1.5 };
  });
  return scored.sort((a, b) => b.score - a.score)[0].move;
}
