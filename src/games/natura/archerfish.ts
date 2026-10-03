import type { Player, Vec } from "./naturaData";

export const ARCHER_WIDTH = 960;
export const ARCHER_HEIGHT = 540;
export const WATERLINE = 330;
export const ARCHER_SECONDS = 60;
export const ARCHER_TARGET = 7;
export const SHOT_COOLDOWN = 0.85;
export const DASH_COOLDOWN = 2.5;
const GRAVITY = 250;
const SHOT_SPEED = 690;
const SWIM_SPEED = 205;
const CATCH_RADIUS = 35;
const MIN_ANGLE = -Math.PI + 0.28;
const MAX_ANGLE = -0.28;

export type ArcherInput = {
  move: number;
  aim: number;
  shoot: boolean;
  dash: boolean;
  target?: Vec;
};
export const emptyArcherInput = (): ArcherInput => ({ move: 0, aim: 0, shoot: false, dash: false });
export type ArcherFish = {
  x: number;
  angle: number;
  facing: number;
  shotCooldown: number;
  dashCooldown: number;
  dashTime: number;
  dashDirection: number;
  catches: number;
  shots: number;
  hits: number;
};
export type ArcherInsect = Vec & {
  id: number;
  vx: number;
  vy: number;
  state: "perched" | "falling" | "floating";
  floatTime: number;
};
type WaterShot = Vec & { vx: number; vy: number; owner: Player; tail: Vec[] };
type Ripple = { x: number; age: number; owner: Player | null };
export type ArcherGame = {
  phase: "ready" | "playing" | "paused" | "finished";
  time: number;
  elapsed: number;
  fish: [ArcherFish, ArcherFish];
  insects: ArcherInsect[];
  shots: WaterShot[];
  ripples: Ripple[];
  respawns: { id: number; delay: number }[];
  winner: Player | null;
  notice: string;
  noticeTime: number;
  ai: { think: number; input: ArcherInput };
};

export const ARCHER_BRANCHES = [
  { x: 125, y: 150 }, { x: 267, y: 210 }, { x: 409, y: 112 },
  { x: 551, y: 112 }, { x: 693, y: 210 }, { x: 835, y: 150 },
];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const insectAt = (id: number): ArcherInsect => ({ ...ARCHER_BRANCHES[id], id, vx: 0, vy: 0, state: "perched", floatTime: 0 });
const newFish = (x: number, facing: number): ArcherFish => ({
  x, facing, angle: -Math.PI / 2, shotCooldown: 0, dashCooldown: 0,
  dashTime: 0, dashDirection: facing, catches: 0, shots: 0, hits: 0,
});

export function createArcherGame(): ArcherGame {
  return {
    phase: "ready", time: ARCHER_SECONDS, elapsed: 0,
    fish: [newFish(265, 1), newFish(695, -1)],
    insects: ARCHER_BRANCHES.map((_, id) => insectAt(id)), shots: [], ripples: [], respawns: [],
    winner: null, notice: "Aim at an insect. Catch it before your rival does.", noticeTime: 4,
    ai: { think: 0.45, input: emptyArcherInput() },
  };
}

export const archerMouth = (fish: ArcherFish): Vec => ({ x: fish.x, y: WATERLINE - 3 });

/** The positive flight-time solution, shared by the visible landing marker and AI. */
export function insectLanding(insect: ArcherInsect): Vec {
  if (insect.state === "floating") return { x: insect.x, y: WATERLINE };
  const remaining = Math.max(0, WATERLINE - insect.y);
  const seconds = (-insect.vy + Math.sqrt(insect.vy ** 2 + 2 * GRAVITY * remaining)) / GRAVITY;
  return { x: clamp(insect.x + insect.vx * seconds, 35, ARCHER_WIDTH - 35), y: WATERLINE };
}

/** Low ballistic arc from the fish's mouth. Null means this shot cannot reach. */
export function archerShotAngle(fish: ArcherFish, target: Vec): number | null {
  const mouth = archerMouth(fish);
  const dx = target.x - mouth.x;
  const height = mouth.y - target.y;
  if (Math.abs(dx) < 1) return -Math.PI / 2;
  const speedSquared = SHOT_SPEED ** 2;
  const discriminant = speedSquared ** 2 - GRAVITY * (GRAVITY * dx ** 2 + 2 * height * speedSquared);
  if (discriminant < 0) return null;
  const elevation = Math.atan((speedSquared - Math.sqrt(discriminant)) / (GRAVITY * Math.abs(dx)));
  const angle = dx > 0 ? -elevation : -Math.PI + elevation;
  return angle >= MIN_ANGLE && angle <= MAX_ANGLE ? angle : null;
}

/** AI only uses the same visible insects and landing information as the player. */
export function chooseArcherInput(game: ArcherGame, player: Player, difficulty: "easy" | "normal" | "hard" = "normal"): ArcherInput {
  const fish = game.fish[player];
  const falling = game.insects.filter(insect => insect.state !== "perched")
    .sort((a, b) => Math.abs(insectLanding(a).x - fish.x) - Math.abs(insectLanding(b).x - fish.x));
  if (falling.length) {
    const dx = insectLanding(falling[0]).x - fish.x;
    return { ...emptyArcherInput(), move: Math.abs(dx) > 12 ? Math.sign(dx) : 0, dash: Math.abs(dx) > 145 };
  }
  const target = game.insects.filter(insect => insect.state === "perched")
    .sort((a, b) => Math.abs(a.x - fish.x) - Math.abs(b.x - fish.x))[0];
  if (!target) return emptyArcherInput();
  const angle = archerShotAngle(fish, target);
  if (angle === null) return { ...emptyArcherInput(), move: Math.sign(target.x - fish.x) };
  // A small, visible aim wobble and reaction interval leave room for a human rival.
  const difference = angle + Math.sin(game.elapsed * 2.4) * (difficulty === "easy" ? 0.07 : difficulty === "hard" ? 0.012 : 0.035) - fish.angle;
  return { move: 0, aim: Math.abs(difference) > 0.015 ? clamp(difference / (1.75 * 0.17), -1, 1) : 0, shoot: Math.abs(difference) < (difficulty === "easy" ? 0.035 : difficulty === "hard" ? 0.07 : 0.055), dash: false };
}

function segmentDistance(a: Vec, b: Vec, point: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function finishArcherGame(game: ArcherGame) {
  game.phase = "finished";
  const [a, b] = game.fish.map(fish => fish.catches);
  game.winner = a === b ? null : a > b ? 0 : 1;
}

/** Fixed substeps avoid tunnelling through insects or fish on slower displays. */
export function updateArcherGame(game: ArcherGame, inputs: [ArcherInput, ArcherInput], seconds: number, ai = false, difficulty: "easy" | "normal" | "hard" = "normal") {
  if (game.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 0.000001 && game.phase === "playing") {
    const dt = Math.min(remaining, 1 / 120, game.time);
    stepArcherGame(game, inputs, dt, ai, difficulty);
    remaining -= dt;
  }
}

function stepArcherGame(game: ArcherGame, inputs: [ArcherInput, ArcherInput], dt: number, ai: boolean, difficulty: "easy" | "normal" | "hard") {
  game.time = Math.max(0, game.time - dt);
  game.elapsed += dt;
  game.noticeTime = Math.max(0, game.noticeTime - dt);
  game.ripples = game.ripples.filter(ripple => (ripple.age += dt) < 0.8);
  if (ai) {
    game.ai.think -= dt;
    if (game.ai.think <= 0) {
      game.ai.input = chooseArcherInput(game, 1, difficulty);
      game.ai.think = difficulty === "easy" ? 0.35 : difficulty === "hard" ? 0.08 : 0.17;
    }
  }
  game.fish.forEach((fish, index) => {
    const input = ai && index === 1 ? game.ai.input : inputs[index];
    fish.shotCooldown = Math.max(0, fish.shotCooldown - dt);
    fish.dashCooldown = Math.max(0, fish.dashCooldown - dt);
    fish.dashTime = Math.max(0, fish.dashTime - dt);
    const move = clamp(input.move, -1, 1);
    if (move) fish.facing = Math.sign(move);
    if (input.dash && move && fish.dashCooldown === 0) {
      fish.dashTime = 0.24;
      fish.dashCooldown = DASH_COOLDOWN;
      fish.dashDirection = Math.sign(move);
    }
    fish.x = clamp(fish.x + (fish.dashTime > 0 ? fish.dashDirection * 510 : move * SWIM_SPEED) * dt, 38, ARCHER_WIDTH - 38);
    fish.angle = clamp(fish.angle + clamp(input.aim, -1, 1) * 1.75 * dt, MIN_ANGLE, MAX_ANGLE);
    if (input.target && input.target.y < WATERLINE - 15) {
      // Pointer aiming selects a real launch direction; the preview shows gravity's effect.
      fish.angle = clamp(Math.atan2(input.target.y - archerMouth(fish).y, input.target.x - fish.x), MIN_ANGLE, MAX_ANGLE);
    }
    if (input.shoot && fish.shotCooldown === 0) {
      game.shots.push({ ...archerMouth(fish), vx: Math.cos(fish.angle) * SHOT_SPEED,
        vy: Math.sin(fish.angle) * SHOT_SPEED, owner: index as Player, tail: [] });
      fish.shotCooldown = SHOT_COOLDOWN;
      fish.shots++;
    }
  });

  game.shots = game.shots.filter(shot => {
    const previous = { x: shot.x, y: shot.y };
    shot.tail.push(previous);
    if (shot.tail.length > 9) shot.tail.shift();
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt + GRAVITY * dt * dt / 2;
    shot.vy += GRAVITY * dt;
    const hit = game.insects.find(insect => insect.state === "perched" && segmentDistance(previous, shot, insect) < 14);
    if (hit) {
      hit.state = "falling";
      hit.vx = shot.vx * 0.11;
      hit.vy = 5;
      game.fish[shot.owner].hits++;
      game.notice = "Insect falling! Race to the landing ring.";
      game.noticeTime = 2;
      return false;
    }
    return shot.y < WATERLINE + 5 && shot.y > -80 && shot.x > -20 && shot.x < ARCHER_WIDTH + 20;
  });

  // Resolve both fish together: equal-distance catches split one food point fairly.
  game.insects = game.insects.filter(insect => {
    if (insect.state === "perched") return true;
    if (insect.state === "falling") {
      insect.x = clamp(insect.x + insect.vx * dt, 35, ARCHER_WIDTH - 35);
      insect.y += insect.vy * dt + GRAVITY * dt * dt / 2;
      insect.vy += GRAVITY * dt;
      if (insect.y < WATERLINE) return true;
      insect.y = WATERLINE;
      insect.state = "floating";
      insect.floatTime = 1.6;
      game.ripples.push({ x: insect.x, age: 0, owner: null });
    }
    const distances = game.fish.map(fish => Math.abs(fish.x - insect.x));
    const nearest = Math.min(...distances);
    if (nearest <= CATCH_RADIUS) {
      const shared = Math.abs(distances[0] - distances[1]) < 0.5;
      const catcher: Player = distances[0] < distances[1] ? 0 : 1;
      if (shared) game.fish.forEach(fish => { fish.catches += 0.5; });
      else game.fish[catcher].catches++;
      game.ripples.push({ x: insect.x, age: 0, owner: shared ? null : catcher });
      game.notice = shared ? "A shared catch! ½ food each." : `${catcher === 0 ? "Coral" : "Gold"} fish catches it! +1 food`;
      game.noticeTime = 2;
      game.respawns.push({ id: insect.id, delay: 1.3 });
      return false;
    }
    insect.floatTime -= dt;
    if (insect.floatTime <= 0) {
      game.respawns.push({ id: insect.id, delay: 1.3 });
      return false;
    }
    return true;
  });
  game.respawns = game.respawns.filter(respawn => {
    respawn.delay -= dt;
    if (respawn.delay > 0) return true;
    game.insects.push(insectAt(respawn.id));
    return false;
  });
  if (game.time <= 0 || game.fish.some(fish => fish.catches >= ARCHER_TARGET)) finishArcherGame(game);
}

export function archerTrajectory(fish: ArcherFish): Vec[] {
  const mouth = archerMouth(fish);
  return Array.from({ length: 19 }, (_, index) => {
    const time = index * 0.028;
    return { x: mouth.x + Math.cos(fish.angle) * SHOT_SPEED * time,
      y: mouth.y + Math.sin(fish.angle) * SHOT_SPEED * time + GRAVITY * time * time / 2 };
  }).filter(point => point.y >= 0 && point.y < WATERLINE && point.x > 0 && point.x < ARCHER_WIDTH);
}
