import { BOT_NAMES, COLORS, EAT, FOOD, massToRadius, massToSpeed } from './config.ts';
import { botInput } from './bots.ts';
import { clamp, clearPath, distance, resolveWalls, zoneRadius } from './maps.ts';
import { angleDelta, canEatPlayer, foodFits, inMouth, mouthPosition } from './rules.ts';
import { spawnFood, spawnPosition, updateSpawns } from './spawn.ts';
import type { GameEvent, GameState, Input, MapId, Participant, Player, PowerObject } from './types.ts';

export function createGame(map: MapId, participants: Participant[], seed = 12345, id = `local-${seed}`): GameState {
  if (participants.length < 2 || participants.length > EAT.match.maxPlayers || new Set(participants.map(p => p.id)).size !== participants.length) throw new Error('Eat It requires 2–8 unique participants.');
  const state: GameState = { id, map, rng: seed || 1, nextId: 1, time: 0, status: 'playing', winnerId: null,
    players: [], food: [], powerups: [], events: [], nextFood: 1, nextPower: EAT.powerups.spawnInterval, spawnSector: 0 };
  participants.forEach((participant, i) => {
    const p = spawnPosition(state, 90, Math.floor(i * 12 / participants.length)) ?? { x: 800 + (i % 4) * 170, y: 600 + Math.floor(i / 4) * 260 };
    state.players.push({ ...p, id: participant.id, name: participant.name, bot: !!participant.bot, color: COLORS[i],
      mass: EAT.player.startingMass, vx: 0, vy: 0, facing: Math.atan2(800 - p.y, 1100 - p.x), alive: true, placement: null,
      eliminatedBy: null, eliminatedAt: null, score: 0, foodEaten: 0, playersEaten: 0, powerupsCollected: 0,
      effects: { speed: 0, shield: 0, magnet: 0, growth: 0 }, input: { x: 0, y: 0 }, botState: 'FORAGE', nextDecision: 0 });
  });
  for (let i = 0; i < EAT.food.spawnCount; i++) spawnFood(state, true);
  for (const kind of ['speed', 'shield', 'magnet', 'growth'] as const) {
    const p = spawnPosition(state, EAT.powerups.radius);
    if (p) state.powerups.push({ ...p, id: state.nextId++, kind });
  }
  return state;
}
export function fillBots(humans: Participant[], count: number): Participant[] {
  const result = [...humans];
  while (result.length < clamp(Math.floor(count), 2, EAT.match.maxPlayers)) {
    const i = result.length; result.push({ id: `bot-${i}`, name: BOT_NAMES[i % BOT_NAMES.length], bot: true });
  }
  return result;
}
export function sanitizeInput(value: unknown): Input {
  if (!value || typeof value !== 'object') return { x: 0, y: 0 };
  const { x, y } = value as Input;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { x: 0, y: 0 };
  const length = Math.max(1, Math.hypot(x, y)); return { x: x / length, y: y / length };
}
function emit(state: GameState, event: Omit<GameEvent, 'id' | 'at'>) {
  state.events.push({ ...event, id: state.nextId++, at: state.time });
}
export function eliminate(state: GameState, victim: Player, killer: Player | null = null): boolean {
  if (!victim.alive || state.status !== 'playing') return false;
  victim.placement = state.players.filter(p => p.alive).length;
  victim.alive = false; victim.eliminatedAt = state.time; victim.eliminatedBy = killer?.id ?? null;
  victim.vx = 0; victim.vy = 0;
  if (killer) {
    killer.mass += victim.mass * EAT.eating.playerMassTransfer; killer.score += Math.round(victim.mass * 10);
    killer.playersEaten++;
    emit(state, { type: 'eat', playerId: killer.id, victimId: victim.id, x: victim.x, y: victim.y, radius: massToRadius(victim.mass) });
  } else emit(state, { type: 'eliminated', playerId: victim.id, x: victim.x, y: victim.y });
  return true;
}
export function checkWinner(state: GameState): void {
  if (state.status !== 'playing') return;
  const survivors = state.players.filter(p => p.alive);
  if (survivors.length === 1) {
    state.status = 'finished'; state.winnerId = survivors[0].id; survivors[0].placement = 1;
    emit(state, { type: 'win', playerId: survivors[0].id, x: survivors[0].x, y: survivors[0].y });
  }
}
export function collectPower(state: GameState, p: Player, power: PowerObject): void {
  const index = state.powerups.findIndex(item => item.id === power.id);
  if (index < 0 || !p.alive) return;
  state.powerups.splice(index, 1); p.powerupsCollected++;
  if (power.kind === 'growth') { p.mass += EAT.powerups.growth.mass; p.effects.growth = state.time + EAT.powerups.growth.indicatorDuration; }
  else p.effects[power.kind] = state.time + EAT.powerups[power.kind].duration;
  p.score += 40; emit(state, { type: 'power', playerId: p.id, power: power.kind, x: power.x, y: power.y });
}
export function movePlayer(state: Pick<GameState, 'map' | 'time'>, p: Player, input: Input, dt: number): void {
  const direction = sanitizeInput(input), moving = Math.hypot(direction.x, direction.y) > 0.05;
  const max = massToSpeed(p.mass) * (p.effects.speed > state.time ? EAT.powerups.speed.strength : 1);
  if (moving) {
    p.vx += direction.x * EAT.player.acceleration * dt; p.vy += direction.y * EAT.player.acceleration * dt;
    // Drag perpendicular velocity so corners feel responsive without snapping.
    const along = p.vx * direction.x + p.vy * direction.y;
    p.vx += (direction.x * along - p.vx) * Math.min(1, EAT.player.friction * dt);
    p.vy += (direction.y * along - p.vy) * Math.min(1, EAT.player.friction * dt);
    const desired = Math.atan2(direction.y, direction.x), turn = EAT.player.turnSpeed * (max / EAT.player.baseSpeed) * dt;
    p.facing += clamp(angleDelta(p.facing, desired), -turn, turn);
  } else { const drag = Math.exp(-EAT.player.friction * dt); p.vx *= drag; p.vy *= drag; }
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > max) { p.vx *= max / speed; p.vy *= max / speed; }
  p.x += p.vx * dt; p.y += p.vy * dt; resolveWalls(state.map, p, massToRadius(p.mass));
}

/** Mutates plain serializable state. Only local solo play or the server calls this. */
export function stepGame(state: GameState, dt = 1 / EAT.network.tickRate): void {
  if (state.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / EAT.network.tickRate); state.time += dt;
  for (const p of state.players) {
    if (!p.alive) continue;
    if (p.bot && state.time >= p.nextDecision) { p.input = botInput(state, p); p.nextDecision = state.time + EAT.bots.decisionInterval; }
    movePlayer(state, p, p.input, dt);
  }
  // Resolve mouths before gentle body separation. A body collision never eliminates.
  for (const a of state.players) for (const b of state.players) {
    if (canEatPlayer(a, b, state.time, state.map)) eliminate(state, b, a);
  }
  for (let i = 0; i < state.players.length; i++) for (let j = i + 1; j < state.players.length; j++) {
    const a = state.players[i], b = state.players[j]; if (!a.alive || !b.alive) continue;
    const d = distance(a, b), overlap = (massToRadius(a.mass) + massToRadius(b.mass)) * 0.84 - d;
    if (overlap <= 0) continue;
    const dx = d > 0 ? (b.x - a.x) / d : 1, dy = d > 0 ? (b.y - a.y) / d : 0;
    const push = overlap * EAT.player.bodyPush;
    a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    resolveWalls(state.map, a, massToRadius(a.mass)); resolveWalls(state.map, b, massToRadius(b.mass));
    if (!state.events.some(e => e.type === 'collision' && e.playerId === a.id && state.time - e.at < 0.4)) emit(state, { type: 'collision', playerId: a.id, victimId: b.id, x: a.x, y: a.y });
  }
  const eaten = new Set<number>();
  for (const f of state.food) {
    const info = FOOD[f.kind];
    let owner = f.target ? state.players.find(p => p.id === f.target && p.alive) : undefined;
    if (f.target && (!owner || !foodFits(owner, f))) { f.target = null; owner = undefined; }
    if (!owner) {
      for (const p of state.players) {
        if (!p.alive || !foodFits(p, f)) continue;
        const d = distance(p, f), r = massToRadius(p.mass);
        const reach = p.effects.magnet > state.time ? EAT.powerups.magnet.range + r : r + EAT.eating.foodAttractionRange + EAT.eating.mouthRange + info.radius;
        if (d > reach || !clearPath(state.map, p, f)) continue;
        const mouth = mouthPosition(p);
        if (p.effects.magnet > state.time && d < EAT.powerups.magnet.range + massToRadius(p.mass)) {
          const length = Math.max(1, distance(mouth, f));
          f.vx += (mouth.x - f.x) / length * EAT.powerups.magnet.strength * dt;
          f.vy += (mouth.y - f.y) / length * EAT.powerups.magnet.strength * dt;
        }
        if (inMouth(p, f, info.radius, EAT.eating.foodAttractionRange) && f.z < 25) { f.target = p.id; f.capturedAt = state.time; owner = p; break; }
        if (d < massToRadius(p.mass) + info.radius && d > 0) {
          f.vx += (f.x - p.x) / d * 110 * dt; f.vy += (f.y - p.y) / d * 110 * dt;
        }
      }
    }
    if (owner) {
      const mouth = mouthPosition(owner), d = distance(f, mouth);
      if (d > massToRadius(owner.mass) + EAT.eating.foodAttractionRange * 3 || !clearPath(state.map, f, mouth, info.radius)) { f.target = null; continue; }
      const step = Math.min(d, EAT.eating.attractionSpeed * dt);
      if (d > 0) { f.x += (mouth.x - f.x) / d * step; f.y += (mouth.y - f.y) / d * step; }
      f.z *= Math.exp(-15 * dt); f.rotation += dt * 4;
      if (distance(f, mouth) < 6 && state.time - f.capturedAt >= EAT.eating.foodAnimation) {
        eaten.add(f.id); owner.mass += info.mass; owner.score += info.score; owner.foodEaten++;
        emit(state, { type: 'food', playerId: owner.id, food: f.kind, x: mouth.x, y: mouth.y });
      }
    } else {
      f.x += f.vx * dt; f.y += f.vy * dt; const damping = Math.exp(-EAT.food.friction * dt); f.vx *= damping; f.vy *= damping;
      if (f.z > 0 || f.vz !== 0) { f.vz -= EAT.food.gravity * dt; f.z += f.vz * dt; if (f.z < 0) { f.z = 0; f.vz = Math.abs(f.vz) > 28 ? -f.vz * EAT.food.bounce : 0; } }
      resolveWalls(state.map, f, info.radius + 4);
    }
  }
  state.food = state.food.filter(f => !eaten.has(f.id));
  for (const power of [...state.powerups]) {
    const p = state.players.find(p => p.alive && inMouth(p, power, EAT.powerups.radius) && clearPath(state.map, p, power));
    if (p) collectPower(state, p, power);
  }
  checkWinner(state);
  // A closing picnic boundary prevents endless stalemates; shields protect from bites only.
  if (state.status === 'playing' && state.time > EAT.match.zoneStart) {
    const center = { x: EAT.match.width / 2, y: EAT.match.height / 2 };
    for (const p of [...state.players].sort((a, b) => a.mass - b.mass)) {
      if (!p.alive || state.status !== 'playing') continue;
      if (distance(p, center) + massToRadius(p.mass) > zoneRadius(state.time)) {
        p.mass -= EAT.match.zoneMassLoss * dt;
        if (p.mass < EAT.player.minMass) { p.mass = EAT.player.minMass; eliminate(state, p); checkWinner(state); }
      }
    }
  }
  updateSpawns(state);
  state.events = state.events.filter(e => state.time - e.at < 2).slice(-80);
}
