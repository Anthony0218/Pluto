import { createRectangularBoard, isPlayable, updateCell } from "./board.ts";
import type { BoardDefinition, Coord, GameVariant, PlacedPiece, TeamDefinition } from "./types.ts";

/**
 * Teams sit on one side of the board and move away from it. A team's side is
 * just its forward direction, so any number of teams (up to four sides, or
 * several sharing one) works with the same rule engine.
 */
export const TEAM_SIDES = ["bottom", "top", "left", "right"] as const;
export type TeamSide = (typeof TEAM_SIDES)[number];
export const MAX_TEAMS = 4;

export const SIDE_FORWARD: Record<TeamSide, Coord> = {
  bottom: { x: 0, y: 1 },
  top: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
};

export const TEAM_COLORS = ["#f5efe1", "#1f1d1b", "#dc2626", "#2563eb", "#16a34a", "#9333ea", "#eab308", "#0d9488"];

const COLOR_NAMES: Record<string, string> = {
  "#f5efe1": "White",
  "#1f1d1b": "Black",
  "#dc2626": "Red",
  "#2563eb": "Blue",
  "#16a34a": "Green",
  "#9333ea": "Purple",
  "#eab308": "Gold",
  "#0d9488": "Teal",
};

export function sideOf(team: TeamDefinition): TeamSide {
  const { x, y } = team.forward;
  if (y > 0) return "bottom";
  if (y < 0) return "top";
  return x > 0 ? "left" : "right";
}

/** Perceived brightness 0..1, used to pick light or dark 3D models and outlines. */
export function luminance(hex: string) {
  const value = Number.parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** A new team on the first free side, with the first unused colour. */
export function createTeam(existing: TeamDefinition[]): TeamDefinition {
  const usedSides = new Set(existing.map(sideOf));
  const side = TEAM_SIDES.find((entry) => !usedSides.has(entry)) ?? "bottom";
  const color = TEAM_COLORS.find((entry) => !existing.some((team) => team.color.toLowerCase() === entry)) ?? TEAM_COLORS[existing.length % TEAM_COLORS.length];
  let index = existing.length + 1;
  while (existing.some((team) => team.id === `team-${index}`)) index += 1;
  return { id: `team-${index}`, name: COLOR_NAMES[color] ?? `Team ${index}`, color, forward: SIDE_FORWARD[side], modelSet: luminance(color) > 0.5 ? "light" : "dark" };
}

export const BACK_RANK = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

/** The cells along a side, in order, plus the next line inward (for pawns). */
function lines(side: TeamSide, width: number, height: number): { back: Coord[]; front: Coord[] } {
  switch (side) {
    case "bottom":
      return { back: Array.from({ length: width }, (_, x) => ({ x, y: 0 })), front: Array.from({ length: width }, (_, x) => ({ x, y: 1 })) };
    case "top":
      return { back: Array.from({ length: width }, (_, x) => ({ x, y: height - 1 })), front: Array.from({ length: width }, (_, x) => ({ x, y: height - 2 })) };
    case "left":
      return { back: Array.from({ length: height }, (_, y) => ({ x: 0, y })), front: Array.from({ length: height }, (_, y) => ({ x: 1, y })) };
    case "right":
      return { back: Array.from({ length: height }, (_, y) => ({ x: width - 1, y })), front: Array.from({ length: height }, (_, y) => ({ x: width - 2, y })) };
  }
}

/**
 * Place a standard army (back rank + pawns) for every team on its own side.
 * Uses the variant's own pieces: missing standard types are skipped, and
 * disabled cells are left empty, so it works on any board shape.
 */
export function arrangeArmies(variant: GameVariant): PlacedPiece[] {
  const types = new Set(variant.pieces.map((piece) => piece.id));
  const royal = variant.pieces.find((piece) => piece.royal)?.id;
  const rank = BACK_RANK.filter((type) => types.has(type));
  if (royal && !rank.includes(royal)) rank.splice(Math.floor(rank.length / 2), 0, royal);
  const pawn = types.has("pawn") ? "pawn" : null;
  const pieces: PlacedPiece[] = [];
  const taken = new Set<string>();
  const put = (piece: PlacedPiece) => {
    const key = `${piece.x},${piece.y}`;
    if (taken.has(key) || !isPlayable(variant.board, piece)) return;
    taken.add(key);
    pieces.push(piece);
  };
  for (const team of variant.teams) {
    const { back, front } = lines(sideOf(team), variant.board.width, variant.board.height);
    // Centre the army on the playable part of its edge.
    const playable = back.map((coord, index) => (isPlayable(variant.board, coord) ? index : -1)).filter((index) => index >= 0);
    if (!playable.length) continue;
    const span = playable[playable.length - 1] - playable[0] + 1;
    const army = rank.slice(0, span);
    const start = playable[0] + Math.floor((span - army.length) / 2);
    army.forEach((type, offset) => put({ type, team: team.id, ...back[start + offset] }));
    if (pawn) for (let offset = 0; offset < army.length; offset++) put({ type: pawn, team: team.id, ...front[start + offset] });
  }
  return pieces;
}

/** A square board with its corners removed — room for an army on every side. */
export function createCrossBoard(size = 14, corner = 3): BoardDefinition {
  let board = createRectangularBoard(size, size);
  for (const cell of board.cells) {
    if ((cell.x < corner || cell.x >= size - corner) && (cell.y < corner || cell.y >= size - corner)) board = updateCell(board, cell, { enabled: false });
  }
  return board;
}
