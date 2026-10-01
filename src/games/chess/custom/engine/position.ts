import { getCell, isPlayable, sameCoord } from "./board.ts";
import type {
  Coord,
  GameRuleType,
  GameState,
  GameVariant,
  PieceDefinition,
  PieceInstance,
  PieceTypeId,
  TeamId,
} from "./types.ts";

/** Everything move generation needs, precomputed once per position. */
export interface Position {
  variant: GameVariant;
  state: GameState;
  defs: Map<PieceTypeId, PieceDefinition>;
  occupancy: (PieceInstance | undefined)[];
}

export function createPosition(variant: GameVariant, state: GameState): Position {
  const defs = new Map(variant.pieces.map((piece) => [piece.id, piece]));
  const occupancy: (PieceInstance | undefined)[] = new Array(state.board.width * state.board.height);
  for (const piece of state.pieces) occupancy[piece.y * state.board.width + piece.x] = piece;
  return { variant, state, defs, occupancy };
}

export function pieceAt(position: Position, coord: Coord): PieceInstance | undefined {
  const { board } = position.state;
  if (coord.x < 0 || coord.y < 0 || coord.x >= board.width || coord.y >= board.height) return undefined;
  return position.occupancy[coord.y * board.width + coord.x];
}

export function findPieceAt(state: GameState, coord: Coord) {
  return state.pieces.find((piece) => sameCoord(piece, coord));
}

export function ruleEnabled(variant: GameVariant, type: GameRuleType) {
  return variant.rules.some((rule) => rule.type === type && rule.enabled);
}

export function getDefinition(variant: GameVariant, type: PieceTypeId) {
  return variant.pieces.find((piece) => piece.id === type);
}

export function isRoyal(variant: GameVariant, piece: PieceInstance) {
  return Boolean(getDefinition(variant, piece.type)?.royal);
}

export function teamPieces(state: GameState, team: TeamId) {
  return state.pieces.filter((piece) => piece.team === team);
}

export function royalCount(variant: GameVariant, state: GameState, team: TeamId) {
  return state.pieces.filter((piece) => piece.team === team && isRoyal(variant, piece)).length;
}

export function activeTeams(variant: GameVariant, state: GameState) {
  return variant.teams.map((team) => team.id).filter((id) => !state.eliminated.includes(id));
}

export function opponentsOf(variant: GameVariant, state: GameState, team: TeamId) {
  return activeTeams(variant, state).filter((id) => id !== team);
}

export function teamName(variant: GameVariant, team: TeamId | undefined) {
  return variant.teams.find((entry) => entry.id === team)?.name ?? team ?? "Unknown";
}

/** Rotate a team-relative offset into board space (+y = team forward). */
export function toBoardOffset(variant: GameVariant, team: TeamId, offset: Coord, relative: boolean): Coord {
  if (!relative) return offset;
  const forward = variant.teams.find((entry) => entry.id === team)?.forward ?? { x: 0, y: 1 };
  const right = { x: forward.y, y: -forward.x };
  return {
    x: offset.x * right.x + offset.y * forward.x,
    y: offset.x * right.y + offset.y * forward.y,
  };
}

/** The last rank in the team's forward direction. */
export function isFarRank(variant: GameVariant, state: GameState, team: TeamId, coord: Coord) {
  const forward = variant.teams.find((entry) => entry.id === team)?.forward ?? { x: 0, y: 1 };
  const { width, height } = state.board;
  if (forward.y > 0) return coord.y === height - 1;
  if (forward.y < 0) return coord.y === 0;
  if (forward.x > 0) return coord.x === width - 1;
  return coord.x === 0;
}

export function nearestEmptyCell(position: Position, origin: Coord): Coord | null {
  const { board } = position.state;
  let best: Coord | null = null;
  let bestDistance = Infinity;
  for (const cell of board.cells) {
    if (!isPlayable(board, cell) || pieceAt(position, cell)) continue;
    const distance = Math.max(Math.abs(cell.x - origin.x), Math.abs(cell.y - origin.y));
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: cell.x, y: cell.y };
    }
  }
  return best;
}

export function tileAt(state: GameState, coord: Coord) {
  return getCell(state.board, coord)?.tile ?? null;
}

/** mulberry32 — returns [value in 0..1, next seed]. */
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}
