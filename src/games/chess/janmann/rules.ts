import { DIVIDEND_CAPACITY_M3, EXTRACTION_RATE_M3, PROMOTION_X, SECTOR_COUNT, VOLUMETRIC_VICTORY_M3, VOLUMETRIC_VICTORY_SECTORS, opposite, type DividendId, type PieceKind, type Side } from "./config.ts";
import { NODES, TOPOLOGY } from "./topology.ts";

export type Control = Side | "neutral" | "contested" | "void";
export interface Piece { id: string; kind: PieceKind; side: Side; at: DividendId }
export interface DividendState { remainingVolumeM3: number; minedVolumeM3: number }
export interface Move { from: DividendId; to: DividendId; promotion?: Exclude<PieceKind, "king" | "pawn"> }
export interface GameResult { winner: Side | null; reason: "checkmate" | "Volumetric Dominance" | "stalemate" }
export interface GameState {
  pieces: Piece[];
  dividends: Record<DividendId, DividendState>;
  turn: Side;
  phase: "move" | "extract";
  extractedVolumeM3: Record<Side, number>;
  ply: number;
  lastMove: Move | null;
  result: GameResult | null;
  history: string[];
}

/** Explicit deployment on two opposite caps, mirrored through the origin. */
export const WHITE_START: { kind: PieceKind; at: DividendId }[] = [
  { kind: "king", at: "0:0" }, { kind: "queen", at: "3:0" },
  { kind: "rook", at: "1:0" }, { kind: "rook", at: "2:0" },
  { kind: "bishop", at: "0:2" }, { kind: "bishop", at: "3:2" },
  { kind: "knight", at: "1:2" }, { kind: "knight", at: "2:2" },
  ...[0, 1, 2, 3].flatMap((sector) => [1, 4].map((index) => ({ kind: "pawn" as const, at: `${sector}:${index}` as DividendId }))),
];

export function createGame(): GameState {
  return {
    pieces: (["white", "black"] as const).flatMap((side) => WHITE_START.map((piece, index) => ({
      id: `${side}-${index}`, kind: piece.kind, side,
      at: side === "white" ? piece.at : `${NODES[piece.at].sectorId ^ 7}:${NODES[piece.at].dividendIndex}` as DividendId,
    }))),
    dividends: Object.fromEntries(TOPOLOGY.map(({ id }) => [id, { remainingVolumeM3: DIVIDEND_CAPACITY_M3, minedVolumeM3: 0 }])) as GameState["dividends"],
    turn: "white", phase: "move", extractedVolumeM3: { white: 0, black: 0 }, ply: 0, lastMove: null, result: null, history: [],
  };
}

export function attackTargets(state: GameState, piece: Piece): DividendId[] {
  const node = NODES[piece.at];
  if (piece.kind === "pawn") return node.pawn[piece.side].captures.filter((id) => state.dividends[id].remainingVolumeM3 > 0);
  if (piece.kind === "king" || piece.kind === "knight") return (piece.kind === "king" ? node.neighbors : node.knightJumps).filter((id) => state.dividends[id].remainingVolumeM3 > 0);
  const rays = piece.kind === "rook" ? node.rookContinuations : piece.kind === "bishop" ? node.bishopContinuations : [...node.rookContinuations, ...node.bishopContinuations];
  const occupied = new Set(state.pieces.map((p) => p.at));
  const attacked = new Set<DividendId>();
  for (const ray of rays) for (const id of ray) {
    if (state.dividends[id].remainingVolumeM3 > 0) attacked.add(id);
    if (occupied.has(id)) break;
  }
  return [...attacked];
}

export function attackedBy(state: GameState, side: Side): Set<DividendId> {
  return new Set(state.pieces.filter((piece) => piece.side === side).flatMap((piece) => attackTargets(state, piece)));
}

export function isInCheck(state: GameState, side: Side): boolean {
  const king = state.pieces.find((piece) => piece.side === side && piece.kind === "king");
  return !king || attackedBy(state, opposite(side)).has(king.at);
}

export function getControl(state: GameState): Record<DividendId, Control> {
  const white = attackedBy(state, "white"), black = attackedBy(state, "black");
  for (const piece of state.pieces) (piece.side === "white" ? white : black).add(piece.at);
  return Object.fromEntries(TOPOLOGY.map(({ id }) => [id, state.dividends[id].remainingVolumeM3 <= 0 ? "void" : white.has(id) && black.has(id) ? "contested" : white.has(id) ? "white" : black.has(id) ? "black" : "neutral"])) as Record<DividendId, Control>;
}

export function getSecuredSectors(control: Record<DividendId, Control>): (Side | null)[] {
  return Array.from({ length: SECTOR_COUNT }, (_, sectorId) => {
    const cells = TOPOLOGY.filter((node) => node.sectorId === sectorId);
    const white = cells.filter((node) => control[node.id] === "white").length;
    const black = cells.filter((node) => control[node.id] === "black").length;
    return white > black ? "white" : black > white ? "black" : null;
  });
}

export function hasVolumetricDominance(volume: number, securedSectors: number) {
  return volume >= VOLUMETRIC_VICTORY_M3 && securedSectors >= VOLUMETRIC_VICTORY_SECTORS;
}

function movedState(state: GameState, move: Move): GameState {
  return { ...state, pieces: state.pieces.filter((piece) => piece.at !== move.to).map((piece) => {
    if (piece.at !== move.from) return piece;
    const promotion = piece.kind === "pawn" && (piece.side === "white" ? -1 : 1) * NODES[move.to].logical[0] >= PROMOTION_X;
    return { ...piece, at: move.to, kind: promotion ? move.promotion ?? "queen" : piece.kind };
  }) };
}

export function getLegalMoves(state: GameState, side: Side = state.turn): Move[] {
  const moves: Move[] = [];
  for (const piece of state.pieces.filter((p) => p.side === side)) {
    const candidates = piece.kind === "pawn"
      ? [NODES[piece.at].pawn[side].forward].filter((id): id is DividendId => !!id && !state.pieces.some((p) => p.at === id)).concat(attackTargets(state, piece).filter((id) => state.pieces.some((p) => p.at === id && p.side !== side)))
      : attackTargets(state, piece);
    for (const to of candidates) {
      if (state.dividends[to].remainingVolumeM3 <= 0 || state.pieces.some((p) => p.at === to && (p.side === side || p.kind === "king"))) continue;
      const move: Move = { from: piece.at, to };
      // Pseudo-attacks (including pinned pieces) determine king safety.
      if (!isInCheck(movedState(state, move), side)) moves.push(move);
    }
  }
  return moves;
}

function endResult(state: GameState, mover: Side): GameResult | null {
  const defender = opposite(mover);
  const replies = getLegalMoves(state, defender);
  if (!replies.length && isInCheck(state, defender)) return { winner: mover, reason: "checkmate" };
  const sectors = getSecuredSectors(getControl(state));
  if (hasVolumetricDominance(state.extractedVolumeM3[mover], sectors.filter((side) => side === mover).length)) return { winner: mover, reason: "Volumetric Dominance" };
  if (!replies.length) return { winner: null, reason: "stalemate" };
  return null;
}

export function applyMove(state: GameState, move: Move): GameState {
  if (state.result || state.phase !== "move" || !getLegalMoves(state).some((legal) => legal.from === move.from && legal.to === move.to)) throw new Error("Illegal move");
  if (move.promotion && !["queen", "rook", "bishop", "knight"].includes(move.promotion)) throw new Error("Illegal promotion");
  const piece = state.pieces.find((p) => p.at === move.from)!;
  const next = { ...movedState(state, move), phase: "extract" as const, lastMove: move, history: [...state.history, `${state.ply + 1}. ${state.turn} ${piece.kind} ${move.from} → ${move.to}`] };
  // Checkmate is immediate; it cannot be postponed to mine or preserve.
  if (isInCheck(next, opposite(state.turn)) && !getLegalMoves(next, opposite(state.turn)).length) return { ...next, result: { winner: state.turn, reason: "checkmate" } };
  return next;
}

function extractedState(state: GameState, id: DividendId): GameState {
  const dividend = state.dividends[id];
  const amount = Math.min(EXTRACTION_RATE_M3, dividend.remainingVolumeM3);
  const remainingVolumeM3 = dividend.remainingVolumeM3 - amount;
  return {
    ...state,
    pieces: remainingVolumeM3 <= 0 ? state.pieces.filter((piece) => piece.at !== id) : state.pieces,
    dividends: { ...state.dividends, [id]: { remainingVolumeM3, minedVolumeM3: dividend.minedVolumeM3 + amount } },
    extractedVolumeM3: { ...state.extractedVolumeM3, [state.turn]: state.extractedVolumeM3[state.turn] + amount },
  };
}

export function eligibleExtractions(state: GameState): DividendId[] {
  if (state.phase !== "extract" || state.result) return [];
  const control = getControl(state);
  return state.pieces.filter((piece) => piece.side === state.turn && control[piece.at] === state.turn
    && state.dividends[piece.at].remainingVolumeM3 > 0
    && !(piece.kind === "king" && state.dividends[piece.at].remainingVolumeM3 <= EXTRACTION_RATE_M3)
    && !isInCheck(extractedState(state, piece.at), state.turn)).map((piece) => piece.at);
}

export function finishTurn(state: GameState, extractFrom?: DividendId): GameState {
  if (state.result || state.phase !== "extract") throw new Error("Move before extracting or preserving");
  if (extractFrom && !eligibleExtractions(state).includes(extractFrom)) throw new Error("This Dividend cannot be extracted");
  const next = extractFrom ? extractedState(state, extractFrom) : state;
  return {
    ...next, result: endResult(next, state.turn), turn: opposite(state.turn), phase: "move", ply: state.ply + 1,
    history: [...next.history, extractFrom ? `Extract ${EXTRACTION_RATE_M3} m³ at ${extractFrom}${next.dividends[extractFrom].remainingVolumeM3 <= 0 ? " · Void · piece sacrificed" : ""}` : "Preserve"],
  };
}
