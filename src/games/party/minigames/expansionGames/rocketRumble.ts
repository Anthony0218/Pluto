import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { applyMove, base, BOT_REACTION, BOT_SPEED, clamp, control, distance, parseMove, rankScores, type Mover, type MovingState, type MoveInput } from "../festivalGames/common.ts";

export const ROCKET_ROCKS = [{ x: 32, y: 32, r: 5 }, { x: 68, y: 32, r: 5 }, { x: 32, y: 68, r: 5 }, { x: 68, y: 68, r: 5 }, { x: 50, y: 50, r: 7 }];
export const rocketAngleDifference = (target: number, heading: number) => Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
interface Rocket extends Mover { heading: number; vx: number; vy: number; boostUntil: number; nextBoostAt: number; shieldUntil: number; actionHeld: boolean; }
export interface RocketState extends MovingState { players: Record<string, Rocket>; fuel: { id: number; x: number; y: number; value: number; respawnAt: number }[]; bots: Record<string, number>; }
function create(c: MinigameCreateContext): RocketState {
  return { ...base(c), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { x: i % 2 ? 87 : 13, y: i < 2 ? 15 : 85, score: 0, stunnedUntil: 0, heading: i < 2 ? Math.PI / 2 : -Math.PI / 2, vx: 0, vy: 0, boostUntil: 0, nextBoostAt: 0, shieldUntil: c.startedAt + 1000, actionHeld: false }])), fuel: Array.from({ length: 16 }, (_, i) => ({ id: i, x: 50 + Math.cos(i * Math.PI / 8) * 37, y: 50 + Math.sin(i * Math.PI / 8) * 37, value: i % 4 === 0 ? 3 : 1, respawnAt: 0 })), bots: {} };
}
export const rocketRumble: MinigameDefinition<RocketState, MoveInput> = {
  id: "rocket-rumble", name: "Rocket Rumble", description: "Pilot a tiny rocket through a cluttered orbital junkyard. Collect fuel stars and boost-bump your rivals!",
  instructions: ["A/D or left/right steer your rocket. Hold W/up for thrust; S/down brakes. Your rocket has momentum.", "Collect fuel stars for 1 point, golden stars for 3. Stars return after 4 seconds.", "Space boosts for 0.7 seconds, with a 4-second cooldown. A boost bump steals 1 point from a rival.", "Asteroid collisions cost 1 point and bounce you away. A short shield prevents repeated hits; nobody is eliminated."],
  controls: "A/D steer · W thrust · S brake · Space boost · touch steering, thrust and Boost", durationSeconds: 60, gameType: "main", supportsBots: true, snapshotIntervalMs: 60, create, parseInput: parseMove, applyInput: applyMove,
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) {
      const at = Math.min(s.simTime + 20, end), dt = (at - s.simTime) / 1000;
      for (const [id, p] of Object.entries(s.players)) {
        const input = control(s, id, at);
        if (input?.action && !p.actionHeld && at >= p.nextBoostAt && at >= p.stunnedUntil) { p.boostUntil = at + 700; p.nextBoostAt = at + 4000; }
        p.actionHeld = input?.action ?? false;
        p.heading += (input?.x ?? 0) * 2.8 * dt;
        const thrust = at < p.stunnedUntil ? 0 : at < p.boostUntil ? 65 : Math.max(0, -(input?.y ?? 0)) * 37;
        const drag = Math.exp(-((input?.y ?? 0) > 0 ? 4.5 : 1.4) * dt);
        p.vx = (p.vx + Math.cos(p.heading) * thrust * dt) * drag;
        p.vy = (p.vy + Math.sin(p.heading) * thrust * dt) * drag;
        p.x = clamp(p.x + p.vx * dt, 4, 96); p.y = clamp(p.y + p.vy * dt, 4, 96);
        if (p.x === 4 || p.x === 96) p.vx *= -.6;
        if (p.y === 4 || p.y === 96) p.vy *= -.6;
        for (const rock of ROCKET_ROCKS) if (distance(p, rock) < rock.r + 2.2) {
          const angle = Math.atan2(p.y - rock.y, p.x - rock.x);
          p.x = rock.x + Math.cos(angle) * (rock.r + 2.3); p.y = rock.y + Math.sin(angle) * (rock.r + 2.3);
          p.vx = Math.cos(angle) * 16; p.vy = Math.sin(angle) * 16;
          if (at >= p.shieldUntil) { p.score = Math.max(0, p.score - 1); p.shieldUntil = at + 1200; p.stunnedUntil = at + 350; }
        }
        for (const star of s.fuel) if (star.respawnAt <= at && distance(p, star) < 4) { p.score += star.value; star.respawnAt = at + 4000; }
      }
      const entries = Object.entries(s.players);
      for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
        const [, p] = entries[i], [, q] = entries[j]; if (distance(p, q) >= 5) continue;
        const angle = Math.atan2(q.y - p.y, q.x - p.x);
        if (p.boostUntil > at && q.shieldUntil <= at && q.score > 0) { p.score++; q.score--; q.shieldUntil = at + 1500; }
        else if (q.boostUntil > at && p.shieldUntil <= at && p.score > 0) { q.score++; p.score--; p.shieldUntil = at + 1500; }
        p.vx -= Math.cos(angle) * 3; p.vy -= Math.sin(angle) * 3; q.vx += Math.cos(angle) * 3; q.vy += Math.sin(angle) * 3;
      }
      s.simTime = at;
    } return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now >= s.endsAt || now < (s.bots[bot.id] ?? 0)) return [];
    s.bots[bot.id] = now + Math.min(220, BOT_REACTION[bot.difficulty]);
    const target = s.fuel.filter((f) => f.respawnAt <= now).sort((a, b) => distance(p, a) / a.value - distance(p, b) / b.value)[0] ?? { x: 50, y: 12 };
    let angle = Math.atan2(target.y - p.y, target.x - p.x);
    const ahead = { x: p.x + Math.cos(p.heading) * 10, y: p.y + Math.sin(p.heading) * 10 };
    const rock = ROCKET_ROCKS.find((r) => distance(ahead, r) < r.r + 5);
    if (rock) angle = Math.atan2(p.y - rock.y, p.x - rock.x);
    const error = rocketAngleDifference(angle, p.heading);
    return [{ at: now, input: { type: "FESTIVAL_MOVE", x: clamp(error * 1.8, -1, 1), y: Math.abs(error) > 1.5 ? .5 : -BOT_SPEED[bot.difficulty], action: !p.actionHeld && now >= p.nextBoostAt && Math.abs(error) < .25 && !rock && distance(p, target) > 16 } }];
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), fuel: structuredClone(s.fuel) }),
};
