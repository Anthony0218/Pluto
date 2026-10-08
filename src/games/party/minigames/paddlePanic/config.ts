import type { Difficulty } from "../../types.ts";

export interface PaddleBotProfile {
  // Time between two decisions (paddle target updates).
  reactionMs: number;
  // Standard deviation of the predicted intercept, in field units. Never zero, so no bot is perfect.
  errorUnits: number;
  // The bot only starts tracking once the ball is within this fraction of the field from its paddle.
  trackFrom: number;
}
// Every Paddle Panic tunable. Field units: width × height; paddles move vertically on the left/right.
export const PADDLE_PANIC_CONFIG = {
  durationSeconds: 60,
  pointsToWin: 3,
  stepMs: 10,
  field: { width: 16, height: 10 },
  paddle: { height: 2.4, width: 0.45, inset: 0.8, maxSpeed: 12 },
  ball: {
    radius: 0.3,
    serveSpeed: 7,
    // Serve speed also grows with match time so late points are quicker.
    serveSpeedPerSecond: 0.05,
    speedUpPerHit: 0.55,
    maxSpeed: 16,
    serveDelayMs: 1100,
    maxServeAngle: 0.5,
    maxBounceAngle: 1.0,
  },
  // Human clients send their paddle target at most this often.
  inputIntervalMs: 70,
  snapshotIntervalMs: 100,
  bots: {
    beginner: { reactionMs: 480, errorUnits: 2.8, trackFrom: .4 },
    easy: { reactionMs: 280, errorUnits: 1.8, trackFrom: .55 },
    medium: { reactionMs: 225, errorUnits: 1.55, trackFrom: .68 },
    hard: { reactionMs: 170, errorUnits: 1.3, trackFrom: .8 },
    extreme: { reactionMs: 40, errorUnits: .1, trackFrom: 1 },
  } satisfies Record<Difficulty, PaddleBotProfile>,
} as const;
