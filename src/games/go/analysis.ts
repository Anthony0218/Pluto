import { applyGoMove, createInitialGoState, getGoGroup, isLegalGoMove, type GoMove, type GoState } from "./rules.ts";

export const GO_COLUMNS = "ABCDEFGHJKLMNOPQRST";
export function goCoordinate(move: GoMove, size: number): string {
  return move.type === "place" ? GO_COLUMNS[move.col] + (size - move.row) : move.type;
}
export function parseGoCoordinate(value: string, size: number): GoMove {
  if (value.toLowerCase() === "pass") return { type: "pass" };
  const col = GO_COLUMNS.indexOf(value[0]?.toUpperCase());
  const row = size - Number(value.slice(1));
  if (!/^[A-HJ-T]\d+$/.test(value.toUpperCase()) || col < 0 || col >= size || row < 0 || row >= size) throw new Error("Invalid Go coordinate");
  return { type: "place", row, col };
}
export function replayGo(state: GoState): GoState[] {
  const frames = [createInitialGoState(state.boardSize, state.komi)];
  for (const move of state.moveHistory) frames.push(applyGoMove(frames.at(-1)!, move));
  return frames;
}
export function capturedGoPoints(before: GoState, after: GoState): number[] {
  return before.board.flatMap((stone, index) => stone && !after.board[index] ? [index] : []);
}
export function goAtariPoints(state: GoState): Set<number> {
  const visited = new Set<number>(), points = new Set<number>();
  state.board.forEach((stone, index) => {
    if (!stone || visited.has(index)) return;
    const group = getGoGroup(state.board, state.boardSize, index);
    group.stones.forEach(point => visited.add(point));
    if (group.liberties.size === 1) group.stones.forEach(point => points.add(point));
  });
  return points;
}
export function previewGoMove(state: GoState, move: GoMove) {
  if (!isLegalGoMove(state, move)) return null;
  const next = applyGoMove(state, move);
  const group = move.type === "place" ? getGoGroup(next.board, next.boardSize, move.row * next.boardSize + move.col) : null;
  return { next, captured: capturedGoPoints(state, next), liberties: group?.liberties ?? new Set<number>(), selfAtari: group?.liberties.size === 1 };
}
export type GoAnalysis = {
  turnNumber: number;
  rootInfo: { scoreLead: number; winrate: number; visits: number };
  moveInfos: { move: string; order: number; scoreLead: number; winrate: number; visits: number; pv: string[] }[];
};
export function goPointLoss(before: GoAnalysis, after: GoAnalysis, player: "black" | "white") {
  return Math.max(0, (before.rootInfo.scoreLead - after.rootInfo.scoreLead) * (player === "black" ? 1 : -1));
}
export function goMoveQuality(loss: number): "Best" | "Excellent" | "Good" | "Inaccuracy" | "Mistake" | "Blunder" {
  return loss < .5 ? "Best" : loss < 1 ? "Excellent" : loss < 2 ? "Good" : loss < 5 ? "Inaccuracy" : loss < 10 ? "Mistake" : "Blunder";
}
export async function analyzeGo(state: GoState, signal?: AbortSignal): Promise<GoAnalysis> {
  const { analyzeInBrowser } = await import("./browserEngine");
  return analyzeInBrowser(state, signal);
}
