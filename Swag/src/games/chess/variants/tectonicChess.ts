import {
  Chess,
  type Color,
  type PieceSymbol,
  type Square,
} from "chess.js";

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

export const TECTONIC_QUADRANTS: TectonicQuadrant[] = [
  "A",
  "B",
  "C",
  "D",
];

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
  };
}

export function cloneTectonicState(
  state: TectonicState,
): TectonicState {
  return {
    ...state,
    lastShiftSquares: [...state.lastShiftSquares],
  };
}

export function quadrantLabel(
  quadrant: TectonicQuadrant,
): string {
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

export function getQuadrantSquares(
  quadrant: TectonicQuadrant,
): Square[] {
  const { row: startRow, column: startColumn } =
    quadrantStarts[quadrant];

  const squares: Square[] = [];

  for (let row = startRow; row < startRow + 4; row += 1) {
    for (
      let column = startColumn;
      column < startColumn + 4;
      column += 1
    ) {
      squares.push(
        `${FILES[column]}${8 - row}` as Square,
      );
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

  const nextCount = state.normalPliesSinceShift + 1;

  return {
    ...cloneTectonicState(state),
    normalPliesSinceShift: Math.min(
      TECTONIC_PLIES_PER_SHIFT,
      nextCount,
    ),
    pendingShift:
      nextCount >= TECTONIC_PLIES_PER_SHIFT,
    lastShiftQuadrant: null,
    lastShiftSquares: [],
    skippedLastShift: false,
  };
}

function pieceToFen(piece: ChessPiece): string {
  return piece.color === "w"
    ? piece.type.toUpperCase()
    : piece.type;
}

function boardToFen(
  board: (ChessPiece | null)[][],
): string {
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

  const { row: startRow, column: startColumn } =
    quadrantStarts[quadrant];

  for (let localRow = 0; localRow < 4; localRow += 1) {
    for (
      let localColumn = 0;
      localColumn < 4;
      localColumn += 1
    ) {
      const piece =
        source[startRow + localRow][
          startColumn + localColumn
        ];

      const targetLocalRow = localColumn;
      const targetLocalColumn = 3 - localRow;

      board[startRow + targetLocalRow][
        startColumn + targetLocalColumn
      ] = piece;
    }
  }

  return board;
}

function removeCastlingRight(
  castling: string,
  right: string,
): string {
  if (castling === "-") {
    return "-";
  }

  const next = castling.replace(right, "");

  return next || "-";
}

function castlingAfterRotation(
  castling: string,
  quadrant: TectonicQuadrant,
): string {
  let next = castling;

  /*
   * A tectonic rotation physically relocates pieces. If a King or
   * eligible Rook is inside that rotating quadrant, its original
   * castling right is permanently lost.
   */
  if (quadrant === "A") {
    next = removeCastlingRight(next, "q");
  }

  if (quadrant === "B") {
    next = removeCastlingRight(next, "k");
    next = removeCastlingRight(next, "q");
  }

  if (quadrant === "C") {
    next = removeCastlingRight(next, "Q");
  }

  if (quadrant === "D") {
    next = removeCastlingRight(next, "K");
    next = removeCastlingRight(next, "Q");
  }

  return next;
}

function buildRotatedFen(
  game: Chess,
  quadrant: TectonicQuadrant,
  keepCurrentTurn: boolean,
): string {
  const fields = game.fen().split(" ");

  const currentTurn = game.turn();
  const rotatedBoard = rotateBoardClockwise(
    game,
    quadrant,
  );

  const castling = castlingAfterRotation(
    fields[2] ?? "-",
    quadrant,
  );

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

function consumeSkipFen(game: Chess): string {
  const fields = game.fen().split(" ");
  const currentTurn = game.turn();

  fields[1] =
    currentTurn === "w" ? "b" : "w";

  fields[3] = "-";

  fields[4] = String(
    Number(fields[4] ?? "0") + 1,
  );

  if (currentTurn === "b") {
    fields[5] = String(
      Number(fields[5] ?? "1") + 1,
    );
  }

  return fields.join(" ");
}

export function getTectonicPreviewGame(
  game: Chess,
  quadrant: TectonicQuadrant,
): Chess | null {
  try {
    return new Chess(
      buildRotatedFen(game, quadrant, true),
      { skipValidation: true },
    );
  } catch {
    return null;
  }
}

export function getTectonicPostShiftPreviewGame(
  game: Chess,
  state: TectonicState,
  quadrant: TectonicQuadrant,
): Chess | null {
  if (
    !isLegalTectonicRotation(
      game,
      state,
      quadrant,
    )
  ) {
    return null;
  }

  try {
    return new Chess(
      buildRotatedFen(game, quadrant, false),
      { skipValidation: true },
    );
  } catch {
    return null;
  }
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

  const preview = getTectonicPreviewGame(
    game,
    quadrant,
  );

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
    isLegalTectonicRotation(
      game,
      state,
      quadrant,
    ),
  );
}

export function canSkipTectonicShift(
  game: Chess,
  state: TectonicState,
): boolean {
  return (
    state.pendingShift &&
    !game.isCheck()
  );
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

  return (
    getLegalTectonicQuadrants(
      game,
      state,
    ).length === 0
  );
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

    const nextGame = new Chess(
      consumeSkipFen(game),
      { skipValidation: true },
    );

    return {
      game: nextGame,
      quadrant: null,
      state: {
        ...cloneTectonicState(state),
        normalPliesSinceShift: 0,
        pendingShift: false,
        shiftCount: state.shiftCount + 1,
        /*
         * A skipped shift consumes the one-shift lock.
         */
        lockedQuadrant: null,
        lastShiftQuadrant: null,
        lastShiftSquares: [],
        skippedLastShift: true,
      },
    };
  }

  if (
    !isLegalTectonicRotation(
      game,
      state,
      quadrant,
    )
  ) {
    return null;
  }

  const nextGame = new Chess(
    buildRotatedFen(game, quadrant, false),
    { skipValidation: true },
  );

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
      lastShiftSquares:
        getQuadrantSquares(quadrant),
      skippedLastShift: false,
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
    `lock:${state.lockedQuadrant ?? "-"}`,
  ].join("|");
}

export function isThreefoldTectonic(
  keys: string[],
): boolean {
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

      if (
        piece?.type === "k" &&
        piece.color === color
      ) {
        return `${FILES[column]}${8 - row}` as Square;
      }
    }
  }

  return null;
}
