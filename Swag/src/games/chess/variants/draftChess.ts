import { Chess, type PieceSymbol, type Square } from "chess.js";

export type DraftSide = "w" | "b";

export type DraftPieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type DraftPlacement = {
  square: Square;
  piece: DraftPieceType;
};

export type DraftSetupState = {
  placements: Record<DraftSide, DraftPlacement[]>;

  confirmed: Record<DraftSide, boolean>;
};

export type DraftSetupAction =
  | {
      type: "PLACE_PIECE";
      side: DraftSide;
      square: Square;
      piece: DraftPieceType;
    }
  | {
      type: "REMOVE_PIECE";
      side: DraftSide;
      square: Square;
    }
  | {
      type: "CONFIRM_ARMY";
      side: DraftSide;
    }
  | {
      type: "RESET_ARMY";
      side: DraftSide;
    };

export type DraftActionResult = {
  state: DraftSetupState;
  error: string | null;
};

export type DraftMoveRecord = {
  ply: number;
  moveNumber: number;
  color: DraftSide;
  san: string;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  captured?: "p" | "n" | "b" | "r" | "q";
  promotion?: "q" | "r" | "b" | "n";
  fenAfter: string;
};

export const DRAFT_BUDGET = 39;

export const DRAFT_PIECE_COSTS: Record<DraftPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const files = "abcdefgh";

export function createInitialDraftSetupState(): DraftSetupState {
  return {
    placements: {
      w: [],
      b: [],
    },

    confirmed: {
      w: false,
      b: false,
    },
  };
}

export function getDraftSetupSquares(side: DraftSide): Square[] {
  const ranks = side === "w" ? [1, 2] : [7, 8];

  const result: Square[] = [];

  for (const rank of ranks) {
    for (const file of files) {
      result.push(`${file}${rank}` as Square);
    }
  }

  return result;
}

export function getDraftKingSquares(side: DraftSide): Square[] {
  const rank = side === "w" ? 1 : 8;

  return files.split("").map((file) => `${file}${rank}` as Square);
}

export function getDraftPieceCost(piece: DraftPieceType): number {
  return DRAFT_PIECE_COSTS[piece];
}

export type RandomDraftResult = {
  state: DraftSetupState;
  fen: string;
};

const randomNonKingPieces: DraftPieceType[] = ["p", "n", "b", "r", "q"];

function randomIndex(length: number): number {
  if (length <= 1) {
    return 0;
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const values = new Uint32Array(1);

    crypto.getRandomValues(values);

    return values[0] % length;
  }

  return Math.floor(Math.random() * length);
}

function shuffle<T>(values: T[]): T[] {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);

    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function canFinishDraftCost(
  remaining: number,
  slotsLeft: number,
  pawnCount: number,
  memo: Map<string, boolean>,
): boolean {
  if (remaining === 0) {
    return true;
  }

  if (slotsLeft === 0 || remaining < 0) {
    return false;
  }

  const key = `${remaining}:${slotsLeft}:${pawnCount}`;

  const cached = memo.get(key);

  if (cached !== undefined) {
    return cached;
  }

  for (const piece of randomNonKingPieces) {
    if (piece === "p" && pawnCount >= 8) {
      continue;
    }

    const cost = DRAFT_PIECE_COSTS[piece];

    if (cost > remaining) {
      continue;
    }

    if (
      canFinishDraftCost(
        remaining - cost,
        slotsLeft - 1,
        pawnCount + (piece === "p" ? 1 : 0),
        memo,
      )
    ) {
      memo.set(key, true);
      return true;
    }
  }

  memo.set(key, false);
  return false;
}

function createRandomDraftComposition(): DraftPieceType[] {
  const result: DraftPieceType[] = [];

  let remaining = DRAFT_BUDGET;

  let pawnCount = 0;

  for (let slot = 0; slot < 15 && remaining > 0; slot += 1) {
    const slotsAfter = 14 - slot;

    const candidates = shuffle(randomNonKingPieces).filter((piece) => {
      if (piece === "p" && pawnCount >= 8) {
        return false;
      }

      const cost = DRAFT_PIECE_COSTS[piece];

      if (cost > remaining) {
        return false;
      }

      return canFinishDraftCost(
        remaining - cost,
        slotsAfter,
        pawnCount + (piece === "p" ? 1 : 0),
        new Map(),
      );
    });

    if (candidates.length === 0) {
      break;
    }

    const piece = candidates[randomIndex(candidates.length)];

    result.push(piece);

    remaining -= DRAFT_PIECE_COSTS[piece];

    if (piece === "p") {
      pawnCount += 1;
    }
  }

  if (remaining !== 0) {
    return [
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
    ];
  }

  return result;
}

function randomDraftPlacements(side: DraftSide): DraftPlacement[] {
  const composition = createRandomDraftComposition();

  const kingSquare = shuffle(getDraftKingSquares(side))[0];

  const pawnRank = side === "w" ? "2" : "7";

  const pawnSquares = shuffle(
    getDraftSetupSquares(side).filter((square) => square[1] === pawnRank),
  );

  const placements: DraftPlacement[] = [
    {
      square: kingSquare,
      piece: "k",
    },
  ];

  const pawns = composition.filter((piece) => piece === "p");

  for (let index = 0; index < pawns.length; index += 1) {
    placements.push({
      square: pawnSquares[index],
      piece: "p",
    });
  }

  const occupied = new Set(placements.map((placement) => placement.square));

  const remainingSquares = shuffle(
    getDraftSetupSquares(side).filter((square) => !occupied.has(square)),
  );

  const otherPieces = composition.filter((piece) => piece !== "p");

  for (let index = 0; index < otherPieces.length; index += 1) {
    placements.push({
      square: remainingSquares[index],
      piece: otherPieces[index],
    });
  }

  return placements;
}

export function randomizeDraftArmy(
  state: DraftSetupState,
  side: DraftSide,
): DraftSetupState {
  if (state.confirmed[side]) {
    return state;
  }

  const next = cloneDraftState(state);

  next.placements[side] = randomDraftPlacements(side);

  return next;
}

function normalizedArmySignature(
  placements: DraftPlacement[],
  side: DraftSide,
): string {
  return placements
    .map((placement) => {
      const file = placement.square[0];

      const rank = Number(placement.square[1]);

      const normalizedRank = side === "w" ? rank : 9 - rank;

      return `${file}${normalizedRank}:${placement.piece}`;
    })
    .sort()
    .join("|");
}

function standardFallbackPlacements(
  side: DraftSide,
  alternate = false,
): DraftPlacement[] {
  const backRank = side === "w" ? "1" : "8";

  const pawnRank = side === "w" ? "2" : "7";

  const pattern: DraftPieceType[] = alternate
    ? ["n", "r", "b", "q", "k", "b", "r", "n"]
    : ["r", "n", "b", "q", "k", "b", "n", "r"];

  const placements: DraftPlacement[] = [];

  for (let index = 0; index < 8; index += 1) {
    placements.push({
      square: `${files[index]}${backRank}` as Square,
      piece: pattern[index],
    });

    placements.push({
      square: `${files[index]}${pawnRank}` as Square,
      piece: "p",
    });
  }

  return placements;
}

type DraftBoardPiece = {
  color: DraftSide;
  piece: DraftPieceType;
};

function draftSquareFileIndex(square: Square): number {
  return files.indexOf(square[0]);
}

function draftSquareRank(square: Square): number {
  return Number(square[1]);
}

function draftSquareAt(fileIndex: number, rank: number): Square | null {
  if (fileIndex < 0 || fileIndex >= 8 || rank < 1 || rank > 8) {
    return null;
  }

  return `${files[fileIndex]}${rank}` as Square;
}

function buildDraftBoardMap(
  state: DraftSetupState,
): Map<Square, DraftBoardPiece> {
  const board = new Map<Square, DraftBoardPiece>();

  for (const side of ["w", "b"] as DraftSide[]) {
    for (const placement of state.placements[side]) {
      board.set(placement.square, {
        color: side,
        piece: placement.piece,
      });
    }
  }

  return board;
}

function draftPieceAttacksSquare(
  board: Map<Square, DraftBoardPiece>,
  from: Square,
  attacker: DraftBoardPiece,
  target: Square,
): boolean {
  const fromFile = draftSquareFileIndex(from);

  const fromRank = draftSquareRank(from);

  const targetFile = draftSquareFileIndex(target);

  const targetRank = draftSquareRank(target);

  const df = targetFile - fromFile;

  const dr = targetRank - fromRank;

  if (attacker.piece === "p") {
    const direction = attacker.color === "w" ? 1 : -1;

    return dr === direction && Math.abs(df) === 1;
  }

  if (attacker.piece === "n") {
    const absFile = Math.abs(df);

    const absRank = Math.abs(dr);

    return (absFile === 1 && absRank === 2) || (absFile === 2 && absRank === 1);
  }

  if (attacker.piece === "k") {
    return Math.max(Math.abs(df), Math.abs(dr)) === 1;
  }

  const diagonal = Math.abs(df) === Math.abs(dr) && df !== 0;

  const straight = (df === 0 && dr !== 0) || (dr === 0 && df !== 0);

  const canSlide =
    (attacker.piece === "b" && diagonal) ||
    (attacker.piece === "r" && straight) ||
    (attacker.piece === "q" && (diagonal || straight));

  if (!canSlide) {
    return false;
  }

  const stepFile = df === 0 ? 0 : df > 0 ? 1 : -1;

  const stepRank = dr === 0 ? 0 : dr > 0 ? 1 : -1;

  let fileIndex = fromFile + stepFile;

  let rank = fromRank + stepRank;

  while (fileIndex !== targetFile || rank !== targetRank) {
    const square = draftSquareAt(fileIndex, rank);

    if (!square || board.has(square)) {
      return false;
    }

    fileIndex += stepFile;

    rank += stepRank;
  }

  return true;
}

function isDraftKingAttacked(
  state: DraftSetupState,
  kingSide: DraftSide,
): boolean {
  const king = state.placements[kingSide].find(
    (placement) => placement.piece === "k",
  );

  if (!king) {
    return true;
  }

  const board = buildDraftBoardMap(state);

  const enemySide: DraftSide = kingSide === "w" ? "b" : "w";

  for (const enemy of state.placements[enemySide]) {
    if (
      draftPieceAttacksSquare(
        board,
        enemy.square,
        {
          color: enemySide,
          piece: enemy.piece,
        },
        king.square,
      )
    ) {
      return true;
    }
  }

  return false;
}

export function validateDraftStartPosition(state: DraftSetupState): {
  ok: boolean;
  fen: string | null;
  error: string | null;
} {
  if (!state.confirmed.w || !state.confirmed.b) {
    return {
      ok: false,
      fen: null,
      error: "Both armies must be confirmed before the game can start.",
    };
  }

  if (
    countDraftPieceType(state, "w", "k") !== 1 ||
    countDraftPieceType(state, "b", "k") !== 1
  ) {
    return {
      ok: false,
      fen: null,
      error: "Both armies need exactly one King.",
    };
  }

  /*
   * A Draft starting position is deliberately stricter than
   * merely being loadable as FEN:
   *
   * neither King may already be under attack before move 1.
   */
  if (isDraftKingAttacked(state, "w") || isDraftKingAttacked(state, "b")) {
    return {
      ok: false,
      fen: null,
      error: "A King is already in check in the starting position.",
    };
  }

  try {
    const fen = buildDraftStartFen(state);

    /*
     * Keep chess.js validation as a second layer:
     * this catches things such as illegal Pawn placement on rank 1/8.
     */
    /*
     * Draft Chess deliberately allows unusual starting formations.
     * We already validated the variant-specific requirements above,
     * especially that neither King starts in check.
     *
     * Load with skipValidation so standard-chess start-position rules
     * do not reject an otherwise legal Draft setup.
     */
    new Chess(fen, { skipValidation: true });

    return {
      ok: true,
      fen,
      error: null,
    };
  } catch {
    return {
      ok: false,
      fen: null,
      error:
        "The combined armies do not create a legal chess starting position.",
    };
  }
}

export function createIndependentRandomDraftSetup(
  maxAttempts = 250,
): RandomDraftResult {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const state = createInitialDraftSetupState();

    state.placements.w = randomDraftPlacements("w");

    let black = randomDraftPlacements("b");

    const whiteSignature = normalizedArmySignature(state.placements.w, "w");

    let blackSignature = normalizedArmySignature(black, "b");

    let rerolls = 0;

    while (blackSignature === whiteSignature && rerolls < 20) {
      black = randomDraftPlacements("b");

      blackSignature = normalizedArmySignature(black, "b");

      rerolls += 1;
    }

    if (blackSignature === whiteSignature) {
      continue;
    }

    state.placements.b = black;

    state.confirmed.w = true;

    state.confirmed.b = true;

    const validation = validateDraftStartPosition(state);

    if (validation.ok && validation.fen) {
      return {
        state,
        fen: validation.fen,
      };
    }

    // Try another independent random pair.
  }

  const state = createInitialDraftSetupState();

  state.placements.w = standardFallbackPlacements("w", false);

  state.placements.b = standardFallbackPlacements("b", true);

  state.confirmed.w = true;
  state.confirmed.b = true;

  const validation = validateDraftStartPosition(state);

  if (!validation.ok || !validation.fen) {
    throw new Error(
      "Could not create a safe Draft fallback starting position.",
    );
  }

  return {
    state,
    fen: validation.fen,
  };
}

export function getDraftSpentPoints(
  state: DraftSetupState,
  side: DraftSide,
): number {
  return state.placements[side].reduce(
    (total, placement) => total + getDraftPieceCost(placement.piece),
    0,
  );
}

export function getDraftRemainingPoints(
  state: DraftSetupState,
  side: DraftSide,
): number {
  return DRAFT_BUDGET - getDraftSpentPoints(state, side);
}

export function getDraftPlacement(
  state: DraftSetupState,
  side: DraftSide,
  square: Square,
): DraftPlacement | null {
  return (
    state.placements[side].find((placement) => placement.square === square) ??
    null
  );
}

export function hasDraftKing(state: DraftSetupState, side: DraftSide): boolean {
  return state.placements[side].some((placement) => placement.piece === "k");
}

export function countDraftPieces(
  state: DraftSetupState,
  side: DraftSide,
): number {
  return state.placements[side].length;
}

export function countDraftPieceType(
  state: DraftSetupState,
  side: DraftSide,
  piece: DraftPieceType,
): number {
  return state.placements[side].filter((placement) => placement.piece === piece)
    .length;
}

function cloneDraftState(state: DraftSetupState): DraftSetupState {
  return {
    placements: {
      w: state.placements.w.map((placement) => ({
        ...placement,
      })),

      b: state.placements.b.map((placement) => ({
        ...placement,
      })),
    },

    confirmed: {
      ...state.confirmed,
    },
  };
}

function validSetupSquare(side: DraftSide, square: Square): boolean {
  return getDraftSetupSquares(side).includes(square);
}

function validKingSquare(side: DraftSide, square: Square): boolean {
  return getDraftKingSquares(side).includes(square);
}

function replaceOrAddPlacement({
  state,
  side,
  square,
  piece,
}: {
  state: DraftSetupState;
  side: DraftSide;
  square: Square;
  piece: DraftPieceType;
}): DraftActionResult {
  if (state.confirmed[side]) {
    return {
      state,
      error: "This army is already confirmed.",
    };
  }

  if (!validSetupSquare(side, square)) {
    return {
      state,
      error:
        side === "w"
          ? "White may only place pieces on ranks 1 and 2."
          : "Black may only place pieces on ranks 7 and 8.",
    };
  }

  if (piece === "k" && !validKingSquare(side, square)) {
    return {
      state,
      error:
        side === "w"
          ? "The White King must stay on rank 1."
          : "The Black King must stay on rank 8.",
    };
  }

  const next = cloneDraftState(state);

  const current = getDraftPlacement(next, side, square);

  let placements = next.placements[side].filter(
    (placement) => placement.square !== square,
  );

  /*
   * Exactly one King:
   * placing the King somewhere else moves it rather than creating
   * a second King.
   */
  if (piece === "k") {
    placements = placements.filter((placement) => placement.piece !== "k");
  }

  const refunded = current ? getDraftPieceCost(current.piece) : 0;

  const currentlySpent = getDraftSpentPoints(next, side);

  const nextSpent = currentlySpent - refunded + getDraftPieceCost(piece);

  if (nextSpent > DRAFT_BUDGET) {
    return {
      state,
      error: "Not enough draft points.",
    };
  }

  placements.push({
    square,
    piece,
  });

  next.placements[side] = placements;

  return {
    state: next,
    error: null,
  };
}

function removePlacement({
  state,
  side,
  square,
}: {
  state: DraftSetupState;
  side: DraftSide;
  square: Square;
}): DraftActionResult {
  if (state.confirmed[side]) {
    return {
      state,
      error: "This army is already confirmed.",
    };
  }

  const next = cloneDraftState(state);

  next.placements[side] = next.placements[side].filter(
    (placement) => placement.square !== square,
  );

  return {
    state: next,
    error: null,
  };
}

export function canConfirmDraftArmy(
  state: DraftSetupState,
  side: DraftSide,
): {
  ok: boolean;
  error: string | null;
} {
  if (state.confirmed[side]) {
    return {
      ok: false,
      error: "This army is already confirmed.",
    };
  }

  const kings = countDraftPieceType(state, side, "k");

  if (kings !== 1) {
    return {
      ok: false,
      error: "Your army needs exactly one King.",
    };
  }

  const king = state.placements[side].find(
    (placement) => placement.piece === "k",
  );

  if (!king || !validKingSquare(side, king.square)) {
    return {
      ok: false,
      error:
        side === "w"
          ? "The White King must be on rank 1."
          : "The Black King must be on rank 8.",
    };
  }

  if (getDraftSpentPoints(state, side) > DRAFT_BUDGET) {
    return {
      ok: false,
      error: "The army exceeds the 39-point budget.",
    };
  }

  return {
    ok: true,
    error: null,
  };
}

function confirmArmy({
  state,
  side,
}: {
  state: DraftSetupState;
  side: DraftSide;
}): DraftActionResult {
  const validation = canConfirmDraftArmy(state, side);

  if (!validation.ok) {
    return {
      state,
      error: validation.error,
    };
  }

  const next = cloneDraftState(state);

  next.confirmed[side] = true;

  return {
    state: next,
    error: null,
  };
}

function resetArmy({
  state,
  side,
}: {
  state: DraftSetupState;
  side: DraftSide;
}): DraftActionResult {
  if (state.confirmed[side]) {
    return {
      state,
      error: "This army is already confirmed.",
    };
  }

  const next = cloneDraftState(state);

  next.placements[side] = [];

  return {
    state: next,
    error: null,
  };
}

export function applyDraftSetupAction(
  state: DraftSetupState,
  action: DraftSetupAction,
): DraftActionResult {
  switch (action.type) {
    case "PLACE_PIECE":
      return replaceOrAddPlacement({
        state,
        side: action.side,
        square: action.square,
        piece: action.piece,
      });

    case "REMOVE_PIECE":
      return removePlacement({
        state,
        side: action.side,
        square: action.square,
      });

    case "CONFIRM_ARMY":
      return confirmArmy({
        state,
        side: action.side,
      });

    case "RESET_ARMY":
      return resetArmy({
        state,
        side: action.side,
      });
  }
}

function boardChar(side: DraftSide, piece: DraftPieceType): string {
  return side === "w" ? piece.toUpperCase() : piece.toLowerCase();
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

function placementAt(
  state: DraftSetupState,
  side: DraftSide,
  square: Square,
): DraftPlacement | null {
  return (
    state.placements[side].find((placement) => placement.square === square) ??
    null
  );
}

function castlingRights(state: DraftSetupState): string {
  let rights = "";

  const whiteKing = placementAt(state, "w", "e1");

  if (whiteKing?.piece === "k") {
    if (placementAt(state, "w", "h1")?.piece === "r") {
      rights += "K";
    }

    if (placementAt(state, "w", "a1")?.piece === "r") {
      rights += "Q";
    }
  }

  const blackKing = placementAt(state, "b", "e8");

  if (blackKing?.piece === "k") {
    if (placementAt(state, "b", "h8")?.piece === "r") {
      rights += "k";
    }

    if (placementAt(state, "b", "a8")?.piece === "r") {
      rights += "q";
    }
  }

  return rights || "-";
}

export function buildDraftStartFen(state: DraftSetupState): string {
  if (!state.confirmed.w || !state.confirmed.b) {
    throw new Error("Both armies must be confirmed before the game can start.");
  }

  const board = Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => ""),
  );

  for (const side of ["w", "b"] as DraftSide[]) {
    for (const placement of state.placements[side]) {
      const fileIndex = files.indexOf(placement.square[0]);

      const rankIndex = 8 - Number(placement.square[1]);

      board[rankIndex][fileIndex] = boardChar(side, placement.piece);
    }
  }

  const boardFen = board.map(fenRank).join("/");

  return [boardFen, "w", castlingRights(state), "-", "0", "1"].join(" ");
}

export function createDraftGame(state: DraftSetupState): Chess {
  return new Chess(buildDraftStartFen(state));
}

export function draftPlacementsToBoard(
  state: DraftSetupState,
  visibleSide: DraftSide,
) {
  const board: Array<
    Array<{
      type: DraftPieceType;
      color: DraftSide;
    } | null>
  > = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

  for (const placement of state.placements[visibleSide]) {
    const fileIndex = files.indexOf(placement.square[0]);

    const rankIndex = 8 - Number(placement.square[1]);

    board[rankIndex][fileIndex] = {
      type: placement.piece,
      color: visibleSide,
    };
  }

  return board;
}

export function isThreefoldDraft(
  records: DraftMoveRecord[],
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
