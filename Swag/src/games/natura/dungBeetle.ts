import type { Player, Vec } from "./naturaData";

export type BeetleInput = {
  left: boolean;
  right: boolean;
  accelerate: boolean;
  brake: boolean;
  recenter: boolean;
};

export type BeetleBall = Vec & {
  vx: number;
  vy: number;
  heading: number;
  angle: number;
  lives: number;
  score: number;
};

export type Cloud = {
  x: number;
  y: number;
  scale: number;
  opacity: number;
};

export type BeetleObstacle = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BeetleGame = {
  phase: "ready" | "playing" | "paused" | "finished";
  time: number;
  players: [BeetleBall, BeetleBall];
  obstacles: BeetleObstacle[];
  clouds: Cloud[];
  finishX: number;
  winner: Player | null;
  notice: string;
};

export const DUNG_W = 960;
export const DUNG_H = 540;

const maker = (x: number, y: number): BeetleBall => ({
  x,
  y,
  vx: 0,
  vy: 0,
  heading: 0,
  angle: 0,
  lives: 3,
  score: 0,
});

export const createDungBeetleGame = (): BeetleGame => ({
  phase: "ready",
  time: 45,
  players: [maker(110, 270), maker(820, 270)],
  obstacles: [
    { x: 240, y: 140, w: 90, h: 160 },
    { x: 420, y: 300, w: 110, h: 120 },
    { x: 620, y: 120, w: 70, h: 180 },
  ],
  clouds: [
    { x: 180, y: 110, scale: 1, opacity: 0.7 },
    { x: 520, y: 195, scale: 1.3, opacity: 0.5 },
    { x: 760, y: 120, scale: 0.8, opacity: 0.65 },
  ],
  finishX: 860,
  winner: null,
  notice:
    "Keep the straight path. The sky map helps; the clouds are the trick.",
});

export const idleBeetleInput = (): BeetleInput => ({
  left: false,
  right: false,
  accelerate: false,
  brake: false,
  recenter: false,
});

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const rectHit = (ball: BeetleBall, obstacle: BeetleObstacle) =>
  ball.x + 20 > obstacle.x &&
  ball.x - 20 < obstacle.x + obstacle.w &&
  ball.y + 20 > obstacle.y &&
  ball.y - 20 < obstacle.y + obstacle.h;

export const updateDungBeetleGame = (
  game: BeetleGame,
  inputs: [BeetleInput, BeetleInput],
  dt: number,
  ai: boolean,
) => {
  if (game.phase !== "playing" || dt <= 0) return;

  const actual: [BeetleInput, BeetleInput] = [
    inputs[0],
    ai ? idleBeetleInput() : inputs[1],
  ];
  game.time = Math.max(0, game.time - dt);

  for (const [index, player] of game.players.entries()) {
    const input = actual[index as Player];
    if (input.left) player.heading -= 2.5 * dt;
    if (input.right) player.heading += 2.5 * dt;
    if (input.accelerate) {
      player.vx += Math.cos(player.heading) * 170 * dt;
      player.vy += Math.sin(player.heading) * 170 * dt;
    }
    if (input.brake) {
      player.vx *= 0.92;
      player.vy *= 0.92;
    }
    if (input.recenter) {
      player.heading = 0;
      game.notice =
        index === 0
          ? "Coral re-centres on the Milky Way."
          : "Gold re-centres on the Milky Way.";
    }

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 200) {
      player.vx = (player.vx / speed) * 200;
      player.vy = (player.vy / speed) * 200;
    }

    player.x = clamp(player.x + player.vx * dt, 28, DUNG_W - 28);
    player.y = clamp(player.y + player.vy * dt, 28, DUNG_H - 28);
    player.angle = Math.atan2(player.vy, player.vx) || player.angle;

    for (const obstacle of game.obstacles) {
      if (rectHit(player, obstacle)) {
        player.x = clamp(player.x - player.vx * dt * 2, 28, DUNG_W - 28);
        player.y = clamp(player.y - player.vy * dt * 2, 28, DUNG_H - 28);
        player.vx *= -0.45;
        player.vy *= -0.45;
        player.lives = Math.max(0, player.lives - 1);
        game.notice =
          index === 0
            ? "Coral clips the obstacle and loses a heart."
            : "Gold clips the obstacle and loses a heart.";
      }
    }

    const distanceToFinish = Math.abs(player.x - game.finishX);
    if (distanceToFinish < 30 && Math.abs(player.y - DUNG_H / 2) < 40) {
      player.score += 1;
      game.notice =
        index === 0
          ? "Coral reaches the finish line."
          : "Gold reaches the finish line.";
      game.phase = "finished";
      game.winner =
        player.score > 0 && game.players[(1 - index) as Player].score === 0
          ? (index as Player)
          : null;
      return;
    }
  }

  for (const cloud of game.clouds) {
    cloud.x += dt * 10;
    if (cloud.x > DUNG_W + 100) cloud.x = -200;
  }

  if (game.time <= 0) {
    const scores = game.players.map((player) => player.score);
    game.winner =
      scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
    game.phase = "finished";
    game.notice =
      game.winner === null
        ? "Both beetles finish the same run; draw."
        : `${game.winner === 0 ? "Coral" : "Gold"} keeps the straighter line.`;
  }
};
