/** Chinese-area Go: stones plus surrounded empty points, 6.5 komi.
 * Suicide is forbidden and positional superko is enforced. State is plain JSON.
 */
export type GoColor = "black" | "white";
export type GoPoint = { row: number; col: number };
export type GoMove = ({ type: "place" } & GoPoint) | { type: "pass" } | { type: "resign" };
export type GoHistoryEntry = GoMove & { player: GoColor; captured?: number };
export type GoState = {
  board: (GoColor | null)[]; boardSize: 9 | 13 | 19; currentPlayer: GoColor;
  captures: Record<GoColor, number>; consecutivePasses: number; komi: number;
  status: "playing" | "finished"; winner: GoColor | "draw" | null; result: string | null;
  lastMove: GoPoint | null; positionHashes: string[]; moveHistory: GoHistoryEntry[];
  /** Stones agreed dead after two passes; removed only for area scoring. */
  deadStones?: number[];
};
export const otherGoColor = (color: GoColor): GoColor => color === "black" ? "white" : "black";
export function hashGoBoard(board: GoState["board"]): string {
  return board.map((cell) => cell === "black" ? "b" : cell === "white" ? "w" : ".").join("");
}
export function createInitialGoState(boardSize: GoState["boardSize"] = 9, komi = 6.5): GoState {
  const board = Array<GoColor | null>(boardSize * boardSize).fill(null);
  return { board, boardSize, currentPlayer: "black", captures: { black: 0, white: 0 }, consecutivePasses: 0, komi, status: "playing", winner: null, result: null, lastMove: null, positionHashes: [hashGoBoard(board)], moveHistory: [] };
}
const at = (size: number, row: number, col: number) => row * size + col;
const inside = (size: number, row: number, col: number) => row >= 0 && col >= 0 && row < size && col < size;
function neighbors(size: number, index: number): number[] {
  const row = Math.floor(index / size), col = index % size;
  return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].filter(([r, c]) => inside(size, r, c)).map(([r, c]) => at(size, r, c));
}
export function getGoGroup(board: GoState["board"], size: number, start: number) {
  const color = board[start], stones = new Set<number>(), liberties = new Set<number>();
  if (!color) return { stones, liberties };
  const queue = [start];
  while (queue.length) {
    const index = queue.pop()!;
    if (stones.has(index)) continue;
    stones.add(index);
    for (const next of neighbors(size, index)) {
      if (board[next] === null) liberties.add(next);
      else if (board[next] === color && !stones.has(next)) queue.push(next);
    }
  }
  return { stones, liberties };
}
function simulatePlacement(state: GoState, row: number, col: number) {
  if (!inside(state.boardSize, row, col)) return null;
  const index = at(state.boardSize, row, col);
  if (state.board[index]) return null;
  const board = [...state.board]; board[index] = state.currentPlayer;
  let captured = 0;
  const opponent = otherGoColor(state.currentPlayer);
  for (const next of neighbors(state.boardSize, index)) {
    if (board[next] !== opponent) continue;
    const group = getGoGroup(board, state.boardSize, next);
    if (!group.liberties.size) { captured += group.stones.size; group.stones.forEach((stone) => { board[stone] = null; }); }
  }
  if (!getGoGroup(board, state.boardSize, index).liberties.size) return null;
  const hash = hashGoBoard(board);
  if (state.positionHashes.includes(hash)) return null;
  return { board, captured, hash };
}
export function isLegalGoMove(state: GoState, move: GoMove): boolean {
  return state.status === "playing" && (move.type !== "place" || simulatePlacement(state, move.row, move.col) !== null);
}
export function getLegalGoMoves(state: GoState): GoMove[] {
  if (state.status !== "playing") return [];
  const moves: GoMove[] = [];
  for (let row = 0; row < state.boardSize; row += 1) for (let col = 0; col < state.boardSize; col += 1) if (simulatePlacement(state, row, col)) moves.push({ type: "place", row, col });
  return [...moves, { type: "pass" }, { type: "resign" }];
}
export function scoreGo(state: GoState) {
  let black = 0, white = state.komi;
  const dead = new Set(state.deadStones ?? []);
  const board = state.board.map((stone, index) => dead.has(index) ? null : stone);
  const visited = new Set<number>();
  board.forEach((cell, index) => {
    if (cell === "black") black += 1;
    else if (cell === "white") white += 1;
    else if (!visited.has(index)) {
      const region = new Set<number>(), borders = new Set<GoColor>(), queue = [index];
      while (queue.length) {
        const point = queue.pop()!;
        if (visited.has(point) || board[point]) continue;
        visited.add(point); region.add(point);
        for (const next of neighbors(state.boardSize, point)) { const occupant = board[next]; if (occupant) borders.add(occupant); else if (!visited.has(next)) queue.push(next); }
      }
      if (borders.size === 1) { if (borders.has("black")) black += region.size; else white += region.size; }
    }
  });
  const winner: GoColor | "draw" = black === white ? "draw" : black > white ? "black" : "white";
  return { black, white, winner };
}
/** Toggle a connected group in the post-pass scoring review. */
export function toggleDeadGoGroup(state: GoState, index: number): GoState {
  if (state.status !== "finished" || state.consecutivePasses < 2 || !state.board[index]) return state;
  const group = getGoGroup(state.board, state.boardSize, index);
  const dead = new Set(state.deadStones ?? []);
  const remove = dead.has(index);
  group.stones.forEach(point => { if (remove) dead.delete(point); else dead.add(point); });
  const next = { ...state, deadStones: [...dead].sort((a, b) => a - b) };
  const score = scoreGo(next), margin = Math.abs(score.black - score.white);
  return { ...next, winner: score.winner, result: score.winner === "draw" ? "Draw" : score.winner + " wins by " + margin };
}
export function applyGoMove(state: GoState, move: GoMove): GoState {
  if (!isLegalGoMove(state, move)) throw new Error("Illegal Go move");
  const player = state.currentPlayer;
  if (move.type === "resign") { const winner = otherGoColor(player); return { ...state, status: "finished", winner, result: winner + " wins by resignation", moveHistory: [...state.moveHistory, { ...move, player }] }; }
  if (move.type === "pass") {
    const consecutivePasses = state.consecutivePasses + 1;
    const next: GoState = { ...state, currentPlayer: otherGoColor(player), consecutivePasses, lastMove: null, moveHistory: [...state.moveHistory, { ...move, player }] };
    if (consecutivePasses >= 2) { const score = scoreGo(next), margin = Math.abs(score.black - score.white); return { ...next, status: "finished", winner: score.winner, result: score.winner === "draw" ? "Draw" : score.winner + " wins by " + margin }; }
    return next;
  }
  const simulated = simulatePlacement(state, move.row, move.col)!;
  return { ...state, board: simulated.board, currentPlayer: otherGoColor(player), consecutivePasses: 0, captures: { ...state.captures, [player]: state.captures[player] + simulated.captured }, lastMove: { row: move.row, col: move.col }, positionHashes: [...state.positionHashes, simulated.hash], moveHistory: [...state.moveHistory, { ...move, player, captured: simulated.captured }] };
}
