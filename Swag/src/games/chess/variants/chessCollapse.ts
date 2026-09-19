import { Chess, type Square } from "chess.js";

export type CollapseSide = "w" | "b";
export type CollapseOutcome = "white" | "black" | "draw" | null;
export type CollapseEdge = "left" | "right" | "top" | "bottom";
export type CollapsePieceType = "p" | "n" | "b" | "r" | "q" | "k";

export type CollapseBounds = {
  minFile: number;
  maxFile: number;
  minRank: number;
  maxRank: number;
};

export type CollapseKingLives = {
  w: number;
  b: number;
};

export type CollapseState = {
  seed: number;
  bounds: CollapseBounds;
  collapsedSquares: Square[];
  warningEdge: CollapseEdge | null;
  warningSquares: Square[];
  warningMovesRemaining: number;
  movesUntilWarning: number;
  collapseCount: number;
  lastImpactSquares: Square[];
};

export type CollapseDestroyedPiece = {
  square: Square;
  type: CollapsePieceType;
  color: CollapseSide;
};

export type CollapseKingRelocation = {
  color: CollapseSide;
  from: Square;
  to: Square;
};

export type CollapseAdvanceResult = {
  state: CollapseState;
  lives: CollapseKingLives;
  outcome: CollapseOutcome;
  kingHits: CollapseSide[];
  trappedKings: CollapseSide[];
  relocatedKings: CollapseKingRelocation[];
  destroyedPieces: CollapseDestroyedPiece[];
  collapsedNow: Square[];
};

export const COLLAPSE_KING_MAX_LIVES = 3;
export const COLLAPSE_WARNING_MOVES = 4;
export const COLLAPSE_MIN_DELAY_MOVES = 5;
export const COLLAPSE_MAX_DELAY_MOVES = 9;

/*
 * Collapse always stops at the central 4x4 board: c3-f6.
 * Edges are removed in a random order, but never beyond this core.
 */
const CORE_MIN_FILE = 2; // c
const CORE_MAX_FILE = 5; // f
const CORE_MIN_RANK = 3;
const CORE_MAX_RANK = 6;

const files = "abcdefgh";

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

export function createCollapseSeed(): number {
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

function randomDelay(seed: number, collapseCount: number, ply: number): number {
  const random = mulberry32(mixSeed(seed, collapseCount, ply, 0xc011a95e));

  return (
    COLLAPSE_MIN_DELAY_MOVES +
    Math.floor(
      random() * (COLLAPSE_MAX_DELAY_MOVES - COLLAPSE_MIN_DELAY_MOVES + 1),
    )
  );
}

export function createInitialCollapseLives(): CollapseKingLives {
  return {
    w: COLLAPSE_KING_MAX_LIVES,
    b: COLLAPSE_KING_MAX_LIVES,
  };
}

export function createInitialCollapseState(
  seed = createCollapseSeed(),
): CollapseState {
  return {
    seed,
    bounds: {
      minFile: 0,
      maxFile: 7,
      minRank: 1,
      maxRank: 8,
    },
    collapsedSquares: [],
    warningEdge: null,
    warningSquares: [],
    warningMovesRemaining: 0,
    movesUntilWarning: randomDelay(seed, 0, 0),
    collapseCount: 0,
    lastImpactSquares: [],
  };
}

export function cloneCollapseState(state: CollapseState): CollapseState {
  return {
    ...state,
    bounds: { ...state.bounds },
    collapsedSquares: [...state.collapsedSquares],
    warningSquares: [...state.warningSquares],
    lastImpactSquares: [...state.lastImpactSquares],
  };
}

export function cloneCollapseLives(
  lives: CollapseKingLives,
): CollapseKingLives {
  return { ...lives };
}

export function isSquareInsideCollapseBounds(
  square: Square,
  bounds: CollapseBounds,
): boolean {
  const file = files.indexOf(square[0]);
  const rank = Number(square[1]);

  return (
    file >= bounds.minFile &&
    file <= bounds.maxFile &&
    rank >= bounds.minRank &&
    rank <= bounds.maxRank
  );
}

export function filterMovesForCollapse<T extends { to: Square }>(
  moves: T[],
  bounds: CollapseBounds,
): T[] {
  return moves.filter((move) => isSquareInsideCollapseBounds(move.to, bounds));
}

export function getAvailableCollapseEdges(
  bounds: CollapseBounds,
): CollapseEdge[] {
  const result: CollapseEdge[] = [];

  if (bounds.minFile < CORE_MIN_FILE) result.push("left");
  if (bounds.maxFile > CORE_MAX_FILE) result.push("right");
  if (bounds.minRank < CORE_MIN_RANK) result.push("bottom");
  if (bounds.maxRank > CORE_MAX_RANK) result.push("top");

  return result;
}

export function collapseCoreReached(bounds: CollapseBounds): boolean {
  return getAvailableCollapseEdges(bounds).length === 0;
}

export function collapseEdgeLabel(edge: CollapseEdge | null): string {
  if (edge === "left") return "Left file";
  if (edge === "right") return "Right file";
  if (edge === "bottom") return "Bottom rank";
  if (edge === "top") return "Top rank";
  return "";
}

function countPiecesOnCollapseEdge(
  game: Chess,
  bounds: CollapseBounds,
  edge: CollapseEdge,
): number {
  return getCollapseEdgeSquares(bounds, edge).reduce(
    (count, square) => count + (game.get(square) ? 1 : 0),
    0,
  );
}

function chooseCollapseEdge(
  game: Chess,
  state: CollapseState,
  completedPly: number,
): CollapseEdge | null {
  const available = getAvailableCollapseEdges(state.bounds);

  if (available.length === 0) return null;

  /*
   * Fair-collapse rule:
   * avoid deleting a heavily occupied home rank when a much safer edge
   * exists. At the initial position ranks 1 and 8 contain eight pieces,
   * while files a and h contain four, so the first warning cannot wipe
   * out an entire back rank. As players evacuate an edge, it naturally
   * becomes more likely to be selected.
   */
  const occupancy = available.map((edge) => {
    const squares = getCollapseEdgeSquares(state.bounds, edge);

    return {
      edge,
      pieces: countPiecesOnCollapseEdge(game, state.bounds, edge),
      squareCount: squares.length,
    };
  });

  /*
   * Prefer edges that are at most half occupied. This prevents an early
   * rank-1/rank-8 wipeout while side files are still substantially safer.
   * If every possible edge is crowded, fall back to the least occupied
   * edge so the collapse can still progress.
   */
  const notMajorityOccupied = occupancy.filter(
    (entry) => entry.pieces * 2 <= entry.squareCount,
  );

  const pool =
    notMajorityOccupied.length > 0
      ? notMajorityOccupied
      : occupancy.filter((entry) => {
          const lightest = Math.min(...occupancy.map((item) => item.pieces));
          return entry.pieces === lightest;
        });

  const fairCandidates = pool.map((entry) => entry.edge);

  const random = mulberry32(
    mixSeed(state.seed, state.collapseCount, completedPly, 0xed63),
  );

  return fairCandidates[Math.floor(random() * fairCandidates.length)];
}

export function getCollapseEdgeSquares(
  bounds: CollapseBounds,
  edge: CollapseEdge,
): Square[] {
  const squares: Square[] = [];

  if (edge === "left" || edge === "right") {
    const fileIndex = edge === "left" ? bounds.minFile : bounds.maxFile;

    for (let rank = bounds.minRank; rank <= bounds.maxRank; rank += 1) {
      squares.push(`${files[fileIndex]}${rank}` as Square);
    }

    return squares;
  }

  const rank = edge === "bottom" ? bounds.minRank : bounds.maxRank;

  for (let file = bounds.minFile; file <= bounds.maxFile; file += 1) {
    squares.push(`${files[file]}${rank}` as Square);
  }

  return squares;
}

function shrinkBounds(
  bounds: CollapseBounds,
  edge: CollapseEdge,
): CollapseBounds {
  if (edge === "left") {
    return { ...bounds, minFile: bounds.minFile + 1 };
  }

  if (edge === "right") {
    return { ...bounds, maxFile: bounds.maxFile - 1 };
  }

  if (edge === "bottom") {
    return { ...bounds, minRank: bounds.minRank + 1 };
  }

  return { ...bounds, maxRank: bounds.maxRank - 1 };
}

function squareFileIndex(square: Square): number {
  return files.indexOf(square[0]);
}

function squareRank(square: Square): number {
  return Number(square[1]);
}

function squareFromBoardIndices(row: number, column: number): Square {
  return `${files[column]}${8 - row}` as Square;
}

function pieceAttacksSquare(
  game: Chess,
  from: Square,
  piece: { type: CollapsePieceType; color: CollapseSide },
  target: Square,
  bounds: CollapseBounds,
): boolean {
  if (!isSquareInsideCollapseBounds(from, bounds)) return false;
  if (!isSquareInsideCollapseBounds(target, bounds)) return false;

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

  if (!canSlide) return false;

  const stepFile = df === 0 ? 0 : df > 0 ? 1 : -1;
  const stepRank = dr === 0 ? 0 : dr > 0 ? 1 : -1;

  let fileIndex = fromFile + stepFile;
  let rank = fromRank + stepRank;

  while (fileIndex !== targetFile || rank !== targetRank) {
    const between = `${files[fileIndex]}${rank}` as Square;

    if (game.get(between)) return false;

    fileIndex += stepFile;
    rank += stepRank;
  }

  return true;
}

export function isCollapseSquareAttacked(
  game: Chess,
  target: Square,
  bySide: CollapseSide,
  bounds: CollapseBounds,
): boolean {
  const board = game.board();

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = board[row][column];

      if (!piece || piece.color !== bySide) continue;

      const from = squareFromBoardIndices(row, column);

      if (
        pieceAttacksSquare(
          game,
          from,
          {
            type: piece.type as CollapsePieceType,
            color: piece.color as CollapseSide,
          },
          target,
          bounds,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function adjacentSquares(square: Square, bounds: CollapseBounds): Square[] {
  const originFile = squareFileIndex(square);
  const originRank = squareRank(square);
  const result: Square[] = [];

  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (df === 0 && dr === 0) continue;

      const file = originFile + df;
      const rank = originRank + dr;

      if (
        file < bounds.minFile ||
        file > bounds.maxFile ||
        rank < bounds.minRank ||
        rank > bounds.maxRank
      ) {
        continue;
      }

      result.push(`${files[file]}${rank}` as Square);
    }
  }

  return result;
}

function relocateKingAfterCollapse(
  game: Chess,
  color: CollapseSide,
  from: Square,
  bounds: CollapseBounds,
): Square | null {
  const original = game.get(from);

  if (!original || original.type !== "k" || original.color !== color) {
    return null;
  }

  /*
   * Emergency evacuation is deliberately only ONE king step. The king
   * cannot teleport across the surviving board. If every adjacent
   * surviving square is occupied or attacked, the king is trapped in
   * the collapsing danger zone and the game ends immediately.
   */
  game.remove(from);

  const enemy: CollapseSide = color === "w" ? "b" : "w";

  const candidates = adjacentSquares(from, bounds).filter(
    (square) => !game.get(square),
  );

  for (const candidate of candidates) {
    game.put({ type: "k", color }, candidate);

    const attacked = isCollapseSquareAttacked(game, candidate, enemy, bounds);

    if (!attacked) {
      return candidate;
    }

    game.remove(candidate);
  }

  game.put({ type: "k", color }, from);
  return null;
}

function stripCastlingRights(game: Chess, rightsToRemove: Set<string>) {
  if (rightsToRemove.size === 0) return;

  const parts = game.fen().split(" ");
  let rights = parts[2];

  for (const right of rightsToRemove) {
    rights = rights.replace(right, "");
  }

  parts[2] = rights || "-";
  game.load(parts.join(" "));
}

function collapseCurrentEdge(
  game: Chess,
  state: CollapseState,
  lives: CollapseKingLives,
  completedPly: number,
): CollapseAdvanceResult {
  if (!state.warningEdge) {
    return {
      state: cloneCollapseState(state),
      lives: cloneCollapseLives(lives),
      outcome: null,
      kingHits: [],
      trappedKings: [],
      relocatedKings: [],
      destroyedPieces: [],
      collapsedNow: [],
    };
  }

  const edge = state.warningEdge;
  const collapseSquares = getCollapseEdgeSquares(state.bounds, edge);
  const collapseSet = new Set(collapseSquares);
  const nextBounds = shrinkBounds(state.bounds, edge);
  const nextLives = cloneCollapseLives(lives);

  const kingHits: CollapseSide[] = [];
  const kingSquares = new Map<CollapseSide, Square>();
  const destroyedPieces: CollapseDestroyedPiece[] = [];
  const trappedKings: CollapseSide[] = [];
  const relocatedKings: CollapseKingRelocation[] = [];
  const rightsToRemove = new Set<string>();

  for (const square of collapseSquares) {
    const piece = game.get(square);

    if (!piece) continue;

    const type = piece.type as CollapsePieceType;
    const color = piece.color as CollapseSide;

    if (type === "k") {
      kingHits.push(color);
      kingSquares.set(color, square);
      nextLives[color] = Math.max(0, nextLives[color] - 1);

      if (color === "w") {
        rightsToRemove.add("K");
        rightsToRemove.add("Q");
      } else {
        rightsToRemove.add("k");
        rightsToRemove.add("q");
      }

      continue;
    }

    destroyedPieces.push({ square, type, color });
    game.remove(square);

    if (square === "a1") rightsToRemove.add("Q");
    if (square === "h1") rightsToRemove.add("K");
    if (square === "a8") rightsToRemove.add("q");
    if (square === "h8") rightsToRemove.add("k");
  }

  /*
   * A king hit by the collapse loses one life. If it still has lives, it
   * may emergency-evacuate by ONE legal king step into the surviving
   * board. No adjacent legal escape means immediate elimination, even if
   * collapse lives remain.
   */
  for (const color of ["w", "b"] as CollapseSide[]) {
    const from = kingSquares.get(color);

    if (!from || nextLives[color] <= 0) continue;

    const destination = relocateKingAfterCollapse(
      game,
      color,
      from,
      nextBounds,
    );

    if (destination) {
      relocatedKings.push({ color, from, to: destination });
    } else {
      trappedKings.push(color);
    }
  }

  const whiteOut = nextLives.w <= 0 || trappedKings.includes("w");
  const blackOut = nextLives.b <= 0 || trappedKings.includes("b");

  let outcome: CollapseOutcome = null;

  if (whiteOut && blackOut) outcome = "draw";
  else if (whiteOut) outcome = "black";
  else if (blackOut) outcome = "white";

  stripCastlingRights(game, rightsToRemove);

  const nextCollapseCount = state.collapseCount + 1;
  const nextAvailable = getAvailableCollapseEdges(nextBounds);

  const nextState: CollapseState = {
    seed: state.seed,
    bounds: nextBounds,
    collapsedSquares: [
      ...state.collapsedSquares,
      ...collapseSquares.filter(
        (square) => !state.collapsedSquares.includes(square),
      ),
    ],
    warningEdge: null,
    warningSquares: [],
    warningMovesRemaining: 0,
    movesUntilWarning:
      nextAvailable.length > 0
        ? randomDelay(state.seed, nextCollapseCount, completedPly)
        : 0,
    collapseCount: nextCollapseCount,
    lastImpactSquares: collapseSquares,
  };

  /* Prevent an unused variable warning in strict projects while documenting intent. */
  void collapseSet;

  return {
    state: nextState,
    lives: nextLives,
    outcome,
    kingHits,
    trappedKings,
    relocatedKings,
    destroyedPieces,
    collapsedNow: collapseSquares,
  };
}

export function advanceCollapseAfterMove(
  game: Chess,
  state: CollapseState,
  lives: CollapseKingLives,
  completedPly: number,
): CollapseAdvanceResult {
  const next = cloneCollapseState(state);
  next.lastImpactSquares = [];

  if (collapseCoreReached(next.bounds)) {
    next.movesUntilWarning = 0;
    next.warningEdge = null;
    next.warningSquares = [];
    next.warningMovesRemaining = 0;

    return {
      state: next,
      lives: cloneCollapseLives(lives),
      outcome: null,
      kingHits: [],
      trappedKings: [],
      relocatedKings: [],
      destroyedPieces: [],
      collapsedNow: [],
    };
  }

  if (next.warningEdge) {
    const warningMovesRemaining = next.warningMovesRemaining - 1;

    if (warningMovesRemaining > 0) {
      next.warningMovesRemaining = warningMovesRemaining;

      return {
        state: next,
        lives: cloneCollapseLives(lives),
        outcome: null,
        kingHits: [],
        trappedKings: [],
        relocatedKings: [],
        destroyedPieces: [],
        collapsedNow: [],
      };
    }

    return collapseCurrentEdge(game, next, lives, completedPly);
  }

  const movesUntilWarning = Math.max(0, next.movesUntilWarning - 1);

  if (movesUntilWarning > 0) {
    next.movesUntilWarning = movesUntilWarning;

    return {
      state: next,
      lives: cloneCollapseLives(lives),
      outcome: null,
      kingHits: [],
      trappedKings: [],
      relocatedKings: [],
      destroyedPieces: [],
      collapsedNow: [],
    };
  }

  const warningEdge = chooseCollapseEdge(game, next, completedPly);

  if (!warningEdge) {
    next.movesUntilWarning = 0;

    return {
      state: next,
      lives: cloneCollapseLives(lives),
      outcome: null,
      kingHits: [],
      trappedKings: [],
      relocatedKings: [],
      destroyedPieces: [],
      collapsedNow: [],
    };
  }

  next.warningEdge = warningEdge;
  next.warningSquares = getCollapseEdgeSquares(next.bounds, warningEdge);
  next.warningMovesRemaining = COLLAPSE_WARNING_MOVES;
  next.movesUntilWarning = 0;

  return {
    state: next,
    lives: cloneCollapseLives(lives),
    outcome: null,
    kingHits: [],
    trappedKings: [],
    relocatedKings: [],
    destroyedPieces: [],
    collapsedNow: [],
  };
}

export function findCollapseKingSquare(
  game: Chess,
  color: CollapseSide,
): Square | null {
  const board = game.board();

  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      const piece = board[row][column];

      if (piece?.type === "k" && piece.color === color) {
        return squareFromBoardIndices(row, column);
      }
    }
  }

  return null;
}

export function getCollapseChessOutcome(
  game: Chess,
  bounds: CollapseBounds,
): CollapseOutcome {
  const legalMoves = filterMovesForCollapse(
    game.moves({ verbose: true }).map((move) => ({ to: move.to as Square })),
    bounds,
  );

  if (legalMoves.length === 0) {
    if (game.isCheck()) {
      return game.turn() === "w" ? "black" : "white";
    }

    return "draw";
  }

  if (game.isInsufficientMaterial()) return "draw";
  if (game.isDrawByFiftyMoves()) return "draw";

  return null;
}

export function repetitionKeyForCollapse(fen: string): string {
  return fen.split(" ").slice(0, 4).join(" ");
}

export function isThreefoldCollapse(
  previousFens: string[],
  currentFen: string,
): boolean {
  const counts = new Map<string, number>();

  const add = (fen: string) => {
    const key = repetitionKeyForCollapse(fen);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  previousFens.forEach(add);
  add(currentFen);

  return [...counts.values()].some((count) => count >= 3);
}
