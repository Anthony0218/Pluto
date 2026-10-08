import type { MinigameInput, Difficulty } from "../../types.ts";
import type { MinigameCreateContext } from "../types.ts";
export interface MoveInput { type: "FESTIVAL_MOVE"; x: number; y: number; action: boolean }
export interface Mover { x: number; y: number; score: number; stunnedUntil: number; }
export interface MovingState { startedAt: number; endsAt: number; simTime: number; seed: number; players: Record<string, Mover>; controls: Record<string, { at: number; input: MoveInput }>; }
export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export function random(s: { seed: number }) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
export const BOT_SPEED: Record<Difficulty, number> = { beginner: .5, easy: .65, medium: .8, hard: .9, extreme: 1 };
export const BOT_REACTION: Record<Difficulty, number> = { beginner: 850, easy: 600, medium: 400, hard: 250, extreme: 60 };
export function parseMove(i: MinigameInput): MoveInput | null {
  return i.type === "FESTIVAL_MOVE" && typeof i.x === "number" && Number.isFinite(i.x) && Math.abs(i.x) <= 1 && typeof i.y === "number" && Number.isFinite(i.y) && Math.abs(i.y) <= 1 && typeof i.action === "boolean" ? { type: "FESTIVAL_MOVE", x: i.x, y: i.y, action: i.action } : null;
}
export function base(c: MinigameCreateContext): MovingState {
  return { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, seed: Math.floor(c.random() * 4294967296), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { x: 10, y: 35 + i * 10, score: 0, stunnedUntil: 0 }])), controls: {} };
}
export function applyMove(s: MovingState, id: string, input: MoveInput, at: number) {
  if (!s.players[id] || at < s.startedAt || at >= s.endsAt || at < s.simTime) throw new Error("Wait for the game to start.");
  s.controls[id] = { at, input: { ...input } };
}
export function control(s: MovingState, id: string, at: number) { const c = s.controls[id]; return c && at - c.at <= 350 ? c.input : null; }
export function move(p: Mover, i: MoveInput | null, speed: number, dt: number, at: number) {
  if (at < p.stunnedUntil) return;
  const length = Math.max(1, Math.hypot(i?.x ?? 0, i?.y ?? 0));
  p.x = clamp(p.x + (i?.x ?? 0) / length * speed * dt, 3, 97); p.y = clamp(p.y + (i?.y ?? 0) / length * speed * dt, 5, 95);
}
export function toward(p: Mover, target: { x: number; y: number }, difficulty: Difficulty, action = false): MoveInput {
  const length = Math.max(1, distance(p, target)), speed = BOT_SPEED[difficulty];
  return { type: "FESTIVAL_MOVE", x: (target.x - p.x) / length * speed, y: (target.y - p.y) / length * speed, action };
}
export function rankScores(s: { players: Record<string, { score: number }> }, ids: readonly string[], rng: () => number) {
  const ties = Object.fromEntries(ids.map((id) => [id, rng()])); return [...ids].sort((a, b) => s.players[b].score - s.players[a].score || ties[b] - ties[a]);
}
