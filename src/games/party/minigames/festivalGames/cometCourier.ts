import type { MinigameDefinition, MinigameCreateContext } from "../types.ts";
import { applyMove, base, BOT_REACTION, control, distance, move, parseMove, random, rankScores, toward, type Mover, type MoveInput, type MovingState } from "./common.ts";
export const DELIVERY_PADS = [{ x: 10, y: 12 }, { x: 90, y: 12 }, { x: 90, y: 88 }, { x: 10, y: 88 }];
export interface Parcel { id: number; x: number; y: number; destination: number; value: number; carrier: string | null; respawnAt: number; }
export interface CourierState extends MovingState { players: Record<string, Mover & { parcel: number | null; dashUntil: number; nextDashAt: number; actionHeld: boolean }>; parcels: Parcel[]; bots: Record<string, number>; deliveries: { playerId: string; at: number; value: number; x: number; y: number }[]; }
function create(c: MinigameCreateContext): CourierState {
  const s: CourierState = { ...base(c), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { x: i % 2 ? 80 : 20, y: i < 2 ? 25 : 75, score: 0, stunnedUntil: 0, parcel: null, dashUntil: 0, nextDashAt: 0, actionHeld: false }])), parcels: [], bots: {}, deliveries: [] };
  for (let i = 0; i < 5; i++) s.parcels.push({ id: i, x: 35 + random(s) * 30, y: 30 + random(s) * 40, destination: Math.floor(random(s) * 4), value: i === 4 ? 3 : 1, carrier: null, respawnAt: 0 }); return s;
}
export const cometCourier: MinigameDefinition<CourierState, MoveInput> = {
  id: "comet-courier", name: "Comet Courier", description: "Deliver oversized parcels to matching pads. Dash past rivals—but protect your package!",
  instructions: ["Walk over an available parcel to pick it up. Its color and symbol show the delivery pad.", "Carrying slows you down. Reach the matching pad to score; golden parcels earn 3 points.", "Space dashes with a 2-second cooldown. Bumping a rival while dashing drops their parcel.", "Dropped parcels can be picked up by anyone. Highest delivery score wins."], controls: "WASD / arrows · Space to dash · touch direction pad and Dash", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 100, create, parseInput: parseMove, applyInput: applyMove,
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) { const at = Math.min(s.simTime + 20, end), dt = (at - s.simTime) / 1000;
      for (const [id, p] of Object.entries(s.players)) {
        const input = control(s, id, at); if (input?.action && !p.actionHeld && at >= p.nextDashAt && at >= p.stunnedUntil) { p.dashUntil = at + 220; p.nextDashAt = at + 2000; } p.actionHeld = input?.action ?? false;
        move(p, input, at < p.dashUntil ? 65 : p.parcel === null ? 27 : 20, dt, at); if (at < p.stunnedUntil) continue;
        if (p.parcel === null) { const parcel = s.parcels.find((parcel) => !parcel.carrier && parcel.respawnAt <= at && distance(p, parcel) < 4); if (parcel) { p.parcel = parcel.id; parcel.carrier = id; } }
        const parcel = s.parcels.find((parcel) => parcel.id === p.parcel); if (parcel) { parcel.x = p.x; parcel.y = p.y; if (distance(p, DELIVERY_PADS[parcel.destination]) < 7) { p.score += parcel.value; s.deliveries.push({ playerId: id, at, value: parcel.value, ...DELIVERY_PADS[parcel.destination] }); p.parcel = null; parcel.carrier = null; parcel.respawnAt = at + 1500; parcel.x = 30 + random(s) * 40; parcel.y = 25 + random(s) * 50; parcel.destination = Math.floor(random(s) * 4); } }
      }
      for (const [id, p] of Object.entries(s.players)) if (p.dashUntil > at) for (const [other, q] of Object.entries(s.players)) if (other !== id && q.parcel !== null && q.stunnedUntil <= at && distance(p, q) < 5) { const parcel = s.parcels.find((parcel) => parcel.id === q.parcel)!; parcel.carrier = null; parcel.respawnAt = at + 500; q.parcel = null; q.stunnedUntil = at + 500; }
      s.simTime = at;
    } s.deliveries = s.deliveries.filter((d) => end - d.at < 900); return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now < (s.bots[bot.id] ?? 0)) return []; s.bots[bot.id] = now + BOT_REACTION[bot.difficulty];
    const held = s.parcels.find((parcel) => parcel.id === p.parcel), parcel = s.parcels.filter((parcel) => !parcel.carrier && parcel.respawnAt <= now).sort((a, b) => (distance(p, a) + distance(a, DELIVERY_PADS[a.destination])) / a.value - (distance(p, b) + distance(b, DELIVERY_PADS[b.destination])) / b.value)[0];
    const target = held ? DELIVERY_PADS[held.destination] : parcel ?? { x: 50, y: 50 };
    return [{ at: now, input: toward(p, target, bot.difficulty, !p.actionHeld && now >= p.nextDashAt && distance(p, target) > 10) }];
  }, scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), parcels: structuredClone(s.parcels), deliveries: structuredClone(s.deliveries) }),
};
