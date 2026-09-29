import { playerRadius } from './config.ts';
import type { GameState, Player } from './types.ts';
/** Smooth bounded curves: dimensions only, never mass, rewards or effect strength. */
export const adaptiveScale = (radius: number, cap = 3.2) => 1 + (cap - 1) * Math.min(1, Math.max(0, (radius - 24) / 288)) ** .7;
export const animalScale = (radius: number, form: 'neutral' | 'friendly' | 'hostile' | 'escape' = 'neutral') => adaptiveScale(radius) * ({ neutral: 1, friendly: 1.15, hostile: 1.8, escape: 2.8 }[form]);
export const questScale = (radius: number) => adaptiveScale(radius, 3.4);
export const powerVisual = (radius: number) => { const scale = adaptiveScale(radius, 2.2); return { scale, glow: 25 * scale, intensity: .25 + .12 * (scale - 1), indicator: 18 * Math.sqrt(scale) }; };
/** Target/owner wins; otherwise nearest living player, with stable player-order ties. */
export function animalPlayer(s: GameState): Player | undefined {
  const e = s.encounter; if (!e) return undefined;
  const owner = s.players.find(p => p.alive && p.id === (e.npc.targetId ?? e.item.ownerId));
  return owner ?? s.players.filter(p => p.alive).reduce<Player | undefined>((best, p) => !best || Math.hypot(p.x-e.npc.x,p.y-e.npc.y) < Math.hypot(best.x-e.npc.x,best.y-e.npc.y) ? p : best, undefined);
}
export function encounterScale(s: GameState) {
  const p = animalPlayer(s), phase = s.encounter?.npc.phase;
  return animalScale(p ? playerRadius(p, s.time) : 24, p?.escape ? 'escape' : phase === 'hostile' || phase === 'emerging' ? 'hostile' : phase === 'friendly' ? 'friendly' : 'neutral');
}
