import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";

export const KNOCKBACK_HP = 200;
export const PUNCH_DAMAGE = 10;
export const PUNCH_COOLDOWN = 450;
export const LAVA_Y = -2.2;
export const HELL_ISLANDS = [
  { x: 0, z: 0, radius: 6.4 },
  { x: -10, z: 0, radius: 4.2 }, { x: 10, z: 0, radius: 4.2 },
  { x: 0, z: -10, radius: 3.2 }, { x: 0, z: 10, radius: 3.2 },
  { x: -7.2, z: 0, radius: 1.3 }, { x: 7.2, z: 0, radius: 1.3 },
  { x: 0, z: -7.2, radius: 1.3 }, { x: 0, z: 7.2, radius: 1.3 },
  { x: -9, z: -9, radius: 2.4 }, { x: 9, z: 9, radius: 2.4 },
] as const;
export function islandCollapseAt(index: number): number { return index === 0 ? Infinity : index >= 9 ? 25000 : index >= 5 ? 50000 : 65000; }
export function onHellIsland(x: number, z: number, elapsed = 0): boolean { return HELL_ISLANDS.some((i, index) => elapsed < islandCollapseAt(index) && Math.hypot(x - i.x, z - i.z) <= i.radius); }
export interface KnockbackInput { type: "KNOCKBACK_CONTROL"; x: number; z: number; yaw: number; punch: boolean; jump: boolean; guard?: boolean }
export interface KnockbackPlayer {
  x: number; y: number; z: number; vx: number; vy: number; vz: number; yaw: number;
  avatarId: number; hp: number; eliminatedAt: number | null; reason: "lava" | "hp" | null;
  guarding?: boolean; lastPunchAt: number; hits: number; grounded: boolean; jumpHeld: boolean;
}
export interface KnockbackHit { id: number; attacker: string; victim: string; at: number; x: number; y: number; z: number; damage: number }
export interface KnockbackState {
  startedAt: number; endsAt: number; simTime: number; players: Record<string, KnockbackPlayer>;
  controls: Record<string, { input: KnockbackInput; at: number }>;
  bots: Record<string, { nextAt: number; aimError: number }>;
  hits: KnockbackHit[]; hitId: number;
}
export type KnockbackView = Pick<KnockbackState, "startedAt" | "endsAt" | "simTime" | "players" | "hits">;
function create(c: MinigameCreateContext): KnockbackState {
  const spawns = [{ x: -10, z: 0 }, { x: 0, z: -10 }, { x: 10, z: 0 }, { x: 0, z: 10 }];
  const rotation = Math.min(3, Math.floor(c.random() * 4));
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, controls: {}, bots: {}, hits: [], hitId: 0,
    players: Object.fromEntries(c.participants.map((p, i) => {
      const spawn = spawns[(i + rotation) % 4];
      return [p.id, { ...spawn, y: 0, vx: 0, vy: 0, vz: 0, yaw: Math.atan2(-spawn.x, spawn.z),
        avatarId: p.avatarId ?? i, hp: KNOCKBACK_HP, eliminatedAt: null, reason: null,
        lastPunchAt: c.startedAt - PUNCH_COOLDOWN, hits: 0, grounded: true, jumpHeld: false }];
    })) };
}
function eliminate(s: KnockbackState, id: string, at: number, reason: "lava" | "hp") {
  const p = s.players[id]; p.eliminatedAt = at; p.reason = reason; p.hp = 0;
  delete s.controls[id]; delete s.bots[id];
}
export const knockbackFinished = (s: KnockbackState) => Object.values(s.players).filter((p) => p.eliminatedAt === null).length <= 1;
function punch(s: KnockbackState, id: string, at: number) {
  const p = s.players[id]; if (p.guarding || at - p.lastPunchAt < PUNCH_COOLDOWN) return;
  p.lastPunchAt = at;
  const target = Object.entries(s.players).filter(([otherId, o]) => {
    const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz);
    return otherId !== id && o.eliminatedAt === null && d < 2.25 && Math.abs(o.y - p.y) < 1.3 &&
      (d < .01 || (dx * Math.sin(p.yaw) - dz * Math.cos(p.yaw)) / d > .65);
  }).sort((a, b) => Math.hypot(a[1].x - p.x, a[1].z - p.z) - Math.hypot(b[1].x - p.x, b[1].z - p.z))[0];
  if (!target) return;
  const [victim, o] = target, d = Math.hypot(o.x - p.x, o.z - p.z);
  const dx = d > .01 ? (o.x - p.x) / d : Math.sin(p.yaw), dz = d > .01 ? (o.z - p.z) / d : -Math.cos(p.yaw);
  const damage = Math.min(o.guarding ? 3 : PUNCH_DAMAGE, o.hp); o.hp -= damage; p.hits++;
  o.vx += dx * (o.guarding ? 2.5 : 8.5); o.vz += dz * (o.guarding ? 2.5 : 8.5);
  s.hits.push({ id: ++s.hitId, attacker: id, victim, at, damage, x: o.x, y: o.y + 1.2, z: o.z });
  if (o.hp === 0) eliminate(s, victim, at, "hp");
}
export function tickKnockback(s: KnockbackState, now: number): boolean {
  const until = Math.min(now, s.endsAt); if (until <= s.simTime || knockbackFinished(s)) return false;
  while (s.simTime < until && !knockbackFinished(s)) {
    const next = Math.min(s.simTime + 20, until), dt = (next - s.simTime) / 1000;
    for (const [id, p] of Object.entries(s.players)) {
      if (p.eliminatedAt !== null) continue;
      const control = s.controls[id], input = control && next - control.at <= 300 ? control.input : null;
      p.guarding = !!input?.guard && p.grounded;
      if (input?.jump && !p.jumpHeld && p.grounded) { p.vy = 7; p.grounded = false; }
      p.jumpHeld = input?.jump ?? false;
      const norm = Math.max(1, Math.hypot(input?.x ?? 0, input?.z ?? 0));
      p.x += ((input?.x ?? 0) / norm * (p.guarding ? 2 : 4.8) + p.vx) * dt;
      p.z += ((input?.z ?? 0) / norm * (p.guarding ? 2 : 4.8) + p.vz) * dt;
      p.vx *= Math.exp(-3.5 * dt); p.vz *= Math.exp(-3.5 * dt);
      if (!onHellIsland(p.x, p.z, next - s.startedAt)) p.grounded = false;
      if (!p.grounded) {
        const before = p.y; p.vy -= 18 * dt; p.y += p.vy * dt;
        if (before >= 0 && p.y <= 0 && p.vy <= 0 && onHellIsland(p.x, p.z, next - s.startedAt)) { p.y = 0; p.vy = 0; p.grounded = true; }
        if (p.y <= LAVA_Y) eliminate(s, id, next, "lava");
      }
    }
    for (const [id, c] of Object.entries(s.controls)) if (s.players[id].eliminatedAt === null && next - c.at <= 300 && c.input.punch) punch(s, id, next);
    s.simTime = next;
  }
  s.hits = s.hits.filter((h) => s.simTime - h.at < 1000).slice(-24);
  return true;
}
export const lavaKnockback: MinigameDefinition<KnockbackState, KnockbackInput> = {
  id: "lava-knockback", name: "Hell Knockout", description: "Fists only. Knock your rivals off the islands and into lava.",
  instructions: ["Everyone starts with 200 HP on the hell islands. Some islands are larger; narrow rock paths connect the main islands.",
    "Every fist hit deals 10 damage and knocks the opponent back. Aim toward them and stay close.",
    "Falling into lava or reaching 0 HP eliminates you for the rest of the game. There are no respawns.",
    "Hold G to guard: less damage and knockback, but slower movement. Glowing islands collapse after a 5-second warning. Last survivor wins. At the time limit, survivors rank by HP, then landed punches."],
  controls: "WASD / arrows · mouse to aim · click / F to punch · G to guard · Space to jump · touch controls",
  durationSeconds: 75, gameType: "main", supportsBots: true, snapshotIntervalMs: 50,
  create,
  parseInput(i) {
    const bounded = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;
    return i.type === "KNOCKBACK_CONTROL" && bounded(i.x, 1) && bounded(i.z, 1) && bounded(i.yaw, Math.PI) && typeof i.punch === "boolean" && typeof i.jump === "boolean" && (i.guard === undefined || typeof i.guard === "boolean")
      ? { type: "KNOCKBACK_CONTROL", x: i.x, z: i.z, yaw: i.yaw, punch: i.punch, jump: i.jump, guard: i.guard === true } : null;
  },
  applyInput(s, id, input, at) {
    const p = s.players[id];
    if (!p || p.eliminatedAt !== null || at < s.startedAt || at >= s.endsAt || at < s.simTime) throw new Error("You are eliminated or the game is over.");
    s.controls[id] = { at, input: { ...input } }; p.yaw = input.yaw;
  },
  tick: tickKnockback, isFinished: knockbackFinished,
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, ((p.eliminatedAt ?? s.simTime) - s.startedAt) / 1000])),
  rank(s, ids, random) {
    const ties = Object.fromEntries(ids.map((id) => [id, random()]));
    return [...ids].sort((a, b) => {
      const p = s.players[a], q = s.players[b];
      return Number(q.eliminatedAt === null) - Number(p.eliminatedAt === null) ||
        (q.eliminatedAt ?? s.simTime) - (p.eliminatedAt ?? s.simTime) || q.hp - p.hp || q.hits - p.hits || ties[b] - ties[a];
    });
  },
  publicView: (s): KnockbackView => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), hits: structuredClone(s.hits) }),
  botInputs(s, bot, now, random) {
    const p = s.players[bot.id]; if (!p || p.eliminatedAt !== null || now < s.startedAt || now >= s.endsAt) return [];
    const plan = (s.bots[bot.id] ??= { nextAt: 0, aimError: 0 }); if (now < plan.nextAt) return [];
    plan.nextAt = now + (bot.difficulty === "extreme" ? 60 : 150); plan.aimError = (random() - .5) * { beginner: 1.6, easy: 1, medium: .75, hard: .5, extreme: .035 }[bot.difficulty];
    const target = Object.entries(s.players).filter(([id, o]) => id !== bot.id && o.eliminatedAt === null)
      .sort((a, b) => Math.hypot(a[1].x - p.x, a[1].z - p.z) - Math.hypot(b[1].x - p.x, b[1].z - p.z))[0]?.[1];
    if (!target) return [];
    const d = Math.hypot(target.x - p.x, target.z - p.z);
    // Travel via the central island rather than taking a shortcut over lava.
    const directSafe = Array.from({ length: 16 }, (_, i) => onHellIsland(p.x + (target.x - p.x) * (i + 1) / 16, p.z + (target.z - p.z) * (i + 1) / 16, now - s.startedAt + 1500)).every(Boolean);
    const evacuate = HELL_ISLANDS.some((island, index) => Math.hypot(p.x - island.x, p.z - island.z) < island.radius && islandCollapseAt(index) - (now - s.startedAt) < 5000 && index !== 0);
    const goal = directSafe && !evacuate ? target : { x: 0, z: 0 };
    const dx = goal.x - p.x, dz = goal.z - p.z, length = Math.max(.01, Math.hypot(dx, dz));
    const speed = { beginner: .45, easy: .65, medium: .725, hard: .8, extreme: 1 }[bot.difficulty];
    let yaw = Math.atan2(target.x - p.x, p.z - target.z) + plan.aimError;
    yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const safeStep = onHellIsland(p.x + dx / length * .7, p.z + dz / length * .7, now - s.startedAt + 1000);
    return [{ at: Math.max(now, s.simTime), input: { type: "KNOCKBACK_CONTROL", x: d < 1.35 ? 0 : dx / length * speed, z: d < 1.35 ? 0 : dz / length * speed,
      yaw, guard: bot.difficulty === "extreme" && d < 2.3 && now - target.lastPunchAt > PUNCH_COOLDOWN - 90 && now - p.lastPunchAt < PUNCH_COOLDOWN - 70, jump: !safeStep && p.grounded, punch: d < 2.2 && random() < { beginner: .2, easy: .4, medium: .55, hard: .7, extreme: .999 }[bot.difficulty] } }];
  },
};
