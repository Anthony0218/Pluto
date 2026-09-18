import { Chess, type Square } from "chess.js";

export const HOT_POTATO_MIN_FUSE_MOVES = 4;
export const HOT_POTATO_MAX_FUSE_MOVES = 12;
export const HOT_POTATO_RESPAWN_WAIT_MOVES = 5;

export type HotPotatoOutcome = "white" | "black" | "draw" | null;

export type HotPotatoState = {
  square: Square | null;
  movesUntilExplosion: number;
  fuseMovesTotal: number;
  respawnMovesRemaining: number;
};

export type HotPotatoMove = {
  from: Square;
  to: Square;
  color: "w" | "b";
  flags: string;
};

export type DestroyedPiece = {
  square: Square;
  type: "p" | "n" | "b" | "r" | "q";
  color: "w" | "b";
};

export type ExplosionResolution = {
  explosionSquares: Square[];
  destroyedPieces: DestroyedPiece[];
  blownUpKingSquares: Square[];
  outcome: HotPotatoOutcome;
};

export function getRandomHotPotatoSquare(
  game: Chess,
  random: () => number = Math.random,
): Square | null {
  const candidates: Square[] = [];

  for (const row of game.board()) {
    for (const piece of row) {
      if (piece && piece.type !== "k") {
        candidates.push(piece.square);
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates[Math.floor(random() * candidates.length)] ?? null;
}

export function getRandomHotPotatoFuseMoves(
  random: () => number = Math.random,
): number {
  const range = HOT_POTATO_MAX_FUSE_MOVES - HOT_POTATO_MIN_FUSE_MOVES + 1;

  return HOT_POTATO_MIN_FUSE_MOVES + Math.floor(random() * range);
}

export function createInitialHotPotatoState(
  game: Chess,
  random: () => number = Math.random,
): HotPotatoState {
  const fuseMoves = getRandomHotPotatoFuseMoves(random);

  return {
    square: getRandomHotPotatoSquare(game, random),
    movesUntilExplosion: fuseMoves,
    fuseMovesTotal: fuseMoves,
    respawnMovesRemaining: 0,
  };
}

function squareToCoordinates(square: Square) {
  return {
    file: square.charCodeAt(0) - "a".charCodeAt(0),
    rank: Number(square[1]) - 1,
  };
}

function coordinatesToSquare(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    return null;
  }

  const fileLetter = String.fromCharCode("a".charCodeAt(0) + file);

  return `${fileLetter}${rank + 1}` as Square;
}

export function getExplosionSquares(center: Square): Square[] {
  const { file, rank } = squareToCoordinates(center);
  const squares: Square[] = [];

  for (let fileOffset = -1; fileOffset <= 1; fileOffset += 1) {
    for (let rankOffset = -1; rankOffset <= 1; rankOffset += 1) {
      const square = coordinatesToSquare(file + fileOffset, rank + rankOffset);

      if (square) {
        squares.push(square);
      }
    }
  }

  return squares;
}

export function findKingSquare(game: Chess, color: "w" | "b"): Square | null {
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece?.type === "k" && piece.color === color) {
        return piece.square;
      }
    }
  }

  return null;
}

/**
 * Returns the potato's square after a legal chess move.
 *
 * Normal carrier move:
 *   e4 -> e5  => potato follows to e5
 *
 * Carrier captured:
 *   piece x carrier => capturing piece inherits the potato
 *
 * En passant:
 *   if the captured pawn carried the potato, the capturing pawn inherits it
 *
 * Castling:
 *   kings cannot carry the potato, but a rook can; if that rook castles,
 *   the potato follows the rook.
 */
export function getHotPotatoSquareAfterMove(
  previousSquare: Square,
  move: HotPotatoMove,
): Square {
  // The carrier itself moved (including a normal capture/promotion).
  if (previousSquare === move.from) {
    return move.to;
  }

  // The carrier was captured on the destination square.
  if (previousSquare === move.to) {
    return move.to;
  }

  // En passant capture: the captured pawn is behind the destination square.
  if (move.flags.includes("e")) {
    const capturedPawnSquare = `${move.to[0]}${move.from[1]}` as Square;

    if (previousSquare === capturedPawnSquare) {
      return move.to;
    }
  }

  // A rook carrying the potato can move as part of castling.
  if (move.flags.includes("k")) {
    const rookFrom = (move.color === "w" ? "h1" : "h8") as Square;
    const rookTo = (move.color === "w" ? "f1" : "f8") as Square;

    if (previousSquare === rookFrom) {
      return rookTo;
    }
  }

  if (move.flags.includes("q")) {
    const rookFrom = (move.color === "w" ? "a1" : "a8") as Square;
    const rookTo = (move.color === "w" ? "d1" : "d8") as Square;

    if (previousSquare === rookFrom) {
      return rookTo;
    }
  }

  return previousSquare;
}

/**
 * Resolves a Hot Potato explosion in-place on the supplied Chess instance.
 *
 * The blast is the carrier square plus all 8 surrounding squares.
 * Kings are NOT removed from chess.js because a king-less FEN is unsafe for
 * history/undo. Instead, blownUpKingSquares tells the Board which king symbols
 * must disappear visually after the terminal blast.
 */
export function resolveHotPotatoExplosion(
  game: Chess,
  hotPotatoSquare: Square,
): ExplosionResolution {
  const explosionSquares = getExplosionSquares(hotPotatoSquare);

  const whiteKingSquare = findKingSquare(game, "w");
  const blackKingSquare = findKingSquare(game, "b");

  const whiteKingHit =
    whiteKingSquare !== null && explosionSquares.includes(whiteKingSquare);

  const blackKingHit =
    blackKingSquare !== null && explosionSquares.includes(blackKingSquare);

  const blownUpKingSquares: Square[] = [
    ...(whiteKingHit && whiteKingSquare ? [whiteKingSquare] : []),
    ...(blackKingHit && blackKingSquare ? [blackKingSquare] : []),
  ];

  // Remove every non-king piece in the 3x3 blast area.
  const destroyedPieces: DestroyedPiece[] = [];

  for (const square of explosionSquares) {
    const piece = game.get(square);

    if (piece && piece.type !== "k") {
      destroyedPieces.push({
        square,
        type: piece.type,
        color: piece.color,
      });

      game.remove(square);
    }
  }

  if (whiteKingHit && blackKingHit) {
    return {
      explosionSquares,
      destroyedPieces,
      blownUpKingSquares,
      outcome: "draw",
    };
  }

  if (whiteKingHit) {
    return {
      explosionSquares,
      destroyedPieces,
      blownUpKingSquares,
      outcome: "black",
    };
  }

  if (blackKingHit) {
    return {
      explosionSquares,
      destroyedPieces,
      blownUpKingSquares,
      outcome: "white",
    };
  }

  return {
    explosionSquares,
    destroyedPieces,
    blownUpKingSquares,
    outcome: null,
  };
}

export function getNormalChessOutcome(game: Chess): HotPotatoOutcome {
  if (game.isCheckmate()) {
    return game.turn() === "w" ? "black" : "white";
  }

  if (
    game.isDraw() ||
    game.isStalemate() ||
    game.isThreefoldRepetition() ||
    game.isInsufficientMaterial()
  ) {
    return "draw";
  }

  return null;
}

export function isChessInCheck(game: Chess): boolean {
  const compatibleGame = game as Chess & {
    isCheck?: () => boolean;
    inCheck?: () => boolean;
  };

  if (typeof compatibleGame.isCheck === "function") {
    return compatibleGame.isCheck();
  }

  if (typeof compatibleGame.inCheck === "function") {
    return compatibleGame.inCheck();
  }

  return false;
}
