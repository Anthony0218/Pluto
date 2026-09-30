import { EAT, FOOD, MATCH_DURATIONS, isPluto, playerRadius, type FoodKind } from './config.ts';
import { distance, validPosition } from './maps.ts';
import { foodFits } from './rules.ts';
import { spawnPosition } from './spawn.ts';
import { releaseQuest } from './quests.ts';
import type { FoodObject, GameEvent, GameState, MatchSettings, MatchStats, Player, Vec } from './types.ts';

export function matchSettings(options: Partial<MatchSettings> = {}): MatchSettings {
  return { matchDuration: MATCH_DURATIONS.includes(options.matchDuration as 120 | 600 | 1200) ? options.matchDuration! : EAT.hell.normalDuration, mode: options.mode === 'solo' ? 'solo' : 'multiplayer', hellEnabled: options.hellEnabled !== false, animalsEnabled: options.animalsEnabled !== false, livesEnabled: options.livesEnabled !== false,
    botsEnabled: options.mode !== 'solo' || options.botsEnabled !== false,
    botDifficulty: options.botDifficulty === 'easy' || options.botDifficulty === 'hard' ? options.botDifficulty : 'medium',
    plutoEnabled: options.plutoEnabled !== false,
    plutoMultiplier: typeof options.plutoMultiplier === 'number' && Number.isFinite(options.plutoMultiplier)
      ? Math.max(EAT.pluto.minMultiplier, Math.min(EAT.pluto.maxMultiplier, options.plutoMultiplier)) : EAT.pluto.multiplier };
}
export function newStats(): MatchStats {
  return { collected: {}, totalGrowth: 0, growthActivations: 0, hostileAttacks: 0, maxMass: EAT.player.startingMass, normalFinalMass: EAT.player.startingMass, deaths: 0, respawns: 0, plutos: 0, plutoBonus: 0,
    pigeonQuest: false, catQuest: false, escapes: 0, hellAssists: 0, hellTime: 0, hellCause: null, fellInLava: false, survivedHell: false,
    buildings: 0, trees: 0, chokes: 0, friendlyGrowth: 0, hostileLoss: 0 };
}
export function recordEvent(s: GameState, event: Omit<GameEvent, 'id' | 'at'>, significant = true) {
  const e = { ...event, id: s.nextId++, at: s.time }; s.events.push(e);
  if (significant) { s.timeline ??= []; s.timeline.push(e); if (s.timeline.length > 256) s.timeline.splice(0, s.timeline.length - 256); }
}
export const canUnderpass = (p: Player, f: Pick<FoodObject, 'kind'>, time: number) => !foodFits(p, f, time) &&
  FOOD[f.kind].underpassClearance > 0;
export const raisedHeight = (kind: FoodKind) => FOOD[kind].underpassClearance * 1.15;
export const unavailable = (p: Player) => !p.alive || !!p.escape || p.ability?.kind === 'jump' || p.fallingAt !== undefined;
export function safePosition(s: GameState, at: Vec, radius: number, ignoredId?: string) {
  return validPosition(s.map, at, radius + 16) && (!s.encounter?.shrine || distance(at, s.encounter.shrine) > radius + 135) &&
    s.players.every(p => p.id === ignoredId || !p.alive || distance(at, p) > radius + playerRadius(p, s.time) + Math.max(120, playerRadius(p, s.time))) &&
    s.food.every(f => f.target || distance(at, f) > radius + FOOD[f.kind].radius + 8);
}
export function clearTemporary(s: GameState, p: Player) {
  delete p.ability; delete p.lastStrikeAt; p.storedJump = false; p.storedStrike = false;
  releaseQuest(s, p.id); p.storedGrowth = false; p.growthModifier = 1; p.stunnedUntil = 0; delete p.knockback; delete p.hellScale; p.chokingUntil = 0; delete p.burpAt; p.nextBurp = s.time + 27 + s.players.indexOf(p) * .73; delete p.escape; delete p.helper; delete p.fallingAt;
  p.effects = { speed: 0, shield: 0, magnet: 0, multiplier: 0, divider: 0, jump: 0, strike: 0 }; p.vx = 0; p.vy = 0; p.input = { x: 0, y: 0 };
  for (const f of s.food) if (f.target === p.id) { f.target = null; f.z = 0; f.vz = 0; f.availableAt = s.time + 1; }
}
export function respawn(s: GameState, p: Player): boolean {
  if (s.status !== 'playing' || s.settings?.livesEnabled === false || s.phase !== 'normal' || p.alive || !p.lives || s.time + 1e-6 < (p.respawnAt ?? Infinity)) return false;
  let at: Vec | null = null;
  for (let attempt = 0; attempt < 12; attempt++) { const candidate = spawnPosition(s, 40); if (candidate && safePosition(s, candidate, 24, p.id)) { at = candidate; break; } }
  if (!at) return false;
  clearTemporary(s, p); delete p.respawnAt; Object.assign(p, at, { mass: EAT.player.startingMass, alive: true, placement: null, eliminatedAt: null, eliminatedBy: null, nextDecision: 0 });
  (p.stats ??= newStats()).respawns++; recordEvent(s, { type: 'respawn', playerId: p.id, ...at }); return true;
}
export function foodReward(s: GameState, p: Player, f: FoodObject) {
  const info = FOOD[f.kind], base = info.growth * (f.rewardMultiplier ?? 1) / Math.max(1, Math.sqrt(p.mass / 1800));
  const bonus = isPluto(f.kind) ? base * ((s.settings?.plutoMultiplier ?? EAT.pluto.multiplier) - 1) : 0;
  const gain = grantGrowth(s, p, base + bonus); countCollected(p, f.kind);
  const stats = p.stats ??= newStats(); stats.maxMass = Math.max(stats.maxMass, p.mass);
  if (isPluto(f.kind)) { stats.plutos++; stats.plutoBonus += bonus * growthFactor(s, p); }
  if (info.building) stats.buildings++;
  if (info.shape === 'tree') stats.trees++;
  if (info.shape === 'vehicle') stats.vehicles = (stats.vehicles ?? 0) + 1;
  if (f.rewardOwner === p.id) stats.friendlyGrowth += gain;
}

/** All reward sources compose modifiers once; expiration never touches earned mass. */
export const growthFactor = (s: GameState, p: Player) => (p.growthModifier ?? 1) * (p.effects.multiplier > s.time ? EAT.powerups.multiplier.strength : 1);
export function countCollected(p: Player, kind: string) {
  const stats = p.stats ??= newStats(), counts = stats.collected ??= {};
  counts[kind] = (counts[kind] ?? 0) + 1;
}
export function grantGrowth(s: GameState, p: Player, base: number) {
  const amount = base * growthFactor(s, p); p.mass += amount;
  const stats = p.stats ??= newStats(); stats.totalGrowth = (stats.totalGrowth ?? 0) + amount; stats.maxMass = Math.max(stats.maxMass, p.mass);
  recordEvent(s, { type: 'growth', playerId: p.id, x: p.x, y: p.y, amount }, false); return amount;
}
export function activateGrowth(s: GameState, p: Player): boolean {
  if (s.status !== 'playing' || s.phase !== 'normal' || unavailable(p) || !p.storedGrowth || p.effects.multiplier > s.time) return false;
  p.storedGrowth = false; p.effects.multiplier = s.time + EAT.powerups.multiplier.duration;
  const stats = p.stats ??= newStats(); stats.growthActivations = (stats.growthActivations ?? 0) + 1;
  recordEvent(s, { type: 'growthActive', playerId: p.id, x: p.x, y: p.y, status: '2x ACTIVE!' }); return true;
}
/** Whole growth units define effective HUD ties; seat order is presentation only. */
export function liveLeaders(players: Player[]) {
  return players.map((p, seat) => ({ p, seat })).sort((a, b) => Math.round(b.p.mass) - Math.round(a.p.mass) || (b.p.lives ?? 0) - (a.p.lives ?? 0) || a.seat - b.seat).map(({ p }) => p);
}
