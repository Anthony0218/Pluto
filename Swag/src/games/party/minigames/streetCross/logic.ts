import type { MinigameInput } from "../../types.ts";
import type { MinigameCreateContext, Random } from "../types.ts";
import {
  FINISH_ROW,
  STREET_CROSS_CONFIG as CONFIG,
  type VehicleKind,
} from "./config.ts";

// Server-authoritative road race. Traffic is fully deterministic after creation (constant speeds), so
// clients draw it from the lane table without per-frame updates, and nobody — human or bot — can know
// anything the others cannot see. Clients send only a movement direction; the server integrates it,
// checks collisions and decides who finished first.

export interface Vehicle {
  kind: VehicleKind;
  length: number;
  offset: number;
}
export interface Lane {
  row: number;
  speed: number;
  vehicles: Vehicle[];
}
export interface Runner {
  x: number;
  y: number;
  dx: number;
  dy: number;
  checkpointRow: number;
  bestY: number;
  hits: number;
  stunnedUntil: number;
  invulnerableUntil: number;
  finishedAt: number | null;
}
export interface StreetBotPlan {
  nextAt: number;
  dy: number;
  // Safe row the bot has committed to reaching (null while deciding).
  commitRow: number | null;
  commitHits: number;
}
export interface StreetCrossState {
  startedAt: number;
  endsAt: number;
  simTime: number;
  lanes: Lane[];
  runners: Record<string, Runner>;
  bots: Record<string, StreetBotPlan>;
}
export interface StreetCrossInput {
  type: "MOVE";
  dx: number;
  dy: number;
}
export type StreetCrossView = Omit<StreetCrossState, "bots">;

const W = CONFIG.width,
  PERIOD = W + CONFIG.offscreen * 2,
  R = CONFIG.player.radius;
const round3 = (v: number) => Math.round(v * 1000) / 1000;

function createLane(spec: (typeof CONFIG.lanes)[number], random: Random): Lane {
  const kinds = Array.from(
    { length: spec.count },
    () => spec.kinds[Math.min(spec.kinds.length - 1, Math.floor(random() * spec.kinds.length))],
  );
  const lengths = kinds.map((k) => CONFIG.vehicleLength[k]);
  // Guaranteed gaps: every gap is at least minGap; leftover road is spread randomly between them.
  const slack = Math.max(0, PERIOD - lengths.reduce((a, b) => a + b, 0) - spec.count * CONFIG.minGap);
  const shares = kinds.map(() => random()),
    total = shares.reduce((a, b) => a + b, 0) || 1;
  let cursor = random() * PERIOD;
  const vehicles = kinds.map((kind, i) => {
    const vehicle = { kind, length: lengths[i], offset: round3(cursor % PERIOD) };
    cursor += lengths[i] + CONFIG.minGap + (slack * shares[i]) / total;
    return vehicle;
  });
  const jitter = 1 + (random() * 2 - 1) * CONFIG.speedJitter;
  return { row: spec.row, speed: round3(spec.speed * jitter), vehicles };
}

// Left edge of a vehicle `elapsedMs` after the start. Shared by server, client and bots.
export function vehicleX(lane: Lane, vehicle: Vehicle, elapsedMs: number): number {
  const travelled = vehicle.offset + (lane.speed * Math.max(0, elapsedMs)) / 1000;
  return (((travelled % PERIOD) + PERIOD) % PERIOD) - CONFIG.offscreen;
}

export function laneHitsBox(
  lane: Lane,
  elapsedMs: number,
  x: number,
  halfWidth: number,
): boolean {
  return lane.vehicles.some((v) => {
    const left = vehicleX(lane, v, elapsedMs);
    return x + halfWidth > left && x - halfWidth < left + v.length;
  });
}

export function createStreetCross({
  participants,
  startedAt,
  endsAt,
  random,
}: MinigameCreateContext): StreetCrossState {
  if (participants.length !== 2) throw new Error("Street Cross needs exactly two players.");
  return {
    startedAt,
    endsAt,
    simTime: startedAt,
    lanes: CONFIG.lanes.map((spec) => createLane(spec, random)),
    runners: Object.fromEntries(
      participants.map((p, i) => [
        p.id,
        {
          x: CONFIG.player.startX[i],
          y: 0.5,
          dx: 0,
          dy: 0,
          checkpointRow: 0,
          bestY: 0.5,
          hits: 0,
          stunnedUntil: 0,
          invulnerableUntil: 0,
          finishedAt: null,
        },
      ]),
    ),
    bots: {},
  };
}

export function parseStreetInput(input: MinigameInput): StreetCrossInput | null {
  if (
    input.type !== "MOVE" ||
    typeof input.dx !== "number" ||
    typeof input.dy !== "number" ||
    !Number.isFinite(input.dx) ||
    !Number.isFinite(input.dy) ||
    Object.keys(input).length !== 3
  )
    return null;
  let dx = Math.max(-1, Math.min(1, input.dx)),
    dy = Math.max(-1, Math.min(1, input.dy));
  const length = Math.hypot(dx, dy);
  if (length > 1) {
    dx /= length;
    dy /= length;
  }
  return { type: "MOVE", dx: round3(dx), dy: round3(dy) };
}

export const isFinishedStreet = (state: StreetCrossState) =>
  Object.values(state.runners).some((r) => r.finishedAt !== null);

export function applyStreetInput(
  state: StreetCrossState,
  playerId: string,
  input: StreetCrossInput,
  at: number,
) {
  const runner = state.runners[playerId];
  if (!runner) throw new Error("You are not playing this duel.");
  if (isFinishedStreet(state) || at < state.startedAt || at >= state.endsAt)
    throw new Error("Street Cross is not running.");
  runner.dx = input.dx;
  runner.dy = input.dy;
}

function hitByTraffic(state: StreetCrossState, runner: Runner, elapsedMs: number): boolean {
  return state.lanes.some(
    (lane) =>
      runner.y + R * 0.8 > lane.row + 0.12 &&
      runner.y - R * 0.8 < lane.row + 0.88 &&
      laneHitsBox(lane, elapsedMs, runner.x, R),
  );
}

function step(state: StreetCrossState, at: number) {
  const dt = CONFIG.stepMs / 1000,
    elapsed = at - state.startedAt;
  for (const runner of Object.values(state.runners)) {
    if (runner.finishedAt !== null || at < runner.stunnedUntil) continue;
    runner.x = Math.min(W - R, Math.max(R, runner.x + runner.dx * CONFIG.player.speed * dt));
    runner.y = Math.max(R, runner.y + runner.dy * CONFIG.player.speed * dt);
    const row = Math.floor(runner.y);
    if (CONFIG.rows[row] === "safe" && row > runner.checkpointRow) runner.checkpointRow = row;
    runner.bestY = Math.max(runner.bestY, runner.y);
    if (runner.y >= FINISH_ROW) {
      runner.y = FINISH_ROW + 0.5;
      runner.finishedAt = at;
      continue;
    }
    if (at >= runner.invulnerableUntil && hitByTraffic(state, runner, elapsed)) {
      runner.hits++;
      runner.y = runner.checkpointRow + 0.5;
      runner.stunnedUntil = at + CONFIG.hitStunMs;
      runner.invulnerableUntil = at + CONFIG.invulnerableMs;
    }
  }
}

export function tickStreetCross(state: StreetCrossState, now: number): boolean {
  const until = Math.min(now, state.endsAt);
  let changed = false;
  while (!isFinishedStreet(state) && state.simTime + CONFIG.stepMs <= until) {
    state.simTime += CONFIG.stepMs;
    step(state, state.simTime);
    changed = true;
  }
  return changed;
}

// First finisher wins; otherwise furthest up the course, then fewer hits, then server random.
export function rankStreetCross(
  state: StreetCrossState,
  participants: readonly string[],
  random: Random,
): string[] {
  const tiebreak = new Map(participants.map((id) => [id, random()]));
  const finish = (id: string) => state.runners[id]?.finishedAt ?? Infinity;
  return [...participants].sort(
    (a, b) =>
      finish(a) - finish(b) ||
      (state.runners[b]?.y ?? 0) - (state.runners[a]?.y ?? 0) ||
      (state.runners[a]?.hits ?? 0) - (state.runners[b]?.hits ?? 0) ||
      tiebreak.get(b)! - tiebreak.get(a)!,
  );
}

export function streetCrossView(state: StreetCrossState): StreetCrossView {
  const view: StreetCrossView & Partial<StreetCrossState> = structuredClone(state);
  delete view.bots;
  return view;
}
