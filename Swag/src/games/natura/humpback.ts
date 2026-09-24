import type { Player, Vec } from "./naturaData";

export type HumpbackInput = {
  x: number;
  y: number;
  bubble: boolean;
  dive: boolean;
};

export type HumpbackFish = Vec & {
  vx: number;
  vy: number;
  phase: number;
};

export type HumpbackPlayer = Vec & {
  vx: number;
  vy: number;
  angle: number;
  score: number;
  boost: number;
  bubbleCooldown: number;
  diveCooldown: number;
};

export type HumpbackBubble = Vec & {
  age: number;
  radius: number;
  owner: Player;
};

export type HumpbackGame = {
  phase: "ready" | "playing" | "paused" | "finished";
  time: number;
  players: [HumpbackPlayer, HumpbackPlayer];
  fish: HumpbackFish[];
  bubbles: HumpbackBubble[];
  winner: Player | null;
  notice: string;
};

export const HUMPBACK_W = 960;
export const HUMPBACK_H = 540;

export const createHumpbackGame = (): HumpbackGame => ({
  phase: "ready",
  time: 45,
  players: [
    {
      x: 220,
      y: 290,
      vx: 0,
      vy: 0,
      angle: 0,
      score: 0,
      boost: 0,
      bubbleCooldown: 0,
      diveCooldown: 0,
    },
    {
      x: 740,
      y: 290,
      vx: 0,
      vy: 0,
      angle: Math.PI,
      score: 0,
      boost: 0,
      bubbleCooldown: 0,
      diveCooldown: 0,
    },
  ],
  fish: Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2;
    const r = 120 + (i % 5) * 18;
    return {
      x: 480 + Math.cos(angle) * r,
      y: 270 + Math.sin(angle) * r,
      vx: Math.cos(angle + 1.4) * 24,
      vy: Math.sin(angle + 1.4) * 24,
      phase: i * 0.7,
    };
  }),
  bubbles: [],
  winner: null,
  notice: "Bubble around the school and lunge when the shoal is dense.",
});

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

export const idleHumpbackInput = (): HumpbackInput => ({
  x: 0,
  y: 0,
  bubble: false,
  dive: false,
});

export const chooseHumpbackInput = (
  game: HumpbackGame,
  index: Player,
  ai: boolean,
): HumpbackInput => {
  if (ai && index === 1) {
    const target = game.fish.reduce((best, fish) => {
      const current = distance(game.players[1], fish);
      return current < best ? current : best;
    }, Number.POSITIVE_INFINITY);
    const chase =
      target < 230
        ? {
            x: 0,
            y: 0,
            bubble: game.time > 5 && game.players[1].bubbleCooldown <= 0.1,
            dive: target < 110,
          }
        : { x: 0, y: 0, bubble: false, dive: false };
    return chase;
  }
  return idleHumpbackInput();
};

export const updateHumpbackGame = (
  game: HumpbackGame,
  inputs: [HumpbackInput, HumpbackInput],
  dt: number,
  ai: boolean,
) => {
  if (game.phase !== "playing" || !Number.isFinite(dt) || dt <= 0) return;

  const actual: [HumpbackInput, HumpbackInput] = [
    inputs[0],
    ai ? chooseHumpbackInput(game, 1, true) : inputs[1],
  ];

  game.time = Math.max(0, game.time - dt);

  for (const [index, player] of game.players.entries()) {
    const input = actual[index as Player];
    const moveX = input.x;
    const moveY = input.y;
    const length = Math.hypot(moveX, moveY) || 1;

    player.bubbleCooldown = Math.max(0, player.bubbleCooldown - dt);
    player.diveCooldown = Math.max(0, player.diveCooldown - dt);
    player.boost = Math.max(0, player.boost - dt);

    const speed = 180;
    const dx = (moveX / length) * speed * dt;
    const dy = (moveY / length) * speed * dt;
    player.x = clamp(player.x + dx, 60, HUMPBACK_W - 60);
    player.y = clamp(player.y + dy, 60, HUMPBACK_H - 60);
    if (moveX !== 0 || moveY !== 0) {
      player.angle = Math.atan2(moveY, moveX);
    }

    if (input.bubble && player.bubbleCooldown <= 0) {
      game.bubbles.push({
        x: player.x,
        y: player.y,
        age: 0,
        radius: 20,
        owner: index as Player,
      });
      player.bubbleCooldown = 1.2;
      game.notice =
        index === 0
          ? "Coral bubbles the school and tightens the shoal."
          : "Gold circles the fish with bubbles.";
    }

    if (input.dive && player.diveCooldown <= 0) {
      const school = game.fish.filter((fish) => distance(player, fish) < 130);
      const density = school.length;
      if (density >= 3) {
        const gained = 1 + Math.floor((density - 2) / 2);
        player.score += gained;
        game.notice =
          index === 0
            ? `Coral lunges for ${gained} fish.`
            : `Gold lunges for ${gained} fish.`;
        game.fish = game.fish.map((fish) => {
          if (distance(player, fish) < 140) {
            const drift = Math.random() * Math.PI * 2;
            const travel = 120;
            return {
              ...fish,
              x: clamp(fish.x + Math.cos(drift) * travel, 40, HUMPBACK_W - 40),
              y: clamp(fish.y + Math.sin(drift) * travel, 40, HUMPBACK_H - 40),
              vx: Math.cos(drift + 0.7) * 20,
              vy: Math.sin(drift + 0.7) * 20,
            };
          }
          return fish;
        });
      } else {
        game.notice =
          index === 0
            ? "Coral needs a tighter pocket before diving."
            : "Gold needs a tighter pocket before diving.";
      }
      player.diveCooldown = 1.5;
    }
  }

  for (const bubble of game.bubbles) {
    bubble.age += dt;
    bubble.radius = 18 + bubble.age * 18;
  }

  game.bubbles = game.bubbles.filter((bubble) => bubble.age < 3.4);

  for (const fish of game.fish) {
    fish.phase += dt;
    fish.x += fish.vx * dt;
    fish.y += fish.vy * dt;

    let tight = 0;
    for (const bubble of game.bubbles) {
      if (distance(fish, bubble) < bubble.radius + 12) {
        tight += 1;
      }
    }

    if (tight > 0) {
      fish.vx *= 0.96;
      fish.vy *= 0.96;
    }

    if (fish.x < 40 || fish.x > HUMPBACK_W - 40) fish.vx *= -1;
    if (fish.y < 40 || fish.y > HUMPBACK_H - 40) fish.vy *= -1;

    const centerX = HUMPBACK_W / 2;
    const centerY = HUMPBACK_H / 2;
    const driftX = (centerX - fish.x) * 0.04;
    const driftY = (centerY - fish.y) * 0.04;
    fish.vx += driftX * dt * 6;
    fish.vy += driftY * dt * 6;

    const maxSpeed = 30;
    const speed = Math.hypot(fish.vx, fish.vy) || 1;
    fish.vx = (fish.vx / speed) * Math.min(speed, maxSpeed);
    fish.vy = (fish.vy / speed) * Math.min(speed, maxSpeed);
    fish.x = clamp(fish.x + fish.vx * dt, 40, HUMPBACK_W - 40);
    fish.y = clamp(fish.y + fish.vy * dt, 40, HUMPBACK_H - 40);
  }

  if (game.time <= 0) {
    const winner =
      game.players[0].score === game.players[1].score
        ? null
        : game.players[0].score > game.players[1].score
          ? 0
          : 1;
    game.winner = winner;
    game.phase = "finished";
    game.notice =
      winner === null
        ? "The school was evenly crowded. It is a draw."
        : `${winner === 0 ? "Coral" : "Gold"} wins the bubble rush.`;
  }
};
