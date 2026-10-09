import type { MinigameCreateContext, MinigameDefinition } from "../types.ts";
import { applyMove, base, BOT_REACTION, control, distance, move, parseMove, rankScores, toward, type Mover, type MovingState, type MoveInput } from "../festivalGames/common.ts";

export const HEIST_DOCKS = [{ x: 10, y: 12 }, { x: 90, y: 12 }, { x: 10, y: 88 }, { x: 90, y: 88 }];
export interface HeistGem { id: number; x: number; y: number; value: number; respawnAt: number; }
interface Thief extends Mover { cargo: number; dock: number; cloakUntil: number; nextCloakAt: number; actionHeld: boolean; caught: number; }
export interface HeistState extends MovingState { players: Record<string, Thief>; gems: HeistGem[]; bots: Record<string, number>; }
export function heistLaser(at: number, startedAt: number) { const elapsed = Math.max(0, at - startedAt); return { angle: elapsed / 1000 * .48, active: elapsed % 8000 >= 1500 }; }
export function inHeistLaser(p: { x: number; y: number }, angle: number) {
  const dx = p.x - 50, dy = p.y - 50, radius = Math.hypot(dx, dy);
  return radius > 5 && radius < 33 && Math.min(Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle)), Math.abs(dx * Math.cos(angle) + dy * Math.sin(angle))) < 1.5;
}
function create(c: MinigameCreateContext): HeistState {
  const gems: HeistGem[] = [];
  for (const radius of [16, 28]) for (let i = 0; i < 8; i++) { const angle = i * Math.PI / 4 + Math.PI / 8; gems.push({ id: gems.length, x: 50 + Math.cos(angle) * radius, y: 50 + Math.sin(angle) * radius, value: radius === 16 ? 3 : 1, respawnAt: 0 }); }
  for (const x of [45, 55]) gems.push({ id: gems.length, x, y: 50, value: 5, respawnAt: 0 });
  return { ...base(c), players: Object.fromEntries(c.participants.map((p, i) => [p.id, { ...HEIST_DOCKS[i], score: 0, stunnedUntil: 0, cargo: 0, dock: i, cloakUntil: 0, nextCloakAt: 0, actionHeld: false, caught: 0 }])), gems, bots: {} };
}
export const plutoHeist: MinigameDefinition<HeistState, MoveInput> = {
  id: "pluto-heist", name: "Pluto Heist", description: "Raid a drifting space vault for moon crystals. Dodge rotating security lasers and escape to your shuttle!",
  instructions: ["Walk over moon crystals to collect them: silver 1, violet 3, golden 5. Your cargo limit is 8.", "Return to your own numbered shuttle to bank cargo. Heavy bags slow you down.", "The vault's cross-shaped laser sweeps the inner platform. Amber is a warning; red means active.", "Space activates a 1.2-second cloak with an 8-second cooldown. Being caught loses unbanked cargo and returns you to your shuttle; banked points are safe."],
  controls: "WASD / arrows · Space to cloak · touch pad and Cloak", durationSeconds: 65, gameType: "main", supportsBots: true, snapshotIntervalMs: 80, create, parseInput: parseMove, applyInput: applyMove,
  tick(s, now) {
    const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) { const at = Math.min(s.simTime + 20, end), dt = (at - s.simTime) / 1000, laser = heistLaser(at, s.startedAt);
      for (const [id, p] of Object.entries(s.players)) {
        const input = control(s, id, at);
        if (input?.action && !p.actionHeld && at >= p.nextCloakAt && at >= p.stunnedUntil) { p.cloakUntil = at + 1200; p.nextCloakAt = at + 8000; }
        p.actionHeld = input?.action ?? false;
        move(p, input, 27 - p.cargo * 1.2, dt, at);
        if (at < p.stunnedUntil) continue;
        if (laser.active && at >= p.cloakUntil && inHeistLaser(p, laser.angle)) { p.cargo = 0; p.caught++; Object.assign(p, HEIST_DOCKS[p.dock]); p.stunnedUntil = at + 700; continue; }
        const gem = s.gems.find((g) => g.respawnAt <= at && p.cargo + g.value <= 8 && distance(p, g) < 3.4);
        if (gem) { p.cargo += gem.value; gem.respawnAt = at + 6500; }
        if (p.cargo && distance(p, HEIST_DOCKS[p.dock]) < 7) { p.score += p.cargo; p.cargo = 0; }
      }
      s.simTime = at;
    } return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now >= s.endsAt || now < (s.bots[bot.id] ?? 0)) return [];
    s.bots[bot.id] = now + Math.min(250, BOT_REACTION[bot.difficulty]);
    const gem = s.gems.filter((g) => g.respawnAt <= now && g.value + p.cargo <= 8).sort((a, b) => (distance(p, a) + distance(a, HEIST_DOCKS[p.dock])) / a.value - (distance(p, b) + distance(b, HEIST_DOCKS[p.dock])) / b.value)[0];
    const target = p.cargo >= (bot.difficulty === "beginner" ? 3 : 5) || !gem ? HEIST_DOCKS[p.dock] : gem;
    const laser = heistLaser(now + 350, s.startedAt), danger = laser.active && inHeistLaser(p, laser.angle);
    return [{ at: now, input: toward(p, target, bot.difficulty, !p.actionHeld && now >= p.nextCloakAt && (danger || p.cargo >= 5 && distance(p, { x: 50, y: 50 }) < 27)) }];
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView: (s) => ({ startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, players: structuredClone(s.players), gems: structuredClone(s.gems) }),
};
