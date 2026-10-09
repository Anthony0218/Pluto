import type { MinigameInput } from '../../types.ts';
import type { MinigameDefinition } from '../types.ts';
import { BOT_REACTION, random, rankScores } from './common.ts';
export const CASCADE_COLUMNS = 9, CASCADE_ROWS = 10;
export const MOON_GLYPHS = ['✦', '◐', '●'] as const;
export type CascadeAction = 'left' | 'right' | 'swap' | 'drop' | 'down';
export interface CascadeInput { type: 'CASCADE_ACTION'; action: CascadeAction }
export interface CascadePlayer { board: number[]; pair: [number, number]; column: number; row: number; score: number; chain: number; cleared: number; overflows: number; pairIndex: number; nextFallAt: number; nextInputAt: number; nextDropAt: number; resetUntil: number; flash: number[]; flashUntil: number }
export interface CascadeState { startedAt: number; endsAt: number; simTime: number; seed: number; players: Record<string, CascadePlayer>; sequence: [number, number][]; bots: Record<string, number> }
export interface CascadeView { startedAt: number; endsAt: number; simTime: number; player: CascadePlayer | null; standings: Record<string, { score: number; cleared: number; chain: number; overflows: number }> }
export function cascadeNeighbors(n: number) {
  const x = n % CASCADE_COLUMNS, y = Math.floor(n / CASCADE_COLUMNS), offset = x % 2 ? 1 : -1;
  return [[x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y], [x - 1, y + offset], [x + 1, y + offset]].filter(([nx, ny]) => nx >= 0 && nx < CASCADE_COLUMNS && ny >= 0 && ny < CASCADE_ROWS).map(([nx, ny]) => ny * CASCADE_COLUMNS + nx);
}
export function cascadeGroups(board: number[]) {
  const visited = new Set<number>(), clear: number[] = [];
  for (let n = 0; n < board.length; n++) {
    if (!board[n] || visited.has(n)) continue; const group = [n]; visited.add(n);
    for (let i = 0; i < group.length; i++) for (const neighbor of cascadeNeighbors(group[i])) if (board[neighbor] === board[n] && !visited.has(neighbor)) { visited.add(neighbor); group.push(neighbor); }
    if (group.length >= 4) clear.push(...group);
  } return clear;
}
export function settleCascade(board: number[]) {
  let score = 0, chain = 0, cleared = 0; const flash: number[] = [];
  for (;;) {
    const group = cascadeGroups(board); if (!group.length) break; chain++; cleared += group.length; score += group.length * chain; flash.push(...group);
    for (const n of group) board[n] = 0;
    for (let x = 0; x < CASCADE_COLUMNS; x++) { const kept = Array.from({ length: CASCADE_ROWS }, (_, y) => board[y * CASCADE_COLUMNS + x]).filter(Boolean); for (let y = CASCADE_ROWS - 1; y >= 0; y--) board[y * CASCADE_COLUMNS + x] = kept.pop() ?? 0; }
  } return { score, chain, cleared, flash };
}
function fits(p: CascadePlayer, column: number, row: number) { return column >= 0 && column < CASCADE_COLUMNS && row >= 0 && row + 1 < CASCADE_ROWS && !p.board[row * CASCADE_COLUMNS + column] && !p.board[(row + 1) * CASCADE_COLUMNS + column]; }
function spawn(s: CascadeState, p: CascadePlayer, at: number) {
  p.column = 4; p.row = 0; p.pair = [...s.sequence[p.pairIndex++ % s.sequence.length]]; p.nextFallAt = at + Math.max(320, 700 - (at - s.startedAt) / 200);
  if (!fits(p, p.column, p.row)) { p.overflows++; p.score = Math.max(0, p.score - 5); p.board.fill(0); p.resetUntil = at + 1800; p.nextFallAt = p.resetUntil + 700; }
}
function lock(s: CascadeState, p: CascadePlayer, at: number) {
  p.board[p.row * CASCADE_COLUMNS + p.column] = p.pair[0]; p.board[(p.row + 1) * CASCADE_COLUMNS + p.column] = p.pair[1];
  const result = settleCascade(p.board); p.score += result.score; p.chain = result.chain; p.cleared += result.cleared; p.flash = result.flash; p.flashUntil = at + 500; p.nextDropAt = at + 350; spawn(s, p, at);
}
export const constellationCascade: MinigameDefinition<CascadeState, CascadeInput> = {
  id: 'constellation-cascade', name: 'Constellation Cascade', description: 'Guide falling moon-glyph pairs into a honeycomb sky. Match connected constellations and trigger chain reactions.',
  instructions: ['Move a falling pair between nine honeycomb columns. Swap which moon glyph is on top.', 'Connect four or more matching glyphs in any direction to clear them. Whole rows do not clear.', 'Loose glyphs fall after a clear. Chain reactions multiply the points from each successive clear.', 'An overflowing landing column or blocked center spawn costs five points and resets your sky after a short pause. Highest score after 75 seconds wins.', 'All players receive the same glyph sequence. Your board is private; opponents’ scores remain visible.'], controls: 'A/D or ←/→ move · W/↑ swap · S/↓ lower · Space drop · touch Left, Right, Swap and Drop', durationSeconds: 75, gameType: 'main', supportsBots: true, personalizedView: true, snapshotIntervalMs: 100,
  create(c) { const s: CascadeState = { startedAt: c.startedAt, endsAt: c.endsAt, simTime: c.startedAt, seed: Math.floor(c.random() * 4294967296), players: {}, sequence: [], bots: {} };
    for (let i = 0; i < 512; i++) s.sequence.push([1 + Math.floor(random(s) * 3), 1 + Math.floor(random(s) * 3)]);
    for (const player of c.participants) { const p: CascadePlayer = { board: Array<number>(CASCADE_COLUMNS * CASCADE_ROWS).fill(0), pair: [1, 1], column: 4, row: 0, score: 0, chain: 0, cleared: 0, overflows: 0, pairIndex: 0, nextFallAt: c.startedAt, nextInputAt: 0, nextDropAt: 0, resetUntil: 0, flash: [], flashUntil: 0 }; s.players[player.id] = p; spawn(s, p, c.startedAt); } return s;
  },
  parseInput(i: MinigameInput) { return i.type === 'CASCADE_ACTION' && ['left', 'right', 'swap', 'drop', 'down'].includes(String(i.action)) ? { type: 'CASCADE_ACTION', action: i.action as CascadeAction } : null; },
  applyInput(s, id, input, at) {
    const p = s.players[id]; if (!p || at < s.startedAt || at >= s.endsAt || at < s.simTime || at < p.resetUntil || at < p.nextInputAt) throw new Error('Wait for the next glyph action.');
    if (input.action === 'drop' && at < p.nextDropAt) throw new Error('The next pair is still arriving.');
    p.nextInputAt = at + 70;
    if (input.action === 'left' || input.action === 'right') { const x = p.column + (input.action === 'left' ? -1 : 1); if (fits(p, x, p.row)) p.column = x; }
    else if (input.action === 'swap') p.pair = [p.pair[1], p.pair[0]];
    else if (input.action === 'down') { if (fits(p, p.column, p.row + 1)) p.row++; else lock(s, p, at); }
    else { while (fits(p, p.column, p.row + 1)) p.row++; lock(s, p, at); }
  },
  tick(s, now) { const end = Math.min(now, s.endsAt); if (end <= s.simTime) return false;
    while (s.simTime < end) { const at = Math.min(end, s.simTime + 20); for (const p of Object.values(s.players)) if (at >= p.resetUntil && at >= p.nextFallAt) { if (fits(p, p.column, p.row + 1)) { p.row++; p.nextFallAt = at + Math.max(320, 700 - (at - s.startedAt) / 200); } else lock(s, p, at); } s.simTime = at; } return true;
  },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || now < s.startedAt || now < p.resetUntil || now < p.nextInputAt || now < (s.bots[bot.id] ?? 0)) return []; s.bots[bot.id] = now + Math.max(100, BOT_REACTION[bot.difficulty] / 2);
    let best = { value: -Infinity, column: p.column, swap: false };
    for (let column = 0; column < CASCADE_COLUMNS; column++) for (const swap of [false, true]) {
      if (!fits(p, column, p.row)) continue;
      // A plan must be reachable horizontally at the pair's current altitude.
      if (Array.from({ length: Math.abs(column - p.column) + 1 }, (_, i) => p.column + Math.sign(column - p.column) * i).some((x) => !fits(p, x, p.row))) continue;
      let row = p.row; while (fits(p, column, row + 1)) row++;
      const board = [...p.board], pair = swap ? [p.pair[1], p.pair[0]] : p.pair; board[row * CASCADE_COLUMNS + column] = pair[0]; board[(row + 1) * CASCADE_COLUMNS + column] = pair[1];
      const result = settleCascade(board), height = board.reduce((sum, glyph, n) => sum + (glyph ? CASCADE_ROWS - Math.floor(n / CASCADE_COLUMNS) : 0), 0);
      let matching = 0; for (const n of [row * CASCADE_COLUMNS + column, (row + 1) * CASCADE_COLUMNS + column]) for (const neighbor of cascadeNeighbors(n)) if (board[n] && board[neighbor] === board[n]) matching++;
      const value = result.score * 12 + matching * 2 - height * .6 + (bot.difficulty === 'beginner' || bot.difficulty === 'easy' ? random(s) * 8 : 0);
      if (value > best.value) best = { value, column, swap };
    }
    const action: CascadeAction = best.column < p.column ? 'left' : best.column > p.column ? 'right' : best.swap ? 'swap' : 'drop';
    if (action === 'drop' && now < p.nextDropAt) return []; return [{ at: now, input: { type: 'CASCADE_ACTION', action } }];
  },
  scores: (s) => Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, p.score])), rank: rankScores,
  publicView(s, _now, viewerId): CascadeView { return { startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, player: viewerId && s.players[viewerId] ? structuredClone(s.players[viewerId]) : null, standings: Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, { score: p.score, cleared: p.cleared, chain: p.chain, overflows: p.overflows }])) }; },
};
