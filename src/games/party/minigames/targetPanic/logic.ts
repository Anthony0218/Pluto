import type { MinigameInput } from "../../types.ts";
import type { MinigameCreateContext, Random } from "../types.ts";
import { TARGET_PANIC_CONFIG as CONFIG, targetValue } from "./config.ts";
import type { TargetKind } from "./config.ts";

// Positions are normalized 0–1 across the space left after subtracting the target size, so a target can
// never render partially off-screen whatever the field size.
export interface PanicTarget {
  id: string;
  kind: TargetKind;
  x: number;
  y: number;
  spawnAt: number;
  expiresAt: number;
}
export interface TargetPanicPlayerState {
  score: number;
  hits: number;
  goldenHits: number;
  dangerHits: number;
  // Per-player target instances: a claim never affects other players.
  claimed: string[];
}
export interface TargetPanicBotPlan {
  nextTargetIndex: number;
  lastTapAt: number;
  queue: { targetId: string; at: number }[];
}
export interface TargetPanicState {
  startedAt: number;
  endsAt: number;
  // One authoritative schedule shared by everyone, so all players face identical timing and difficulty.
  targets: PanicTarget[];
  players: Record<string, TargetPanicPlayerState>;
  bots: Record<string, TargetPanicBotPlan>;
}
export interface TargetPanicInput {
  type: "TARGET_HIT";
  targetId: string;
}
export interface TargetPanicView {
  startedAt: number;
  endsAt: number;
  targets: PanicTarget[];
  players: Record<
    string,
    Omit<TargetPanicPlayerState, "claimed"> & { claimed: string[] }
  >;
}

function pickKind(random: Random): TargetKind {
  const roll = random();
  if (roll < CONFIG.goldenChance) return "golden";
  if (roll < CONFIG.goldenChance + CONFIG.dangerChance) return "danger";
  return "standard";
}

export function generateSchedule(
  startedAt: number,
  endsAt: number,
  random: Random,
): PanicTarget[] {
  const targets: PanicTarget[] = [];
  const rushFrom = endsAt - CONFIG.finalRushSeconds * 1000;
  let at = startedAt + CONFIG.firstSpawnDelayMs;
  while (at + CONFIG.targetLifetimeMs <= endsAt) {
    const visible = targets.filter((t) => t.expiresAt > at);
    let x = random(),
      y = random();
    // Retry a few times to keep simultaneous targets apart; accept the last candidate otherwise.
    for (
      let attempt = 0;
      attempt < 12 &&
      visible.some((t) => Math.hypot(t.x - x, t.y - y) < CONFIG.minSpacing);
      attempt++
    ) {
      x = random();
      y = random();
    }
    targets.push({
      id: `t${targets.length}`,
      kind: pickKind(random),
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      spawnAt: Math.round(at),
      expiresAt: Math.round(at) + CONFIG.targetLifetimeMs,
    });
    const interval =
      at >= rushFrom ? CONFIG.finalRushIntervalMs : CONFIG.spawnIntervalMs;
    at += Math.max(
      250,
      interval + (random() * 2 - 1) * CONFIG.spawnJitterMs,
    );
  }
  return targets;
}

export function createTargetPanic({
  participants,
  startedAt,
  endsAt,
  random,
}: MinigameCreateContext): TargetPanicState {
  return {
    startedAt,
    endsAt,
    targets: generateSchedule(startedAt, endsAt, random),
    players: Object.fromEntries(
      participants.map((p) => [
        p.id,
        { score: 0, hits: 0, goldenHits: 0, dangerHits: 0, claimed: [] },
      ]),
    ),
    bots: {},
  };
}

export function parseTargetPanicInput(
  input: MinigameInput,
): TargetPanicInput | null {
  return input.type === "TARGET_HIT" &&
    typeof input.targetId === "string" &&
    /^t\d{1,4}$/.test(input.targetId)
    ? { type: "TARGET_HIT", targetId: input.targetId }
    : null;
}

// Every rejection happens before any mutation. `at` is the authoritative server time of the hit.
export function applyTargetHit(
  state: TargetPanicState,
  playerId: string,
  input: TargetPanicInput,
  at: number,
) {
  const player = state.players[playerId];
  if (!player) throw new Error("You are not playing this minigame.");
  if (at < state.startedAt || at >= state.endsAt)
    throw new Error("Target Panic is not running.");
  const target = state.targets.find((t) => t.id === input.targetId);
  if (!target) throw new Error("That target does not exist.");
  if (at < target.spawnAt) throw new Error("That target has not appeared yet.");
  if (at > target.expiresAt + CONFIG.hitGraceMs)
    throw new Error("That target already disappeared.");
  if (player.claimed.includes(target.id))
    throw new Error("You already hit that target.");
  player.claimed.push(target.id);
  player.hits++;
  if (target.kind === "golden") player.goldenHits++;
  if (target.kind === "danger") player.dangerHits++;
  player.score = Math.max(CONFIG.minScore, player.score + targetValue(target.kind));
}

// Higher score, then fewer danger hits, then a server-random tiebreaker.
export function rankTargetPanic(
  state: TargetPanicState,
  participants: readonly string[],
  random: Random,
): string[] {
  const tiebreak = new Map(participants.map((id) => [id, random()]));
  return [...participants].sort((a, b) => {
    const pa = state.players[a],
      pb = state.players[b];
    return (
      (pb?.score ?? 0) - (pa?.score ?? 0) ||
      (pa?.dangerHits ?? 0) - (pb?.dangerHits ?? 0) ||
      tiebreak.get(b)! - tiebreak.get(a)!
    );
  });
}

export function targetPanicView(
  state: TargetPanicState,
  now: number,
): TargetPanicView {
  const targets = state.targets.filter(
    (t) =>
      t.spawnAt <= now + CONFIG.viewLookaheadMs &&
      t.expiresAt + CONFIG.hitGraceMs > now,
  );
  const ids = new Set(targets.map((t) => t.id));
  return {
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    targets,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, p]) => [
        id,
        { ...p, claimed: p.claimed.filter((c) => ids.has(c)) },
      ]),
    ),
  };
}
