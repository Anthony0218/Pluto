import { Chess, type PieceSymbol, type Square } from "chess.js";

export type MirrorSide = "w" | "b";

export type MirrorPieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type MirrorPlacement = {
  sourceSide: MirrorSide;
  sourceSquare: Square;
  mirroredSquare: Square;
  piece: MirrorPieceType;
  drawIndex: number;
};

export type MirrorSetupState = {
  seed: number;
  bag: MirrorPieceType[];
  drawIndex: number;
  turn: MirrorSide;
  placements: MirrorPlacement[];
  complete: boolean;
};

export type MirrorSetupAction =
  | {
      type: "PLACE_DRAWN_PIECE";
      side: MirrorSide;
      square: Square;
    }
  | {
      type: "RESTART_SETUP";
      seed: number;
    };

export type MirrorActionResult = {
  state: MirrorSetupState;
  error: string | null;
};

export type MirrorMoveRecord = {
  ply: number;
  moveNumber: number;
  color: MirrorSide;
  san: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: "p" | "n" | "b" | "r" | "q";
  promotion?: "q" | "r" | "b" | "n";
  fenAfter: string;
};

const files = "abcdefgh";

const STANDARD_BAG: MirrorPieceType[] = [
  "p",
  "p",
  "p",
  "p",
  "p",
  "p",
  "p",
  "p",
  "n",
  "n",
  "b",
  "b",
  "r",
  "r",
  "q",
  "k",
];

export function createMirrorSeed(): number {
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

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
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

function shuffledBag(seed: number): MirrorPieceType[] {
  const bag = [...STANDARD_BAG];

  for (let index = bag.length - 1; index > 0; index -= 1) {
    const random = seededRandom(seed, `mirror-bag:${index}`);

    const swapIndex = Math.floor(random * (index + 1));

    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }

  return bag;
}

export function createInitialMirrorSetupState(
  seed = createMirrorSeed(),
): MirrorSetupState {
  return {
    seed,
    bag: shuffledBag(seed),
    drawIndex: 0,
    turn: "w",
    placements: [],
    complete: false,
  };
}

export function getCurrentMirrorPiece(
  state: MirrorSetupState,
): MirrorPieceType | null {
  if (state.complete || state.drawIndex >= state.bag.length) {
    return null;
  }

  return state.bag[state.drawIndex] ?? null;
}

export function getMirrorSetupSquares(side: MirrorSide): Square[] {
  const ranks = side === "w" ? [1, 2] : [7, 8];

  const result: Square[] = [];

  for (const rank of ranks) {
    for (const file of files) {
      result.push(`${file}${rank}` as Square);
    }
  }

  return result;
}

export function getMirrorKingSquares(side: MirrorSide): Square[] {
  const rank = side === "w" ? 1 : 8;

  return files.split("").map((file) => `${file}${rank}` as Square);
}

function kingStillPendingAfterCurrentDraw(state: MirrorSetupState): boolean {
  return state.bag.slice(state.drawIndex + 1).includes("k");
}

export function mirrorSquare(square: Square): Square {
  const file = square[0];

  const rank = Number(square[1]);

  return `${file}${9 - rank}` as Square;
}

function pairKey(square: Square): string {
  const mirrored = mirrorSquare(square);

  return [square, mirrored].sort().join("|");
}

function occupiedPairKeys(state: MirrorSetupState): Set<string> {
  return new Set(
    state.placements.map((placement) => pairKey(placement.sourceSquare)),
  );
}

export function getAvailableMirrorSquares(
  state: MirrorSetupState,
  side: MirrorSide,
): Square[] {
  const occupied = occupiedPairKeys(state);

  const currentPiece = getCurrentMirrorPiece(state);

  const baseAvailable = getMirrorSetupSquares(side).filter(
    (square) => !occupied.has(pairKey(square)),
  );

  /*
   * Mirror Chess v3:
   * - Pawns may use either starting rank.
   * - Knights/Bishops/Rooks/Queen may use either starting rank.
   * - The King must stay on White rank 1 / Black rank 8.
   */
  if (currentPiece === "k") {
    const kingSquares = new Set(getMirrorKingSquares(side));

    return baseAvailable.filter((square) => kingSquares.has(square));
  }

  /*
   * If the King has not been drawn yet, reserve at least one
   * back-rank mirrored pair so setup can always finish.
   */
  const kingPending = kingStillPendingAfterCurrentDraw(state);

  if (!kingPending) {
    return baseAvailable;
  }

  return baseAvailable.filter((square) => {
    const isBackRank = side === "w" ? square[1] === "1" : square[1] === "8";

    if (!isBackRank) {
      return true;
    }

    const nextOccupied = new Set(occupied);

    nextOccupied.add(pairKey(square));

    const kingSlotsLeft = getMirrorKingSquares(side).filter(
      (candidate) => !nextOccupied.has(pairKey(candidate)),
    ).length;

    return kingSlotsLeft >= 1;
  });
}

export function isMirrorSquareAvailable(
  state: MirrorSetupState,
  side: MirrorSide,
  square: Square,
): boolean {
  return getAvailableMirrorSquares(state, side).includes(square);
}

export function applyMirrorSetupAction(
  state: MirrorSetupState,
  action: MirrorSetupAction,
): MirrorActionResult {
  if (action.type === "RESTART_SETUP") {
    return {
      state: createInitialMirrorSetupState(action.seed),
      error: null,
    };
  }

  if (state.complete) {
    return {
      state,
      error: "The mirrored army is already complete.",
    };
  }

  if (action.side !== state.turn) {
    return {
      state,
      error: "It is not this player's placement turn.",
    };
  }

  if (!isMirrorSquareAvailable(state, action.side, action.square)) {
    return {
      state,
      error:
        getCurrentMirrorPiece(state) === "k"
          ? "The King must be placed on White rank 1 or Black rank 8."
          : "This mirrored square pair is unavailable, occupied, or needed to reserve a back-rank square for the King.",
    };
  }

  const piece = getCurrentMirrorPiece(state);

  if (!piece) {
    return {
      state,
      error: "There is no piece left to draw.",
    };
  }

  const placement: MirrorPlacement = {
    sourceSide: action.side,

    sourceSquare: action.square,

    mirroredSquare: mirrorSquare(action.square),

    piece,

    drawIndex: state.drawIndex,
  };

  const nextDrawIndex = state.drawIndex + 1;

  const complete = nextDrawIndex >= state.bag.length;

  return {
    state: {
      ...state,

      placements: [...state.placements, placement],

      drawIndex: nextDrawIndex,

      turn: action.side === "w" ? "b" : "w",

      complete,
    },

    error: null,
  };
}

function pieceFenChar(side: MirrorSide, piece: MirrorPieceType): string {
  return side === "w" ? piece.toUpperCase() : piece.toLowerCase();
}

function placementForSide(
  placement: MirrorPlacement,
  side: MirrorSide,
): {
  square: Square;
  piece: MirrorPieceType;
} {
  if (placement.sourceSide === side) {
    return {
      square: placement.sourceSquare,
      piece: placement.piece,
    };
  }

  return {
    square: placement.mirroredSquare,
    piece: placement.piece,
  };
}

export function getMirrorPlacementsForSide(
  state: MirrorSetupState,
  side: MirrorSide,
): Array<{
  square: Square;
  piece: MirrorPieceType;
}> {
  return state.placements.map((placement) => placementForSide(placement, side));
}

export function mirrorSetupToBoard(state: MirrorSetupState) {
  const board: Array<
    Array<{
      type: MirrorPieceType;
      color: MirrorSide;
    } | null>
  > = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

  for (const side of ["w", "b"] as MirrorSide[]) {
    for (const placement of getMirrorPlacementsForSide(state, side)) {
      const fileIndex = files.indexOf(placement.square[0]);

      const rankIndex = 8 - Number(placement.square[1]);

      board[rankIndex][fileIndex] = {
        type: placement.piece,
        color: side,
      };
    }
  }

  return board;
}

function fenRank(cells: string[]): string {
  let result = "";
  let empty = 0;

  for (const cell of cells) {
    if (!cell) {
      empty += 1;
      continue;
    }

    if (empty > 0) {
      result += String(empty);
      empty = 0;
    }

    result += cell;
  }

  if (empty > 0) {
    result += String(empty);
  }

  return result;
}

function castlingRights(state: MirrorSetupState): string {
  let rights = "";

  const white = new Map(
    getMirrorPlacementsForSide(state, "w").map((placement) => [
      placement.square,
      placement.piece,
    ]),
  );

  const black = new Map(
    getMirrorPlacementsForSide(state, "b").map((placement) => [
      placement.square,
      placement.piece,
    ]),
  );

  if (white.get("e1") === "k") {
    if (white.get("h1") === "r") {
      rights += "K";
    }

    if (white.get("a1") === "r") {
      rights += "Q";
    }
  }

  if (black.get("e8") === "k") {
    if (black.get("h8") === "r") {
      rights += "k";
    }

    if (black.get("a8") === "r") {
      rights += "q";
    }
  }

  return rights || "-";
}

export function buildMirrorStartFen(state: MirrorSetupState): string {
  if (!state.complete) {
    throw new Error("The mirrored setup is not complete yet.");
  }

  const board = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ""),
  );

  for (const side of ["w", "b"] as MirrorSide[]) {
    for (const placement of getMirrorPlacementsForSide(state, side)) {
      const fileIndex = files.indexOf(placement.square[0]);

      const rankIndex = 8 - Number(placement.square[1]);

      board[rankIndex][fileIndex] = pieceFenChar(side, placement.piece);
    }
  }

  const boardFen = board.map(fenRank).join("/");

  return [boardFen, "w", castlingRights(state), "-", "0", "1"].join(" ");
}

export function isMirrorStartPositionValid(state: MirrorSetupState): {
  ok: boolean;
  error: string | null;
} {
  if (!state.complete) {
    return {
      ok: false,
      error: "All 16 piece pairs must be placed first.",
    };
  }

  try {
    const fen = buildMirrorStartFen(state);

    new Chess(fen, { skipValidation: true });

    return {
      ok: true,
      error: null,
    };
  } catch {
    return {
      ok: false,
      error: "This mirrored formation does not create a valid chess position.",
    };
  }
}

export function createMirrorGame(state: MirrorSetupState): Chess {
  return new Chess(buildMirrorStartFen(state), { skipValidation: true });
}

export function isThreefoldMirror(
  records: MirrorMoveRecord[],
  initialFen: string,
  currentFen: string,
): boolean {
  const positionKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

  const current = positionKey(currentFen);

  const keys = [
    positionKey(initialFen),

    ...records.map((record) => positionKey(record.fenAfter)),
  ];

  return keys.filter((key) => key === current).length >= 3;
}
