import { Chess, type Square, type Move } from "chess.js";

export type PortalSide = "w" | "b";

export type PortalPieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type PortalEffect = "destroy" | "teleport" | "swap" | "promote" | "extra-turn";

export type PortalPromotionCard = "p" | "n" | "b" | "r" | "q" | "k";

export type PortalResult =
  | "destroyed"
  | "teleported"
  | "swapped"
  | "promotion-card"
  | "fizzled"
  | "extra-turn";

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
  kingPowers?: Partial<Record<PortalSide, { piece: "n" | "b" | "r" | "q"; movesLeft: number }>>;
  loser?: PortalSide;
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

export const ROULETTE_PROBABILITIES = { destroy: 10, promote: 60, teleport: 20, swap: 10 } as const;
const effectPool: PortalEffect[] = ["destroy", "promote", "promote", "promote", "promote", "promote", "promote", "teleport", "teleport", "swap"];

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
    loser: state.loser,
    kingPowers: Object.fromEntries(Object.entries(state.kingPowers ?? {}).map(([side, power]) => [side, { ...power }])),

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
  state?: PortalState,
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

  const power = state?.kingPowers?.[enemySide];
  if (power?.movesLeft) {
    const king = game.board().flat().find((p) => p?.type === "k" && p.color === enemySide);
    if (king && pieceAttacksSquare(game, king.square, { type: power.piece, color: enemySide }, kingSquare)) return true;
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
  state = clonePortalState(state);
  const power = state.kingPowers?.[move.color];
  if (move.piece === "k" && power && --power.movesLeft <= 0) delete state.kingPowers![move.color];
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

  if (move.piece === "k") {
    const draw = mulberry32(mixSeed(next.seed, portalIndex, portal.triggerCount, ply, 0x4b))();
    if (draw < 0.8) {
      portal.effect = "promote";
    } else {
      const parts = game.fen().split(" ");
      parts[1] = move.color;
      parts[3] = "-";
      game.load(parts.join(" "));
      const event: PortalEvent = { ply, square: landingSquare, effect: "extra-turn", result: "extra-turn", color: move.color, piece: "k" };
      next.events.push(event);
      return { state: next, event, pendingPromotion: null };
    }
  }

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
  if (event.piece === "k" && event.promotionCard) {
    if (event.promotionCard === "k") next.loser = event.color;
    else if (event.promotionCard !== "p") {
      next.kingPowers ??= {};
      next.kingPowers[event.color] = { piece: event.promotionCard, movesLeft: 3 };
    }
  }
  return next;
}

export function roulettePositionKey(fen: string, state: PortalState): string {
  return JSON.stringify([
    fen.split(" ").slice(0, 4).join(" "),
    state.portals.map(({ square, effect, revealed, triggerCount, expiresAfterPly }) => [square, effect, revealed, triggerCount, expiresAfterPly]),
    [state.kingPowers?.w ?? null, state.kingPowers?.b ?? null],
  ]);
}

export function isThreefoldPortal(records: PortalMoveRecord[], initialFen: string, currentFen: string): boolean {
  const counts = new Map<string, number>();
  const add = (fen: string, state: PortalState) => {
    const key = roulettePositionKey(fen, state);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  const first = records[0]?.portalBefore;
  if (!first) return false;
  add(initialFen, first);
  for (const record of records) add(record.fenAfter, record.portalAfter);
  if (records.at(-1)?.fenAfter !== currentFen) add(currentFen, records.at(-1)!.portalAfter);
  return [...counts.values()].some((count) => count >= 3);
}

/** Keep the real king in the FEN. Its additional movement belongs to variant state. */
export function applyRouletteCard(game: Chess, square: Square, card: PortalPromotionCard) {
  const current = game.get(square);
  if (!current || current.type === "k") return;
  game.remove(square);
  if (card !== "k") game.put({ type: card, color: current.color }, square);
}

function extraKingMove(game: Chess, from: Square, to: Square): Move {
  const color = game.turn();
  const captured = game.get(to)?.type;
  game.remove(from);
  game.remove(to);
  game.put({ type: "k", color }, to);
  const parts = game.fen().split(" ");
  parts[1] = color === "w" ? "b" : "w";
  parts[2] = parts[2].replace(color === "w" ? /[KQ]/g : /[kq]/g, "") || "-";
  parts[3] = "-";
  parts[4] = captured ? "0" : String(Number(parts[4]) + 1);
  if (color === "b") parts[5] = String(Number(parts[5]) + 1);
  game.load(parts.join(" "));
  return { from, to, color, piece: "k", captured, san: `K${from}${captured ? "x" : "-"}${to}`, flags: captured ? "c" : "n" } as Move;
}

export function getRouletteMoves(game: Chess, state: PortalState, square?: Square): Move[] {
  if (state.loser) return [];
  const color = game.turn();
  const moves = game.moves({ verbose: true, ...(square ? { square } : {}) }).filter((move) => {
    if (game.get(move.to)?.type === "k") return false;
    const next = new Chess(game.fen());
    next.move(move);
    // Castling must also cross a square safe from the empowered enemy king.
    if (move.flags.includes("k") || move.flags.includes("q")) {
      if (isPortalKingAttacked(game, color, state)) return false;
      const middle = `${move.flags.includes("k") ? "f" : "d"}${color === "w" ? "1" : "8"}` as Square;
      const crossing = new Chess(game.fen());
      crossing.remove(move.from); crossing.put({ type: "k", color }, middle);
      if (isPortalKingAttacked(crossing, color, state)) return false;
    }
    return !isPortalKingAttacked(next, color, state);
  });
  const power = state.kingPowers?.[color];
  const king = game.board().flat().find((p) => p?.type === "k" && p.color === color);
  if (!king || !power?.movesLeft || (square && square !== king.square)) return moves;
  for (const file of files) for (let rank = 1; rank <= 8; rank++) {
    const to = `${file}${rank}` as Square;
    const target = game.get(to);
    if (target?.color === color || target?.type === "k" || moves.some((m) => m.from === king.square && m.to === to)) continue;
    if (!pieceAttacksSquare(game, king.square, { type: power.piece, color }, to)) continue;
    const next = new Chess(game.fen());
    const move = extraKingMove(next, king.square, to);
    if (!isPortalKingAttacked(next, color, state)) moves.push(move);
  }
  return moves;
}

export function moveRoulette(game: Chess, state: PortalState, input: { from: Square; to: Square; promotion?: string }): Move {
  const move = getRouletteMoves(game, state, input.from).find((m) => m.to === input.to && (!m.promotion || m.promotion === (input.promotion ?? "q")));
  if (!move) throw new Error("Illegal move");
  const standard = game.moves({ square: input.from, verbose: true }).some((m) => m.to === input.to);
  return standard ? game.move(input) : extraKingMove(game, input.from, input.to);
}
