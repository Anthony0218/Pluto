import type { MinigameDefinition, MinigameCreateContext, Random } from "../types.ts";
import type { MinigameInput } from "../../types.ts";

export const DIRECTIONS = ["left", "up", "right", "down"] as const;
export type Direction = (typeof DIRECTIONS)[number];
export const ARROW_SYMBOLS: Record<Direction, string> = { left: "←", up: "↑", right: "→", down: "↓" };
export const MEMORY_TIMING = { move: 2400, hazard: 1100, restore: 650 };
const DELTA: Record<Direction, [number, number]> = { left: [-1, 0], up: [0, -1], right: [1, 0], down: [0, 1] };
export function arrowCount(round: number): number {
  return round === 1 ? 3 : round <= 3 ? 4 : round <= 6 ? 5 : round <= 10 ? 6 : round - 4;
}
interface MemoryPlayer {
  quadrant: number; x: number; z: number; alive: boolean; moved: boolean; score: number; eliminatedAt: number | null;
  heatSteps: number; totalSteps: number; lastCorrectAt: number;
}
interface MemoryPoint { x: number; z: number }
export function quadrantOrigin(quadrant: number): MemoryPoint { return { x: (quadrant % 2) * 5, z: Math.floor(quadrant / 2) * 5 }; }
interface MemoryBot { round: number; remembered: Direction[]; step: number }
export interface ArrowMemoryState {
  map: "ice" | "hell";
  startedAt: number; endsAt: number; round: number; step: number;
  heat: number; level: number; heatEndsAt: number; heatResults: { heat: number; ranking: string[]; points: Record<string, number> }[];
  phase: "memorize" | "move" | "hazard" | "restore" | "intermission" | "finished";
  phaseEndsAt: number; sequences: Record<string, Direction[]>; paths: Record<string, MemoryPoint[]>;
  safe: Record<string, MemoryPoint>; players: Record<string, MemoryPlayer>;
  seed: number; bots: Record<string, MemoryBot>;
}
export type ArrowMemoryView = Omit<ArrowMemoryState, "seed" | "bots" | "paths" | "sequences" | "safe"> & {
  sequence: Direction[]; arrowCount: number; safe: Record<string, MemoryPoint> | null;
};
interface MemoryInput { type: "MEMORY_STEP"; direction: Direction; round: number; step: number }
function randomStep(state: ArrowMemoryState) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
function prepareRound(state: ArrowMemoryState, at: number) {
  state.sequences = {}; state.paths = {}; state.safe = {};
  const firstArrows: Direction[] = [...DIRECTIONS];
  for (let i = firstArrows.length - 1; i > 0; i--) {
    const j = Math.floor(randomStep(state) * (i + 1));
    [firstArrows[i], firstArrows[j]] = [firstArrows[j], firstArrows[i]];
  }
  for (const [id, p] of Object.entries(state.players)) {
    const origin = quadrantOrigin(p.quadrant);
    let x = origin.x + 2, z = origin.z + 2;
    state.sequences[id] = []; state.paths[id] = []; state.safe[id] = { x, z };
    for (let i = 0; i < arrowCount(state.level); i++) {
      const legal = DIRECTIONS.filter((d) => {
        const [dx, dz] = DELTA[d];
        return x + dx >= origin.x && x + dx < origin.x + 5 && z + dz >= origin.z && z + dz < origin.z + 5;
      });
      // Distinct first arrows guarantee four different combinations, even in the easiest round.
      const direction = i === 0 ? firstArrows[p.quadrant] : legal[Math.floor(randomStep(state) * legal.length)];
      x += DELTA[direction][0]; z += DELTA[direction][1];
      state.sequences[id].push(direction); state.paths[id].push({ x, z });
    }
    if (p.alive) { p.x = origin.x + 2; p.z = origin.z + 2; p.moved = false; }
  }
  state.step = 0; state.phase = "memorize";
  state.phaseEndsAt = Math.min(state.heatEndsAt, at + 1800 + arrowCount(state.level) * 850);
}
function create(context: MinigameCreateContext): ArrowMemoryState {
  const state: ArrowMemoryState = {
    map: context.random() < 0.5 ? "ice" : "hell", startedAt: context.startedAt, endsAt: context.endsAt,
    round: 1, step: 0, phase: "memorize", phaseEndsAt: 0, sequences: {}, paths: {}, safe: {},
    heat: 1, level: 1, heatEndsAt: context.startedAt + 120_000, heatResults: [],
    seed: Math.floor(context.random() * 4294967296), bots: {},
    players: Object.fromEntries(context.participants.map((p, quadrant) => [p.id, {
      quadrant, x: 0, z: 0, alive: true, moved: false, score: 0, eliminatedAt: null,
      heatSteps: 0, totalSteps: 0, lastCorrectAt: 0,
    }])),
  };
  prepareRound(state, context.startedAt); return state;
}
function finishHeat(state: ArrowMemoryState, at: number) {
  const ties = Object.fromEntries(Object.keys(state.players).map((id) => [id, randomStep(state)]));
  const ranking = Object.keys(state.players).sort((a, b) => {
    const pa = state.players[a], pb = state.players[b];
    return Number(pb.alive) - Number(pa.alive) || pb.heatSteps - pa.heatSteps ||
      (pb.eliminatedAt ?? at) - (pa.eliminatedAt ?? at) || pa.lastCorrectAt - pb.lastCorrectAt || ties[b] - ties[a];
  });
  const points = Object.fromEntries(ranking.map((id, i) => [id, Math.max(0, 3 - i)]));
  for (const id of ranking) state.players[id].score += points[id];
  state.heatResults.push({ heat: state.heat, ranking, points });
  state.phase = state.heat === 3 ? "finished" : "intermission"; state.phaseEndsAt = at + 3500;
}
export function tickMemory(state: ArrowMemoryState, now: number): boolean {
  let changed = false;
  while (state.phase !== "finished" && now >= state.phaseEndsAt) {
    changed = true;
    const at = state.phaseEndsAt;
    if (state.phase === "intermission") {
      state.heat++; state.level = 1; state.round++; state.heatEndsAt = at + 120_000; state.bots = {};
      for (const p of Object.values(state.players)) Object.assign(p, { alive: true, moved: false, eliminatedAt: null, heatSteps: 0, lastCorrectAt: at });
      prepareRound(state, at); continue;
    }
    if (at >= state.heatEndsAt) { finishHeat(state, at); continue; }
    if (state.phase === "memorize" || state.phase === "restore") {
      if (state.phase === "restore" && state.step === arrowCount(state.level)) {
        state.round++; state.level++; prepareRound(state, at); continue;
      }
      state.phase = "move"; state.phaseEndsAt = at + MEMORY_TIMING.move;
      for (const p of Object.values(state.players)) p.moved = false;
    } else if (state.phase === "move") {
      for (const [id, p] of Object.entries(state.players)) if (p.alive) {
        state.safe[id] = { ...state.paths[id][state.step] };
        if (p.x !== state.safe[id].x || p.z !== state.safe[id].z) { p.alive = false; p.eliminatedAt = at; }
        else { p.heatSteps++; p.totalSteps++; }
      }
      state.phase = "hazard"; state.phaseEndsAt = at + MEMORY_TIMING.hazard;
    } else {
      if (Object.values(state.players).filter((p) => p.alive).length <= 1) finishHeat(state, at);
      else { state.step++; state.phase = "restore"; state.phaseEndsAt = at + MEMORY_TIMING.restore; }
    }
    if (!(["intermission", "finished"] as string[]).includes(state.phase)) state.phaseEndsAt = Math.min(state.phaseEndsAt, state.heatEndsAt);
  }
  return changed;
}
export function parseMemoryInput(input: MinigameInput): MemoryInput | null {
  return input.type === "MEMORY_STEP" && DIRECTIONS.includes(input.direction as Direction) &&
    Number.isInteger(input.round) && Number(input.round) >= 1 && Number.isInteger(input.step) && Number(input.step) >= 0
    ? { type: "MEMORY_STEP", direction: input.direction as Direction, round: Number(input.round), step: Number(input.step) } : null;
}
function applyInput(state: ArrowMemoryState, id: string, input: MemoryInput, at: number) {
  const p = state.players[id];
  if (!p?.alive || state.phase !== "move" || at < state.startedAt || at >= state.phaseEndsAt ||
    input.round !== state.round || input.step !== state.step || p.moved) throw new Error("Wait for your next arrow step.");
  const [dx, dz] = DELTA[input.direction];
  const origin = quadrantOrigin(p.quadrant);
  if (p.x + dx < origin.x || p.x + dx >= origin.x + 5 || p.z + dz < origin.z || p.z + dz >= origin.z + 5) throw new Error("Stay inside your quadrant.");
  p.x += dx; p.z += dz; p.moved = true;
  if (input.direction === state.sequences[id][state.step]) p.lastCorrectAt = at;
}
export function memoryView(state: ArrowMemoryState, _now?: number, viewerId?: string): ArrowMemoryView {
  const players = structuredClone(state.players);
  // No copying a move while inputs are still open: opponents stay at their previous safe positions.
  if (state.phase === "move") for (const [id, p] of Object.entries(players)) if (id !== viewerId && p.alive) {
    Object.assign(p, state.safe[id]); p.moved = false; p.lastCorrectAt = 0;
  }
  return { map: state.map, startedAt: state.startedAt, endsAt: state.endsAt, round: state.round, step: state.step,
    phase: state.phase, phaseEndsAt: state.phaseEndsAt, players,
    heat: state.heat, level: state.level, heatEndsAt: state.heatEndsAt, heatResults: structuredClone(state.heatResults),
    sequence: state.phase === "memorize" && viewerId && players[viewerId]?.alive ? [...state.sequences[viewerId]] : [],
    arrowCount: arrowCount(state.level), safe: state.phase === "hazard" || state.phase === "intermission" || state.phase === "finished" ? structuredClone(state.safe) : null };
}
export const arrowMemory: MinigameDefinition<ArrowMemoryState, MemoryInput> = {
  id: "arrow-memory", name: "One Wrong Step",
  description: "Remember the arrows. One wrong square sends you into ice water or lava.",
  instructions: ["Each explorer owns a 5×5 quadrant and receives a different, private arrow sequence.",
    "Memorize your arrows, then repeat one step at a time. Other moves stay hidden until the step ends.",
    "Ice: icicles strike every wrong tile. Hell: every wrong platform disappears.",
    "Three survival rounds. Each awards 3 / 2 / 1 points to first / second / third; totals decide the winner.",
    "Everyone returns for the next round. Sequences grow harder within each round; tied survivors use correct steps and response time."],
  controls: "WASD / arrow keys or direction buttons · one press per step",
  durationSeconds: 375, gameType: "main", supportsBots: true,
  personalizedView: true,
  create, parseInput: parseMemoryInput, applyInput, tick: tickMemory,
  isFinished: (s) => s.phase === "finished", snapshotIntervalMs: 100,
  botInputs(state, bot, now, random) {
    if (!state.players[bot.id]?.alive || now < state.startedAt) return [];
    // Memorize only what humans can see; keep this imperfect recollection after the arrows disappear.
    if (state.phase === "memorize") {
      if (state.bots[bot.id]?.round !== state.round) {
        const accuracy = { easy: 0.80, medium: 0.92, hard: 0.98 }[bot.difficulty];
        state.bots[bot.id] = { round: state.round, step: -1, remembered: state.sequences[bot.id].map((d) =>
          random() < accuracy ? d : DIRECTIONS[Math.floor(random() * 4)]) };
      }
      return [];
    }
    const plan = state.bots[bot.id];
    if (state.phase !== "move" || state.players[bot.id].moved || plan?.step === state.step ||
      now < state.phaseEndsAt - MEMORY_TIMING.move + 450) return [];
    if (plan) plan.step = state.step;
    return [{ at: now, input: { type: "MEMORY_STEP", direction: plan?.remembered[state.step] ?? DIRECTIONS[Math.floor(random() * 4)],
      round: state.round, step: state.step } }];
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])),
  rank(s, ids, random: Random) {
    const ties = Object.fromEntries(ids.map((id) => [id, random()]));
    return [...ids].sort((a, b) => s.players[b].score - s.players[a].score ||
      s.players[b].totalSteps - s.players[a].totalSteps || ties[b] - ties[a]);
  },
  publicView: memoryView,
};
