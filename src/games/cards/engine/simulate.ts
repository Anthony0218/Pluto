/**
 * Headless bot-vs-bot runs for the Simulation tab and balance checks. Every
 * seat is played by the generic bot; results are aggregated per seat.
 */
import { chooseBotAction } from "./bot.ts";
import { createGame, performAction } from "./GameEngine.ts";
import type { GameDefinition, GameResult } from "./types.ts";

export interface SimulatedGame {
  seed: number;
  outcome: "finished" | "stalled" | "error";
  result?: GameResult;
  /** Seat index of every winner / loser. */
  winners: number[];
  losers: number[];
  actions: number;
  rounds: number;
  error?: string;
}

export function simulateGame(def: GameDefinition, options: { players: number; settings?: Record<string, unknown>; seed: number; maxActions?: number }): SimulatedGame {
  const seats = Array.from({ length: options.players }, (_, index) => ({ id: `bot-${index + 1}`, name: `Bot ${index + 1}`, isBot: true }));
  const base = { seed: options.seed, winners: [] as number[], losers: [] as number[], actions: 0, rounds: 0 };
  let state;
  try {
    state = createGame(def, { players: seats, settings: options.settings, seed: options.seed });
  } catch (error) {
    return { ...base, outcome: "error", error: error instanceof Error ? error.message : String(error) };
  }
  const limit = options.maxActions ?? 5000;
  let actions = 0;
  while (state.status === "playing" && actions < limit) {
    const current = state;
    const actor = current.players.find((player) => chooseBotAction(def, current, player.id));
    if (!actor) break;
    const result = performAction(def, current, actor.id, chooseBotAction(def, current, actor.id)!);
    if (!result.ok) return { ...base, outcome: "error", actions, rounds: current.roundNumber, error: result.error };
    state = result.state;
    actions++;
  }
  const seat = (id: string) => state.players.find((player) => player.id === id)!.seat;
  if (state.status !== "finished") return { ...base, outcome: "stalled", actions, rounds: state.roundNumber };
  return {
    ...base,
    outcome: "finished",
    result: state.result,
    winners: (state.result?.winners ?? []).map(seat),
    losers: (state.result?.losers ?? []).map(seat),
    actions,
    rounds: state.roundNumber,
  };
}

export interface SimulationSummary {
  games: number;
  finished: number;
  stalled: number;
  errors: number;
  draws: number;
  /** Per seat: games won (shared wins count for each winner) and lost. */
  seats: { wins: number; losses: number }[];
  averageActions: number;
  averageRounds: number;
  firstError?: string;
  /** How games ended, by reason text. */
  reasons: { reason: string; count: number }[];
}

export function summarizeSimulations(games: SimulatedGame[], players: number): SimulationSummary {
  const seats = Array.from({ length: players }, () => ({ wins: 0, losses: 0 }));
  const reasons = new Map<string, number>();
  for (const game of games) {
    for (const seat of game.winners) seats[seat].wins++;
    for (const seat of game.losers) seats[seat].losses++;
    // Group reasons without player names so "Bot 2 holds every card" and "Bot 1 …" count together.
    const reason = game.outcome === "finished" ? (game.result?.reason ?? "").replace(/Bot \d+( and Bot \d+)*/g, "A bot") : game.outcome;
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  const finished = games.filter((game) => game.outcome === "finished");
  const average = (pick: (game: SimulatedGame) => number) => (finished.length ? finished.reduce((sum, game) => sum + pick(game), 0) / finished.length : 0);
  return {
    games: games.length,
    finished: finished.length,
    stalled: games.filter((game) => game.outcome === "stalled").length,
    errors: games.filter((game) => game.outcome === "error").length,
    draws: finished.filter((game) => game.result?.draw).length,
    seats,
    averageActions: average((game) => game.actions),
    averageRounds: average((game) => game.rounds),
    firstError: games.find((game) => game.error)?.error,
    reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}
