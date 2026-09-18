import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export type FogSide = "w" | "b";
export type FogCapturedPiece = "p" | "n" | "b" | "r" | "q";
export type FogPromotionPiece = "q" | "r" | "b" | "n";

export type FogMoveRecord = {
  ply: number;
  moveNumber: number;
  color: FogSide;
  san: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: FogCapturedPiece;
  promotion?: FogPromotionPiece;
  fenAfter: string;
};

const files = "abcdefgh";

export function createFogSeed(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] >>> 0;
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number, salt: string): number {
  let value = (seed ^ hashString(salt)) >>> 0;
  value += 0x6d2b79f5;
  let result = value;
  result = Math.imul(result ^ (result >>> 15), result | 1);
  result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
  return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
}

function shuffled<T>(values: T[], seed: number, salt: string): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededRandom(seed, `${salt}:${i}`) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Symmetric randomized start that preserves ordinary castling:
 * Rooks remain on a/h, King remains on e, pawns remain standard.
 * Queen/Bishops/Knights are shuffled across b/c/d/f/g.
 */
export function createRandomFogStartFen(seed: number): string {
  const slots = ["b", "c", "d", "f", "g"];
  const pieces = shuffled(["q", "b", "b", "n", "n"], seed, "back-rank");
  const back: Record<string, string> = { a: "r", e: "k", h: "r" };
  slots.forEach((file, index) => { back[file] = pieces[index]; });
  const white = files.split("").map((file) => back[file].toUpperCase()).join("");
  const black = files.split("").map((file) => back[file].toLowerCase()).join("");
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

export function createFogGame(seed: number): Chess {
  return new Chess(createRandomFogStartFen(seed));
}

export function allBoardSquares(): Square[] {
  const result: Square[] = [];
  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      result.push(`${files[file]}${rank}` as Square);
    }
  }
  return result;
}

function squareFromBoard(row: number, column: number): Square {
  return `${files[column]}${8 - row}` as Square;
}

function raySquares(game: Chess, from: Square, deltas: Array<[number, number]>): Square[] {
  const result: Square[] = [];
  const startFile = files.indexOf(from[0]);
  const startRank = Number(from[1]);
  for (const [df, dr] of deltas) {
    let file = startFile + df;
    let rank = startRank + dr;
    while (file >= 0 && file < 8 && rank >= 1 && rank <= 8) {
      const square = `${files[file]}${rank}` as Square;
      result.push(square);
      if (game.get(square)) break;
      file += df;
      rank += dr;
    }
  }
  return result;
}

function attackSquares(game: Chess, square: Square, type: PieceSymbol, color: Color): Square[] {
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]);
  const result: Square[] = [];
  const add = (f: number, r: number) => {
    if (f >= 0 && f < 8 && r >= 1 && r <= 8) result.push(`${files[f]}${r}` as Square);
  };

  if (type === "p") {
    const direction = color === "w" ? 1 : -1;
    add(file - 1, rank + direction);
    add(file + 1, rank + direction);
    return result;
  }
  if (type === "n") {
    for (const [df, dr] of [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]]) add(file + df, rank + dr);
    return result;
  }
  if (type === "k") {
    for (let df = -1; df <= 1; df += 1) for (let dr = -1; dr <= 1; dr += 1) if (df || dr) add(file + df, rank + dr);
    return result;
  }
  if (type === "b" || type === "q") result.push(...raySquares(game, square, [[1,1],[1,-1],[-1,1],[-1,-1]]));
  if (type === "r" || type === "q") result.push(...raySquares(game, square, [[1,0],[-1,0],[0,1],[0,-1]]));
  return result;
}

/** Own pieces + attacked squares + legal destinations are visible. */
export function getFogVisibleSquares(game: Chess, side: FogSide): Square[] {
  const visible = new Set<Square>();
  for (const square of allBoardSquares()) {
    const piece = game.get(square);
    if (!piece || piece.color !== side) continue;
    visible.add(square);
    for (const target of attackSquares(game, square, piece.type, piece.color)) visible.add(target);
    for (const move of game.moves({ square, verbose: true })) visible.add(move.to);
  }
  return [...visible];
}

export function getFogSquares(game: Chess, side: FogSide): Square[] {
  const visible = new Set(getFogVisibleSquares(game, side));
  return allBoardSquares().filter((square) => !visible.has(square));
}

export function getMaskedBoard(game: Chess, side: FogSide) {
  const visible = new Set(getFogVisibleSquares(game, side));
  return game.board().map((rank, row) => rank.map((piece, column) => {
    if (!piece) return null;
    const square = squareFromBoard(row, column);
    return piece.color === side || visible.has(square) ? piece : null;
  }));
}

export function isThreefoldFog(records: FogMoveRecord[], initialFen: string, currentFen: string): boolean {
  const key = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
  const current = key(currentFen);
  const keys = [key(initialFen), ...records.map((record) => key(record.fenAfter))];
  return keys.filter((candidate) => candidate === current).length >= 3;
}
