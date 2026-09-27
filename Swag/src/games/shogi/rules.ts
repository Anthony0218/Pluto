/** Standard 9x9 Japanese Shogi. Black (sente) moves toward row 0. */
export type ShogiColor = "black" | "white";
export type ShogiPieceType = "K" | "R" | "B" | "G" | "S" | "N" | "L" | "P";
export type ShogiPiece = { color: ShogiColor; type: ShogiPieceType; promoted: boolean };
export type ShogiMove =
  | { type: "move"; from: number; to: number; promote: boolean }
  | { type: "drop"; piece: Exclude<ShogiPieceType, "K">; to: number }
  | { type: "resign" };
export type ShogiState = {
  board: (ShogiPiece | null)[];
  currentPlayer: ShogiColor;
  hands: Record<ShogiColor, Partial<Record<Exclude<ShogiPieceType, "K">, number>>>;
  status: "playing" | "finished";
  winner: ShogiColor | null;
  result: string | null;
  lastMove: ShogiMove | null;
  moveHistory: { player: ShogiColor; move: ShogiMove }[];
  check: boolean;
};
const HAND_TYPES: Exclude<ShogiPieceType, "K">[] = ["R", "B", "G", "S", "N", "L", "P"];
export const otherShogiColor = (color: ShogiColor): ShogiColor => color === "black" ? "white" : "black";
const rowOf = (index: number) => Math.floor(index / 9);
const colOf = (index: number) => index % 9;
const inside = (row: number, col: number) => row >= 0 && col >= 0 && row < 9 && col < 9;
const indexOf = (row: number, col: number) => row * 9 + col;
const clonePiece = (piece: ShogiPiece): ShogiPiece => ({ ...piece });

export function createInitialShogiState(): ShogiState {
  const board = Array<ShogiPiece | null>(81).fill(null);
  const back: ShogiPieceType[] = ["L", "N", "S", "G", "K", "G", "S", "N", "L"];
  back.forEach((type, col) => {
    board[col] = { color: "white", type, promoted: false };
    board[72 + col] = { color: "black", type, promoted: false };
    board[18 + col] = { color: "white", type: "P", promoted: false };
    board[54 + col] = { color: "black", type: "P", promoted: false };
  });
  board[10] = { color: "white", type: "R", promoted: false };
  board[16] = { color: "white", type: "B", promoted: false };
  board[64] = { color: "black", type: "B", promoted: false };
  board[70] = { color: "black", type: "R", promoted: false };
  return { board, currentPlayer: "black", hands: { black: {}, white: {} }, status: "playing", winner: null, result: null, lastMove: null, moveHistory: [], check: false };
}
const inZone = (color: ShogiColor, row: number) => color === "black" ? row <= 2 : row >= 6;
export function mustPromote(piece: ShogiPiece, destinationRow: number): boolean {
  if (piece.promoted) return false;
  const last = piece.color === "black" ? 0 : 8;
  const secondLast = piece.color === "black" ? 1 : 7;
  return (["P", "L"].includes(piece.type) && destinationRow === last) || (piece.type === "N" && (destinationRow === last || destinationRow === secondLast));
}
export function canPromote(piece: ShogiPiece, from: number, to: number): boolean {
  return !piece.promoted && !["K", "G"].includes(piece.type) && (inZone(piece.color, rowOf(from)) || inZone(piece.color, rowOf(to)));
}
const GOLD_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]];
const SILVER_STEPS = [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]];
function oriented(piece: ShogiPiece, pairs: number[][]) {
  const direction = piece.color === "black" ? 1 : -1;
  return pairs.map(([dr, dc]) => [dr * direction, dc]);
}
function targetsForPiece(board: ShogiState["board"], from: number): number[] {
  const piece = board[from];
  if (!piece) return [];
  const row = rowOf(from), col = colOf(from), targets: number[] = [];
  const addStep = (dr: number, dc: number) => {
    const r = row + dr, c = col + dc;
    if (!inside(r, c)) return;
    const target = board[indexOf(r, c)];
    if (!target || (target.color !== piece.color && target.type !== "K")) targets.push(indexOf(r, c));
  };
  const addRay = (dr: number, dc: number) => {
    let r = row + dr, c = col + dc;
    while (inside(r, c)) {
      const target = board[indexOf(r, c)];
      if (!target) targets.push(indexOf(r, c));
      else { if (target.color !== piece.color && target.type !== "K") targets.push(indexOf(r, c)); break; }
      r += dr; c += dc;
    }
  };
  if (piece.type === "K") [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([a,b]) => addStep(a,b));
  else if (piece.promoted && ["P", "L", "N", "S"].includes(piece.type)) oriented(piece, GOLD_STEPS).forEach(([a,b]) => addStep(a,b));
  else if (piece.type === "G") oriented(piece, GOLD_STEPS).forEach(([a,b]) => addStep(a,b));
  else if (piece.type === "S") oriented(piece, SILVER_STEPS).forEach(([a,b]) => addStep(a,b));
  else if (piece.type === "N") oriented(piece, [[-2,-1],[-2,1]]).forEach(([a,b]) => addStep(a,b));
  else if (piece.type === "L") oriented(piece, [[-1,0]]).forEach(([a,b]) => addRay(a,b));
  else if (piece.type === "P") oriented(piece, [[-1,0]]).forEach(([a,b]) => addStep(a,b));
  else if (piece.type === "R") {
    [[-1,0],[1,0],[0,-1],[0,1]].forEach(([a,b]) => addRay(a,b));
    if (piece.promoted) [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,b]) => addStep(a,b));
  } else if (piece.type === "B") {
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([a,b]) => addRay(a,b));
    if (piece.promoted) [[-1,0],[1,0],[0,-1],[0,1]].forEach(([a,b]) => addStep(a,b));
  }
  return targets;
}
function attacksSquare(board: ShogiState["board"], from: number, target: number): boolean {
  const piece = board[from];
  if (!piece) return false;
  const copy = board.map((cell) => cell ? clonePiece(cell) : null);
  const targetPiece = copy[target];
  if (targetPiece?.type === "K") copy[target] = { ...targetPiece, type: "G" };
  return targetsForPiece(copy, from).includes(target);
}
export function isInCheck(state: ShogiState, color: ShogiColor): boolean {
  const king = state.board.findIndex((piece) => piece?.color === color && piece.type === "K");
  if (king < 0) return true;
  return state.board.some((piece, from) => piece?.color === otherShogiColor(color) && attacksSquare(state.board, from, king));
}
function applyRaw(state: ShogiState, move: Exclude<ShogiMove, { type: "resign" }>): ShogiState {
  const player = state.currentPlayer, board = state.board.map((piece) => piece ? clonePiece(piece) : null);
  const hands = { black: { ...state.hands.black }, white: { ...state.hands.white } };
  if (move.type === "drop") {
    board[move.to] = { color: player, type: move.piece, promoted: false };
    hands[player][move.piece] = (hands[player][move.piece] ?? 0) - 1;
  } else {
    const piece = board[move.from]!;
    const captured = board[move.to];
    if (captured && captured.type !== "K") hands[player][captured.type] = (hands[player][captured.type] ?? 0) + 1;
    board[move.from] = null;
    board[move.to] = { ...piece, promoted: piece.promoted || move.promote };
  }
  const currentPlayer = otherShogiColor(player);
  return { ...state, board, hands, currentPlayer, lastMove: move, moveHistory: [...state.moveHistory, { player, move }], check: false };
}
function boardMoves(state: ShogiState): ShogiMove[] {
  const moves: ShogiMove[] = [];
  state.board.forEach((piece, from) => {
    if (piece?.color !== state.currentPlayer) return;
    for (const to of targetsForPiece(state.board, from)) {
      const required = mustPromote(piece, rowOf(to));
      moves.push({ type: "move", from, to, promote: required });
      if (!required && canPromote(piece, from, to)) moves.push({ type: "move", from, to, promote: true });
    }
  });
  return moves;
}
function validDropDestination(state: ShogiState, piece: Exclude<ShogiPieceType, "K">, to: number): boolean {
  if (state.board[to]) return false;
  const row = rowOf(to), col = colOf(to);
  const last = state.currentPlayer === "black" ? 0 : 8;
  const secondLast = state.currentPlayer === "black" ? 1 : 7;
  if ((piece === "P" || piece === "L") && row === last) return false;
  if (piece === "N" && (row === last || row === secondLast)) return false;
  if (piece === "P" && state.board.some((cell, index) => colOf(index) === col && cell?.color === state.currentPlayer && cell.type === "P" && !cell.promoted)) return false;
  return true;
}
function generateLegalMoves(state: ShogiState, enforcePawnDropMate: boolean): ShogiMove[] {
  if (state.status !== "playing") return [];
  const candidates = boardMoves(state);
  for (const piece of HAND_TYPES) {
    if (!(state.hands[state.currentPlayer][piece] ?? 0)) continue;
    for (let to = 0; to < 81; to += 1) if (validDropDestination(state, piece, to)) candidates.push({ type: "drop", piece, to });
  }
  const legal: ShogiMove[] = [];
  for (const move of candidates) {
    const next = applyRaw(state, move as Exclude<ShogiMove, { type: "resign" }>);
    if (isInCheck(next, state.currentPlayer)) continue;
    if (enforcePawnDropMate && move.type === "drop" && move.piece === "P" && isInCheck(next, next.currentPlayer) && generateLegalMoves(next, false).length === 0) continue;
    legal.push(move);
  }
  return legal;
}
export function getLegalShogiMoves(state: ShogiState): ShogiMove[] {
  return generateLegalMoves(state, true);
}
export function isLegalShogiMove(state: ShogiState, move: ShogiMove): boolean {
  if (move.type === "resign") return state.status === "playing";
  return getLegalShogiMoves(state).some((legal) => JSON.stringify(legal) === JSON.stringify(move));
}
export function applyShogiMove(state: ShogiState, move: ShogiMove): ShogiState {
  if (!isLegalShogiMove(state, move)) throw new Error("Illegal Shogi move");
  const player = state.currentPlayer;
  if (move.type === "resign") return { ...state, status: "finished", winner: otherShogiColor(player), result: otherShogiColor(player) + " wins by resignation", lastMove: move, moveHistory: [...state.moveHistory, { player, move }] };
  let next = applyRaw(state, move);
  const check = isInCheck(next, next.currentPlayer);
  if (generateLegalMoves(next, true).length === 0) {
    next = { ...next, status: "finished", winner: player, result: check ? player + " wins by checkmate" : player + " wins (no legal moves)", check };
  } else next = { ...next, check };
  return next;
}
