import type { Difficulty, MinigameInput } from '../../types.ts';
import type { MinigameCreateContext } from '../types.ts';
import { BOT_REACTION, BOT_SPEED, distance, random, rankScores } from '../festivalGames/common.ts';
export { BOT_REACTION, BOT_SPEED, distance, random, rankScores };
export interface Point { x: number; y: number }
export interface ArcadeInput { type: 'ARCADE_CONTROL'; x: number; y: number; aimX: number; aimY: number; action: boolean; fire: boolean }
export interface Pawn extends Point { score: number; actionHeld: boolean; nextActionAt: number }
export interface ArcadeState<P extends Pawn = Pawn> { startedAt: number; endsAt: number; simTime: number; seed: number; players: Record<string, P>; controls: Record<string, { at: number; input: ArcadeInput }>; bots: Record<string, number> }
export interface Wall { x: number; y: number; w: number; h: number }
export function createBase(c: MinigameCreateContext): ArcadeState {
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, seed: Math.floor(c.random() * 4294967296), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { x: i % 2 ? 80 : 20, y: i < 2 ? 25 : 75, score: 0, actionHeld: false, nextActionAt: 0 }])), controls: {}, bots: {} };
}
export function parseControl(i: MinigameInput): ArcadeInput | null {
  if (i.type !== 'ARCADE_CONTROL' || typeof i.action !== 'boolean' || typeof i.fire !== 'boolean') return null;
  for (const k of ['x', 'y', 'aimX', 'aimY']) if (typeof i[k] !== 'number' || !Number.isFinite(i[k]) || Math.abs(i[k] as number) > 1) return null;
  return { type: 'ARCADE_CONTROL', x: i.x as number, y: i.y as number, aimX: i.aimX as number, aimY: i.aimY as number, action: i.action, fire: i.fire };
}
export function applyControl(s: ArcadeState, id: string, input: ArcadeInput, at: number) {
  if (!s.players[id] || at < s.startedAt || at >= s.endsAt || at < s.simTime) throw new Error('This control is outside the active game.');
  s.controls[id] = { at, input: { ...input } };
}
export function control(s: ArcadeState, id: string, at: number): ArcadeInput | null { const c = s.controls[id]; return c && at - c.at <= 1000 ? c.input : null; }
export function step(s: ArcadeState, now: number, update: (at: number, dt: number) => void, finished?: () => boolean) {
  const end = Math.min(now, s.endsAt); if (end <= s.simTime || finished?.()) return false;
  while (s.simTime < end && !finished?.()) { const at = Math.min(end, s.simTime + 20); update(at, (at - s.simTime) / 1000); s.simTime = at; } return true;
}
export function blocked(p: Point, walls: Wall[], radius = 2) { return walls.some((w) => p.x > w.x - radius && p.x < w.x + w.w + radius && p.y > w.y - radius && p.y < w.y + w.h + radius); }
export function walk(p: Point, i: Pick<ArcadeInput, 'x' | 'y'> | null, speed: number, dt: number, walls: Wall[] = [], radius = 2) {
  const length = Math.max(1, Math.hypot(i?.x ?? 0, i?.y ?? 0));
  const x = Math.max(radius, Math.min(100 - radius, p.x + (i?.x ?? 0) / length * speed * dt));
  if (!blocked({ x, y: p.y }, walls, radius)) p.x = x;
  const y = Math.max(radius, Math.min(100 - radius, p.y + (i?.y ?? 0) / length * speed * dt));
  if (!blocked({ x: p.x, y }, walls, radius)) p.y = y;
}
export function toward(p: Point, target: Point, difficulty: Difficulty, action = false, fire = false): ArcadeInput {
  const len = Math.max(.001, distance(p, target)), speed = BOT_SPEED[difficulty];
  return { type: 'ARCADE_CONTROL', x: (target.x - p.x) / len * speed, y: (target.y - p.y) / len * speed, aimX: (target.x - p.x) / len, aimY: (target.y - p.y) / len, action, fire };
}
export function scores(s: ArcadeState) { return Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])); }
export function publicBase(s: ArcadeState) { return { startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players) }; }
