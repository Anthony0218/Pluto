import type { MinigameInput } from "../../types.ts";
import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { ARENA_MAPS, WEAPONS, collides, walkHeight, rayBox, obstructionDistance, type ArenaMapId, type ArenaPoint, type WeaponId } from "./maps.ts";

export interface ArenaInput { type: "ARENA_CONTROL"; forward: number; strafe: number; yaw: number; pitch: number; fire: boolean }
type PickupInput = { type: "ARENA_PICKUP" };
export interface ArenaPlayer extends ArenaPoint {
  avatarId?: number;
  yaw: number; pitch: number; hp: number; weapon: WeaponId | null; ammo: number;
  kills: number; deaths: number; respawnAt: number | null; protectedUntil: number; lastShotAt: number;
}
export interface ArenaShot { id: number; from: ArenaPoint; to: ArenaPoint; at: number; weapon: WeaponId; playerId: string }
export interface ArenaHit { id: number; attacker: string; victim: string; at: number; damage: number; headshot: boolean; hpAfter: number; position: ArenaPoint }
interface ArenaBotPlan { nextAt: number; routeAt: number; route: ArenaPoint[]; goal: string; targetId: string | null; seenAt: number; nextFireAt: number }
export const ARENA_BOT_PROFILES = {
  easy: { reactionMs: 1300, shotPauseMs: 1500, aimSpread: 0.62, pitchSpread: 0.20, speed: 0.7 },
  medium: { reactionMs: 950, shotPauseMs: 1100, aimSpread: 0.38, pitchSpread: 0.12, speed: 0.8 },
  hard: { reactionMs: 650, shotPauseMs: 850, aimSpread: 0.22, pitchSpread: 0.075, speed: 0.9 },
};
export interface ArenaState {
  map: ArenaMapId; startedAt: number; endsAt: number; simTime: number;
  players: Record<string, ArenaPlayer>; pickups: { id: number; availableAt: number }[];
  supplies: { id: number; availableAt: number }[]; seed: number;
  controls: Record<string, { input: ArenaInput; at: number }>;
  bots: Record<string, ArenaBotPlan>; shots: ArenaShot[]; shotId: number; hits: ArenaHit[];
  feed: { killer: string; victim: string; weapon: WeaponId; headshot: boolean; at: number }[];
}
export type ArenaView = Pick<ArenaState, "map" | "startedAt" | "endsAt" | "simTime" | "players" | "pickups" | "supplies" | "shots" | "hits" | "feed">;
const neutral = (): ArenaInput => ({ type: "ARENA_CONTROL", forward: 0, strafe: 0, yaw: 0, pitch: 0, fire: false });
const distance = (a: ArenaPoint, b: ArenaPoint) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function create(context: MinigameCreateContext): ArenaState {
  const map = context.random() < 0.5 ? "arcade" : "city";
  const spawns = [...ARENA_MAPS[map].spawns];
  // Randomize seats, keeping all four starts equally far from a pickup.
  for (let i = spawns.length - 1; i > 0; i--) {
    const j = Math.floor(context.random() * (i + 1)); [spawns[i], spawns[j]] = [spawns[j], spawns[i]];
  }
  return {
    map, startedAt: context.startedAt, endsAt: context.endsAt, simTime: context.startedAt,
    players: Object.fromEntries(context.participants.map((p, i) => [p.id, {
      ...spawns[i % spawns.length], avatarId: p.avatarId ?? 2, yaw: 0, pitch: 0, hp: 100, weapon: null, ammo: 0,
      kills: 0, deaths: 0, respawnAt: null, protectedUntil: context.startedAt + 1500, lastShotAt: context.startedAt - 10_000,
    }])),
    pickups: ARENA_MAPS[map].pickups.map((_, id) => ({ id, availableAt: context.startedAt })),
    supplies: ARENA_MAPS[map].supplies.map((_, id) => ({ id, availableAt: context.startedAt })), seed: Math.floor(context.random() * 4294967296),
    controls: {}, bots: {}, shots: [], shotId: 0, hits: [], feed: [],
  };
}
export function parseArenaInput(input: MinigameInput): ArenaInput | PickupInput | null {
  if (input.type === "ARENA_PICKUP") return { type: "ARENA_PICKUP" };
  const finite = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;
  if (input.type !== "ARENA_CONTROL" || !finite(input.forward, 1) || !finite(input.strafe, 1) ||
    !finite(input.yaw, Math.PI) || !finite(input.pitch, 1.45) || typeof input.fire !== "boolean") return null;
  return { type: "ARENA_CONTROL", forward: input.forward, strafe: input.strafe, yaw: input.yaw, pitch: input.pitch, fire: input.fire };
}
function pickup(state: ArenaState, id: string, at: number) {
  const p = state.players[id], map = ARENA_MAPS[state.map];
  const available = state.pickups.filter((item) => item.availableAt <= at && distance(p, map.pickups[item.id]) < 1.5)
    .sort((a, b) => distance(p, map.pickups[a.id]) - distance(p, map.pickups[b.id]));
  const item = available[0]; if (!item) return false;
  p.weapon = map.pickups[item.id].weapon; p.ammo = WEAPONS[p.weapon].ammo;
  item.availableAt = at + 10_000; return true;
}
function applyInput(state: ArenaState, id: string, input: ArenaInput | PickupInput, at: number) {
  const p = state.players[id];
  if (!p || p.hp <= 0 || at < state.startedAt || at >= state.endsAt) throw new Error("Wait until you respawn.");
  if (input.type === "ARENA_PICKUP") {
    if (!pickup(state, id, at)) throw new Error("Move closer to an available weapon.");
  } else {
    state.controls[id] = { input: { ...input }, at }; p.yaw = input.yaw; p.pitch = input.pitch;
  }
}
export function collectSupplies(state: ArenaState, id: string, at: number): boolean {
  const p = state.players[id]; if (!p || p.hp <= 0) return false;
  let changed = false;
  for (const item of state.supplies) {
    const supply = ARENA_MAPS[state.map].supplies[item.id];
    if (at < item.availableAt || distance(p, supply) >= 1.3) continue;
    if (supply.kind === "health") { if (p.hp >= 100) continue; p.hp = Math.min(100, p.hp + 40); }
    else { if (!p.weapon || p.weapon === "knife" || p.ammo >= WEAPONS[p.weapon].ammo * 3) continue;
      p.ammo = Math.min(WEAPONS[p.weapon].ammo * 3, p.ammo + WEAPONS[p.weapon].ammo); }
    item.availableAt = at + 12_000; changed = true;
  }
  return changed;
}
function fire(state: ArenaState, id: string, at: number) {
  const p = state.players[id];
  if (!p.weapon || p.ammo === 0 || at - p.lastShotAt < WEAPONS[p.weapon].cooldown || at < p.protectedUntil) return;
  const weapon = p.weapon, spec = WEAPONS[weapon]; p.lastShotAt = at;
  if (p.ammo > 0) p.ammo--;
  const origin = { x: p.x, y: p.y + 1.55, z: p.z };
  const direction = { x: Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * Math.cos(p.pitch) };
  let hitDistance = Math.min(spec.range, obstructionDistance(ARENA_MAPS[state.map], origin, direction));
  let victim: string | null = null, headshot = false;
  for (const [otherId, other] of Object.entries(state.players)) if (otherId !== id && other.hp > 0) {
    const ghost = (other.avatarId ?? 2) % 4 === 3;
    const head = rayBox(origin, direction, { x: other.x, y: other.y + (ghost ? 1.3 : 1.45), z: other.z, w: 0.58, h: 0.55, d: 0.58, color: "", kind: "cover" });
    const body = rayBox(origin, direction, { x: other.x, y: other.y + 0.65, z: other.z, w: 0.75, h: 1.25, d: 0.7, color: "", kind: "cover" });
    const d = Math.min(head, body);
    if (d < hitDistance) { hitDistance = d; victim = otherId; headshot = weapon !== "knife" && head <= body; }
  }
  state.shots.push({ id: ++state.shotId, playerId: id, weapon, at, from: origin,
    to: { x: origin.x + direction.x * hitDistance, y: origin.y + direction.y * hitDistance, z: origin.z + direction.z * hitDistance } });
  if (!victim) return;
  const other = state.players[victim]; if (at < other.protectedUntil) return;
  const damage = Math.min(other.hp, spec.damage * (headshot ? 2 : 1));
  other.hp -= damage;
  state.hits.push({ id: state.shotId, attacker: id, victim, at, damage, headshot, hpAfter: other.hp,
    position: { x: origin.x + direction.x * hitDistance, y: origin.y + direction.y * hitDistance, z: origin.z + direction.z * hitDistance } });
  if (!other.hp) {
    p.kills++; other.deaths++; other.respawnAt = at + 3000; other.weapon = null; other.ammo = 0;
    delete state.controls[victim]; delete state.bots[victim];
    state.feed.unshift({ killer: id, victim, weapon, headshot, at }); state.feed = state.feed.slice(0, 4);
  }
}
export function moveArenaPlayer(map: (typeof ARENA_MAPS)[ArenaMapId], p: ArenaPoint, input: ArenaInput, seconds: number) {
  const norm = Math.max(1, Math.hypot(input.forward, input.strafe));
  const dx = (Math.sin(input.yaw) * input.forward + Math.cos(input.yaw) * input.strafe) / norm * 6 * seconds;
  const dz = (-Math.cos(input.yaw) * input.forward + Math.sin(input.yaw) * input.strafe) / norm * 6 * seconds;
  // Split axes lets the player slide along cover without walking through it.
  for (const point of [{ x: p.x + dx, z: p.z }, { x: p.x + dx, z: p.z + dz }]) {
    if (point.z !== p.z) point.x = p.x;
    const y = walkHeight(map, p, point.x, point.z);
    if (y !== null && !collides(map, point.x, y, point.z)) { p.x = point.x; p.z = point.z; p.y = y; }
  }
}
export function tickArena(state: ArenaState, now: number): boolean {
  const end = Math.min(now, state.endsAt); if (end <= state.simTime) return false;
  // Catch up in bounded physical steps so late inputs cannot teleport or tunnel through cover.
  while (state.simTime < end) {
    const next = Math.min(state.simTime + 50, end), seconds = (next - state.simTime) / 1000;
    for (const [id, p] of Object.entries(state.players)) {
      if (p.hp <= 0) {
        if (p.respawnAt !== null && next >= p.respawnAt) {
          const others = Object.values(state.players).filter((o) => o !== p && o.hp > 0);
          const candidates = ARENA_MAPS[state.map].spawns.filter((s) => others.every((o) => distance(s, o) >= 8));
          state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
          const safe = candidates.length ? candidates[Math.floor(state.seed / 4294967296 * candidates.length)] :
            [...ARENA_MAPS[state.map].spawns].sort((a, b) => Math.min(...others.map((o) => distance(b, o)), 100) - Math.min(...others.map((o) => distance(a, o)), 100))[0];
          Object.assign(p, safe, { hp: 100, weapon: null, ammo: 0, respawnAt: null, protectedUntil: next + 1500 });
        }
        continue;
      }
      const control = state.controls[id];
      if (control && next - control.at <= 350) moveArenaPlayer(ARENA_MAPS[state.map], p, control.input, seconds);
      collectSupplies(state, id, next);
      if (!p.weapon || p.ammo === 0) pickup(state, id, next);
    }
    for (const [id, control] of Object.entries(state.controls)) if (state.players[id].hp > 0 && next - control.at <= 350 && control.input.fire) fire(state, id, next);
    state.simTime = next;
  }
  state.shots = state.shots.filter((s) => end - s.at < 450).slice(-24);
  state.hits = state.hits.filter((hit) => end - hit.at < 1500).slice(-32);
  return true;
}
// Bots navigate the same walkable surfaces as humans, including the four stairs. A small BFS is only
// needed when a goal changes; its nodes are not part of the network snapshot.
function routeTo(state: ArenaState, start: ArenaPoint, target: ArenaPoint): ArenaPoint[] {
  const map = ARENA_MAPS[state.map], initial = { x: Math.round(start.x), y: start.y, z: Math.round(start.z) };
  const key = (p: ArenaPoint) => `${p.x},${Math.round(p.y * 2)},${p.z}`;
  const queue = [initial], previous = new Map<string, ArenaPoint | null>([[key(initial), null]]);
  let nearest = initial, best = distance(initial, target);
  for (let i = 0; i < queue.length && i < 6000; i++) {
    const point = queue[i], d = distance(point, target);
    if (d < best) { best = d; nearest = point; }
    if (d < 1) break;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = point.x + dx, z = point.z + dz;
      // Two half steps satisfy the same ramp height limit as real movement.
      const midY = walkHeight(map, point, point.x + dx / 2, point.z + dz / 2);
      const y = midY === null ? null : walkHeight(map, { x, y: midY, z }, x, z);
      if (y === null || collides(map, x, y, z)) continue;
      const next = { x, y, z }, k = key(next);
      if (!previous.has(k)) { previous.set(k, point); queue.push(next); }
    }
  }
  const route: ArenaPoint[] = [];
  for (let p: ArenaPoint | null = nearest; p; p = previous.get(key(p)) ?? null) route.unshift(p);
  return route.slice(1);
}
export const pickupArena: MinigameDefinition<ArenaState, ArenaInput | PickupInput> = {
  id: "pickup-arena", name: "Pickup Shootout", description: "Find a weapon and fight for the highest kill count.",
  instructions: ["Everyone starts unarmed. Walk over a weapon to equip it; use E to swap.",
    "One kill = one point. You respawn unarmed after three seconds.",
    "Walk over health packs (+40 HP) and ammo boxes (one magazine). Supplies return after 12 seconds.",
    "Headshots deal double damage. A Desert Eagle headshot eliminates a full-health opponent.",
    "Random arena: three-floor arcade with four stairs, or city buildings and street cover."],
  controls: "WASD + mouse · click to shoot / knife · E to swap · touch move, look and fire controls",
  durationSeconds: 120, gameType: "main", supportsBots: true, snapshotIntervalMs: 100,
  create, parseInput: parseArenaInput, applyInput, tick: tickArena,
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.kills])),
  rank(s, ids, random) {
    const ties = Object.fromEntries(ids.map((id) => [id, random()]));
    return [...ids].sort((a, b) => s.players[b].kills - s.players[a].kills || s.players[a].deaths - s.players[b].deaths || ties[b] - ties[a]);
  },
  publicView: (s): ArenaView => ({ map: s.map, startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime,
    players: structuredClone(s.players), pickups: s.pickups.map((p) => ({ ...p })), supplies: s.supplies.map((p) => ({ ...p })), shots: structuredClone(s.shots), hits: structuredClone(s.hits), feed: structuredClone(s.feed) }),
  botInputs(state, bot, now, random) {
    const p = state.players[bot.id]; if (!p || !p.hp || now < state.startedAt) return [];
    const profile = ARENA_BOT_PROFILES[bot.difficulty];
    const plan = (state.bots[bot.id] ??= { nextAt: 0, routeAt: 0, route: [], goal: "", targetId: null, seenAt: now, nextFireAt: now });
    if (now < plan.nextAt) return [];
    plan.nextAt = now + 150;
    const map = ARENA_MAPS[state.map];
    const opponents = Object.entries(state.players).filter(([id, o]) => id !== bot.id && o.hp > 0).sort((a, b) => distance(p, a[1]) - distance(p, b[1]));
    const target = opponents[0];
    let goal: ArenaPoint | undefined, goalId = "", visible = false;
    const supply = state.supplies.filter((item) => item.availableAt <= now &&
      (map.supplies[item.id].kind === "health" ? p.hp <= 40 : !!p.weapon && p.weapon !== "knife" && p.ammo <= 2))
      .sort((a, b) => distance(p, map.supplies[a.id]) - distance(p, map.supplies[b.id]))[0];
    if (supply) { goal = map.supplies[supply.id]; goalId = `supply:${supply.id}`; }
    else if (p.weapon && p.ammo !== 0 && target) {
      goal = target[1]; goalId = target[0] + `:${Math.round(goal.x / 3)},${Math.round(goal.y)},${Math.round(goal.z / 3)}`;
      const d = distance(p, goal), origin = { x: p.x, y: p.y + 1.55, z: p.z };
      const direction = { x: (goal.x - p.x) / d, y: (goal.y + 1.1 - origin.y) / d, z: (goal.z - p.z) / d };
      visible = d < WEAPONS[p.weapon].range && obstructionDistance(map, origin, direction) >= d - 0.5;
    } else {
      const item = state.pickups.filter((item) => item.availableAt <= now).sort((a, b) => distance(p, map.pickups[a.id]) - distance(p, map.pickups[b.id]))[0];
      if (item) { goal = map.pickups[item.id]; goalId = `pickup:${item.id}`; }
    }
    if (!goal) return [{ at: now, input: neutral() }];
    const stop = visible && p.weapon !== "knife" && distance(p, goal) < 10;
    if (!stop && now >= plan.routeAt && (plan.goal !== goalId || !plan.route.length)) {
      plan.goal = goalId; plan.route = routeTo(state, p, goal); plan.routeAt = now + 1200;
    }
    while (plan.route.length && distance(p, plan.route[0]) < 0.5) plan.route.shift();
    const waypoint = plan.route[0] ?? goal;
    const aim = visible ? goal : waypoint;
    const visibleId = visible && target ? target[0] : null;
    if (visibleId !== plan.targetId) { plan.targetId = visibleId; plan.seenAt = now; }
    if (!visible) plan.seenAt = now;
    const error = profile.aimSpread * (random() - 0.5);
    const yaw = Math.atan2(aim.x - p.x, p.z - aim.z) + (visible ? error : 0);
    const wrappedYaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    const pitch = visible ? Math.atan2(goal.y - p.y - 0.35, Math.hypot(goal.x - p.x, goal.z - p.z)) + profile.pitchSpread * (random() - 0.5) : 0;
    const walkingYaw = Math.atan2(waypoint.x - p.x, p.z - waypoint.z), offset = walkingYaw - wrappedYaw;
    // Slow down near a waypoint so a 100 ms room tick cannot repeatedly overshoot a stair step.
    const speed = stop ? 0 : Math.min(profile.speed, Math.hypot(waypoint.x - p.x, waypoint.z - p.z) / 1.5);
    const shoot = visible && now - plan.seenAt >= profile.reactionMs && now >= plan.nextFireAt;
    if (shoot) plan.nextFireAt = now + profile.shotPauseMs;
    return [{ at: now, input: { type: "ARENA_CONTROL", forward: speed * Math.cos(offset), strafe: speed * Math.sin(offset),
      yaw: wrappedYaw, pitch: Math.max(-1.45, Math.min(1.45, pitch)), fire: shoot } }];
  },
};
