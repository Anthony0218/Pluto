import { applyMove, getLegalMoves } from "./game.ts";
import { generateCandidates } from "./movement.ts";
import { areAllies, createPosition, getDefinition, opponentsOf } from "./position.ts";
import { searchBestMove } from "./search.ts";
import type { GameState, GameVariant, Move, TeamId } from "./types.ts";

/**
 * Lightweight players for simulations. They only ever use the custom rule
 * engine — a standard-chess engine cannot understand arbitrary variants.
 */
export type AiKind = "random" | "greedy" | "strategist" | "master";

export const AI_KINDS: { id: AiKind; label: string; description: string }[] = [
  { id: "random", label: "Random", description: "Plays a random legal move." },
  { id: "greedy", label: "Tactician", description: "Grabs material, avoids hanging pieces, takes wins when it sees them." },
  { id: "strategist", label: "Strategist", description: "Searches about three moves ahead with alpha-beta pruning." },
  { id: "master", label: "Master", description: "Deep iterative search using its full thinking time; plays to the variant's own win conditions." },
];

/** Search budgets for the searching levels. */
export const SEARCH_LEVELS: Record<"strategist" | "master", { maxDepth: number; timeMs: number }> = {
  strategist: { maxDepth: 3, timeMs: 900 },
  master: { maxDepth: 8, timeMs: 2500 },
};

function material(variant: GameVariant, state: GameState, team: TeamId) {
  return state.pieces.filter((piece) => areAllies(variant, piece.team, team)).reduce((sum, piece) => sum + Math.min(getDefinition(variant, piece.type)?.value ?? 1, 50), 0);
}

/** Highest value the opponents could capture next move (pseudo-legal, cheap). */
function worstThreat(variant: GameVariant, state: GameState, team: TeamId) {
  const position = createPosition(variant, state);
  let worst = 0;
  for (const piece of state.pieces) {
    if (areAllies(variant, piece.team, team)) continue;
    for (const hit of generateCandidates(position, piece, { capturesOnly: true })) {
      for (const id of hit.captureIds) {
        const victim = state.pieces.find((entry) => entry.id === id);
        if (victim && areAllies(variant, victim.team, team)) worst = Math.max(worst, Math.min(getDefinition(variant, victim.type)?.value ?? 1, 50));
      }
    }
  }
  return worst;
}

function scoreMove(variant: GameVariant, state: GameState, move: Move, team: TeamId, random: () => number) {
  const after = applyMove(variant, state, move);
  if (after.result) {
    if (after.result.winners.includes(team) && !after.result.draw) return 100_000;
    if (after.result.draw) return -50;
    return -100_000;
  }
  const opponents = opponentsOf(variant, after, team).filter((id, index, all) => !all.slice(0, index).some((other) => areAllies(variant, id, other)));
  const balance = material(variant, after, team) - opponents.reduce((sum, opponent) => sum + material(variant, after, opponent), 0);
  const tempo = after.turn === team ? 0.5 : 0;
  return balance * 10 - worstThreat(variant, after, team) * 8 + tempo + random() * 2;
}

export function chooseAiMove(variant: GameVariant, state: GameState, kind: AiKind, random: () => number = Math.random): Move | null {
  const moves = getLegalMoves(variant, state);
  if (!moves.length) return null;
  if (kind === "random") return moves[Math.floor(random() * moves.length)];
  if (kind === "strategist" || kind === "master") return searchBestMove(variant, state, { ...SEARCH_LEVELS[kind], random }).move;
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreMove(variant, state, move, state.turn, random);
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
