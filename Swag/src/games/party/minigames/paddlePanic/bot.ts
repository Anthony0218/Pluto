import type { MinigameParticipant, Random, TimedInput } from "../types.ts";
import { PADDLE_PANIC_CONFIG as CONFIG } from "./config.ts";
import {
  paddleX,
  predictBallY,
  type PaddlePanicInput,
  type PaddlePanicState,
} from "./logic.ts";

const gauss = (random: Random) =>
  Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(2 * Math.PI * random());

// Paddle Panic bot: every `reactionMs` it re-reads the visible ball (position and velocity, exactly what
// players see), predicts where it will cross its paddle and moves there. The misjudgement is drawn once
// per approach, so an error is a consistent misread rather than jitter. Its paddle obeys the same speed
// cap as a human's, and its input goes through the same validation.
export function paddlePanicBotInputs(
  state: PaddlePanicState,
  bot: MinigameParticipant,
  now: number,
  random: Random,
): TimedInput<PaddlePanicInput>[] {
  const paddle = state.paddles[bot.id];
  if (!paddle || state.winnerId) return [];
  const profile = CONFIG.bots[bot.difficulty];
  const plan = (state.bots[bot.id] ??= { nextAt: now, approachKey: "", error: 0 });
  if (now < plan.nextAt) return [];
  plan.nextAt = now + profile.reactionMs * (0.8 + random() * 0.4);
  const { width: W, height: H } = CONFIG.field;
  const x = paddleX(paddle.side),
    ball = state.ball,
    distance = Math.abs(x - ball.x) / W;
  const predicted =
    state.serveAt === null && distance <= profile.trackFrom ? predictBallY(ball, x) : null;
  let targetY: number;
  if (predicted !== null) {
    const key = `${state.scores[state.sides.left]}-${state.scores[state.sides.right]}-${Object.values(state.paddles).reduce((n, p) => n + p.returns, 0)}`;
    if (key !== plan.approachKey) {
      plan.approachKey = key;
      plan.error = gauss(random) * profile.errorUnits;
    }
    targetY = predicted + plan.error;
  } else targetY = H / 2 + (paddle.targetY - H / 2) * 0.5;
  const y = Math.min(1, Math.max(0, targetY / H));
  if (Math.abs(y * H - paddle.targetY) < 0.05) return [];
  return [{ input: { type: "PADDLE", y: Math.round(y * 1000) / 1000 }, at: now }];
}
