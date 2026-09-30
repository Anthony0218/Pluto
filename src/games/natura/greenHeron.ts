import type { Player, Vec } from "./naturaData";

export type HeronInput = {
  x: number;
  y: number;
  bait: boolean;
  strike: boolean;
};

export type Fish = Vec & {
  vx: number;
  vy: number;
  size: number;
};

export type Bait = Vec & {
  age: number;
};

export type HeronGame = {
  phase: "ready" | "playing" | "paused" | "finished";
  time: number;
  players: [
    { x: number; y: number; score: number; facing: number },
    { x: number; y: number; score: number; facing: number },
  ];
  fish: Fish[];
  bait: Bait | null;
  winner: Player | null;
  notice: string;
};

export const HERON_W = 960;
export const HERON_H = 540;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export const createHeronGame = (): HeronGame => ({
  phase: "ready",
  time: 40,
  players: [
    { x: 170, y: 420, score: 0, facing: -1 },
    { x: 790, y: 420, score: 0, facing: 1 },
  ],
  fish: Array.from({ length: 11 }, (_, index) => ({
    x: 220 + (index % 5) * 130,
    y: 120 + Math.floor(index / 5) * 100,
    vx: (Math.random() - 0.5) * 30,
    vy: (Math.random() - 0.5) * 30,
    size: 12 + (index % 3) * 4,
  })),
  bait: null,
  winner: null,
  notice: "Place bait in the pond, then strike when fish gather within reach.",
});

export const idleHeronInput = (): HeronInput => ({
  x: 0,
  y: 0,
  bait: false,
  strike: false,
});

export const updateHeronGame = (
  game: HeronGame,
  inputs: [HeronInput, HeronInput],
  dt: number,
  ai: boolean,
) => {
  if (game.phase !== "playing" || dt <= 0) return;

  const actual: [HeronInput, HeronInput] = [
    inputs[0],
    ai ? idleHeronInput() : inputs[1],
  ];
  game.time = Math.max(0, game.time - dt);

  for (const [index, player] of game.players.entries()) {
    const input = actual[index as Player];
    const move = Math.hypot(input.x, input.y) || 1;
    const normalizedX = input.x / move;
    const normalizedY = input.y / move;
    const speed = 150;
    player.x = clamp(player.x + normalizedX * speed * dt, 60, HERON_W - 60);
    player.y = clamp(player.y + normalizedY * speed * dt, 360, HERON_H - 60);
    if (Math.abs(input.x) + Math.abs(input.y) > 0.1)
      player.facing = input.x >= 0 ? 1 : -1;

    if (input.bait) {
      const x = clamp(player.x + player.facing * 80, 100, HERON_W - 100);
      const y = clamp(player.y - 50, 100, HERON_H - 100);
      game.bait = { x, y, age: 0 };
      game.notice =
        index === 0
          ? "Coral sets the bait and watches the fish."
          : "Gold sets the bait and watches the fish.";
    }

    if (input.strike && game.bait) {
      const fish = game.fish
        .map((item) => ({ item, distance: distance(item, game.bait!) }))
        .sort((a, b) => a.distance - b.distance)[0];
      if (fish && fish.distance < 65) {
        player.score += 1;
        game.notice =
          index === 0
            ? "Coral strikes and collects a fish."
            : "Gold strikes and collects a fish.";
        const [target] = game.fish.splice(game.fish.indexOf(fish.item), 1);
        if (target) {
          target.x = 120 + Math.random() * (HERON_W - 240);
          target.y = 90 + Math.random() * 200;
          game.fish.push(target);
        }
        game.bait = null;
      } else {
        game.notice =
          index === 0
            ? "Coral strikes too early. The bait drifts away."
            : "Gold strikes too early. The bait drifts away.";
      }
    }
  }

  if (game.bait) {
    game.bait.age += dt;
    game.bait.x += Math.sin(game.bait.age * 1.6) * 12 * dt;
    game.bait.y += Math.cos(game.bait.age * 2.2) * 9 * dt;
    if (game.bait.age > 8) game.bait = null;
  }

  for (const fish of game.fish) {
    if (game.bait) {
      const dx = game.bait.x - fish.x;
      const dy = game.bait.y - fish.y;
      const len = Math.hypot(dx, dy) || 1;
      fish.vx += (dx / len) * 18 * dt;
      fish.vy += (dy / len) * 18 * dt;
    }

    fish.x += fish.vx * dt;
    fish.y += fish.vy * dt;
    fish.vx *= 0.995;
    fish.vy *= 0.995;

    if (fish.x < 35 || fish.x > HERON_W - 35) fish.vx *= -0.9;
    if (fish.y < 60 || fish.y > HERON_H - 60) fish.vy *= -0.9;
    fish.x = clamp(fish.x, 40, HERON_W - 40);
    fish.y = clamp(fish.y, 60, HERON_H - 60);
  }

  if (game.time <= 0) {
    const scores = game.players.map((player) => player.score);
    game.winner =
      scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1;
    game.phase = "finished";
    game.notice =
      game.winner === null
        ? "Both herons catch the same number of fish; draw."
        : `${game.winner === 0 ? "Coral" : "Gold"} wins the pond battle.`;
  }
};
