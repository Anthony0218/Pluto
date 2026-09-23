import { Chess, type Square } from "chess.js";

export type HorrorColor = "w" | "b";
export type HorrorPieceType = "p" | "n" | "b" | "r" | "q";

export type HorrorDeathReason = "curse" | "fire" | "curse+fire";

export type HotSquare = {
  square: Square;
  expiresAfterPly: number;
};

export type FrozenPiece = {
  square: Square;
  color: HorrorColor;
  clearAfterPly: number;
};

export type DoomedPiece = {
  square: Square;
  color: HorrorColor;
  reason: HorrorDeathReason;
  removeAfterPly: number;
};

export type HorrorState = {
  infectedSquares: Square[];
  cursedSquares: Square[];
  hotSquares: HotSquare[];
  frozen: FrozenPiece | null;
  doomed: DoomedPiece[];

  infectionSpreadCount: number;
  curseTriggers: number;
  fireTriggers: number;
  freezeTriggers: number;
  deaths: number;
  hotWave: number;
};

export type HorrorMoveInput = {
  color: HorrorColor;
  piece: "p" | "n" | "b" | "r" | "q" | "k";
  from: Square;
  to: Square;
  captured?: HorrorPieceType;
  capturedSquare: Square | null;
  promotion?: "q" | "r" | "b" | "n";
  isCastle: boolean;
  isKingsideCastle: boolean;
  knightDirectCheck: boolean;
};

export type HorrorDeath = {
  square: Square;
  reason: HorrorDeathReason;
  piece: HorrorPieceType;
};

export type HorrorEvent = {
  infectionsAdded: Square[];
  becameCursed: Square | null;
  curseTriggered: boolean;
  fireTriggered: boolean;
  fireCrossed: boolean;
  frozenSquare: Square | null;
  deaths: HorrorDeath[];
  hotSpawned: Square[];
};

export type HorrorMoveRecord = {
  ply: number;
  moveNumber: number;
  color: HorrorColor;
  san: string;
  from: Square;
  to: Square;
  piece: "p" | "n" | "b" | "r" | "q" | "k";
  captured?: HorrorPieceType;
  promotion?: "q" | "r" | "b" | "n";
  fenAfter: string;
  stateAfter: HorrorState;
  event: HorrorEvent;
};

export const HOT_SQUARE_INTERVAL_PLIES = 8;
export const HOT_SQUARE_LIFETIME_PLIES = 4;
export const HOT_SQUARE_COUNT = 2;

const files = "abcdefgh";

const allSquares: Square[] = Array.from({ length: 8 }, (_, rankIndex) => {
  const rank = String(8 - rankIndex);

  return Array.from(
    { length: 8 },
    (_, fileIndex) => `${files[fileIndex]}${rank}` as Square,
  );
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

  const random = ((result ^ (result >>> 14)) >>> 0) / 4294967296;

  return Math.floor(random * length);
}

export function createHorrorSeed(): number {
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

function uniqueSquares(squares: Square[]): Square[] {
  return [...new Set(squares)];
}

function chooseSquare(candidates: Square[], seedText: string): Square | null {
  if (candidates.length === 0) {
    return null;
  }

  return candidates[seededIndex(seedText, candidates.length)] ?? null;
}

function sidePieces(
  game: Chess,
  color: HorrorColor,
  options?: {
    pawnsOnly?: boolean;
    exclude?: Square[];
  },
): Square[] {
  const excluded = new Set(options?.exclude ?? []);

  return allSquares.filter((square) => {
    if (excluded.has(square)) {
      return false;
    }

    const piece = game.get(square);

    if (!piece || piece.color !== color || piece.type === "k") {
      return false;
    }

    if (options?.pawnsOnly && piece.type !== "p") {
      return false;
    }

    return true;
  });
}

export function createInitialHorrorState(
  game: Chess,
  seed: number,
): HorrorState {
  const infectedWhite = chooseSquare(
    sidePieces(game, "w", { pawnsOnly: true }),
    `${seed}:infected:w`,
  );

  const infectedBlack = chooseSquare(
    sidePieces(game, "b", { pawnsOnly: true }),
    `${seed}:infected:b`,
  );

  const infected = [infectedWhite, infectedBlack].filter(
    (square): square is Square => square !== null,
  );

  const cursedWhite = chooseSquare(
    sidePieces(game, "w", { exclude: infected }),
    `${seed}:cursed:w`,
  );

  const cursedBlack = chooseSquare(
    sidePieces(game, "b", { exclude: infected }),
    `${seed}:cursed:b`,
  );

  return {
    infectedSquares: uniqueSquares(infected),

    cursedSquares: uniqueSquares(
      [cursedWhite, cursedBlack].filter(
        (square): square is Square => square !== null,
      ),
    ),

    hotSquares: [],
    frozen: null,
    doomed: [],

    infectionSpreadCount: 0,
    curseTriggers: 0,
    fireTriggers: 0,
    freezeTriggers: 0,
    deaths: 0,
    hotWave: 0,
  };
}

export function cloneHorrorState(state: HorrorState): HorrorState {
  return {
    infectedSquares: [...state.infectedSquares],
    cursedSquares: [...state.cursedSquares],
    hotSquares: state.hotSquares.map((item) => ({ ...item })),
    frozen: state.frozen ? { ...state.frozen } : null,
    doomed: state.doomed.map((item) => ({ ...item })),

    infectionSpreadCount: state.infectionSpreadCount,
    curseTriggers: state.curseTriggers,
    fireTriggers: state.fireTriggers,
    freezeTriggers: state.freezeTriggers,
    deaths: state.deaths,
    hotWave: state.hotWave,
  };
}

function moveTrackedSquare(
  squares: Square[],
  from: Square,
  to: Square,
  capturedSquare: Square | null,
): Square[] {
  let next = squares.filter(
    (square) => square !== capturedSquare && square !== from,
  );

  if (squares.includes(from)) {
    next.push(to);
  }

  return uniqueSquares(next);
}

function rookCastleSquares(move: HorrorMoveInput): {
  from: Square;
  to: Square;
} | null {
  if (!move.isCastle) {
    return null;
  }

  if (move.color === "w") {
    return move.isKingsideCastle
      ? { from: "h1", to: "f1" }
      : { from: "a1", to: "d1" };
  }

  return move.isKingsideCastle
    ? { from: "h8", to: "f8" }
    : { from: "a8", to: "d8" };
}

function updateTrackedForMove(
  squares: Square[],
  move: HorrorMoveInput,
): Square[] {
  let next = moveTrackedSquare(
    squares,
    move.from,
    move.to,
    move.capturedSquare,
  );

  const rookMove = rookCastleSquares(move);

  if (rookMove) {
    next = moveTrackedSquare(next, rookMove.from, rookMove.to, null);
  }

  return next;
}

function squareCoords(square: Square) {
  return {
    file: files.indexOf(square[0]),
    rank: Number(square[1]),
  };
}

function adjacentSquares(square: Square): Square[] {
  const { file, rank } = squareCoords(square);

  const result: Square[] = [];

  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) {
        continue;
      }

      const nextFile = file + df;
      const nextRank = rank + dr;

      if (nextFile < 0 || nextFile > 7 || nextRank < 1 || nextRank > 8) {
        continue;
      }

      result.push(`${files[nextFile]}${nextRank}` as Square);
    }
  }

  return result;
}

function squaresStrictlyBetween(from: Square, to: Square): Square[] {
  const fromFile = files.indexOf(from[0]);
  const fromRank = Number(from[1]);
  const toFile = files.indexOf(to[0]);
  const toRank = Number(to[1]);

  const df = Math.sign(toFile - fromFile);
  const dr = Math.sign(toRank - fromRank);

  const fileDistance = Math.abs(toFile - fromFile);

  const rankDistance = Math.abs(toRank - fromRank);

  /*
   * Only straight or diagonal paths have intermediate board squares.
   * Knights have none. Pawns are handled naturally for their
   * two-square opening move because it is a straight file move.
   */
  const isStraight = fromFile === toFile || fromRank === toRank;

  const isDiagonal = fileDistance === rankDistance;

  if (!isStraight && !isDiagonal) {
    return [];
  }

  const result: Square[] = [];

  let file = fromFile + df;
  let rank = fromRank + dr;

  while (file !== toFile || rank !== toRank) {
    result.push(`${files[file]}${rank}` as Square);

    file += df;
    rank += dr;
  }

  return result;
}

function moveCrossesHotSquare(
  move: Pick<HorrorMoveInput, "from" | "to">,
  activeHotSquares: Square[],
): boolean {
  const hot = new Set(activeHotSquares);

  return squaresStrictlyBetween(move.from, move.to).some((square) =>
    hot.has(square),
  );
}

export function removeHorrorPieceNow(
  game: Chess,
  square: Square,
  options?: {
    clearEnPassant?: boolean;
  },
): void {
  if (!game.get(square)) {
    return;
  }

  const nextFen = replaceBoardInFen(game.fen(), [square], options);

  game.load(nextFen);
}

export function horrorMoveTouchesFire({
  state,
  from,
  to,
  ply,
}: {
  state: HorrorState;
  from: Square;
  to: Square;
  ply: number;
}): boolean {
  const activeHot = getActiveHotSquares(state, ply);

  return (
    activeHot.includes(to) || moveCrossesHotSquare({ from, to }, activeHot)
  );
}

function chooseInfectionSpread(
  game: Chess,
  state: HorrorState,
  source: Square,
  seed: number,
  ply: number,
): Square | null {
  const candidates = adjacentSquares(source).filter((square) => {
    const piece = game.get(square);

    return (
      piece !== undefined &&
      piece.type !== "k" &&
      !state.infectedSquares.includes(square)
    );
  });

  return chooseSquare(candidates, `${seed}:infection:${ply}:${source}`);
}

export function getActiveHotSquares(state: HorrorState, ply: number): Square[] {
  return state.hotSquares
    .filter((item) => item.expiresAfterPly >= ply)
    .map((item) => item.square);
}

function replaceBoardInFen(
  fen: string,
  squaresToRemove: Square[],
  options?: {
    clearEnPassant?: boolean;
  },
): string {
  if (squaresToRemove.length === 0) {
    return fen;
  }

  const parts = fen.split(" ");

  const expanded = parts[0].split("/").map((rank) => {
    const cells: string[] = [];

    for (const char of rank) {
      if (/\d/.test(char)) {
        for (let index = 0; index < Number(char); index += 1) {
          cells.push("");
        }
      } else {
        cells.push(char);
      }
    }

    return cells;
  });

  for (const square of squaresToRemove) {
    const fileIndex = files.indexOf(square[0]);

    const rankIndex = 8 - Number(square[1]);

    expanded[rankIndex][fileIndex] = "";
  }

  parts[0] = expanded
    .map((cells) => {
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
    })
    .join("/");

  /*
   * Supernatural disappearance resets the 50-move clock.
   */
  parts[4] = "0";

  if (options?.clearEnPassant) {
    parts[3] = "-";
  }

  /*
   * Repair castling rights directly from the board BEFORE loading
   * the final FEN. This avoids validating an intermediate FEN with
   * stale rook/castling information.
   */
  let castling = parts[2] ?? "-";

  const a1 = expanded[7][0];
  const h1 = expanded[7][7];
  const a8 = expanded[0][0];
  const h8 = expanded[0][7];

  if (a1 !== "R") {
    castling = castling.replace("Q", "");
  }

  if (h1 !== "R") {
    castling = castling.replace("K", "");
  }

  if (a8 !== "r") {
    castling = castling.replace("q", "");
  }

  if (h8 !== "r") {
    castling = castling.replace("k", "");
  }

  parts[2] = castling || "-";

  return parts.join(" ");
}

function chooseHotSquares(
  game: Chess,
  state: HorrorState,
  seed: number,
  ply: number,
): Square[] {
  const existing = new Set(state.hotSquares.map((item) => item.square));

  let candidates = allSquares.filter(
    (square) => game.get(square) === undefined && !existing.has(square),
  );

  const chosen: Square[] = [];

  for (let index = 0; index < HOT_SQUARE_COUNT; index += 1) {
    const square = chooseSquare(
      candidates,
      `${seed}:hot:${state.hotWave + 1}:${ply}:${index}`,
    );

    if (!square) {
      break;
    }

    chosen.push(square);

    candidates = candidates.filter((candidate) => candidate !== square);
  }

  return chosen;
}

function chooseFrozenPiece(
  game: Chess,
  enemyColor: HorrorColor,
  state: HorrorState,
  seed: number,
  ply: number,
): Square | null {
  const doomed = new Set(state.doomed.map((item) => item.square));

  const candidates = allSquares.filter((square) => {
    const piece = game.get(square);

    return (
      piece !== undefined &&
      piece.color === enemyColor &&
      piece.type !== "k" &&
      !doomed.has(square)
    );
  });

  return chooseSquare(candidates, `${seed}:freeze:${ply}`);
}

function removeStatusesAtSquares(state: HorrorState, squares: Square[]) {
  if (squares.length === 0) {
    return;
  }

  const removed = new Set(squares);

  state.infectedSquares = state.infectedSquares.filter(
    (square) => !removed.has(square),
  );

  state.cursedSquares = state.cursedSquares.filter(
    (square) => !removed.has(square),
  );

  if (state.frozen && removed.has(state.frozen.square)) {
    state.frozen = null;
  }
}

function addDoomed(state: HorrorState, next: DoomedPiece) {
  const existing = state.doomed.find(
    (item) => item.square === next.square && item.color === next.color,
  );

  if (existing) {
    if (existing.reason !== next.reason) {
      existing.reason = "curse+fire";
    }

    existing.removeAfterPly = Math.max(
      existing.removeAfterPly,
      next.removeAfterPly,
    );

    return;
  }

  state.doomed.push(next);
}

export function resolveHorrorAfterMove({
  previousState,
  gameAfterMove,
  move,
  seed,
  ply,
}: {
  previousState: HorrorState;
  gameAfterMove: Chess;
  move: HorrorMoveInput;
  seed: number;
  ply: number;
}): {
  state: HorrorState;
  event: HorrorEvent;
} {
  const state = cloneHorrorState(previousState);

  const event: HorrorEvent = {
    infectionsAdded: [],
    becameCursed: null,
    curseTriggered: false,
    fireTriggered: false,
    fireCrossed: false,
    frozenSquare: null,
    deaths: [],
    hotSpawned: [],
  };

  const moverWasInfected = previousState.infectedSquares.includes(move.from);

  const capturedWasInfected =
    move.capturedSquare !== null &&
    previousState.infectedSquares.includes(move.capturedSquare);

  const capturedWasCursed =
    move.capturedSquare !== null &&
    previousState.cursedSquares.includes(move.capturedSquare);

  state.infectedSquares = updateTrackedForMove(state.infectedSquares, move);

  state.cursedSquares = updateTrackedForMove(state.cursedSquares, move);

  /*
   * Capturing an infected piece infects the capturer.
   * Kings are immune to infection.
   */
  if (
    capturedWasInfected &&
    move.piece !== "k" &&
    !state.infectedSquares.includes(move.to)
  ) {
    state.infectedSquares.push(move.to);
    event.infectionsAdded.push(move.to);
  }

  /*
   * An infected piece that captures becomes cursed as well.
   */
  if (
    moverWasInfected &&
    move.captured &&
    move.piece !== "k" &&
    !state.cursedSquares.includes(move.to)
  ) {
    state.cursedSquares.push(move.to);
    event.becameCursed = move.to;
  }

  /*
   * An infected mover spreads to one adjacent occupied non-King square.
   */
  if (state.infectedSquares.includes(move.to)) {
    const spread = chooseInfectionSpread(
      gameAfterMove,
      state,
      move.to,
      seed,
      ply,
    );

    if (spread) {
      state.infectedSquares.push(spread);
      event.infectionsAdded.push(spread);
      state.infectionSpreadCount += 1;
    }
  }

  const activeHot = getActiveHotSquares(previousState, ply);

  const moverCrossedFire = moveCrossesHotSquare(move, activeHot);

  const moverLandedOnFire = activeHot.includes(move.to);

  /*
   * Fire resolves BEFORE the resulting Horror position is evaluated.
   *
   * A non-King mover that either lands on or crosses an active
   * burning square disappears immediately from its destination.
   * Therefore a piece that would have delivered check from that
   * destination no longer checks the King in the final position.
   */
  if ((moverCrossedFire || moverLandedOnFire) && move.piece !== "k") {
    const pieceAtDestination = gameAfterMove.get(move.to);

    if (
      pieceAtDestination &&
      pieceAtDestination.color === move.color &&
      pieceAtDestination.type !== "k"
    ) {
      const pawnDoubleStep =
        move.piece === "p" &&
        Math.abs(Number(move.to[1]) - Number(move.from[1])) === 2;

      removeHorrorPieceNow(gameAfterMove, move.to, {
        clearEnPassant: pawnDoubleStep,
      });

      removeStatusesAtSquares(state, [move.to]);

      state.doomed = state.doomed.filter((item) => item.square !== move.to);

      state.fireTriggers += 1;
      state.deaths += 1;

      event.fireTriggered = true;
      event.fireCrossed = moverCrossedFire;

      event.deaths.push({
        square: move.to,
        reason: "fire",
        piece: move.piece,
      });
    }
  }

  if (
    capturedWasCursed &&
    move.piece !== "k" &&
    gameAfterMove.get(move.to) !== undefined
  ) {
    addDoomed(state, {
      square: move.to,
      color: move.color,
      reason: "curse",
      removeAfterPly: ply + 1,
    });

    state.curseTriggers += 1;
    event.curseTriggered = true;
  }

  const rookMove = rookCastleSquares(move);

  if (rookMove) {
    const rookCrossedFire = moveCrossesHotSquare(rookMove, activeHot);

    const rookLandedOnFire = activeHot.includes(rookMove.to);

    if (rookCrossedFire || rookLandedOnFire) {
      const rookAtDestination = gameAfterMove.get(rookMove.to);

      if (
        rookAtDestination &&
        rookAtDestination.type === "r" &&
        rookAtDestination.color === move.color
      ) {
        const nextFen = replaceBoardInFen(gameAfterMove.fen(), [rookMove.to]);

        gameAfterMove.load(nextFen);

        removeStatusesAtSquares(state, [rookMove.to]);

        state.fireTriggers += 1;
        state.deaths += 1;

        event.fireTriggered = true;
        event.fireCrossed = event.fireCrossed || rookCrossedFire;

        event.deaths.push({
          square: rookMove.to,
          reason: "fire",
          piece: "r",
        });
      }
    }
  }

  /*
   * FINAL FIRE INVARIANT
   *
   * If the non-King mover touched active fire, it is impossible for
   * that mover to remain on the destination square in the authoritative
   * post-Horror position. This runs before freeze/check/game-over logic.
   */
  if (move.piece !== "k" && (moverCrossedFire || moverLandedOnFire)) {
    const survivor = gameAfterMove.get(move.to);

    if (survivor && survivor.color === move.color) {
      const pawnDoubleStep =
        move.piece === "p" &&
        Math.abs(Number(move.to[1]) - Number(move.from[1])) === 2;

      removeHorrorPieceNow(gameAfterMove, move.to, {
        clearEnPassant: pawnDoubleStep,
      });

      removeStatusesAtSquares(state, [move.to]);

      state.doomed = state.doomed.filter((item) => item.square !== move.to);

      const alreadyRecorded = event.deaths.some(
        (death) =>
          death.square === move.to &&
          (death.reason === "fire" || death.reason === "curse+fire"),
      );

      if (!alreadyRecorded) {
        state.fireTriggers += 1;
        state.deaths += 1;
        event.fireTriggered = true;

        event.deaths.push({
          square: move.to,
          reason: "fire",
          piece: move.piece,
        });
      }
    }
  }

  /*
   * The previous freeze expires after the frozen side completes one move.
   */
  if (state.frozen && state.frozen.clearAfterPly <= ply) {
    state.frozen = null;
  }

  /*
   * Resolve pieces doomed on the previous ply.
   */
  const due = state.doomed.filter((item) => item.removeAfterPly <= ply);

  const removeSquares: Square[] = [];

  for (const doomed of due) {
    const piece = gameAfterMove.get(doomed.square);

    if (piece && piece.color === doomed.color && piece.type !== "k") {
      removeSquares.push(doomed.square);

      event.deaths.push({
        square: doomed.square,
        reason: doomed.reason,
        piece: piece.type,
      });

      state.deaths += 1;
    }
  }

  state.doomed = state.doomed.filter((item) => item.removeAfterPly > ply);

  if (removeSquares.length > 0) {
    const nextFen = replaceBoardInFen(gameAfterMove.fen(), removeSquares);

    gameAfterMove.load(nextFen);

    removeStatusesAtSquares(state, removeSquares);
  }

  /*
   * Expire fire zones after they were active for this ply.
   */
  state.hotSquares = state.hotSquares.filter(
    (item) => item.expiresAfterPly > ply,
  );

  /*
   * Two new burning squares every four complete moves.
   */
  if (ply > 0 && ply % HOT_SQUARE_INTERVAL_PLIES === 0) {
    const spawned = chooseHotSquares(gameAfterMove, state, seed, ply);

    state.hotWave += 1;

    for (const square of spawned) {
      state.hotSquares.push({
        square,
        expiresAfterPly: ply + HOT_SQUARE_LIFETIME_PLIES,
      });
    }

    event.hotSpawned = spawned;
  }

  /*
   * A direct Knight check freezes one random enemy non-King piece
   * for that enemy's next turn.
   */
  if (
    move.knightDirectCheck &&
    gameAfterMove.get(move.to)?.type === "n" &&
    gameAfterMove.get(move.to)?.color === move.color
  ) {
    const enemyColor: HorrorColor = move.color === "w" ? "b" : "w";

    const frozen = chooseFrozenPiece(
      gameAfterMove,
      enemyColor,
      state,
      seed,
      ply,
    );

    if (frozen) {
      state.frozen = {
        square: frozen,
        color: enemyColor,
        clearAfterPly: ply + 1,
      };

      state.freezeTriggers += 1;
      event.frozenSquare = frozen;
    }
  }

  state.infectedSquares = uniqueSquares(state.infectedSquares);

  state.cursedSquares = uniqueSquares(state.cursedSquares);

  return {
    state,
    event,
  };
}

function castlingRookFrom(color: HorrorColor, to: Square): Square | null {
  if (color === "w") {
    if (to === "g1") return "h1";
    if (to === "c1") return "a1";
  } else {
    if (to === "g8") return "h8";
    if (to === "c8") return "a8";
  }

  return null;
}

export function isHorrorMoveAllowed({
  game,
  state,
  from,
  to,
  nextPly,
}: {
  game: Chess;
  state: HorrorState;
  from: Square;
  to: Square;
  nextPly: number;
}): boolean {
  const piece = game.get(from);

  if (!piece) {
    return false;
  }

  if (
    state.frozen &&
    state.frozen.color === piece.color &&
    state.frozen.square === from
  ) {
    return false;
  }

  /*
   * A frozen rook cannot be used as part of castling.
   */
  if (
    piece.type === "k" &&
    Math.abs(files.indexOf(to[0]) - files.indexOf(from[0])) === 2
  ) {
    const rookFrom = castlingRookFrom(piece.color, to);

    if (
      rookFrom &&
      state.frozen?.square === rookFrom &&
      state.frozen.color === piece.color
    ) {
      return false;
    }
  }

  /*
   * Kings may not step onto OR cross burning squares.
   * This filter is also used by hasAnyHorrorLegalMove(), so burning
   * squares count as unavailable King escapes for checkmate.
   */
  if (piece.type === "k") {
    if (state.cursedSquares.includes(to)) {
      return false;
    }

    const activeHot = getActiveHotSquares(state, nextPly);

    if (activeHot.includes(to)) {
      return false;
    }

    if (moveCrossesHotSquare({ from, to }, activeHot)) {
      return false;
    }
  }

  return true;
}

export function legalHorrorMovesForSquare({
  game,
  state,
  square,
  nextPly,
}: {
  game: Chess;
  state: HorrorState;
  square: Square;
  nextPly: number;
}): Square[] {
  return game
    .moves({
      square,
      verbose: true,
    })
    .filter((move) =>
      isHorrorMoveAllowed({
        game,
        state,
        from: move.from,
        to: move.to,
        nextPly,
      }),
    )
    .map((move) => move.to);
}

export function hasAnyHorrorLegalMove({
  game,
  state,
  nextPly,
}: {
  game: Chess;
  state: HorrorState;
  nextPly: number;
}): boolean {
  return game.moves({ verbose: true }).some((move) =>
    isHorrorMoveAllowed({
      game,
      state,
      from: move.from,
      to: move.to,
      nextPly,
    }),
  );
}

export function positionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function isThreefoldFromHorrorRecords(
  records: HorrorMoveRecord[],
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
