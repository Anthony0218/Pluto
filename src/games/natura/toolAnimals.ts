import type { Player, Vec } from "./naturaData";
import { createFoodSites, nearestFood, collectSharedFood, type FoodSite } from "./sharedFood.ts";

export type ToolKind = "bolas" | "coconut";
export type ToolInput = { x: number; y: number; action: boolean; secondary: boolean };
export const idleToolInput = (): ToolInput => ({ x: 0, y: 0, action: false, secondary: false });
export type ToolPlayer = Vec & {
  food: number; lives: number; angle: number; swing: number; cooldown: number; caughtInSwing: boolean;
  lure: number; lureCooldown: number; carrying: boolean; hidden: boolean; coverTime: number; shell: Vec; flash: number; captured: number; dragDirection: number;
};
export type Moth = Vec & { id: number; vx: number; phase: number };
export type ToolGame = {
  kind: ToolKind; phase: "ready" | "playing" | "paused" | "finished"; time: number; elapsed: number;
  players: [ToolPlayer, ToolPlayer]; winner: Player | null; notice: string;
  actionHeld: [boolean, boolean]; secondaryHeld: [boolean, boolean];
  reefShelters?: Vec[]; foodSites: FoodSite[]; moths: Moth[]; spawn: number; nextMoth: number; aiThink: number; aiInput: ToolInput;
  raid: { stage: "calm" | "warning" | "attack"; time: number; lanes: number[] };
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const TOOL_W = 960, TOOL_H = 540;
export const toolGoal = (kind: ToolKind) => kind === "bolas" ? 8 : 6;
export function createToolGame(kind: ToolKind): ToolGame {
  const player = (x: number, y: number): ToolPlayer => ({ x, y, food: 0, lives: 3, angle: 90, swing: 0, cooldown: 0,
    caughtInSwing: false, lure: 0, lureCooldown: 0, carrying: false, hidden: false, coverTime: 0, shell: { x: x + 42, y }, flash: 0, captured: 0, dragDirection: 1 });
  return {
    kind, phase: "ready", time: 60, elapsed: 0, players: kind === "bolas" ? [player(240, 115), player(720, 115)] : [player(90, 180), player(90, 360)],
    winner: null, notice: kind === "bolas" ? "Lure a moth into range, aim the thread, then time your swing." : "Pick up your numbered shell. Carry it slowly, or drop it to move faster.",
    actionHeld: [false, false], secondaryHeld: [false, false],
    foodSites: createFoodSites([{x:230,y:160},{x:230,y:380},{x:480,y:210},{x:480,y:330},{x:765,y:160},{x:765,y:380}]),
    moths: [130, 340, 620, 830].map((x, id) => ({ x, y: 235 + id % 2 * 30, id, vx: id % 2 ? -65 : 65, phase: id })),
    spawn: 1.5, nextMoth: 4, aiThink: 1, aiInput: idleToolInput(), raid: { stage: "calm", time: 4, lanes: [180, 360, 270] },
  };
}
export function bolasTip(player: ToolPlayer): Vec {
  const sweep = player.swing > 0 ? (1 - player.swing / 0.34) * 1.2 - 0.6 : 0;
  const angle = player.angle * Math.PI / 180 + sweep;
  return { x: player.x + Math.cos(angle) * 145, y: player.y + Math.sin(angle) * 145 };
}
export function coconutFood(player: Player, food: number): Vec | null {
  const route = [{ x: 230, y: 160 }, { x: 465, y: 230 }, { x: 765, y: 145 }, { x: 835, y: 370 }, { x: 520, y: 395 }, { x: 185, y: 345 }];
  const point = route[food];
  return point ? { x: point.x, y: player === 0 ? point.y : TOOL_H - point.y } : null;
}
export function raidPredators(game: ToolGame): Vec[] {
  if (game.raid.stage !== "attack") return [];
  const progress = 1 - game.raid.time / 2.2;
  return game.raid.lanes.map((y, i) => ({ x: i % 2 ? 1040 - progress * 1120 : -80 + progress * 1120, y }));
}
export const shellProtects = (player: ToolPlayer) => player.hidden && player.coverTime <= 0;

export function chooseToolInput(game: ToolGame, index: Player): ToolInput {
  const player = game.players[index], input = idleToolInput();
  if (game.phase === "finished" || player.lives <= 0 || player.captured > 0) return input;
  if (game.kind === "bolas") {
    const target = game.moths.reduce<Moth | undefined>((best, moth) => !best || Math.hypot(moth.x - player.x, moth.y - player.y) < Math.hypot(best.x - player.x, best.y - player.y) ? moth : best, undefined);
    if (!target) return input;
    const dx = target.x - player.x, dy = target.y - player.y;
    const angle = clamp(Math.atan2(dy, dx) * 180 / Math.PI, 20, 160);
    input.x = Math.abs(dx) > 55 ? clamp(dx / 90, -1, 1) : 0;
    input.y = clamp((player.angle - angle) / 15, -1, 1);
    input.action = player.cooldown === 0 && !game.actionHeld[index] && Math.abs(Math.hypot(dx, dy) - 145) < 28 && Math.abs(angle - player.angle) < 18;
    input.secondary = player.lureCooldown === 0 && !game.secondaryHeld[index];
    return input;
  }
  if (game.raid.stage !== "calm") {
    if (player.hidden) return input;
    if (player.carrying || Math.hypot(player.x - player.shell.x, player.y - player.shell.y) <= 40) return { ...input, secondary: !game.secondaryHeld[index] };
  }
  if (player.hidden) return { ...input, secondary: !game.secondaryHeld[index] };
  if (!player.carrying && Math.hypot(player.x - player.shell.x, player.y - player.shell.y) <= 40) return { ...input, action: !game.actionHeld[index] };
  const target = nearestFood(game.foodSites, player);
  if (!target) return input;
  return { ...input, x: Math.abs(target.x - player.x) > 6 ? Math.sign(target.x - player.x) : 0,
    y: Math.abs(target.y - player.y) > 6 ? Math.sign(target.y - player.y) : 0 };
}
function distanceToSegment(point: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t);
}
function finish(game: ToolGame) {
  const [a, b] = game.players;
  if (game.kind === "coconut" && (a.lives === 0) !== (b.lives === 0)) game.winner = a.lives === 0 ? 1 : 0;
  else {
    const delta = a.food - b.food || (game.kind === "coconut" ? a.lives - b.lives : 0);
    game.winner = delta === 0 ? null : delta > 0 ? 0 : 1;
  }
  game.phase = "finished";
}
export function updateToolGame(game: ToolGame, inputs: [ToolInput, ToolInput], seconds: number, ai: boolean, difficulty: "easy" | "normal" | "hard" = "normal") {
  if (game.phase !== "playing" || !Number.isFinite(seconds) || seconds <= 0) return;
  let remaining = Math.min(seconds, 0.1);
  while (remaining > 0.000001 && game.phase === "playing") {
    const dt = Math.min(remaining, 1 / 120, game.time);
    game.time = Math.max(0, game.time - dt); game.elapsed += dt;
    if (ai) {
      game.aiThink -= dt;
      if (game.aiThink <= 0) { game.aiInput = chooseToolInput(game, 1); game.aiThink = difficulty === "easy" ? 0.4 : difficulty === "hard" ? 0.1 : 0.32; }
    }
    const actual: [ToolInput, ToolInput] = [inputs[0], ai ? game.aiInput : inputs[1]];
    if (game.kind === "bolas") stepBolas(game, actual, dt); else stepCoconut(game, actual, dt);
    actual.forEach((input, index) => { game.actionHeld[index] = input.action; game.secondaryHeld[index] = input.secondary; });
    if (game.time <= 0 || game.players.some(player => player.food >= toolGoal(game.kind)) ||
      (game.kind === "coconut" && game.players.some(player => player.lives <= 0 && player.captured === 0))) finish(game);
    remaining -= dt;
  }
}
function stepBolas(game: ToolGame, inputs: [ToolInput, ToolInput], dt: number) {
  const oldTips = game.players.map(bolasTip);
  game.players.forEach((player, index) => {
    const input = inputs[index];
    player.x = clamp(player.x + clamp(input.x, -1, 1) * 150 * dt, 45, 915);
    // During a swing the aim is locked, so the swept collision path matches the drawing.
    if (player.swing === 0) player.angle = clamp(player.angle - input.y * 75 * dt, 20, 160);
    player.cooldown = Math.max(0, player.cooldown - dt); player.swing = Math.max(0, player.swing - dt);
    player.lure = Math.max(0, player.lure - dt); player.lureCooldown = Math.max(0, player.lureCooldown - dt);
    if (input.secondary && !game.secondaryHeld[index] && player.lureCooldown === 0) { player.lure = 3.5; player.lureCooldown = 5; }
    if (input.action && !game.actionHeld[index] && player.cooldown === 0) {
      player.swing = 0.34; player.cooldown = 0.95; player.caughtInSwing = false;
      oldTips[index] = bolasTip(player); // Starting a swing is not a teleporting hitbox.
    }
  });
  game.spawn -= dt;
  if (game.spawn <= 0 && game.moths.length < 10) {
    const id = game.nextMoth++, fromLeft = id % 2 === 0;
    game.moths.push({ id, x: fromLeft ? -20 : 980, y: 205 + id % 4 * 23, vx: fromLeft ? 72 : -72, phase: id });
    game.spawn = 1.25;
  }
  game.moths = game.moths.filter(moth => {
    const lures = game.players.filter(player => player.lure > 0 && Math.hypot(moth.x - player.x, moth.y - player.y) < 310);
    const target = lures.sort((a, b) => Math.abs(moth.x - a.x) - Math.abs(moth.x - b.x))[0];
    if (target) {
      const dx = target.x - moth.x, dy = target.y + 140 - moth.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      moth.x += dx / distance * 70 * dt; moth.y += dy / distance * 70 * dt;
    } else { moth.x += moth.vx * dt; moth.y += Math.sin(game.elapsed * 3 + moth.phase) * 20 * dt; }
    const distances = game.players.map((player, index) => player.swing > 0 && !player.caughtInSwing ? distanceToSegment(moth, oldTips[index], bolasTip(player)) : Infinity);
    const minimum = Math.min(...distances);
    if (minimum < 19) {
      const tied = Math.abs(distances[0] - distances[1]) < 0.5;
      const winner = distances[0] < distances[1] ? 0 : 1;
      game.players.forEach((player, index) => { if (tied || index === winner) { player.food += tied ? 0.5 : 1; player.caughtInSwing = true; } });
      game.notice = tied ? "Both sticky threads arrived together. Half a catch each." : `${winner === 0 ? "Coral" : "Gold"} snares a moth!`;
      return false;
    }
    return moth.x > -60 && moth.x < 1020;
  });
}
function stepCoconut(game: ToolGame, inputs: [ToolInput, ToolInput], dt: number) {
  game.raid.time -= dt;
  if (game.raid.time <= 0) {
    if (game.raid.stage === "calm") {
      game.raid = { stage: "warning", time: 1.4, lanes: [game.players[0].y, game.players[1].y, 100 + Math.floor(game.elapsed / 8) * 97 % 350] };
      game.notice = "Predators approaching the marked lanes! Assemble your shell or move clear.";
    } else if (game.raid.stage === "warning") game.raid = { ...game.raid, stage: "attack", time: 2.2 };
    else { game.raid = { ...game.raid, stage: "calm", time: 2.8 }; game.notice = "The patrol passed. Uncover, pick up your shell, and forage."; }
  }
  game.players.forEach((player, index) => {
    if (player.captured > 0) {
      player.captured = Math.max(0, player.captured - dt);
      player.x += player.dragDirection * 520 * dt;
      if (player.captured === 0 && player.lives > 0) {
        player.x = 90; player.y = index === 0 ? 180 : 360;
        player.shell = { x: 90, y: player.y }; player.flash = 2.5;
        game.notice = "Back at the shelter. Brief protection gives you time to move.";
      }
      return;
    }
    if (player.lives <= 0) return;
    const input = inputs[index];
    player.flash = Math.max(0, player.flash - dt); player.coverTime = Math.max(0, player.coverTime - dt);
    if (input.secondary && !game.secondaryHeld[index]) {
      if (player.hidden) player.hidden = false;
      else if (player.carrying || Math.hypot(player.x - player.shell.x, player.y - player.shell.y) <= 40) {
        if (player.carrying) { player.shell = { x: player.x, y: player.y }; player.carrying = false; }
        player.x = player.shell.x; player.y = player.shell.y; player.hidden = true; player.coverTime = 0.45;
      } else game.notice = "Get within reach of your numbered shell before hiding.";
    }
    if (input.action && !game.actionHeld[index] && !player.hidden) {
      if (player.carrying) { player.carrying = false; player.shell = { x: player.x, y: player.y }; }
      else if (Math.hypot(player.x - player.shell.x, player.y - player.shell.y) <= 40) player.carrying = true;
      else game.notice = "Your shell is too far away. Follow its numbered marker.";
    }
    if (!player.hidden) {
      const norm = Math.max(1, Math.hypot(input.x, input.y)), speed = player.carrying ? 100 : 165;
      player.x = clamp(player.x + input.x / norm * speed * dt, 30, 930);
      player.y = clamp(player.y + input.y / norm * speed * dt, 65, 495);
    }
    if (player.carrying) player.shell = { x: player.x, y: player.y };
    const predatorIndex = raidPredators(game).findIndex(predator => Math.hypot(predator.x - player.x, predator.y - player.y) < 46);
    if (player.flash === 0 && !shellProtects(player) && !game.reefShelters?.some(reef => Math.hypot(reef.x-player.x,reef.y-player.y)<48) && predatorIndex >= 0) {
      player.lives--; player.captured = 1; player.flash = 1;
      player.dragDirection = predatorIndex % 2 ? -1 : 1;
      player.hidden = false; player.carrying = false;
      game.notice = `${index === 0 ? "Coral" : "Gold"} is carried away. One heart lost.`;
    }
  });
  if (collectSharedFood(game.foodSites, game.players, game.players.map(p => p.lives > 0 && !p.hidden && p.captured === 0) as [boolean, boolean], 25, dt)) {
    game.notice = "Shared food collected. Each meal is available to either forager.";
  }
}
