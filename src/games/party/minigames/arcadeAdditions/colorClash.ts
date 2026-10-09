import type { MinigameDefinition } from '../types.ts';
import { applyControl, control, createBase, distance, parseControl, publicBase, random, rankScores, scores, step, toward, walk, BOT_REACTION, type ArcadeInput, type ArcadeState, type Wall } from './common.ts';
export const PAINT_SIZE = 19;
// Walls occupy exact tile coordinates so painted ground always remains walkable.
const WALL_CELLS = new Set([4 * 19 + 5, 5 * 19 + 5, 6 * 19 + 5, 7 * 19 + 5, 11 * 19 + 13, 12 * 19 + 13, 13 * 19 + 13, 14 * 19 + 13]);
export const paintWalls: Wall[] = [...WALL_CELLS].map((n) => ({ x: n % 19 * 100 / 19, y: Math.floor(n / 19) * 100 / 19, w: 100 / 19, h: 100 / 19 }));
export interface ColorState extends ArcadeState { owners: (string | null)[]; washAt: number; washColumn: number; burstEvents: { id: string; at: number; x: number; y: number }[] }
function paint(s: ColorState, id: string, x: number, y: number) { if (x >= 0 && y >= 0 && x < PAINT_SIZE && y < PAINT_SIZE && !WALL_CELLS.has(y * PAINT_SIZE + x)) s.owners[y * PAINT_SIZE + x] = id; }
export const colorClash: MinigameDefinition<ColorState, ArcadeInput> = {
  id: 'color-clash', name: 'Color Clash', description: 'Paint the floor by running over it. Overwrite rivals, burst color, and claim freshly washed strips.',
  instructions: ['Every tile you step on becomes yours. Rival tiles can be repainted.', 'Space paints a diamond-shaped area around you, with an eight-second cooldown.', 'Every 15 seconds a marked vertical strip is washed clean. It flashes for three seconds first.', 'Most owned tiles at the end of 75 seconds wins.'], controls: 'WASD / arrows · Space paint burst · touch direction pad and Paint Burst', durationSeconds: 75, gameType: 'main', supportsBots: true, snapshotIntervalMs: 100,
  create(c) { const b = createBase(c); return { ...b, players: Object.fromEntries(Object.entries(b.players).map(([id, p], i) => [id, { ...p, x: i % 2 ? 88 : 12, y: i < 2 ? 12 : 88 }])), owners: Array<string | null>(PAINT_SIZE * PAINT_SIZE).fill(null), washAt: c.startedAt + 15000, washColumn: Math.floor(random(b) * PAINT_SIZE), burstEvents: [] }; }, parseInput: parseControl, applyInput: applyControl,
  tick(s, now) { return step(s, now, (at, dt) => {
    for (const [id, p] of Object.entries(s.players)) {
      const i = control(s, id, at); walk(p, i, 22, dt, paintWalls, 1.2); const x = Math.floor(p.x * PAINT_SIZE / 100), y = Math.floor(p.y * PAINT_SIZE / 100); paint(s, id, x, y);
      if (i?.action && !p.actionHeld && at >= p.nextActionAt) { p.nextActionAt = at + 8000; for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) if (Math.abs(dx) + Math.abs(dy) <= 2) paint(s, id, x + dx, y + dy); s.burstEvents.push({ id, at, x: p.x, y: p.y }); } p.actionHeld = i?.action ?? false;
    }
    if (at >= s.washAt && s.washAt < s.endsAt) { for (let y = 0; y < PAINT_SIZE; y++) s.owners[y * PAINT_SIZE + s.washColumn] = null; s.washAt += 15000; s.washColumn = Math.floor(random(s) * PAINT_SIZE); }
    for (const p of Object.values(s.players)) p.score = 0; for (const id of s.owners) if (id) s.players[id].score++;
    s.burstEvents = s.burstEvents.filter((e) => at - e.at < 700);
  }); },
  botInputs(s, bot, now) { const p = s.players[bot.id]; if (!p || now < (s.bots[bot.id] ?? s.startedAt)) return []; s.bots[bot.id] = now + Math.min(300, BOT_REACTION[bot.difficulty]);
    const candidates = s.owners.flatMap((owner, n) => owner !== bot.id && !WALL_CELLS.has(n) ? [n] : []);
    const value = (n: number) => distance(p, { x: (n % 19 + .5) * 100 / 19, y: (Math.floor(n / 19) + .5) * 100 / 19 }) + (s.owners[n] ? -1 : 0);
    candidates.sort((a, b) => value(a) - value(b)); const n = candidates[0] ?? Math.floor(random(s) * s.owners.length), target = { x: (n % 19 + .5) * 100 / 19, y: (Math.floor(n / 19) + .5) * 100 / 19 };
    // Route around each small wall through its nearest end.
    for (const w of paintWalls) if ((p.x < w.x && target.x > w.x) || (p.x > w.x + w.w && target.x < w.x + w.w)) if (p.y >= w.y - 2 && p.y <= w.y + w.h + 2) { target.y = p.y - w.y < w.y + w.h - p.y ? w.y - 3 : w.y + w.h + 3; target.x = p.x; break; }
    return [{ at: now, input: toward(p, target, bot.difficulty, !p.actionHeld && now >= p.nextActionAt) }];
  }, scores, rank: rankScores, publicView: (s) => ({ ...publicBase(s), owners: [...s.owners], washAt: s.washAt, washColumn: s.washColumn, burstEvents: structuredClone(s.burstEvents) }),
};
