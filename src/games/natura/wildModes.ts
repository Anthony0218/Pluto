import type { Player, Vec } from "./naturaData";

export type WildKind = "trapjaw" | "cuttlefish";
export type Pattern = 0 | 1 | 2 | 3 | 4 | 5;
export type WildInput = { x: number; y: number; action: boolean; secondary: boolean; pattern?: Pattern; bumpy?: boolean };
export const idleWildInput = (): WildInput => ({ x: 0, y: 0, action: false, secondary: false });
export const WILD_W = 960, WILD_H = 540, WILD_SECONDS = 60;
export const SNAP_SPEED = 500, SNAP_GRAVITY = 720;
export const PLATFORMS = [
  { x: 20, y: 450, width: 200 }, { x: 275, y: 385, width: 145 },
  { x: 465, y: 315, width: 140 }, { x: 655, y: 245, width: 135 },
  { x: 835, y: 175, width: 105 },
];
export const SNAP_LEVELS = [
  { name: "Root Ridge", platforms: PLATFORMS },
  { name: "Fallen Logs", platforms: [
    { x: 20, y: 420, width: 175 }, { x: 245, y: 350, width: 125 }, { x: 440, y: 395, width: 120 },
    { x: 635, y: 300, width: 115 }, { x: 825, y: 220, width: 115 },
  ] },
  { name: "Fern Staircase", platforms: [
    { x: 15, y: 460, width: 145 }, { x: 205, y: 390, width: 110 }, { x: 365, y: 325, width: 105 },
    { x: 525, y: 265, width: 105 }, { x: 680, y: 195, width: 100 }, { x: 840, y: 130, width: 105 },
  ] },
  { name: "Stone Hollows", platforms: [
    { x: 20, y: 360, width: 160 }, { x: 245, y: 410, width: 105 }, { x: 435, y: 315, width: 105 },
    { x: 625, y: 370, width: 100 }, { x: 825, y: 280, width: 110 },
  ] },
  { name: "Canopy Run", platforms: [
    { x: 15, y: 445, width: 150 }, { x: 205, y: 350, width: 100 }, { x: 370, y: 290, width: 95 },
    { x: 525, y: 345, width: 95 }, { x: 685, y: 245, width: 95 }, { x: 840, y: 155, width: 105 },
  ] },
  { name: "Mossy Switchbacks", platforms: [
    { x: 15, y: 450, width: 150 }, { x: 210, y: 360, width: 110 }, { x: 390, y: 405, width: 110 },
    { x: 555, y: 300, width: 105 }, { x: 710, y: 235, width: 95 }, { x: 850, y: 150, width: 90 },
  ] },
  { name: "Amber Creek", platforms: [
    { x: 15, y: 395, width: 150 }, { x: 225, y: 440, width: 105 }, { x: 405, y: 350, width: 100 },
    { x: 590, y: 275, width: 100 }, { x: 790, y: 320, width: 140 },
  ] },
  { name: "Orchid Steps", platforms: [
    { x: 15, y: 470, width: 140 }, { x: 190, y: 390, width: 100 }, { x: 350, y: 305, width: 100 },
    { x: 510, y: 230, width: 100 }, { x: 675, y: 300, width: 95 }, { x: 840, y: 205, width: 105 },
  ] },
  { name: "Moonlit Roots", platforms: [
    { x: 15, y: 400, width: 155 }, { x: 215, y: 320, width: 100 }, { x: 385, y: 400, width: 95 },
    { x: 550, y: 310, width: 95 }, { x: 715, y: 220, width: 95 }, { x: 860, y: 135, width: 85 },
  ] },
  { name: "Crown of the Forest", platforms: [
    { x: 15, y: 475, width: 140 }, { x: 190, y: 390, width: 95 }, { x: 350, y: 310, width: 90 },
    { x: 510, y: 235, width: 90 }, { x: 675, y: 165, width: 90 }, { x: 845, y: 95, width: 100 },
  ] },
];
export const HABITATS = [
  { name: "Sand", pattern: 0 as Pattern, bumpy: false, color: "#d0bf93" },
  { name: "Pebbles", pattern: 1 as Pattern, bumpy: true, color: "#82978b" },
  { name: "Reef", pattern: 2 as Pattern, bumpy: true, color: "#ae8074" },
  { name: "Seagrass", pattern: 3 as Pattern, bumpy: false, color: "#648c66" },
  { name: "Shell bed", pattern: 4 as Pattern, bumpy: true, color: "#cbbab4" },
  { name: "Dark gravel", pattern: 5 as Pattern, bumpy: false, color: "#637e8c" },
];
export const PATTERN_NAMES = ["Plain", "Mottled", "Banded", "Veined", "Spotted", "Speckled"];
export type HabitatPatch = Vec & { pattern: Pattern; polygon: Vec[] };
/** Jittered, mirrored Voronoi patches: fresh geography, equal routes for both players. */
export function createHabitatMap(seed: number): HabitatPatch[] {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const patches: HabitatPatch[] = [];
  for (let row = 0; row < 2; row++) {
    const patterns: Pattern[] = [0, 1, 2, 3, 4, 5];
    for (let i = 5; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [patterns[i], patterns[j]] = [patterns[j], patterns[i]]; }
    for (let col = 0; col < 6; col++) {
      const x = col * 160 + 80 + (random() - 0.5) * 70;
      const y = row * 135 + 67.5 + (random() - 0.5) * 48;
      patches.push({ x, y, pattern: patterns[col], polygon: [] }, { x, y: WILD_H - y, pattern: patterns[col], polygon: [] });
    }
  }
  patches.forEach(patch => {
    let polygon: Vec[] = [{ x: 0, y: 0 }, { x: WILD_W, y: 0 }, { x: WILD_W, y: WILD_H }, { x: 0, y: WILD_H }];
    for (const other of patches) {
      if (other === patch) continue;
      const nx = other.x - patch.x, ny = other.y - patch.y;
      const boundary = (other.x ** 2 + other.y ** 2 - patch.x ** 2 - patch.y ** 2) / 2;
      const distance = (point: Vec) => point.x * nx + point.y * ny - boundary;
      const clipped: Vec[] = [];
      polygon.forEach((a, i) => {
        const b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
        if (da <= 0) clipped.push(a);
        if ((da <= 0) !== (db <= 0)) {
          const t = da / (da - db); clipped.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      });
      polygon = clipped;
    }
    patch.polygon = polygon;
  });
  return patches;
}
type Base = {
  phase: "ready" | "playing" | "paused" | "finished"; time: number; elapsed: number;
  winner: Player | null; notice: string; actionHeld: [boolean, boolean]; secondaryHeld: [boolean, boolean];
  aiThink: number; aiReadyAt: number; aiInput: WildInput;
};
export type AntState = Vec & {
  vx: number; vy: number; angle: number; facing: number; grounded: boolean;
  checkpoint: number; lives: number; cooldown: number; flash: number;
};
export type CuttleState = Vec & {
  pattern: Pattern; bumpy: boolean; exposure: number; lives: number; food: number;
  moving: boolean; flash: number;
};
export type SnapGame = Base & { kind: "trapjaw"; level: number; players: [AntState, AntState] };
export type CuttleGame = Base & { kind: "cuttlefish"; seed: number; patches: HabitatPatch[]; players: [CuttleState, CuttleState] };
export type WildGame = SnapGame | CuttleGame;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const base = (): Base => ({ phase: "ready", time: WILD_SECONDS, elapsed: 0, winner: null,
  notice: "", actionHeld: [false, false], secondaryHeld: [false, false], aiThink: 0.4, aiReadyAt: 2.2, aiInput: idleWildInput() });
export const snapPlatforms = (game: SnapGame) => SNAP_LEVELS[game.level].platforms;
export function createSnapGame(level = 0): SnapGame {
  level = clamp(Math.trunc(level), 0, SNAP_LEVELS.length - 1);
  const start = SNAP_LEVELS[level].platforms[0];
  const ant = (x: number): AntState => ({ x, y: start.y, vx: 0, vy: 0, angle: 60, facing: 1,
    grounded: true, checkpoint: 0, lives: 3, cooldown: 0, flash: 0 });
  return { ...base(), kind: "trapjaw", level, players: [ant(start.x + start.width * 0.375), ant(start.x + start.width * 0.625)], notice: `${SNAP_LEVELS[level].name}: aim, snap and reach the nest.` };
}
export function createCuttleGame(seed = 1): CuttleGame {
  const patches = createHabitatMap(seed);
  const cuttle = (y: number): CuttleState => {
    const habitat = habitatAt(90, y, patches);
    return { x: 90, y, pattern: habitat.pattern, bumpy: habitat.bumpy, exposure: 0, lives: 3, food: 0, moving: false, flash: 0 };
  };
  return { ...base(), kind: "cuttlefish", seed, patches, players: [cuttle(180), cuttle(360)], notice: "24 scattered patches. Six disguises. Watch for fast predators." };
}
export const createWildGame = (kind: WildKind, level = 0, seed = 1): WildGame => kind === "trapjaw" ? createSnapGame(level) : createCuttleGame(seed);
export const habitatAt = (x: number, y: number, patches: HabitatPatch[]) => {
  const nearest = patches.reduce((best, patch) => Math.hypot(patch.x - x, patch.y - y) < Math.hypot(best.x - x, best.y - y) ? patch : best);
  return HABITATS[nearest.pattern];
};
export const camouflageMatches = (animal: CuttleState, patches: HabitatPatch[]) => {
  const habitat = habitatAt(animal.x, animal.y, patches);
  return habitat.pattern === animal.pattern && habitat.bumpy === animal.bumpy;
};
export function foodTarget(player: Player, collected: number): Vec | null {
  const path = [{ x: 210, y: 165 }, { x: 445, y: 215 }, { x: 750, y: 145 },
    { x: 860, y: 330 }, { x: 545, y: 385 }, { x: 170, y: 370 }];
  const target = path[collected];
  return target ? { x: target.x, y: player === 0 ? target.y : WILD_H - target.y } : null;
}
export type Predator = Vec & { facing: number };
export function predatorsAt(elapsed: number): Predator[] {
  return [{ x: -260 + (elapsed * 150) % 1480, y: 130, facing: 1 },
    { x: 1220 - (elapsed * 140 + 530) % 1480, y: 410, facing: -1 },
    { x: -260 + (elapsed * 160 + 770) % 1480, y: 270, facing: 1 }];
}
export function inPredatorView(point: Vec, predator: Predator): boolean {
  const forward = (point.x - predator.x) * predator.facing;
  return forward > 0 && forward < 240 && Math.abs(point.y - predator.y) < 22 + forward * 0.42;
}

function rankWinner(values: [number, number]): Player | null {
  return values[0] === values[1] ? null : values[0] > values[1] ? 0 : 1;
}
function finish(game: WildGame) {
  const [a, b] = game.players;
  if (a.lives === 0 && b.lives > 0) game.winner = 1;
  else if (b.lives === 0 && a.lives > 0) game.winner = 0;
  else if (game.kind === "trapjaw") game.winner = rankWinner(game.players.map(p => p.checkpoint * 10 + p.lives) as [number, number]);
  else game.winner = rankWinner(game.players.map(p => p.food * 10 + p.lives) as [number, number]);
  game.phase = "finished";
}

export function chooseSnapInput(game: SnapGame, player: Player): WildInput {
  const ant = game.players[player];
  const input = idleWildInput();
  const platforms = snapPlatforms(game);
  const next = platforms[ant.checkpoint + 1];
  if (!ant.grounded || !next || ant.lives === 0 || (player === 1 && game.elapsed < game.aiReadyAt)) return input;
  const launchX = platforms[ant.checkpoint].x + platforms[ant.checkpoint].width / 2;
  if (Math.abs(ant.x - launchX) > 3) return { ...input, x: clamp((launchX - ant.x) / (135 * 0.2), -1, 1) };
  const height = ant.y - next.y;
  let bestAngle = 60, bestError = Infinity;
  for (let angle = 35; angle <= 80; angle += 0.5) {
    const radians = angle * Math.PI / 180;
    const vy = SNAP_SPEED * Math.sin(radians);
    const discriminant = vy ** 2 - 2 * SNAP_GRAVITY * height;
    if (discriminant < 0) continue;
    const flight = (vy + Math.sqrt(discriminant)) / SNAP_GRAVITY;
    const error = Math.abs(ant.x + SNAP_SPEED * Math.cos(radians) * flight - (next.x + next.width / 2));
    if (error < bestError) { bestError = error; bestAngle = angle; }
  }
  // A proportional adjustment avoids oscillating past the target between decisions.
  input.y = clamp((ant.angle - bestAngle) / (55 * 0.2), -1, 1);
  input.action = Math.abs(ant.angle - bestAngle) < 1.2 && ant.cooldown === 0;
  // Walking back into launch position may leave the ant facing left.
  if (ant.facing < 0) { input.x = 0.05; input.action = false; }
  return input;
}
export function chooseCuttleInput(game: CuttleGame, player: Player): WildInput {
  const animal = game.players[player];
  const habitat = habitatAt(animal.x, animal.y, game.patches);
  const input = { ...idleWildInput(), pattern: habitat.pattern, bumpy: habitat.bumpy };
  const target = foodTarget(player, animal.food);
  if (!target || animal.lives === 0 || (player === 1 && game.elapsed < game.aiReadyAt)) return input;
  const watched = predatorsAt(game.elapsed).some(predator => inPredatorView(animal, predator));
  if (watched && animal.exposure > 35) return input;
  return { ...input, x: Math.abs(target.x - animal.x) > 8 ? Math.sign(target.x - animal.x) : 0,
    y: Math.abs(target.y - animal.y) > 8 ? Math.sign(target.y - animal.y) : 0 };
}

export function updateWildGame(game: WildGame, inputs: [WildInput, WildInput], seconds: number, ai: boolean, difficulty: "easy" | "normal" | "hard" = "normal") {
  if (game.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 0.000001 && game.phase === "playing") {
    const dt = Math.min(remaining, 1 / 120, game.time);
    game.time = Math.max(0, game.time - dt); game.elapsed += dt;
    if (ai) {
      game.aiThink -= dt;
      if (game.aiThink <= 0) {
        game.aiInput = game.kind === "trapjaw" ? chooseSnapInput(game, 1) : chooseCuttleInput(game, 1);
        game.aiThink = difficulty === "easy" ? 0.4 : difficulty === "hard" ? 0.1 : 0.2;
      }
    }
    const actual: [WildInput, WildInput] = [inputs[0], ai ? game.aiInput : inputs[1]];
    if (game.kind === "trapjaw") stepSnap(game, actual, dt);
    else stepCuttle(game, actual, dt);
    actual.forEach((input, index) => { game.actionHeld[index] = input.action; game.secondaryHeld[index] = input.secondary; });
    if (game.time <= 0 || game.players.some(p => p.lives <= 0) ||
      (game.kind === "trapjaw" ? game.players.some(p => p.checkpoint === snapPlatforms(game).length - 1) : game.players.some(p => p.food >= 6))) finish(game);
    remaining -= dt;
  }
}

function stepSnap(game: SnapGame, inputs: [WildInput, WildInput], dt: number) {
  const platforms = snapPlatforms(game);
  game.players.forEach((ant, index) => {
    if (ant.lives <= 0) return;
    const input = inputs[index];
    ant.cooldown = Math.max(0, ant.cooldown - dt); ant.flash = Math.max(0, ant.flash - dt);
    ant.angle = clamp(ant.angle - input.y * 55 * dt, 35, 80);
    if (ant.grounded) {
      ant.vx = clamp(input.x, -1, 1) * 135;
      if (input.x) ant.facing = Math.sign(input.x);
      if (input.action && !game.actionHeld[index] && ant.cooldown === 0) {
        const radians = ant.angle * Math.PI / 180;
        ant.vx = ant.facing * Math.cos(radians) * SNAP_SPEED;
        ant.vy = -Math.sin(radians) * SNAP_SPEED;
        ant.grounded = false; ant.cooldown = 0.7;
        game.notice = `${index === 0 ? "Coral" : "Gold"} snaps against the ground and launches!`;
      }
    }
    const previousY = ant.y;
    ant.x = clamp(ant.x + ant.vx * dt, 12, WILD_W - 12);
    if (ant.grounded && !platforms.some(p => Math.abs(p.y - ant.y) < 1 && ant.x >= p.x && ant.x <= p.x + p.width)) ant.grounded = false;
    if (!ant.grounded) {
      ant.y += ant.vy * dt + SNAP_GRAVITY * dt * dt / 2;
      ant.vy += SNAP_GRAVITY * dt;
      if (ant.vy >= 0) {
        const landed = platforms.findIndex(p => previousY <= p.y && ant.y >= p.y && ant.x >= p.x + 4 && ant.x <= p.x + p.width - 4);
        if (landed >= 0) {
          ant.y = platforms[landed].y; ant.vy = 0; ant.vx = 0; ant.grounded = true;
          if (landed > ant.checkpoint) {
            ant.checkpoint = landed;
            if (index === 1) game.aiReadyAt = game.elapsed + 2;
            game.notice = `${index === 0 ? "Coral" : "Gold"} reaches ledge ${landed + 1}. Checkpoint saved.`;
          }
        }
      }
    }
    if (ant.y > WILD_H + 45) {
      ant.lives--; ant.flash = 1.4; ant.vx = 0; ant.vy = 0; ant.grounded = true;
      const checkpoint = platforms[ant.checkpoint];
      ant.x = checkpoint.x + checkpoint.width / 2; ant.y = checkpoint.y;
      ant.cooldown = 0.4; ant.facing = 1;
      game.notice = "Missed the ledge. Lose one heart and return to your checkpoint.";
    }
  });
}

function stepCuttle(game: CuttleGame, inputs: [WildInput, WildInput], dt: number) {
  const predators = predatorsAt(game.elapsed);
  game.players.forEach((animal, index) => {
    if (animal.lives <= 0) return;
    const input = inputs[index];
    animal.flash = Math.max(0, animal.flash - dt);
    if (input.action && !game.actionHeld[index]) animal.pattern = ((animal.pattern + 1) % PATTERN_NAMES.length) as Pattern;
    if (input.secondary && !game.secondaryHeld[index]) animal.bumpy = !animal.bumpy;
    if (input.pattern !== undefined) animal.pattern = input.pattern;
    if (input.bumpy !== undefined) animal.bumpy = input.bumpy;
    const dx = clamp(input.x, -1, 1), dy = clamp(input.y, -1, 1);
    const norm = Math.max(1, Math.hypot(dx, dy));
    animal.moving = dx !== 0 || dy !== 0;
    animal.x = clamp(animal.x + dx / norm * 125 * dt, 28, WILD_W - 28);
    animal.y = clamp(animal.y + dy / norm * 125 * dt, 72, WILD_H - 45);
    const watched = predators.some(predator => inPredatorView(animal, predator));
    const matched = camouflageMatches(animal, game.patches);
    const rate = watched && animal.flash === 0 ? (matched ? animal.moving ? 40 : -30 : animal.moving ? 95 : 80) : -32;
    animal.exposure = clamp(animal.exposure + rate * dt, 0, 100);
    if (animal.exposure >= 100) {
      animal.lives--; animal.exposure = 0; animal.flash = 2;
      animal.x = 90; animal.y = index === 0 ? 180 : 360;
      game.notice = `${index === 0 ? "Coral" : "Gold"} was spotted! One heart lost. Hide on matching ground.`;
    }
    const food = foodTarget(index as Player, animal.food);
    if (animal.lives > 0 && food && Math.hypot(animal.x - food.x, animal.y - food.y) <= 24) {
      animal.food++;
      if (index === 1) game.aiReadyAt = game.elapsed + 0.8;
      game.notice = `${index === 0 ? "Coral" : "Gold"} collects a shrimp. ${animal.food} / 6 food.`;
    }
  });
}

export function setCuttleSkin(game: WildGame, player: Player, pattern?: Pattern, bumpy?: boolean) {
  if (game.kind !== "cuttlefish" || game.phase !== "playing") return;
  if (pattern !== undefined) game.players[player].pattern = pattern;
  if (bumpy !== undefined) game.players[player].bumpy = bumpy;
}
