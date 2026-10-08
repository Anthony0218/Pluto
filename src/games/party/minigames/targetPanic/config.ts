import type { Difficulty } from "../../types.ts";

export type TargetKind = "standard" | "golden" | "danger";
export interface TargetPanicBotProfile {
  reactionMs: readonly [number, number];
  // Chance to go for a good target at all.
  accuracy: number;
  // Chance to tap a danger target by mistake.
  mistakeChance: number;
}
// Every Target Panic tunable lives here; components and rules read from this object only.
export const TARGET_PANIC_CONFIG = {
  durationSeconds: 90,
  firstSpawnDelayMs: 400,
  spawnIntervalMs: 700,
  spawnJitterMs: 160,
  finalRushSeconds: 15,
  finalRushIntervalMs: 540,
  targetLifetimeMs: 1600,
  // Late hits are accepted this long after expiry to absorb network latency.
  hitGraceMs: 350,
  normalScore: 1,
  goldenScore: 3,
  dangerPenalty: 2,
  minScore: 0,
  goldenChance: 0.1,
  dangerChance: 0.2,
  // Minimum normalized distance between targets that are visible at the same time.
  minSpacing: 0.26,
  // Clients render targets as a square of this size inside the play field (never off-screen).
  targetSizePx: 78,
  // How far ahead of `now` the network view reveals upcoming targets.
  viewLookaheadMs: 2000,
  // Minimum time between two taps of the same bot.
  botTapGapMs: 140,
  bots: {
    beginner: { reactionMs: [950, 1400], accuracy: .4, mistakeChance: .4 },
    easy: { reactionMs: [650, 1000], accuracy: .6, mistakeChance: .25 },
    medium: { reactionMs: [500, 850], accuracy: .7, mistakeChance: .175 },
    hard: { reactionMs: [350, 700], accuracy: .8, mistakeChance: .1 },
    extreme: { reactionMs: [60, 120], accuracy: .999, mistakeChance: .001 },
  } satisfies Record<Difficulty, TargetPanicBotProfile>,
} as const;

export function targetValue(kind: TargetKind): number {
  return kind === "golden"
    ? TARGET_PANIC_CONFIG.goldenScore
    : kind === "danger"
      ? -TARGET_PANIC_CONFIG.dangerPenalty
      : TARGET_PANIC_CONFIG.normalScore;
}
