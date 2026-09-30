import { Chess, type Color, type PieceSymbol, type Square } from "chess.js";

export type TectonicQuadrant = "A" | "B" | "C" | "D";
export type TectonicSide = "w" | "b";

export type TectonicState = {
  normalPliesSinceShift: number;
  pendingShift: boolean;
  shiftCount: number;
  lockedQuadrant: TectonicQuadrant | null;
  lastShiftQuadrant: TectonicQuadrant | null;
  lastShiftSquares: Square[];
  skippedLastShift: boolean;
  consecutiveShiftSkips: number;
};

export type TectonicShiftResult = {
  game: Chess;
  state: TectonicState;
  quadrant: TectonicQuadrant | null;
};

type ChessPiece = {
  type: PieceSymbol;
  color: Color;
};

export const TECTONIC_PLIES_PER_SHIFT = 4;

export const TECTONIC_QUADRANTS: TectonicQuadrant[] = ["A", "B", "C", "D"];

const FILES = "abcdefgh";

const quadrantStarts: Record<
  TectonicQuadrant,
  { row: number; column: number }
> = {
  A: { row: 0, column: 0 },
  B: { row: 0, column: 4 },
  C: { row: 4, column: 0 },
  D: { row: 4, column: 4 },
};

export function createInitialTectonicState(): TectonicState {
  return {
    normalPliesSinceShift: 0,
    pendingShift: false,
    shiftCount: 0,
    lockedQuadrant: null,
    lastShiftQuadrant: null,
    lastShiftSquares: [],
    skippedLastShift: false,
    consecutiveShiftSkips: 0,
  };
}

export function cloneTectonicState(state: TectonicState): TectonicState {
  return {
    ...state,
    lastShiftSquares: [...state.lastShiftSquares],
  };
}

export function quadrantLabel(quadrant: TectonicQuadrant): string {
  switch (quadrant) {
    case "A":
      return "A · a5–d8";
    case "B":
      return "B · e5–h8";
    case "C":
      return "C · a1–d4";
    case "D":
      return "D · e1–h4";
  }
}

export function getQuadrantSquares(quadrant: TectonicQuadrant): Square[] {
  const { row: startRow, column: startColumn } = quadrantStarts[quadrant];

  const squares: Square[] = [];

  for (let row = startRow; row < startRow + 4; row += 1) {
    for (let column = startColumn; column < startColumn + 4; column += 1) {
      squares.push(`${FILES[column]}${8 - row}` as Square);
    }
  }

  return squares;
}

export function advanceTectonicAfterNormalMove(
  state: TectonicState,
): TectonicState {
  if (state.pendingShift) {
    return cloneTectonicState(state);
  }

  /*
   * First skipped shift:
   * the same player still makes a normal chess move. After that move,
   * the opponent receives the Tectonic Shift opportunity.
   */
  if (state.consecutiveShiftSkips === 1) {
    return {
      ...cloneTectonicState(state),
      normalPliesSinceShift: TECTONIC_PLIES_PER_SHIFT,
      pendingShift: true,
      lastShiftQuadrant: null,
      lastShiftSquares: [],
      skippedLastShift: true,
    };
  }

  /*
   * Second consecutive skipped shift:
   * that player also gets their normal chess move. Once it is completed,
   * the special shift sequence is over and the normal 4-ply counter
   * starts again for the next player.
   */
  if (state.consecutiveShiftSkips >= 2) {
    return {
      ...cloneTectonicState(state),
      normalPliesSinceShift: 0,
      pendingShift: false,
      consecutiveShiftSkips: 0,
      lastShiftQuadrant: null,
      lastShiftSquares: [],
      skippedLastShift: true,
    };
  }

  const nextCount = state.normalPliesSinceShift + 1;

  return {
    ...cloneTectonicState(state),
    normalPliesSinceShift: Math.min(TECTONIC_PLIES_PER_SHIFT, nextCount),
    pendingShift: nextCount >= TECTONIC_PLIES_PER_SHIFT,
    lastShiftQuadrant: null,
    lastShiftSquares: [],
    skippedLastShift: false,
  };
}

function pieceToFen(piece: ChessPiece): string {
  return piece.color === "w" ? piece.type.toUpperCase() : piece.type;
}

function boardToFen(board: (ChessPiece | null)[][]): string {
  return board
    .map((row) => {
      let empty = 0;
      let result = "";

      for (const piece of row) {
        if (!piece) {
          empty += 1;
          continue;
        }

        if (empty > 0) {
          result += String(empty);
          empty = 0;
        }

        result += pieceToFen(piece);
      }

      if (empty > 0) {
        result += String(empty);
      }

      return result;
    })
    .join("/");
}

function cloneBoard(
  board: ({
    type: PieceSymbol;
    color: Color;
  } | null)[][],
): (ChessPiece | null)[][] {
  return board.map((row) =>
    row.map((piece) =>
      piece
        ? {
            type: piece.type,
            color: piece.color,
          }
        : null,
    ),
  );
}

function rotateBoardClockwise(
  game: Chess,
  quadrant: TectonicQuadrant,
): (ChessPiece | null)[][] {
  const board = cloneBoard(game.board());
  const source = cloneBoard(game.board());

  const { row: startRow, column: startColumn } = quadrantStarts[quadrant];

  for (let localRow = 0; localRow < 4; localRow += 1) {
    for (let localColumn = 0; localColumn < 4; localColumn += 1) {
      const piece = source[startRow + localRow][startColumn + localColumn];

      const targetLocalRow = localColumn;
      const targetLocalColumn = 3 - localRow;

      board[startRow + targetLocalRow][startColumn + targetLocalColumn] = piece;
    }
  }

  return board;
}

function pieceAtBoardSquare(
  board: (ChessPiece | null)[][],
  square: Square,
): ChessPiece | null {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const row = 8 - rank;

  if (file < 0 || row < 0 || row > 7) {
    return null;
  }

  return board[row]?.[file] ?? null;
}

function hasPieceAt(
  board: (ChessPiece | null)[][],
  square: Square,
  type: PieceSymbol,
  color: Color,
): boolean {
  const piece = pieceAtBoardSquare(board, square);

  return piece?.type === type && piece.color === color;
}

function castlingAfterRotation(
  castling: string,
  rotatedBoard: (ChessPiece | null)[][],
): string {
  if (castling === "-") {
    return "-";
  }

  /*
   * Never trust a historical castling flag after physically rotating
   * pieces. chess.js assumes a castling right is backed by the King and
   * corresponding Rook on their home squares; stale flags can make its
   * internal move generator enter an invalid state.
   *
   * Preserve a right only when:
   *   1. it already existed before the rotation, and
   *   2. the required King and Rook are still on the correct home squares
   *      after the rotation.
   */
  let next = "";

  if (
    castling.includes("K") &&
    hasPieceAt(rotatedBoard, "e1", "k", "w") &&
    hasPieceAt(rotatedBoard, "h1", "r", "w")
  ) {
    next += "K";
  }

  if (
    castling.includes("Q") &&
    hasPieceAt(rotatedBoard, "e1", "k", "w") &&
    hasPieceAt(rotatedBoard, "a1", "r", "w")
  ) {
    next += "Q";
  }

  if (
    castling.includes("k") &&
    hasPieceAt(rotatedBoard, "e8", "k", "b") &&
    hasPieceAt(rotatedBoard, "h8", "r", "b")
  ) {
    next += "k";
  }

  if (
    castling.includes("q") &&
    hasPieceAt(rotatedBoard, "e8", "k", "b") &&
    hasPieceAt(rotatedBoard, "a8", "r", "b")
  ) {
    next += "q";
  }

  return next || "-";
}

function buildRotatedFen(
  game: Chess,
  quadrant: TectonicQuadrant,
  keepCurrentTurn: boolean,
): string {
  const fields = game.fen().split(" ");

  const currentTurn = game.turn();
  const rotatedBoard = rotateBoardClockwise(game, quadrant);

  const castling = castlingAfterRotation(fields[2] ?? "-", rotatedBoard);

  const nextTurn: TectonicSide = keepCurrentTurn
    ? currentTurn
    : currentTurn === "w"
      ? "b"
      : "w";

  let halfmove = Number(fields[4] ?? "0");
  let fullmove = Number(fields[5] ?? "1");

  if (!keepCurrentTurn) {
    /*
     * A Tectonic Shift replaces this side's normal turn.
     * It therefore advances the quiet-move clock and clears
     * en-passant, just like allowing one complete turn to pass.
     */
    halfmove += 1;

    if (currentTurn === "b") {
      fullmove += 1;
    }
  }

  return [
    boardToFen(rotatedBoard),
    nextTurn,
    castling,
    "-",
    String(halfmove),
    String(fullmove),
  ].join(" ");
}

function createSafeTectonicGame(fen: string): Chess | null {
  try {
    const game = new Chess(fen, { skipValidation: true });

    /*
     * Force chess.js to exercise its move generator immediately.
     * This catches stale/invalid derived state here rather than later in
     * AI or result evaluation.
     */
    game.moves();

    return game;
  } catch {
    return null;
  }
}

export function getTectonicPreviewGame(
  game: Chess,
  quadrant: TectonicQuadrant,
): Chess | null {
  return createSafeTectonicGame(buildRotatedFen(game, quadrant, true));
}

export function getTectonicPostShiftPreviewGame(
  game: Chess,
  state: TectonicState,
  quadrant: TectonicQuadrant,
): Chess | null {
  if (!isLegalTectonicRotation(game, state, quadrant)) {
    return null;
  }

  return createSafeTectonicGame(buildRotatedFen(game, quadrant, false));
}

export function isLegalTectonicRotation(
  game: Chess,
  state: TectonicState,
  quadrant: TectonicQuadrant,
): boolean {
  if (!state.pendingShift) {
    return false;
  }

  if (state.lockedQuadrant === quadrant) {
    return false;
  }

  const preview = getTectonicPreviewGame(game, quadrant);

  if (!preview) {
    return false;
  }

  /*
   * The preview keeps the shifter as side-to-move, therefore
   * isCheck() tells us whether that player's own King would be
   * attacked after the rotation.
   */
  return !preview.isCheck();
}

export function getLegalTectonicQuadrants(
  game: Chess,
  state: TectonicState,
): TectonicQuadrant[] {
  return TECTONIC_QUADRANTS.filter((quadrant) =>
    isLegalTectonicRotation(game, state, quadrant),
  );
}

export function canSkipTectonicShift(
  game: Chess,
  state: TectonicState,
): boolean {
  return state.pendingShift && !game.isCheck();
}

export function isTectonicLockedOut(
  game: Chess,
  state: TectonicState,
): boolean {
  if (!state.pendingShift) {
    return false;
  }

  if (canSkipTectonicShift(game, state)) {
    return false;
  }

  return getLegalTectonicQuadrants(game, state).length === 0;
}

export function applyTectonicShift(
  game: Chess,
  state: TectonicState,
  quadrant: TectonicQuadrant | null,
): TectonicShiftResult | null {
  if (!state.pendingShift) {
    return null;
  }

  const shifter = game.turn();

  if (quadrant === null) {
    if (!canSkipTectonicShift(game, state)) {
      return null;
    }

    /*
     * Skipping the Tectonic Shift no longer consumes the player's
     * normal chess move. Keep the exact same side to move.
     *
     * After the first skip, that player's following normal move hands
     * a shift opportunity to the opponent.
     *
     * After a second consecutive skip, that player's following normal
     * move ends the special sequence and resets the normal counter.
     */
    const nextGame = new Chess(game.fen(), { skipValidation: true });

    return {
      game: nextGame,
      quadrant: null,
      state: {
        ...cloneTectonicState(state),
        normalPliesSinceShift: TECTONIC_PLIES_PER_SHIFT,
        pendingShift: false,
        shiftCount: state.shiftCount + 1,
        consecutiveShiftSkips: Math.min(
          2,
          (state.consecutiveShiftSkips ?? 0) + 1,
        ),
        /*
         * A skipped shift consumes the one-shift quadrant lock.
         */
        lockedQuadrant: null,
        lastShiftQuadrant: null,
        lastShiftSquares: [],
        skippedLastShift: true,
      },
    };
  }

  if (!isLegalTectonicRotation(game, state, quadrant)) {
    return null;
  }

  const nextGame = createSafeTectonicGame(
    buildRotatedFen(game, quadrant, false),
  );

  if (!nextGame) {
    return null;
  }

  /*
   * Sanity check: the special turn must really have passed.
   */
  if (nextGame.turn() === shifter) {
    return null;
  }

  return {
    game: nextGame,
    quadrant,
    state: {
      ...cloneTectonicState(state),
      normalPliesSinceShift: 0,
      pendingShift: false,
      shiftCount: state.shiftCount + 1,
      lockedQuadrant: quadrant,
      lastShiftQuadrant: quadrant,
      lastShiftSquares: getQuadrantSquares(quadrant),
      skippedLastShift: false,
      consecutiveShiftSkips: 0,
    },
  };
}

export function tectonicRepetitionKey(
  game: Chess,
  state: TectonicState,
): string {
  const fenFields = game.fen().split(" ");

  return [
    fenFields.slice(0, 4).join(" "),
    `tectonic:${state.normalPliesSinceShift}`,
    `pending:${state.pendingShift ? 1 : 0}`,
    `skips:${state.consecutiveShiftSkips ?? 0}`,
    `lock:${state.lockedQuadrant ?? "-"}`,
  ].join("|");
}

export function isThreefoldTectonic(keys: string[]): boolean {
  const counts = new Map<string, number>();

  for (const key of keys) {
    const count = (counts.get(key) ?? 0) + 1;

    counts.set(key, count);

    if (count >= 3) {
      return true;
    }
  }

  return false;
}

export function findTectonicKingSquare(
  game: Chess,
  color: TectonicSide,
): Square | null {
  const board = game.board();

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = board[row][column];

      if (piece?.type === "k" && piece.color === color) {
        return `${FILES[column]}${8 - row}` as Square;
      }
    }
  }

  return null;
}
