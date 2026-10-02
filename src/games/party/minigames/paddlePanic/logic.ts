import type { MinigameInput } from "../../types.ts";
import type { MinigameCreateContext, Random } from "../types.ts";
import { PADDLE_PANIC_CONFIG as CONFIG } from "./config.ts";

// Server-authoritative paddle duel. The server simulates the ball in fixed steps; clients only send the
// height they want their paddle at, and the paddle moves there at a capped speed (no teleporting).

export type PaddleSide = "left" | "right";
export interface PaddleState {
  side: PaddleSide;
  y: number;
  targetY: number;
  returns: number;
}
export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface PaddleBotPlan {
  nextAt: number;
  approachKey: string;
  error: number;
}
export interface PaddlePanicState {
  startedAt: number;
  endsAt: number;
  simTime: number;
  sides: Record<PaddleSide, string>;
  paddles: Record<string, PaddleState>;
  scores: Record<string, number>;
  ball: Ball;
  // The ball waits at the centre until serveAt (null while in play).
  serveAt: number | null;
  serveToward: PaddleSide;
  // Hidden, pre-drawn serve angles (the server's random source is not available inside tick).
  serveAngles: number[];
  serveIndex: number;
  winnerId: string | null;
  finishedAt: number | null;
  lastPoint: { scorerId: string; at: number } | null;
  bots: Record<string, PaddleBotPlan>;
}
export interface PaddlePanicInput {
  type: "PADDLE";
  y: number;
}
export type PaddlePanicView = Omit<PaddlePanicState, "serveAngles" | "serveIndex" | "bots">;

const { width: W, height: H } = CONFIG.field;
const HALF = CONFIG.paddle.height / 2;
const clampPaddle = (y: number) => Math.min(H - HALF, Math.max(HALF, y));
export const paddleX = (side: PaddleSide) =>
  side === "left" ? CONFIG.paddle.inset : W - CONFIG.paddle.inset;

export function serveSpeed(state: PaddlePanicState, at: number): number {
  return (
    CONFIG.ball.serveSpeed +
    (Math.max(0, at - state.startedAt) / 1000) * CONFIG.ball.serveSpeedPerSecond
  );
}

export function createPaddlePanic({
  participants,
  startedAt,
  endsAt,
  random,
}: MinigameCreateContext): PaddlePanicState {
  const [left, right] = participants.map((p) => p.id);
  if (!left || !right || participants.length !== 2)
    throw new Error("Paddle Panic needs exactly two players.");
  const paddle = (side: PaddleSide): PaddleState => ({
    side,
    y: H / 2,
    targetY: H / 2,
    returns: 0,
  });
  return {
    startedAt,
    endsAt,
    simTime: startedAt,
    sides: { left, right },
    paddles: { [left]: paddle("left"), [right]: paddle("right") },
    scores: { [left]: 0, [right]: 0 },
    ball: { x: W / 2, y: H / 2, vx: 0, vy: 0 },
    serveAt: startedAt + CONFIG.ball.serveDelayMs,
    serveToward: random() < 0.5 ? "left" : "right",
    serveAngles: Array.from(
      { length: 16 },
      () => Math.round((random() * 2 - 1) * CONFIG.ball.maxServeAngle * 1000) / 1000,
    ),
    serveIndex: 0,
    winnerId: null,
    finishedAt: null,
    lastPoint: null,
    bots: {},
  };
}

export function parsePaddleInput(input: MinigameInput): PaddlePanicInput | null {
  return input.type === "PADDLE" &&
    typeof input.y === "number" &&
    Number.isFinite(input.y) &&
    Object.keys(input).length === 2
    ? { type: "PADDLE", y: Math.min(1, Math.max(0, input.y)) }
    : null;
}

export function applyPaddleInput(
  state: PaddlePanicState,
  playerId: string,
  input: PaddlePanicInput,
  at: number,
) {
  const paddle = state.paddles[playerId];
  if (!paddle) throw new Error("You are not playing this duel.");
  if (state.winnerId || at < state.startedAt || at >= state.endsAt)
    throw new Error("Paddle Panic is not running.");
  paddle.targetY = clampPaddle(input.y * H);
}

function bounceOff(state: PaddlePanicState, side: PaddleSide) {
  const id = state.sides[side],
    paddle = state.paddles[id],
    ball = state.ball,
    r = CONFIG.ball.radius;
  const offset = Math.max(-1, Math.min(1, (ball.y - paddle.y) / (HALF + r)));
  const angle = offset * CONFIG.ball.maxBounceAngle,
    speed = Math.min(CONFIG.ball.maxSpeed, Math.hypot(ball.vx, ball.vy) + CONFIG.ball.speedUpPerHit),
    dir = side === "left" ? 1 : -1;
  ball.vx = dir * Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed;
  ball.x = paddleX(side) + dir * (CONFIG.paddle.width / 2 + r);
  paddle.returns++;
}

function score(state: PaddlePanicState, scorer: PaddleSide, at: number) {
  const scorerId = state.sides[scorer];
  state.scores[scorerId]++;
  state.lastPoint = { scorerId, at };
  state.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  if (state.scores[scorerId] >= CONFIG.pointsToWin) {
    state.winnerId = scorerId;
    state.finishedAt = at;
    state.serveAt = null;
    return;
  }
  // The player who conceded receives the next serve.
  state.serveToward = scorer === "left" ? "right" : "left";
  state.serveAt = at + CONFIG.ball.serveDelayMs;
}

function step(state: PaddlePanicState, at: number) {
  const dt = CONFIG.stepMs / 1000,
    r = CONFIG.ball.radius,
    face = CONFIG.paddle.width / 2;
  for (const paddle of Object.values(state.paddles)) {
    const delta = paddle.targetY - paddle.y,
      max = CONFIG.paddle.maxSpeed * dt;
    paddle.y = clampPaddle(paddle.y + Math.max(-max, Math.min(max, delta)));
  }
  if (state.serveAt !== null) {
    if (at < state.serveAt) return;
    const angle = state.serveAngles[state.serveIndex++ % state.serveAngles.length],
      speed = serveSpeed(state, at),
      dir = state.serveToward === "left" ? -1 : 1;
    state.ball.vx = dir * Math.cos(angle) * speed;
    state.ball.vy = Math.sin(angle) * speed;
    state.serveAt = null;
  }
  const ball = state.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y < r) {
    ball.y = r;
    ball.vy = Math.abs(ball.vy);
  } else if (ball.y > H - r) {
    ball.y = H - r;
    ball.vy = -Math.abs(ball.vy);
  }
  for (const side of ["left", "right"] as const) {
    const x = paddleX(side),
      paddle = state.paddles[state.sides[side]],
      incoming = side === "left" ? ball.vx < 0 : ball.vx > 0,
      reached = side === "left" ? ball.x - r <= x + face : ball.x + r >= x - face,
      notPast = side === "left" ? ball.x >= x - face : ball.x <= x + face;
    if (incoming && reached && notPast && Math.abs(ball.y - paddle.y) <= HALF + r)
      bounceOff(state, side);
  }
  if (ball.x + r < 0) score(state, "right", at);
  else if (ball.x - r > W) score(state, "left", at);
}

// Advances the simulation in fixed steps up to `now`. Deterministic for a given input history.
export function tickPaddlePanic(state: PaddlePanicState, now: number): boolean {
  const until = Math.min(now, state.endsAt);
  let changed = false;
  while (!state.winnerId && state.simTime + CONFIG.stepMs <= until) {
    state.simTime += CONFIG.stepMs;
    step(state, state.simTime);
    changed = true;
  }
  return changed;
}

// Winner (first to 3) first; at the time limit higher score, then more returns, then server random.
export function rankPaddlePanic(
  state: PaddlePanicState,
  participants: readonly string[],
  random: Random,
): string[] {
  const tiebreak = new Map(participants.map((id) => [id, random()]));
  return [...participants].sort(
    (a, b) =>
      Number(b === state.winnerId) - Number(a === state.winnerId) ||
      (state.scores[b] ?? 0) - (state.scores[a] ?? 0) ||
      (state.paddles[b]?.returns ?? 0) - (state.paddles[a]?.returns ?? 0) ||
      tiebreak.get(b)! - tiebreak.get(a)!,
  );
}

export function paddlePanicView(state: PaddlePanicState): PaddlePanicView {
  const view: PaddlePanicView & Partial<PaddlePanicState> = structuredClone(state);
  delete view.serveAngles;
  delete view.serveIndex;
  delete view.bots;
  return view;
}

// Where the ball crosses x = targetX, folding wall reflections. Used by bots and client prediction.
export function predictBallY(ball: Ball, targetX: number): number | null {
  if (ball.vx === 0 || Math.sign(targetX - ball.x) !== Math.sign(ball.vx)) return null;
  const r = CONFIG.ball.radius,
    span = H - 2 * r,
    raw = ball.y - r + ball.vy * ((targetX - ball.x) / ball.vx),
    folded = ((raw % (2 * span)) + 2 * span) % (2 * span);
  return r + (folded <= span ? folded : 2 * span - folded);
}
