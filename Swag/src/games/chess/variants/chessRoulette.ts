import { Chess, type Square } from "chess.js";

export type PortalSide = "w" | "b";

export type PortalPieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type PortalEffect = "destroy" | "teleport" | "swap" | "promote";

export type PortalPromotionCard = "p" | "n" | "b" | "r" | "q" | "k";

export type PortalResult =
  | "destroyed"
  | "teleported"
  | "swapped"
  | "promotion-card"
  | "fizzled";

export type Portal = {
  id: string;
  square: Square;
  effect: PortalEffect;

  /*
   * ChessRoulette Lucky Squares are visible immediately.
   * `revealed` now means the outcome has fired at least once,
   * not that the location is hidden.
   */
  revealed: boolean;

  triggerCount: number;

  /*
   * After a Lucky Square fires on ply N, it stays alive through
   * the opponent's reply move (ply N + 1), then disappears before
   * the triggering player moves again.
   */
  expiresAfterPly: number | null;
  triggeredBy: PortalSide | null;
};

export type PortalEvent = {
  ply: number;
  square: Square;
  effect: PortalEffect;
  result: PortalResult;
  color: PortalSide;
  piece: PortalPieceType;
  destination?: Square;
  swapSquare?: Square;
  promotionCard?: PortalPromotionCard;
};

export type PortalState = {
  seed: number;
  portals: Portal[];
  events: PortalEvent[];
};

export type PortalMoveRecord = {
  ply: number;
  san: string;
  color: PortalSide;
  from: Square;
  to: Square;
  captured?: PortalPieceType;
  fenBefore: string;
  fenAfter: string;
  portalBefore: PortalState;
  portalAfter: PortalState;
  portalEvent: PortalEvent | null;
};

export type PendingPortalPromotion = {
  portalId: string;
  portalSquare: Square;
  deck: PortalPromotionCard[];
};

const files = "abcdefgh";

const effectPool: PortalEffect[] = ["destroy", "teleport", "swap", "promote"];

export const PORTAL_PROMOTION_DECK: PortalPromotionCard[] = [
  "p",
  "p",
  "p",
  "p",
  "p",
  "p",
  "p",
  "p",
  "b",
  "b",
  "n",
  "n",
  "r",
  "r",
  "q",
  "k",
];

export function createPortalSeed(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const values = new Uint32Array(1);

    crypto.getRandomValues(values);

    return values[0];
  }

  return Math.floor(Math.random() * 0xffffffff);
}

function mulberry32(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;

    let t = value;

    t = Math.imul(t ^ (t >>> 15), t | 1);

    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(...values: number[]): number {
  let seed = 0x811c9dc5;

  for (const value of values) {
    seed ^= value >>> 0;

    seed = Math.imul(seed, 0x01000193);
  }

  return seed >>> 0;
}

function hashString(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);

    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function shuffled<T>(values: T[], seed: number): T[] {
  const random = mulberry32(seed);

  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));

    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

export function clonePortalState(state: PortalState): PortalState {
  return {
    seed: state.seed,

    portals: state.portals.map((portal) => ({
      ...portal,
    })),

    events: state.events.map((event) => ({
      ...event,
    })),
  };
}

export function createInitialPortalState(
  seed = createPortalSeed(),
): PortalState {
  /*
   * Variant 8 rule:
   * visible Lucky Squares can ONLY exist on ranks 3, 4, 5 and 6.
   */
  const candidateSquares: Square[] = [];

  for (const rank of ["3", "4", "5", "6"]) {
    for (const file of files) {
      candidateSquares.push(`${file}${rank}` as Square);
    }
  }

  /*
   * ChessRoulette starts with exactly 2 visible Lucky Squares.
   * Additional Lucky Squares can spawn later every 15 played moves.
   */
  const portalCount = 2;

  const squares = shuffled(candidateSquares, mixSeed(seed, 0x11)).slice(
    0,
    portalCount,
  );

  /*
   * Lucky Square locations are visible; their effects remain unknown until triggered.
   * With 2 starting Lucky Squares, their two effects are independently seeded.
   */
  const effects = squares.map(
    (_, index) =>
      effectPool[
        Math.floor(mulberry32(mixSeed(seed, index, 0x29))() * effectPool.length)
      ],
  );

  return {
    seed,

    portals: squares.map((square, index) => ({
      id: `portal-${index}`,

      square,

      effect: effects[index],

      revealed: false,

      triggerCount: 0,

      expiresAfterPly: null,

      triggeredBy: null,
    })),

    events: [],
  };
}

export function buildPortalPromotionDeck(
  state: PortalState,
  portalId: string,
  ply: number,
): PortalPromotionCard[] {
  const portal = state.portals.find((candidate) => candidate.id === portalId);

  const triggerCount = portal?.triggerCount ?? 0;

  return shuffled(
    PORTAL_PROMOTION_DECK,
    mixSeed(state.seed, hashString(portalId), triggerCount, ply, 0x77),
  );
}

export function getLuckySquareSquares(state: PortalState): Square[] {
  return state.portals.map((portal) => portal.square);
}

export function getRevealedPortalSquaresByEffect(
  state: PortalState,
  effect: PortalEffect,
): Square[] {
  return state.portals
    .filter((portal) => portal.revealed && portal.effect === effect)
    .map((portal) => portal.square);
}

function squareFromBoardIndices(row: number, column: number): Square {
  return `${files[column]}${8 - row}` as Square;
}

function squareFileIndex(square: Square): number {
  return files.indexOf(square[0]);
}

function squareRank(square: Square): number {
  return Number(square[1]);
}

function pieceAttacksSquare(
  game: Chess,
  from: Square,
  piece: {
    type: PortalPieceType;
    color: PortalSide;
  },
  target: Square,
): boolean {
  const fromFile = squareFileIndex(from);

  const fromRank = squareRank(from);

  const targetFile = squareFileIndex(target);

  const targetRank = squareRank(target);

  const df = targetFile - fromFile;

  const dr = targetRank - fromRank;

  if (piece.type === "p") {
    const direction = piece.color === "w" ? 1 : -1;

    return dr === direction && Math.abs(df) === 1;
  }

  if (piece.type === "n") {
    const fileDistance = Math.abs(df);

    const rankDistance = Math.abs(dr);

    return (
      (fileDistance === 1 && rankDistance === 2) ||
      (fileDistance === 2 && rankDistance === 1)
    );
  }

  if (piece.type === "k") {
    return Math.max(Math.abs(df), Math.abs(dr)) === 1;
  }

  const diagonal = Math.abs(df) === Math.abs(dr) && df !== 0;

  const straight = (df === 0 && dr !== 0) || (dr === 0 && df !== 0);

  const canSlide =
    (piece.type === "b" && diagonal) ||
    (piece.type === "r" && straight) ||
    (piece.type === "q" && (diagonal || straight));

  if (!canSlide) {
    return false;
  }

  const stepFile = df === 0 ? 0 : df > 0 ? 1 : -1;

  const stepRank = dr === 0 ? 0 : dr > 0 ? 1 : -1;

  let fileIndex = fromFile + stepFile;

  let rank = fromRank + stepRank;

  while (fileIndex !== targetFile || rank !== targetRank) {
    const between = `${files[fileIndex]}${rank}` as Square;

    if (game.get(between)) {
      return false;
    }

    fileIndex += stepFile;

    rank += stepRank;
  }

  return true;
}

export function isPortalKingAttacked(
  game: Chess,
  kingSide: PortalSide,
): boolean {
  const board = game.board();

  let kingSquare: Square | null = null;

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = board[row][column];

      if (piece?.type === "k" && piece.color === kingSide) {
        kingSquare = squareFromBoardIndices(row, column);

        break;
      }
    }
  }

  if (!kingSquare) {
    return true;
  }

  const enemySide: PortalSide = kingSide === "w" ? "b" : "w";

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = board[row][column];

      if (!piece || piece.color !== enemySide) {
        continue;
      }

      const from = squareFromBoardIndices(row, column);

      if (
        pieceAttacksSquare(
          game,
          from,
          {
            type: piece.type as PortalPieceType,

            color: piece.color as PortalSide,
          },
          kingSquare,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function sanitizeCastlingRights(game: Chess, affectedColors: Set<PortalSide>) {
  if (affectedColors.size === 0) {
    return;
  }

  const parts = game.fen().split(" ");

  let rights = parts[2];

  if (affectedColors.has("w")) {
    rights = rights.replace("K", "").replace("Q", "");
  }

  if (affectedColors.has("b")) {
    rights = rights.replace("k", "").replace("q", "");
  }

  parts[2] = rights || "-";

  game.load(parts.join(" "));
}

function tryPortalMutation(
  game: Chess,
  moverSide: PortalSide,
  mutate: () => Set<PortalSide>,
): boolean {
  const before = game.fen();

  try {
    const affectedColors = mutate();

    sanitizeCastlingRights(game, affectedColors);

    if (isPortalKingAttacked(game, moverSide)) {
      game.load(before);
      return false;
    }

    new Chess(game.fen());

    return true;
  } catch {
    game.load(before);
    return false;
  }
}

function allEmptySquares(game: Chess, pieceType: PortalPieceType): Square[] {
  const result: Square[] = [];

  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of files) {
      const square = `${file}${rank}` as Square;

      if (game.get(square)) {
        continue;
      }

      if (pieceType === "p" && (rank === 1 || rank === 8)) {
        continue;
      }

      result.push(square);
    }
  }

  return result;
}

const luckySquareCandidateSquares: Square[] = [..."abcdefgh"].flatMap(
  (file) => [
    `${file}3` as Square,
    `${file}4` as Square,
    `${file}5` as Square,
    `${file}6` as Square,
  ],
);

function createSpawnedLuckySquare(
  state: PortalState,
  square: Square,
  serial: number,
): Portal {
  const random = mulberry32(
    mixSeed(state.seed, serial, hashString(square), 0x5151),
  );

  return {
    id: `lucky-${serial}-${square}`,

    square,

    effect: effectPool[Math.floor(random() * effectPool.length)],

    revealed: false,

    triggerCount: 0,

    expiresAfterPly: null,

    triggeredBy: null,
  };
}

/**
 * A triggered Lucky Square survives the opponent's reply and then
 * disappears when the original triggering player is to move again.
 *
 * If White triggers on ply 7:
 * - Black may play ply 8 while the square still exists.
 * - after ply 8 completes, the square is removed before White acts.
 */
export function expireTriggeredLuckySquares(
  state: PortalState,
  completedPly: number,
): PortalState {
  const next = clonePortalState(state);

  next.portals = next.portals.filter(
    (portal) =>
      portal.expiresAfterPly === null || completedPly < portal.expiresAfterPly,
  );

  return next;
}

/**
 * Every 15 played moves (plies), try to spawn 2 new Lucky Squares.
 *
 * New squares:
 * - only ranks 3, 4, 5 or 6
 * - must be empty
 * - must not already contain a Lucky Square
 * - up to 2 spawn if only 1 eligible square remains
 * - 0 spawn if no eligible squares remain
 */
export function spawnLuckySquaresAfterMove(
  game: Chess,
  state: PortalState,
  completedPly: number,
): PortalState {
  if (completedPly <= 0 || completedPly % 15 !== 0) {
    return state;
  }

  const next = clonePortalState(state);

  const existing = new Set(next.portals.map((portal) => portal.square));

  const eligible = luckySquareCandidateSquares.filter(
    (square) => !existing.has(square) && !game.get(square),
  );

  if (eligible.length === 0) {
    return next;
  }

  const chosen = shuffled(
    eligible,
    mixSeed(state.seed, completedPly, next.portals.length, 0x1515),
  ).slice(0, 2);

  const serialBase = completedPly * 100 + next.portals.length;

  chosen.forEach((square, index) => {
    next.portals.push(
      createSpawnedLuckySquare(next, square, serialBase + index),
    );
  });

  return next;
}

export type PortalResolution = {
  state: PortalState;
  event: PortalEvent | null;
  pendingPromotion: PendingPortalPromotion | null;
};

export function resolvePortalAfterMove(
  game: Chess,
  state: PortalState,
  landingSquare: Square,
  move: {
    color: PortalSide;
    piece: PortalPieceType;
  },
  ply: number,
): PortalResolution {
  const portalIndex = state.portals.findIndex(
    (portal) => portal.square === landingSquare,
  );

  if (portalIndex < 0) {
    return {
      state: clonePortalState(state),

      event: null,

      pendingPromotion: null,
    };
  }

  const next = clonePortalState(state);

  const portal = next.portals[portalIndex];

  portal.revealed = true;

  portal.triggerCount += 1;

  portal.triggeredBy = move.color;

  /*
   * Keep this Lucky Square through the opponent's next move.
   * Remove it after ply + 1 has completed.
   */
  portal.expiresAfterPly = ply + 1;

  /*
   * Kings reveal portals but are immune to their effects.
   * This keeps normal chess king legality intact.
   */
  if (move.piece === "k") {
    const event: PortalEvent = {
      ply,
      square: landingSquare,
      effect: portal.effect,
      result: "fizzled",
      color: move.color,
      piece: move.piece,
    };

    next.events.push(event);

    return {
      state: next,
      event,
      pendingPromotion: null,
    };
  }

  /*
   * Promote works for every NON-KING piece.
   *
   * Kings are handled by the immunity branch above, so they can never
   * enter Promotion Roulette. Every other piece draws from the same deck:
   * a Queen can become a Pawn, a Rook can become a Bishop, etc.
   */
  if (portal.effect === "promote") {
    return {
      state: next,
      event: null,
      pendingPromotion: {
        portalId: portal.id,

        portalSquare: portal.square,

        deck: buildPortalPromotionDeck(next, portal.id, ply),
      },
    };
  }

  const eventSeed = mixSeed(
    next.seed,
    portalIndex,
    portal.triggerCount,
    ply,
    0x91,
  );

  if (portal.effect === "destroy") {
    const original = game.get(landingSquare);

    const worked = original
      ? tryPortalMutation(game, move.color, () => {
          game.remove(landingSquare);

          const affected = new Set<PortalSide>();

          if (original.type === "r" || original.type === "k") {
            affected.add(original.color as PortalSide);
          }

          return affected;
        })
      : false;

    const event: PortalEvent = {
      ply,
      square: landingSquare,
      effect: "destroy",
      result: worked ? "destroyed" : "fizzled",
      color: move.color,
      piece: move.piece,
    };

    next.events.push(event);

    return {
      state: next,
      event,
      pendingPromotion: null,
    };
  }

  if (portal.effect === "teleport") {
    const piece = game.get(landingSquare);

    const candidates = piece
      ? shuffled(
          allEmptySquares(game, piece.type as PortalPieceType),
          eventSeed,
        )
      : [];

    let destination: Square | undefined;

    if (piece) {
      for (const candidate of candidates) {
        const worked = tryPortalMutation(game, move.color, () => {
          const removed = game.remove(landingSquare);

          if (!removed) {
            return new Set();
          }

          game.put(
            {
              type: removed.type,
              color: removed.color,
            },
            candidate,
          );

          const affected = new Set<PortalSide>();

          if (removed.type === "r" || removed.type === "k") {
            affected.add(removed.color as PortalSide);
          }

          return affected;
        });

        if (worked) {
          destination = candidate;
          break;
        }
      }
    }

    const event: PortalEvent = {
      ply,
      square: landingSquare,
      effect: "teleport",
      result: destination ? "teleported" : "fizzled",
      color: move.color,
      piece: move.piece,
      destination,
    };

    next.events.push(event);

    return {
      state: next,
      event,
      pendingPromotion: null,
    };
  }

  /*
   * Swap with a seeded random opponent non-King piece.
   */
  const movedPiece = game.get(landingSquare);

  const enemySide: PortalSide = move.color === "w" ? "b" : "w";

  const enemySquares: Square[] = [];

  const board = game.board();

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = board[row][column];

      if (piece && piece.color === enemySide && piece.type !== "k") {
        enemySquares.push(squareFromBoardIndices(row, column));
      }
    }
  }

  const candidates = shuffled(enemySquares, eventSeed);

  let swapSquare: Square | undefined;

  if (movedPiece) {
    for (const candidate of candidates) {
      const targetPiece = game.get(candidate);

      if (!targetPiece) {
        continue;
      }

      const worked = tryPortalMutation(game, move.color, () => {
        const source = game.remove(landingSquare);

        const target = game.remove(candidate);

        if (!source || !target) {
          return new Set();
        }

        game.put(
          {
            type: source.type,
            color: source.color,
          },
          candidate,
        );

        game.put(
          {
            type: target.type,
            color: target.color,
          },
          landingSquare,
        );

        const affected = new Set<PortalSide>();

        if (source.type === "r" || source.type === "k") {
          affected.add(source.color as PortalSide);
        }

        if (target.type === "r" || target.type === "k") {
          affected.add(target.color as PortalSide);
        }

        return affected;
      });

      if (worked) {
        swapSquare = candidate;
        break;
      }
    }
  }

  const event: PortalEvent = {
    ply,
    square: landingSquare,
    effect: "swap",
    result: swapSquare ? "swapped" : "fizzled",
    color: move.color,
    piece: move.piece,
    swapSquare,
  };

  next.events.push(event);

  return {
    state: next,
    event,
    pendingPromotion: null,
  };
}

export function finalizePortalPromotionEvent(
  state: PortalState,
  event: PortalEvent,
): PortalState {
  const next = clonePortalState(state);

  next.events.push(event);

  return next;
}

function repetitionKey(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function isThreefoldPortal(
  records: PortalMoveRecord[],
  initialFen: string,
  currentFen: string,
): boolean {
  const counts = new Map<string, number>();

  const add = (fen: string) => {
    const key = repetitionKey(fen);

    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  add(initialFen);

  for (const record of records) {
    add(record.fenAfter);
  }

  if (records[records.length - 1]?.fenAfter !== currentFen) {
    add(currentFen);
  }

  return [...counts.values()].some((count) => count >= 3);
}
