import type { Difficulty } from "../../types.ts";

export type VehicleKind = "bike" | "car" | "truck" | "bus";
export type RowKind = "start" | "road" | "safe" | "finish";
export interface LaneSpec {
  row: number;
  // Units per second; the direction is the sign.
  speed: number;
  kinds: readonly VehicleKind[];
  count: number;
}
export interface StreetBotProfile {
  decisionMs: number;
  // Standard deviation (seconds) of the bot's timing misjudgement.
  misjudgeSec: number;
  // Extra clearance (units) the bot wants around its pawn.
  marginUnits: number;
  // Chance, per decision while waiting at a kerb, to step out even though the gap looks unsafe.
  mistakeChance: number;
}
// Course runs bottom (row 0, start) to top (finish). Each row is one unit tall; x spans `width` units.
export const STREET_CROSS_CONFIG = {
  durationSeconds: 60,
  stepMs: 10,
  width: 12,
  rows: [
    "start",
    "road",
    "road",
    "road",
    "safe",
    "road",
    "road",
    "road",
    "safe",
    "road",
    "road",
    "finish",
  ] as readonly RowKind[],
  // Safe rows double as checkpoints: a hit respawns you on the last one you reached.
  lanes: [
    { row: 1, speed: 2.0, kinds: ["car", "bike"], count: 3 },
    { row: 2, speed: -2.6, kinds: ["truck", "car"], count: 3 },
    { row: 3, speed: 2.4, kinds: ["car", "bike"], count: 2 },
    { row: 5, speed: -3.0, kinds: ["bus", "car"], count: 3 },
    { row: 6, speed: 3.3, kinds: ["car", "bike"], count: 3 },
    { row: 7, speed: -2.8, kinds: ["truck", "car"], count: 2 },
    { row: 9, speed: 5.0, kinds: ["car", "bike"], count: 2 },
    { row: 10, speed: -5.6, kinds: ["car", "bike"], count: 2 },
  ] as readonly LaneSpec[],
  vehicleLength: { bike: 0.8, car: 1.4, truck: 2.4, bus: 3.2 } as Record<VehicleKind, number>,
  // Vehicles wrap this far outside the visible road so they never pop in on screen.
  offscreen: 3.5,
  minGap: 2.6,
  // Random ±fraction applied to each lane's speed at creation.
  speedJitter: 0.12,
  player: { speed: 2.2, radius: 0.3, startX: [4, 8] as readonly number[] },
  hitStunMs: 1200,
  invulnerableMs: 2000,
  inputIntervalMs: 80,
  snapshotIntervalMs: 100,
  bots: {
    beginner: { decisionMs: 1000, misjudgeSec: .7, marginUnits: .02, mistakeChance: .12 },
    easy: { decisionMs: 750, misjudgeSec: .45, marginUnits: .05, mistakeChance: .05 },
    medium: { decisionMs: 540, misjudgeSec: .315, marginUnits: .12, mistakeChance: .03 },
    hard: { decisionMs: 330, misjudgeSec: .18, marginUnits: .2, mistakeChance: .015 },
    extreme: { decisionMs: 60, misjudgeSec: .005, marginUnits: .14, mistakeChance: .0002 },
  } satisfies Record<Difficulty, StreetBotProfile>,
} as const;
export const FINISH_ROW = STREET_CROSS_CONFIG.rows.indexOf("finish");
