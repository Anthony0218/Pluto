import { Chess, type Square } from "chess.js";

export const MUTATION_INTERVAL_PLIES = 10;

export type MutationPieceType = "p" | "n" | "b" | "r" | "q";
export type MutationColor = "w" | "b";

export type MutationEvent = {
  mutationNumber: number;
  ply: number;
  moveNumber: number;
  square: Square;
  color: MutationColor;
  fromType: MutationPieceType;
  toType: MutationPieceType;
  valueBefore: number;
  valueAfter: number;
  valueDelta: number;
  fenBefore: string;
  fenAfter: string;
};

export type MutationMoveRecord = {
  ply: number;
  moveNumber: number;
  color: MutationColor;
  san: string;
  from: Square;
  to: Square;
  piece: "p" | "n" | "b" | "r" | "q" | "k";
  captured?: "p" | "n" | "b" | "r" | "q";
  promotion?: "q" | "r" | "b" | "n";
  fenAfter: string;
  mutation: MutationEvent | null;
};

const pieceValues: Record<MutationPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
};

const mutationTargets: MutationPieceType[] = [
  "p",
  "n",
  "b",
  "r",
  "q",
];

const files = "abcdefgh";

const allSquares: Square[] = Array.from({ length: 8 }, (_, rankIndex) => {
  const rank = String(8 - rankIndex);

  return Array.from({ length: 8 }, (_, fileIndex) => {
    return `${files[fileIndex]}${rank}` as Square;
  });
}).flat();

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededIndex(seedText: string, length: number): number {
  if (length <= 1) return 0;

  let value = hashString(seedText);

  value += 0x6d2b79f5;

  let result = value;

  result = Math.imul(result ^ (result >>> 15), result | 1);
  result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

  const random =
    ((result ^ (result >>> 14)) >>> 0) / 4294967296;

  return Math.floor(random * length);
}

export function createMutationSeed(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const values = new Uint32Array(1);

    crypto.getRandomValues(values);

    return values[0] >>> 0;
  }

  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

export function shouldMutateAfterPly(ply: number): boolean {
  return ply > 0 && ply % MUTATION_INTERVAL_PLIES === 0;
}

export function getPliesUntilNextMutation(plyCount: number): number {
  const remainder = plyCount % MUTATION_INTERVAL_PLIES;

  return remainder === 0
    ? MUTATION_INTERVAL_PLIES
    : MUTATION_INTERVAL_PLIES - remainder;
}

function boardCharFor(
  color: MutationColor,
  type: MutationPieceType,
): string {
  return color === "w" ? type.toUpperCase() : type;
}

function expandFenRank(rank: string): string[] {
  const result: string[] = [];

  for (const char of rank) {
    if (/\d/.test(char)) {
      for (let index = 0; index < Number(char); index += 1) {
        result.push("");
      }
    } else {
      result.push(char);
    }
  }

  return result;
}

function compressFenRank(rank: string[]): string {
  let result = "";
  let emptyCount = 0;

  for (const char of rank) {
    if (!char) {
      emptyCount += 1;
      continue;
    }

    if (emptyCount > 0) {
      result += String(emptyCount);
      emptyCount = 0;
    }

    result += char;
  }

  if (emptyCount > 0) {
    result += String(emptyCount);
  }

  return result;
}

function replacePieceInFen(
  fen: string,
  square: Square,
  color: MutationColor,
  targetType: MutationPieceType,
): string {
  const parts = fen.split(" ");
  const ranks = parts[0].split("/").map(expandFenRank);

  const fileIndex = files.indexOf(square[0]);
  const rank = Number(square[1]);
  const rankIndex = 8 - rank;

  ranks[rankIndex][fileIndex] = boardCharFor(color, targetType);

  parts[0] = ranks.map(compressFenRank).join("/");

  return parts.join(" ");
}

function fenWithTurn(
  fen: string,
  color: MutationColor,
): string {
  const parts = fen.split(" ");

  parts[1] = color;

  /*
   * En-passant belongs to the original side-to-move context.
   * It is irrelevant when we temporarily flip the turn merely
   * to ask chess.js whether the other king would be attacked.
   */
  parts[3] = "-";

  return parts.join(" ");
}

function colorIsInCheck(
  fen: string,
  color: MutationColor,
): boolean {
  try {
    return new Chess(fenWithTurn(fen, color)).isCheck();
  } catch {
    return true;
  }
}

function isProtectedCastlingRook(
  fen: string,
  square: Square,
  color: MutationColor,
  type: string,
): boolean {
  if (type !== "r") return false;

  const castling = fen.split(" ")[2] ?? "-";

  if (color === "w") {
    if (square === "h1" && castling.includes("K")) return true;
    if (square === "a1" && castling.includes("Q")) return true;
  } else {
    if (square === "h8" && castling.includes("k")) return true;
    if (square === "a8" && castling.includes("q")) return true;
  }

  return false;
}

type MutationCandidate = {
  square: Square;
  color: MutationColor;
  fromType: MutationPieceType;
  toType: MutationPieceType;
  fenAfter: string;
};

function buildMutationCandidates(game: Chess): MutationCandidate[] {
  const fenBefore = game.fen();

  /*
   * After a normal move, game.turn() is the side that will move next.
   * A random mutation must not suddenly leave the player who just moved
   * with their king attacked while it is the opponent's turn.
   */
  const previousMover: MutationColor =
    game.turn() === "w" ? "b" : "w";

  const candidates: MutationCandidate[] = [];

  for (const square of allSquares) {
    const piece = game.get(square);

    if (!piece || piece.type === "k") {
      continue;
    }

    const fromType = piece.type as MutationPieceType;
    const color = piece.color as MutationColor;

    /*
     * Avoid stale castling-right edge cases:
     * a rook that still carries an active castling right
     * is left untouched until that right disappears naturally.
     */
    if (
      isProtectedCastlingRook(
        fenBefore,
        square,
        color,
        fromType,
      )
    ) {
      continue;
    }

    for (const toType of mutationTargets) {
      if (toType === fromType) {
        continue;
      }

      /*
       * Don't create an immobile pawn directly on its promotion rank.
       */
      if (
        toType === "p" &&
        (square[1] === "1" || square[1] === "8")
      ) {
        continue;
      }

      const fenAfter = replacePieceInFen(
        fenBefore,
        square,
        color,
        toType,
      );

      try {
        new Chess(fenAfter);
      } catch {
        continue;
      }

      if (colorIsInCheck(fenAfter, previousMover)) {
        continue;
      }

      candidates.push({
        square,
        color,
        fromType,
        toType,
        fenAfter,
      });
    }
  }

  return candidates;
}

export function applyScheduledMutation(
  game: Chess,
  seed: number,
  mutationNumber: number,
  ply: number,
): MutationEvent | null {
  if (!shouldMutateAfterPly(ply)) {
    return null;
  }

  const fenBefore = game.fen();
  const candidates = buildMutationCandidates(game);

  if (candidates.length === 0) {
    return null;
  }

  const index = seededIndex(
    `${seed}:${mutationNumber}:${fenBefore}`,
    candidates.length,
  );

  const selected = candidates[index];

  game.load(selected.fenAfter);

  return {
    mutationNumber,
    ply,
    moveNumber: Math.ceil(ply / 2),
    square: selected.square,
    color: selected.color,
    fromType: selected.fromType,
    toType: selected.toType,
    valueBefore: pieceValues[selected.fromType],
    valueAfter: pieceValues[selected.toType],
    valueDelta:
      pieceValues[selected.toType] -
      pieceValues[selected.fromType],
    fenBefore,
    fenAfter: selected.fenAfter,
  };
}

export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function isThreefoldFromRecords(
  records: MutationMoveRecord[],
  currentFen: string,
): boolean {
  const initialFen = new Chess().fen();

  const keys = [
    positionKey(initialFen),
    ...records.map((record) => positionKey(record.fenAfter)),
  ];

  const currentKey = positionKey(currentFen);

  return keys.filter((key) => key === currentKey).length >= 3;
}
