import type { Square } from "chess.js";

/**
 * World placement for any board size. Ranks run along -x (rank 0 nearest the
 * +x "White" camera), files along +z — the same orientation the original 8×8
 * 3D board used, so existing camera presets keep working.
 */
export function cellToWorld(x: number, y: number, width = 8, height = 8) {
  return [(height - 1) / 2 - y, 0.45, x - (width - 1) / 2] as const;
}

export function squareToWorld(square: Square) {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;
  return cellToWorld(file, rank);
}

export function coordinatesToSquare(file: number, rank: number): Square {
  const fileName = String.fromCharCode("a".charCodeAt(0) + file);
  return `${fileName}${rank + 1}` as Square;
}

export function squareToCoordinates(square: Square) {
  return { x: square.charCodeAt(0) - "a".charCodeAt(0), y: Number(square[1]) - 1 };
}
