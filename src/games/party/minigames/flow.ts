import { DUEL_FLOW, MAIN_MINIGAME_REWARDS, MINIGAME_FLOW } from "../config.ts";
import { emit, log } from "../engine/events.ts";
import { bumpStat } from "../engine/stats.ts";
import type {
  Match,
  MinigameInput,
  MinigamePosition,
  MinigameResult,
  MinigameRuntime,
} from "../types.ts";
import { minigameRegistry } from "./index.ts";
import { selectMinigame, type MinigameRegistry } from "./registry.ts";
import type {
  MinigameDefinition,
  MinigameParticipant,
  Random,
} from "./types.ts";

// Glue between the board phases and the minigame modules. It only handles ids, participants, timing,
// completion and rankings; everything game-specific goes through the definition's hooks.

export const MINIGAME_PHASES = [
  "MINIGAME_INTRO",
  "MINIGAME",
  "MINIGAME_RESULTS",
] as const;
export function isMinigamePhase(phase: Match["phase"]): boolean {
  return (MINIGAME_PHASES as readonly string[]).includes(phase);
}
// Duel Saber duels reuse the same runtime inside the active player's turn, in their own phases so they
// can never be confused with the end-of-round minigame (no placement rewards, no round change).
export const DUEL_PHASES = ["DUEL_INTRO", "DUEL_MINIGAME", "DUEL_RESULTS"] as const;
export function isDuelPhase(phase: Match["phase"]): boolean {
  return (DUEL_PHASES as readonly string[]).includes(phase);
}
// Phases in which the minigame screen replaces the board.
export function isMinigameScreenPhase(phase: Match["phase"]): boolean {
  return isMinigamePhase(phase) || isDuelPhase(phase);
}
// Phases in which the running minigame accepts input.
export function isMinigamePlayPhase(phase: Match["phase"]): boolean {
  return phase === "MINIGAME" || phase === "DUEL_MINIGAME";
}

function participantsOf(state: Match, ids: readonly string[]) {
  return ids.map((id): MinigameParticipant => {
    const p = state.players.find((player) => player.id === id)!;
    return { id, isBot: p.isBot, difficulty: p.difficulty };
  });
}

// Shared by main minigames and duels: one runtime shape, one set of hooks.
function createRuntime(
  state: Match,
  definition: MinigameDefinition,
  participants: string[],
  introMs: number,
  random: Random,
  now: number,
) {
  const startedAt = now + introMs,
    endsAt = startedAt + definition.durationSeconds * 1000;
  state.minigame = {
    minigameId: definition.id,
    participants,
    status: "INTRO",
    introStartedAt: now,
    startedAt,
    endsAt,
    resultsEndsAt: null,
    state: definition.create({
      participants: participantsOf(state, participants),
      startedAt,
      endsAt,
      random,
    }),
    results: null,
    rewards: null,
    rewardsApplied: false,
  };
}

export function startMinigame(
  state: Match,
  minigameId: string,
  random: Random,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
) {
  const definition = registry.get(minigameId);
  if (definition.gameType !== "main")
    throw new Error(`${definition.name} is not a main minigame.`);
  createRuntime(state, definition, [...state.order], MINIGAME_FLOW.introMs, random, now);
  state.phase = "MINIGAME_INTRO";
  log(state, `Minigame time: ${definition.name}!`);
}

// Server-side pick from the duel pool only; main minigames can never be chosen for a duel.
export function selectDuelMinigame(
  previousId: string | null,
  random: Random,
  registry: MinigameRegistry = minigameRegistry,
): string {
  return selectMinigame(registry.pool("duel"), previousId, random);
}

// Starts a two-player duel minigame inside the active player's turn (phase DUEL_INTRO).
export function startDuelMinigame(
  state: Match,
  minigameId: string,
  participants: readonly [string, string],
  random: Random,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
) {
  const definition = registry.get(minigameId);
  if (definition.gameType !== "duel")
    throw new Error(`${definition.name} is not a duel minigame.`);
  createRuntime(state, definition, [...participants], DUEL_FLOW.introMs, random, now);
  state.phase = "DUEL_INTRO";
}

// Advances a realtime minigame's own simulation to `now`. `finished` covers early completion and time.
export function simulateMinigame(
  state: Match,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
): { changed: boolean; finished: boolean } {
  const runtime = state.minigame;
  if (!runtime) return { changed: false, finished: false };
  const definition = registry.get(runtime.minigameId);
  const changed =
    definition.tick?.(runtime.state, Math.min(now, runtime.endsAt)) ?? false;
  return {
    changed,
    finished:
      now >= runtime.endsAt || (definition.isFinished?.(runtime.state) ?? false),
  };
}

// Called when the Animal Phase is over. The server alone chooses the minigame.
export function beginMinigamePhase(
  state: Match,
  random: Random,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
) {
  const id = selectMinigame(
    registry.pool("main"),
    state.lastMinigameId,
    random,
  );
  startMinigame(state, id, random, now, registry);
}

export function toResults(
  ranking: readonly string[],
  scores: Record<string, number>,
): MinigameResult[] {
  if (new Set(ranking).size !== ranking.length || ranking.length > 4)
    throw new Error("A minigame ranking must list each participant once.");
  return ranking.map((playerId, i) => ({
    playerId,
    position: (i + 1) as MinigamePosition,
    score: scores[playerId],
  }));
}

export function rewardFor(position: MinigamePosition): number {
  return MAIN_MINIGAME_REWARDS[position];
}

// Freezes and ranks the running minigame once. Rewards are not part of this: main minigames pay
// placement rewards, duels settle their wager instead.
export function concludeMinigame(
  state: Match,
  random: Random,
  now: number,
  resultsMs: number,
  registry: MinigameRegistry = minigameRegistry,
) {
  const runtime = state.minigame;
  if (!runtime) throw new Error("No minigame is running.");
  if (runtime.status === "FINISHED") return;
  const definition = registry.get(runtime.minigameId);
  runtime.status = "FINISHED";
  runtime.results = toResults(
    definition.rank(runtime.state, runtime.participants, random),
    definition.scores(runtime.state),
  );
  runtime.resultsEndsAt = now + resultsMs;
  log(
    state,
    `${definition.name} is over! ${state.players.find((p) => p.id === runtime.results![0].playerId)!.name} wins.`,
  );
}

// Freezes the main minigame, ranks it and pays rewards. Idempotent: rewards are applied exactly once.
export function finishMinigame(
  state: Match,
  random: Random,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
) {
  if (state.minigame && registry.get(state.minigame.minigameId).gameType !== "main")
    throw new Error("Duels never pay main minigame rewards.");
  concludeMinigame(state, random, now, MINIGAME_FLOW.resultsMs, registry);
  applyMinigameRewards(state);
  state.phase = "MINIGAME_RESULTS";
}

export function applyMinigameRewards(state: Match) {
  const runtime = state.minigame;
  if (!runtime?.results || runtime.rewardsApplied) return;
  runtime.rewards = {};
  bumpStat(state, runtime.results[0].playerId, "minigameWins");
  for (const result of runtime.results) {
    const amount = rewardFor(result.position),
      player = state.players.find((p) => p.id === result.playerId)!;
    player.coins += amount;
    runtime.rewards[result.playerId] = amount;
    if (amount > 0)
      emit(state, {
        kind: "MINIGAME_REWARD",
        playerId: player.id,
        amount,
        text: `${player.name.toUpperCase()} +${amount} COINS`,
      });
  }
  runtime.rewardsApplied = true;
}

// Winner first; everyone else keeps their previous relative order.
export function nextRoundOrder(
  order: readonly string[],
  winnerId: string,
): string[] {
  if (!order.includes(winnerId)) return [...order];
  return [winnerId, ...order.filter((id) => id !== winnerId)];
}

// Validates one client/bot input. Returns a new state; throws on any rejection.
export function applyMinigameInput(
  current: Match,
  playerId: string,
  input: MinigameInput,
  at: number,
  registry: MinigameRegistry = minigameRegistry,
): Match {
  const runtime = current.minigame;
  if (!isMinigamePlayPhase(current.phase) || runtime?.status !== "ACTIVE")
    throw new Error("No minigame is accepting input right now.");
  if (at < runtime.startedAt || at >= runtime.endsAt)
    throw new Error("The minigame is not running.");
  if (!runtime.participants.includes(playerId))
    throw new Error("You are not playing this minigame.");
  const definition = registry.get(runtime.minigameId),
    parsed = definition.parseInput(input);
  if (parsed === null) throw new Error("Invalid minigame input.");
  const state = structuredClone(current),
    live = state.minigame!.state;
  // Realtime games first simulate up to the moment of the input, so it applies to the current world.
  definition.tick?.(live, at);
  if (definition.isFinished?.(live)) throw new Error("The minigame is over.");
  definition.applyInput(live, playerId, parsed, at);
  return state;
}

// Runs each bot's minigame controller. `accepted` counts bot inputs that passed validation, so the
// caller knows whether players can see a change. Bot planning state is kept either way.
export function stepMinigameBots(
  current: Match,
  now: number,
  random: Random,
  registry: MinigameRegistry = minigameRegistry,
): { match: Match; accepted: number } {
  const runtime = current.minigame;
  if (!isMinigamePlayPhase(current.phase) || runtime?.status !== "ACTIVE")
    return { match: current, accepted: 0 };
  const definition = registry.get(runtime.minigameId);
  const bots = participantsOf(current, runtime.participants).filter(
    (p) => p.isBot,
  );
  if (!definition.botInputs || !bots.length)
    return { match: current, accepted: 0 };
  const state = structuredClone(current),
    live = state.minigame!;
  let accepted = 0;
  for (const bot of bots)
    for (const { input, at } of definition.botInputs(
      live.state,
      bot,
      now,
      random,
    ))
      try {
        if (at < live.startedAt || at >= live.endsAt) continue;
        definition.tick?.(live.state, at);
        if (definition.isFinished?.(live.state)) continue;
        definition.applyInput(live.state, bot.id, input, at);
        accepted++;
      } catch {
        // A late or invalid bot tap is rejected exactly like a human's.
      }
  return { match: state, accepted };
}

// Network-safe copy of the runtime: minigame state is reduced to its public view.
export function publicMinigameView(
  runtime: MinigameRuntime,
  now: number,
  registry: MinigameRegistry = minigameRegistry,
): MinigameRuntime {
  return {
    ...runtime,
    state: registry.get(runtime.minigameId).publicView(runtime.state, now),
    serverNow: now,
  };
}
