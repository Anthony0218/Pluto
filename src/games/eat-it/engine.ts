import { abilityVelocity, stepJump, canStorePower } from './abilities.ts';
import { stepStuckTree } from './choking.ts';
import { stepBurp } from './expressions.ts';
import { botPolicy } from './bots.ts';
import { matchSettings, newStats, clearTemporary, recordEvent, canUnderpass, unavailable, respawn, foodReward, grantGrowth, countCollected } from './progression.ts';
import { startHell, stepHell } from './hell.ts';
import { activateEscape, stepEscape } from './escape.ts';
import { BOT_NAMES, COLORS, EAT, FOOD, POWER_KINDS, isBigProp, matchDuration, playerRadius, massToSpeed } from './config.ts';
import { createEncounter, stepEncounter, finishEncounter, resolveShrine, shrineClear } from './quests.ts';
import { beginFall, fallOffset, fallPose, jamAge, jamsInMouth } from './falling.ts';
import { collideObjects, objectContact } from './physics.ts';
import { botInput } from './bots.ts';
import { clamp, clearPath, distance, resolveWalls, zoneRadius } from './maps.ts';
import { angleDelta, canEatPlayer, consumptionDuration, entersMouth, foodFits, inMouth, mouthPosition, mouthCoordinates, playerFits, canopyFits, treeParts, isChoking } from './rules.ts';
import { spawnCityBuildings, spawnFood, spawnPluto, spawnPosition, updateSpawns } from './spawn.ts';
import type { GameEvent, GameState, Input, MapId, Participant, Player, PowerObject, MatchSettings } from './types.ts';

export function createGame(map: MapId, participants: Participant[], seed = 12345, id = `local-${seed}`, options: Partial<MatchSettings> = {}): GameState {
  if (options.mode === 'solo' && options.botsEnabled === false) participants = participants.filter(p => !p.bot);
  if (participants.length < (options.mode === 'solo' ? 1 : 2) || participants.length > EAT.match.maxPlayers || new Set(participants.map(p => p.id)).size !== participants.length) throw new Error('Eat It requires 1–8 unique participants (at least two online).');
  const state: GameState = { id, map, rng: seed || 1, nextId: 1, time: 0, status: 'playing', winnerId: null,
    settings: matchSettings(options), phase: 'normal', timeline: [], nextPluto: EAT.pluto.interval, players: [], food: [], powerups: [], events: [], nextFood: 1, nextPower: EAT.powerups.spawnInterval, spawnSector: 0 };
  participants.forEach((participant, i) => {
    const p = spawnPosition(state, 90, Math.floor(i * 12 / participants.length)) ?? { x: 800 + (i % 4) * 170, y: 600 + Math.floor(i / 4) * 260 };
    state.players.push({ ...p, id: participant.id, name: participant.name, bot: !!participant.bot, color: COLORS[i],
      nextBurp: 27 + i * 6 / participants.length, lives: state.settings?.livesEnabled === false ? 1 : EAT.lives.count, stats: newStats(), mass: EAT.player.startingMass, vx: 0, vy: 0, facing: Math.atan2(EAT.match.height / 2 - p.y, EAT.match.width / 2 - p.x), alive: true, placement: null,
      eliminatedBy: null, eliminatedAt: null, score: 0, foodEaten: 0, playersEaten: 0, powerupsCollected: 0,
      effects: { speed: 0, shield: 0, magnet: 0, multiplier: 0, divider: 0, jump: 0, strike: 0 }, input: { x: 0, y: 0 }, botState: 'FORAGE', nextDecision: 0 });
  });
  state.spawnLocations = state.players.map(p => ({ x: p.x, y: p.y }));
  createEncounter(state);
  if (map === 'city') spawnCityBuildings(state);
  for (let i = 0; i < EAT.food.spawnCount * 3 && state.food.length < EAT.food.spawnCount; i++) spawnFood(state, true);
  state.bigTarget = state.food.filter(f => isBigProp(f.kind)).length; state.nextBig = EAT.food.bigRespawnInterval;
  // Only common items start on the map; Shield, Strike and growth items arrive via weighted spawns.
  for (const kind of ['speed', 'magnet'] as const) {
    const p = spawnPosition(state, EAT.powerups.radius);
    if (p) state.powerups.push({ ...p, id: state.nextId++, kind });
  }
  for (let i = 0; i < EAT.pluto.initialCount; i++) spawnPluto(state);
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
  recordEvent(state, event, ['eat', 'eliminated', 'win', 'tie'].includes(event.type));
}
export function eliminate(state: GameState, victim: Player, killer: Player | null = null): boolean {
  if (!victim.alive || state.status !== 'playing' || epilogue) return false;
  victim.placement = state.players.filter(p => p.alive || (state.phase === 'normal' && state.settings?.livesEnabled !== false && (p.lives ?? 0) > 0)).length;
  victim.alive = false; victim.eliminatedAt = state.time; victim.eliminatedBy = killer?.id ?? null;
  const stats = victim.stats ??= newStats(); stats.deaths++; stats.maxMass = Math.max(stats.maxMass, victim.mass);
  victim.lives = Math.max(0, (victim.lives ?? 1) - 1);
  if (state.phase === 'normal' && state.settings?.livesEnabled !== false && victim.lives > 0) { victim.respawnAt = state.time + EAT.lives.respawnDelay; victim.placement = null; }
  clearTemporary(state, victim);
  victim.vx = 0; victim.vy = 0;
  if (killer) {
    grantGrowth(state, killer, victim.mass * EAT.eating.playerMassTransfer); countCollected(killer, 'player'); killer.score += Math.round(victim.mass * 10);
    killer.playersEaten++;
    if (killer.ability?.kind === 'strike' || state.time - (killer.lastStrikeAt ?? -10) < .15) { const stats = killer.stats ??= newStats(); stats.strikeDevours = (stats.strikeDevours ?? 0) + 1; }
    emit(state, { type: 'eat', playerId: killer.id, victimId: victim.id, x: victim.x, y: victim.y, radius: playerRadius(victim, state.time) });
  } else emit(state, { type: 'eliminated', playerId: victim.id, x: victim.x, y: victim.y });
  return true;
}
export function checkWinner(state: GameState): void {
  if (state.status !== 'playing' || epilogue) return;
  const eligible = state.players.filter(p => p.alive || (state.phase === 'normal' && state.settings?.livesEnabled !== false && (p.lives ?? 0) > 0));
  if (eligible.length > 1 || eligible.some(p => !p.alive || p.fallingAt !== undefined)) return;
  const solo = state.settings?.mode === 'solo' && state.players.length === 1;
  if (solo && eligible.length && (state.phase !== 'hell' || state.time < (state.hell?.readyAt ?? Infinity) + EAT.hell.soloDuration)) return;
  if (solo && !eligible.length) { state.status = 'finished'; state.result = 'loss'; state.winnerId = null; finishEncounter(state); return; }
  const survivors = eligible;
  if (survivors.length === 1) {
    state.status = 'finished'; state.winnerId = survivors[0].id; survivors[0].placement = 1; finishEncounter(state);
    state.result = 'winner'; if (survivors[0].stats) survivors[0].stats.survivedHell = state.phase === 'hell';
    for (const p of state.players) if (p.stats) { p.stats.maxMass = Math.max(p.stats.maxMass, p.mass); if (state.phase === 'normal') p.stats.normalFinalMass = p.mass; }
    emit(state, { type: 'win', playerId: survivors[0].id, x: survivors[0].x, y: survivors[0].y });
  } else if (survivors.length === 0) {
    state.status = 'finished'; state.result = 'tie'; state.winnerId = null;
    const last = Math.max(...state.players.map(p => p.eliminatedAt ?? -1));
    state.tiedIds = state.hell?.finalists ?? state.players.filter(p => p.eliminatedAt === last).map(p => p.id);
    for (const p of state.players) if (state.tiedIds.includes(p.id)) p.placement = 1; finishEncounter(state);
    emit(state, { type: 'tie', playerId: '', x: EAT.match.width / 2, y: EAT.match.height / 2 });
  }
}
export function finishNormal(state: GameState) {
  const ranked = [...state.players].filter(p => p.alive || (p.lives ?? 0) > 0).sort((a,b) => b.mass-a.mass || b.score-a.score);
  if (!ranked.length) { checkWinner(state); return; }
  ranked.forEach((p,i) => { p.placement = i > 0 && p.mass === ranked[i-1].mass && p.score === ranked[i-1].score ? ranked[i-1].placement : i+1; });
  const winners = ranked.filter(p=>p.placement===1);
  state.status='finished'; state.result=winners.length===1?'winner':'tie'; state.winnerId=winners.length===1?winners[0].id:null;
  state.tiedIds=winners.length>1?winners.map(p=>p.id):[];
  for (const p of state.players) if (p.stats) { p.stats.normalFinalMass=p.mass; p.stats.maxMass=Math.max(p.stats.maxMass,p.mass); }
  finishEncounter(state); emit(state,{type:state.result==='tie'?'tie':'win',playerId:state.winnerId??'',x:ranked[0].x,y:ranked[0].y});
}
export function collectPower(state: GameState, p: Player, power: PowerObject): void {
  const index = state.powerups.findIndex(item => item.id === power.id);
  if (index < 0 || unavailable(p) || !POWER_KINDS.includes(power.kind) || !canStorePower(state, p, power.kind)) return;
  state.powerups.splice(index, 1); p.powerupsCollected++;
  countCollected(p, power.kind);
  if (power.kind === 'jump') p.storedJump = true;
  else if (power.kind === 'strike') p.storedStrike = true;
  else if (power.kind === 'multiplier') p.storedGrowth = true;
  else if (power.kind === 'divider') p.growthModifier = EAT.powerups.divider.strength;
  else p.effects[power.kind] = state.time + EAT.powerups[power.kind].duration;
  p.score += 40; emit(state, { type: 'power', playerId: p.id, power: power.kind, x: power.x, y: power.y });
}
export function movePlayer(state: Pick<GameState, 'map' | 'time' | 'encounter' | 'phase'>, p: Player, input: Input, dt: number, speedScale = 1): void {
  const burst = abilityVelocity(p, state.time);
  if (p.knockback && p.knockback.until > state.time) { p.x += p.knockback.x * dt; p.y += p.knockback.y * dt; p.vx = p.vy = 0; return; }
  if ((p.stunnedUntil ?? 0) > state.time || isChoking(p, state.time)) { p.vx = 0; p.vy = 0; return; }
  if (burst) {
    p.vx = burst.x; p.vy = burst.y; p.x += p.vx*dt; p.y += p.vy*dt;
    if (state.phase !== 'hell') { resolveWalls(state.map,p,playerRadius(p,state.time)); resolveShrine(state,p,playerRadius(p,state.time)); }
    return;
  }
  const direction = sanitizeInput(input), moving = Math.hypot(direction.x, direction.y) > 0.05;
  const max = speedScale * massToSpeed(p.mass) * (p.effects.speed > state.time ? EAT.powerups.speed.strength : 1);
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
  p.x += p.vx * dt; p.y += p.vy * dt; if (state.phase === 'hell') return; resolveWalls(state.map, p, playerRadius(p, state.time)); resolveShrine(state, p, playerRadius(p, state.time));
}

let epilogue = false;
/** The winner's victory lap after the last rival is eaten. The finished world keeps moving
 * (eating, bots, Hell) so the end screen can wait, but nobody is eliminated or respawns and
 * the result never changes. Presentation only: callers step a copy of the final state. */
export function stepEpilogue(state: GameState, dt = 1 / EAT.network.tickRate): void {
  if (state.status !== 'finished') return;
  epilogue = true; state.status = 'playing';
  try { stepGame(state, dt); } finally { state.status = 'finished'; epilogue = false; }
}
/** A win by being the last mouth standing, which earns the victory lap. */
export const lastStanding = (state: GameState) => state.status === 'finished' && state.result === 'winner' && state.players.length > 1 && state.players.filter(p => p.alive).length === 1;

/** Mutates plain serializable state. Only local solo play or the server calls this. */
export function stepGame(state: GameState, dt = 1 / EAT.network.tickRate): void {
  if (state.status !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / EAT.network.tickRate); state.time += dt;
  state.powerups = state.powerups.filter(p => POWER_KINDS.includes(p.kind));
  for (const p of state.players) for (const key of Object.keys(p.effects)) if (!POWER_KINDS.includes(key as typeof POWER_KINDS[number])) delete (p.effects as Record<string, number>)[key];
  if (!epilogue && state.settings?.hellEnabled === false && state.phase === 'normal' && state.time >= matchDuration(state)) { finishNormal(state); return; }
  if (!epilogue && state.settings?.hellEnabled && state.phase === 'normal' && state.time >= matchDuration(state)) startHell(state);
  if (state.hell && state.phase !== 'normal') { stepHell(state, dt); state.events = state.events.filter(e => state.time - e.at < 2).slice(-80); return; }
  for (const p of state.players) {
    if (!p.alive) { if (p.bot) respawn(state, p); continue; }
    if (p.stats) p.stats.maxMass = Math.max(p.stats.maxMass, p.mass);
    if (p.ability?.kind === 'jump') { stepJump(state,p); continue; }
    if (p.escape) { stepEscape(state, p, dt); continue; }
    if (p.bot && state.time >= p.nextDecision) { const fleeing = p.botState === 'FLEE'; p.input = botInput(state, p); p.nextDecision = state.time + botPolicy(state).interval;
      if (p.botState === 'FLEE' && (fleeing || botPolicy(state).escapeDelay === 0) && activateEscape(state, p)) continue; }
    movePlayer(state, p, p.input, dt, p.bot ? botPolicy(state).speed : 1);
  }
  // Resolve mouths before gentle body separation. A body collision never eliminates.
  for (const a of state.players) for (const b of state.players) {
    if (canEatPlayer(a, b, state.time, state.map) && shrineClear(state, a, b)) eliminate(state, b, a);
  }
  for (let i = 0; i < state.players.length; i++) for (let j = i + 1; j < state.players.length; j++) {
    const a = state.players[i], b = state.players[j]; if (unavailable(a) || unavailable(b)) continue;
    // A rival that is small enough to eat never pushes the bigger player away.
    if ((playerFits(a, b, state.time) || playerFits(b, a, state.time)) && clearPath(state.map, a, b)) continue;
    const d = distance(a, b), overlap = (playerRadius(a, state.time) + playerRadius(b, state.time)) * 0.84 - d;
    if (overlap <= 0) continue;
    for (const p of [a, b]) if (p.effects.shield > state.time && state.time - (p.shieldHitAt ?? -10) > .45) p.shieldHitAt = state.time;
    const dx = d > 0 ? (b.x - a.x) / d : 1, dy = d > 0 ? (b.y - a.y) / d : 0;
    const push = overlap * EAT.player.bodyPush;
    a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
    resolveWalls(state.map, a, playerRadius(a, state.time)); resolveWalls(state.map, b, playerRadius(b, state.time));
    resolveShrine(state, a, playerRadius(a, state.time)); resolveShrine(state, b, playerRadius(b, state.time));
    if (!state.events.some(e => e.type === 'collision' && e.playerId === a.id && state.time - e.at < 0.4)) emit(state, { type: 'collision', playerId: a.id, victimId: b.id, x: a.x, y: a.y });
  }
  const eaten = new Set<number>();
  for (const f of state.food) {
    const info = FOOD[f.kind];
    if (f.delivery) {
      const recipient = state.players.find(p => p.id === f.rewardOwner && !unavailable(p));
      if (recipient) {
        const t = clamp((state.time - f.delivery.startedAt) / f.delivery.duration, 0, 1), m = mouthPosition(recipient, playerRadius(recipient, state.time));
        f.x = f.delivery.from.x + (m.x - f.delivery.from.x) * t; f.y = f.delivery.from.y + (m.y - f.delivery.from.y) * t;
        f.z = f.delivery.height * (1-t) + Math.sin(t * Math.PI) * 35;
        if (t < 1) continue;
      }
      delete f.delivery; f.vz = -35;
    }
    if (stepStuckTree(state, f)) continue;
    let owner = f.target ? state.players.find(p => p.id === f.target && !unavailable(p)) : undefined;
    // A shrinking mouth safely ejects an unfinished swallow without granting rewards.
    if (f.target && (!owner || !foodFits(owner, f, state.time))) {
      if (owner) { const r = playerRadius(owner, state.time); f.x = owner.x + Math.cos(owner.facing) * (r + info.radius + 2); f.y = owner.y + Math.sin(owner.facing) * (r + info.radius + 2); }
      f.target = null; f.z = 0; f.vz = 0; owner = undefined;
      // Sleeping props skip normal integration, so an ejected building must
      // be returned inside the arena/scenery bounds here, even when asleep.
      resolveWalls(state.map, f, info.radius + 4); resolveShrine(state, f, info.radius + 4);
    }
    if (!owner) {
      for (const p of state.players) {
        if (unavailable(p) || isChoking(p, state.time)) continue;
        const r = playerRadius(p, state.time), d = distance(p, f);
        const magnet = p.effects.magnet > state.time;
        if (d > r + info.radius + (magnet ? EAT.powerups.magnet.range : 2)) continue;
        const fits = foodFits(p, f, state.time);
        if (fits && clearPath(state.map, p, f) && shrineClear(state, p, f)) {
          if (magnet && !info.building && d < EAT.powerups.magnet.range + r) {
            const mouth = mouthPosition(p, r), length = Math.max(1, distance(mouth, f));
            f.vx += (mouth.x - f.x) / length * EAT.powerups.magnet.strength * dt;
            f.vy += (mouth.y - f.y) / length * EAT.powerups.magnet.strength * dt;
          }
          if (entersMouth(p, f, state.time)) { beginFall(f, p, state.time); f.target = p.id; f.capturedAt = state.time; const entry = mouthCoordinates(p, f); f.entryForward = entry.forward / r; f.entrySide = entry.side / r; f.vx = 0; f.vy = 0; f.vz = 0; owner = p; break; }
        }
        // Edible props stay put until the opening reaches them. Body impulses
        // must never kick a snack away while approaching or turning over it.
        const contact = !fits && f.z < r ? canUnderpass(p, f, state.time) ? null : objectContact(p, r, f) : null;
        if (contact) {
          const { nx, ny, overlap } = contact;
          // Contact with an oversized object has very high effective resistance.
          // It remains a finite-mass body and can still receive prop impulses.
          const mobility = info.underpassClearance ? 0 : Math.min(.00002, p.mass / (p.mass + info.mass * 10000));
          f.x += nx * overlap * mobility; f.y += ny * overlap * mobility;
          p.x -= nx * overlap * (1 - mobility); p.y -= ny * overlap * (1 - mobility);
          const impact = Math.max(0, (p.vx - f.vx) * nx + (p.vy - f.vy) * ny);
          f.vx += nx * impact * mobility * (1 + info.bounce); f.vy += ny * impact * mobility * (1 + info.bounce);
          p.vx -= nx * impact * (1 - mobility); p.vy -= ny * impact * (1 - mobility);
          if (impact > 15) f.vz = Math.min(85, impact * mobility * info.bounce);
          f.rotation += (p.vx * ny - p.vy * nx) * mobility * dt * .01;
          resolveWalls(state.map, p, r); resolveShrine(state, p, r);
        }
      }
    }
    if (owner) {
      // Reservation happens only AFTER physical entrance contact. Gravity/depth
      // drives the swallow; there is no world-space suction, even during a gulp.
      const age = state.time - f.capturedAt, duration = consumptionDuration(f);
      // Oversized canopies and too-long leaning props jam: the eater chokes for `chokeDuration`, then spits them out.
      const tree = !!treeParts(f.kind), jammed = tree ? age >= EAT.eating.treeEntryDuration && !canopyFits(owner, f, state.time) : age >= jamAge(f) && jamsInMouth(owner, f, state.time);
      if (jammed) {
        owner.chokingUntil = state.time + EAT.eating.chokeDuration; if (owner.stats) owner.stats.chokes++; owner.vx = 0; owner.vy = 0;
        f.target = null; f.vx = f.vy = f.vz = 0;
        f.stuck = { playerId: owner.id, since: state.time, until: owner.chokingUntil, ...(tree ? {} : { age: jamAge(f) }) };
        f.availableAt = owner.chokingUntil + 1.25;
        stepStuckTree(state, f);
        emit(state, { type: 'choke', playerId: owner.id, x: owner.x, y: owner.y });
        continue;
      }
      // Transport in world axes; turning the mouth never spins the falling prop.
      const offset = fallOffset(f, age);
      f.x = owner.x + offset.x; f.y = owner.y + offset.y;
      const pose = fallPose(f, age + dt);
      f.vz = (pose.z - f.z) / dt; f.z = pose.z;
      if (age >= duration && f.z < -12) {
        eaten.add(f.id);
        foodReward(state, owner, f);
        owner.score += info.score; owner.foodEaten++;
        emit(state, { type: 'food', playerId: owner.id, food: f.kind, x: owner.x, y: owner.y });
      }
    } else {
      // Sleeping props skip integration and scenery checks until contact/magnet wakes them.
      const awake = Math.abs(f.vx) + Math.abs(f.vy) > .1 || f.z !== 0 || f.vz !== 0;
      if (!awake) { f.vx = 0; f.vy = 0; continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      const terrainDrag = state.map === 'nature' ? 1.3 : 1;
      const damping = Math.exp(-info.friction * terrainDrag * dt); f.vx *= damping; f.vy *= damping;
      f.rotation += (f.vx + f.vy) / Math.max(20, info.mass) * dt * .12;
      if (f.z > 0 || f.vz !== 0) { f.vz -= EAT.food.gravity * dt; f.z += f.vz * dt; if (f.z < 0) { f.z = 0; f.vz = Math.abs(f.vz) > 28 ? -f.vz * info.bounce : 0; } }
      const before = { x: f.x, y: f.y }; resolveWalls(state.map, f, info.radius + 4); resolveShrine(state, f, info.radius + 4);
      if (before.x !== f.x) f.vx *= -info.bounce;
      if (before.y !== f.y) f.vy *= -info.bounce;
    }
  }
  collideObjects(state.food);
  if (eaten.size) state.food = state.food.filter(f => !eaten.has(f.id));
  for (const power of [...state.powerups]) {
    const p = state.players.find(p => !unavailable(p) && canStorePower(state,p,power.kind) && !isChoking(p, state.time) && inMouth(p, power, EAT.powerups.radius, 0, state.time) && clearPath(state.map, p, power));
    if (p) collectPower(state, p, power);
  }
  stepEncounter(state, dt);
  for (const p of state.players) stepBurp(state, p);
  checkWinner(state);
  // A closing picnic boundary prevents endless stalemates; shields protect from bites only.
  if (!state.settings?.matchDuration && !state.settings?.hellEnabled && state.status === 'playing' && state.time > EAT.match.zoneStart) {
    const center = { x: EAT.match.width / 2, y: EAT.match.height / 2 };
    for (const p of [...state.players].sort((a, b) => a.mass - b.mass)) {
      if (!p.alive || state.status !== 'playing') continue;
      if (distance(p, center) + playerRadius(p, state.time) > zoneRadius(state.time)) {
        p.mass -= (EAT.match.zoneMassLoss + (state.time >= EAT.match.zoneEnd ? p.mass * .12 : 0)) * dt;
        if (p.mass < EAT.player.minMass) { p.mass = EAT.player.minMass; eliminate(state, p); checkWinner(state); }
      }
    }
  }
  updateSpawns(state);
  state.events = state.events.filter(e => state.time - e.at < 2).slice(-80);
}
