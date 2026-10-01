import { boardLayers, getCell, getLayer } from "./board.ts";
import { applyMove, getLegalMoves } from "./game.ts";
import { areAllies, getDefinition, isFarRank } from "./position.ts";
import type { Coord, GameState, GameVariant, Move, PieceInstance, TeamId } from "./types.ts";

/**
 * Engine-agnostic game-tree search. It never assumes standard chess: every
 * node is produced by the custom rule engine's own legal-move generator and
 * `applyMove`, so custom pieces, tiles, events and victory conditions are all
 * respected. Opponents are searched "paranoid" style (all other teams minimise
 * the searching team's score), which also handles extra turns and N teams.
 */
export interface SearchOptions {
  maxDepth: number;
  /** Wall-clock budget; the deepest completed iteration is used. */
  timeMs: number;
  /** Extra capture-only plies at the horizon to avoid obvious blunders. */
  quiescenceDepth?: number;
  random?: () => number;
  now?: () => number;
}

export interface SearchResult {
  move: Move | null;
  score: number;
  depth: number;
  nodes: number;
}

const WIN = 1_000_000;
const ABORT = Symbol("search-abort");

interface TableEntry {
  depth: number;
  score: number;
  flag: "exact" | "lower" | "upper";
  best?: string;
}

const moveKey = (move: Move) => `${move.pieceId}>${move.to.x},${move.to.y}${move.promotion ?? ""}${move.castle ? "c" : ""}`;

function stateKey(state: GameState) {
  let key = `${state.turn}|${state.royalMode}|${state.suddenDeath ? 1 : 0}|${state.enPassant ? `${state.enPassant.square.x},${state.enPassant.square.y},${state.enPassant.square.z ?? 0}` : "-"}|${state.scheduled.length}|${state.eliminated.join(",")}`;
  for (const piece of state.pieces) key += `|${piece.id}${piece.type}${piece.team}${piece.x},${piece.y},${piece.z ?? 0}${piece.moveCount ? "m" : ""}`;
  return key;
}

/** Static evaluation in centipawn-like units, from `team`'s point of view. */
export function evaluatePosition(variant: GameVariant, state: GameState, team: TeamId): number {
  if (state.result) {
    if (state.result.draw || !state.result.winners.length) return 0;
    return state.result.winners.includes(team) ? WIN - state.ply : -WIN + state.ply;
  }
  const { width, height } = state.board;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  const goalWinners = variant.victoryConditions.filter((condition) => condition.enabled && (condition.type === "reachZone" || condition.type === "reachSquare"));
  const goals: { coord: Coord; team?: string; pieceType?: string }[] = [];
  for (const condition of goalWinners) {
    if (condition.type === "reachSquare" && condition.square) goals.push({ coord: condition.square, team: condition.team, pieceType: condition.pieceType });
    if (condition.type === "reachZone")
      for (const layer of boardLayers(state.board)) for (const cell of layer.cells) if (cell.enabled && cell.tile === "goal") goals.push({ coord: { x: cell.x, y: cell.y, z: layer.z }, team: cell.team ?? condition.team, pieceType: condition.pieceType });
  }

  let score = 0;
  for (const piece of state.pieces) {
    const def = getDefinition(variant, piece.type);
    const sign = areAllies(variant, piece.team, team) ? 1 : -1;
    let value = Math.min(def?.value ?? 1, def?.royal ? 20 : 60) * 100;
    if (!def?.royal) {
      // Central pieces control more squares in almost every variant.
      value += (Math.max(cx, cy) - Math.max(Math.abs(piece.x - cx), Math.abs(piece.y - cy))) * (def?.promotion ? 3 : 8);
      // Only the last stretch toward promotion is worth much; early pushes are not.
      if (def?.promotion) value += promotionProgress(variant, state, piece) ** 3 * 160;
    }
    for (const goal of goals) {
      if ((goal.team && goal.team !== "any" && goal.team !== piece.team) || (goal.pieceType && goal.pieceType !== piece.type)) continue;
      const distance = Math.max(Math.abs(piece.x - goal.coord.x), Math.abs(piece.y - goal.coord.y), Math.abs((piece.z ?? 0) - (goal.coord.z ?? 0)));
      value += Math.max(0, Math.max(width, height) - distance) * 12;
    }
    score += sign * value;
  }
  return score;
}

/** 0..1: how far a promotable piece has travelled toward its promotion zone. */
function promotionProgress(variant: GameVariant, state: GameState, piece: PieceInstance) {
  const forward = variant.teams.find((entry) => entry.id === piece.team)?.forward ?? { x: 0, y: 1 };
  const { width, height } = getLayer(state.board, piece.z ?? 0) ?? state.board;
  if (isFarRank(variant, state, piece.team, piece)) return 1;
  if (forward.y > 0) return piece.y / (height - 1);
  if (forward.y < 0) return (height - 1 - piece.y) / (height - 1);
  if (forward.x > 0) return piece.x / (width - 1);
  return (width - 1 - piece.x) / (width - 1);
}

function orderMoves(variant: GameVariant, state: GameState, moves: Move[], best?: string) {
  const valueOf = (id: string) => getDefinition(variant, state.pieces.find((piece) => piece.id === id)?.type ?? "")?.value ?? 1;
  const scored = moves.map((move) => {
    let priority = 0;
    if (best && moveKey(move) === best) priority += 1e6;
    for (const id of move.captureIds) priority += valueOf(id) * 100 - valueOf(move.pieceId);
    if (move.promotion) priority += (getDefinition(variant, move.promotion)?.value ?? 1) * 90;
    if (move.landing) priority += 5;
    const cell = getCell(state.board, move.landing ?? move.to);
    if (cell?.tile === "goal") priority += 300;
    return { move, priority };
  });
  return scored.sort((a, b) => b.priority - a.priority).map((entry) => entry.move);
}

export function searchBestMove(variant: GameVariant, root: GameState, options: SearchOptions): SearchResult {
  const now = options.now ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const deadline = now() + options.timeMs;
  const team = root.turn;
  const quiescenceDepth = options.quiescenceDepth ?? 3;
  const table = new Map<string, TableEntry>();
  let nodes = 0;

  const tick = () => {
    nodes += 1;
    if ((nodes & 63) === 0 && now() > deadline) throw ABORT;
  };

  function quiesce(state: GameState, alpha: number, beta: number, depth: number): number {
    tick();
    const standPat = evaluatePosition(variant, state, team);
    if (state.result || depth <= 0) return standPat;
    const maximizing = areAllies(variant, state.turn, team);
    if (maximizing) {
      if (standPat >= beta) return standPat;
      alpha = Math.max(alpha, standPat);
    } else {
      if (standPat <= alpha) return standPat;
      beta = Math.min(beta, standPat);
    }
    const captures = orderMoves(variant, state, getLegalMoves(variant, state, { capturesOnly: true }));
    let best = standPat;
    for (const move of captures) {
      const score = quiesce(applyMove(variant, state, move), alpha, beta, depth - 1);
      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, score);
      }
      if (alpha >= beta) break;
    }
    return best;
  }

  function search(state: GameState, depth: number, alpha: number, beta: number): number {
    tick();
    if (state.result) return evaluatePosition(variant, state, team);
    if (depth <= 0) return quiesce(state, alpha, beta, quiescenceDepth);

    const key = stateKey(state);
    const cached = table.get(key);
    if (cached && cached.depth >= depth) {
      if (cached.flag === "exact") return cached.score;
      if (cached.flag === "lower") alpha = Math.max(alpha, cached.score);
      else beta = Math.min(beta, cached.score);
      if (alpha >= beta) return cached.score;
    }

    const moves = orderMoves(variant, state, getLegalMoves(variant, state), cached?.best);
    if (!moves.length) return evaluatePosition(variant, state, team);
    const maximizing = areAllies(variant, state.turn, team);
    const alphaStart = alpha;
    const betaStart = beta;
    let best = maximizing ? -Infinity : Infinity;
    let bestKey: string | undefined;
    for (const move of moves) {
      const score = search(applyMove(variant, state, move), depth - 1, alpha, beta);
      if (maximizing ? score > best : score < best) {
        best = score;
        bestKey = moveKey(move);
      }
      if (maximizing) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) break;
    }
    const flag = best <= alphaStart ? "upper" : best >= betaStart ? "lower" : "exact";
    table.set(key, { depth, score: best, flag, best: bestKey });
    return best;
  }

  const rootMoves = getLegalMoves(variant, root);
  if (!rootMoves.length) return { move: null, score: evaluatePosition(variant, root, team), depth: 0, nodes };
  let bestMove = rootMoves[0];
  let bestScore = -Infinity;
  let completedDepth = 0;
  let ordered = orderMoves(variant, root, rootMoves);

  for (let depth = 1; depth <= options.maxDepth; depth++) {
    try {
      let iterationBest = ordered[0];
      let iterationScore = -Infinity;
      const scores = new Map<Move, number>();
      for (const move of ordered) {
        // Tiny jitter keeps equally good moves from always being played the same way.
        const score = search(applyMove(variant, root, move), depth - 1, iterationScore, Infinity) + random() * 3;
        scores.set(move, score);
        if (score > iterationScore) {
          iterationScore = score;
          iterationBest = move;
        }
      }
      bestMove = iterationBest;
      bestScore = iterationScore;
      completedDepth = depth;
      ordered = [...ordered].sort((a, b) => (scores.get(b) ?? -Infinity) - (scores.get(a) ?? -Infinity));
      if (bestScore > WIN / 2) break; // A forced win was found; no need to look deeper.
    } catch (error) {
      if (error !== ABORT) throw error;
      break;
    }
  }
  return { move: bestMove, score: bestScore, depth: completedDepth, nodes };
}
