import type { Square } from "chess.js";

export function squareToWorld(square: Square) {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = Number(square[1]) - 1;

  /*
   * Desired orientation:
   * old a1 -> new h1
   * old h1 -> new h8
   *
   * 90° counterclockwise rotation in world placement:
   *   x = 3.5 - rank
   *   z = file - 3.5
   */
  return [3.5 - rank, 0.45, file - 3.5] as const;
}

export function coordinatesToSquare(file: number, rank: number): Square {
  const fileName = String.fromCharCode("a".charCodeAt(0) + file);
  return `${fileName}${rank + 1}` as Square;
}
