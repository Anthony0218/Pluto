import { applyGoMove, createInitialGoState, getGoGroup, isLegalGoMove, toggleDeadGoGroup, type GoMove, type GoState } from "./rules.ts";

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
  if (state.deadStones?.length) {
    let final = frames.at(-1)!;
    const seen = new Set<number>();
    for (const index of state.deadStones) {
      if (!Number.isInteger(index) || index < 0 || index >= final.board.length || !final.board[index]) throw new Error("Invalid dead stone marker");
      if (seen.has(index)) continue;
      const group = getGoGroup(final.board, final.boardSize, index);
      if (![...group.stones].every(point => state.deadStones!.includes(point))) throw new Error("Incomplete dead group marker");
      group.stones.forEach(point => seen.add(point));
      final = toggleDeadGoGroup(final, index);
    }
    frames[frames.length - 1] = final;
  }
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
export type GoMoveQuality = "AI Move" | "Good" | "Inaccuracy" | "Mistake" | "Blunder";
/** Go review uses KataGo score loss; there is no universal rank-independent cutoff. */
export function goMoveQuality(loss: number, matchesTopMove = false): GoMoveQuality {
  return matchesTopMove ? "AI Move" : loss < 2 ? "Good" : loss < 5 ? "Inaccuracy" : loss < 10 ? "Mistake" : "Blunder";
}
export async function analyzeGo(state: GoState, signal?: AbortSignal): Promise<GoAnalysis> {
  const { analyzeInBrowser } = await import("./browserEngine");
  return analyzeInBrowser(state, signal);
}
