import type { MinigameDefinition } from '../types.ts';
import { applyControl, control, createBase, distance, parseControl, random, rankScores, scores, step, toward, BOT_REACTION, type ArcadeInput, type ArcadeState, type Pawn, type Point } from './common.ts';
export const MAZE_SIZE = 35;
export interface MazePawn extends Pawn { hp: number; boostUntil: number; protectedUntil: number; attackAt: number; eliminatedAt: number | null; facingX: number; facingY: number }
export interface MazeState extends ArcadeState<MazePawn> { cells: number[]; minotaurId: string; revealUntil: number; nextRevealAt: number; attackEndsAt: number; finished: boolean; winners: 'Minotaur' | 'Runners' | null; plans: Record<string, { target: number; memory: Point | null; memoryUntil: number }> }
export interface MazeView { startedAt: number; endsAt: number; simTime: number; cells: number[]; minotaurId: string; revealUntil: number; nextRevealAt: number; attackEndsAt: number; players: Record<string, MazePawn>; roster: Record<string, { hp: number; eliminatedAt: number | null }>; winners: MazeState['winners'] }
export function mazeOpen(cells: number[], x: number, y: number) { return x >= 0 && y >= 0 && x < MAZE_SIZE && y < MAZE_SIZE && cells[Math.floor(y) * MAZE_SIZE + Math.floor(x)] === 0; }
function generate(s: { seed: number }) {
  const cells = Array<number>(MAZE_SIZE * MAZE_SIZE).fill(1), stack = [MAZE_SIZE + 1]; cells[stack[0]] = 0;
  while (stack.length) {
    const n = stack[stack.length - 1], x = n % MAZE_SIZE, y = Math.floor(n / MAZE_SIZE);
    const neighbors = [[x + 2, y], [x - 2, y], [x, y + 2], [x, y - 2]].filter(([nx, ny]) => nx > 0 && ny > 0 && nx < MAZE_SIZE - 1 && ny < MAZE_SIZE - 1 && cells[ny * MAZE_SIZE + nx]);
    if (!neighbors.length) { stack.pop(); continue; }
    const [nx, ny] = neighbors[Math.floor(random(s) * neighbors.length)]; cells[(y + ny) / 2 * MAZE_SIZE + (x + nx) / 2] = 0; cells[ny * MAZE_SIZE + nx] = 0; stack.push(ny * MAZE_SIZE + nx);
  }
  // Add alternate routes while keeping the outer boundary closed.
  for (let y = 1; y < MAZE_SIZE - 1; y++) for (let x = 1; x < MAZE_SIZE - 1; x++) if (cells[y * MAZE_SIZE + x] && random(s) < .13 && ((mazeOpen(cells, x - 1, y) && mazeOpen(cells, x + 1, y)) || (mazeOpen(cells, x, y - 1) && mazeOpen(cells, x, y + 1)))) cells[y * MAZE_SIZE + x] = 0;
  return cells;
}
function mazeWalk(s: MazeState, p: MazePawn, i: ArcadeInput | null, speed: number, dt: number) {
  const length = Math.max(1, Math.hypot(i?.x ?? 0, i?.y ?? 0)), r = .2;
  const valid = (x: number, y: number) => [[-r, -r], [-r, r], [r, -r], [r, r]].every(([dx, dy]) => mazeOpen(s.cells, x + dx, y + dy));
  const x = p.x + (i?.x ?? 0) / length * speed * dt; if (valid(x, p.y)) p.x = x;
  const y = p.y + (i?.y ?? 0) / length * speed * dt; if (valid(p.x, y)) p.y = y;
}
export function mazeSight(cells: number[], a: Point, b: Point) {
  const len = distance(a, b); if (len > 7) return false;
  for (let t = 0; t <= 1; t += 1 / Math.max(1, Math.ceil(len * 12))) if (!mazeOpen(cells, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; return true;
}
export function mazeVisible(s: MazeState, viewerId: string, id: string, at: number) { const p = s.players[viewerId], q = s.players[id]; return !!q && q.hp > 0 && (viewerId === id || s.revealUntil > at || (!!p && p.hp > 0 && mazeSight(s.cells, p, q))); }
function hit(s: MazeState, at: number) {
  const hunter = s.players[s.minotaurId];
  for (const [id, p] of Object.entries(s.players)) if (id !== s.minotaurId && p.hp > 0 && at >= p.protectedUntil && distance(hunter, p) < 1.35 && mazeSight(s.cells, hunter, p)) {
    const len = Math.max(.001, distance(hunter, p)), aim = ((p.x - hunter.x) * hunter.facingX + (p.y - hunter.y) * hunter.facingY) / len;
    if (aim < .2) continue;
    p.hp--; if (p.hp === 1) { p.boostUntil = at + 3000; p.protectedUntil = at + 3000; s.revealUntil = Math.max(s.revealUntil, at + 3000); } else p.eliminatedAt = at;
  }
}
function finish(s: MazeState, winner: NonNullable<MazeState['winners']>) { s.finished = true; s.winners = winner; for (const [id, p] of Object.entries(s.players)) p.score = (id === s.minotaurId ? winner === 'Minotaur' : winner === 'Runners') ? 1 : 0; }
// Breadth-first pathing uses the public maze geometry, never a hidden rival position.
function nextCell(cells: number[], from: number, to: number) {
  if (from === to) return from;
  const previous = Array<number>(cells.length).fill(-1), queue = [from]; previous[from] = from;
  for (let i = 0; i < queue.length && previous[to] < 0; i++) { const n = queue[i], x = n % MAZE_SIZE, y = Math.floor(n / MAZE_SIZE); for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) if (mazeOpen(cells, nx, ny)) { const q = ny * MAZE_SIZE + nx; if (previous[q] < 0) { previous[q] = n; queue.push(q); } } }
  if (previous[to] < 0) return from; let n = to; while (previous[n] !== from && n !== from) n = previous[n]; return n;
}
function cell(p: Point) { return Math.floor(p.y) * MAZE_SIZE + Math.floor(p.x); }
export const minotaurMaze: MinigameDefinition<MazeState, ArcadeInput> = {
  id: 'minotaur-maze', name: "Minotaur’s Labyrinth", description: 'One faster Minotaur hunts three runners in a huge maze. Survive five minutes as location pulses accelerate.',
  instructions: ['One random player is the Minotaur, 20% faster than runners. The runner team wins if anyone survives 300 seconds; the hunter wins by eliminating all three.', 'Runners take two hits. The first gives +50% speed and protection for three seconds, and reveals everyone for three seconds.', 'With 150 seconds remaining, locations pulse every 30 seconds. At 100 seconds: every 20. At 50 seconds: every 10. Each pulse lasts three seconds.', 'Walls block normal sight. The Minotaur’s attack winds up for 0.35 seconds; aim with your movement and press Attack.', 'In Festival, the winning side shares 12 points: 12 for the hunter or 4 per runner. All runners share their team’s outcome, including eliminated teammates.'],
  controls: 'WASD / arrows · Space / Attack for Minotaur · touch direction pad and Attack', durationSeconds: 300, gameType: 'main', teamFormat: '1v3', supportsBots: true, personalizedView: true, snapshotIntervalMs: 100,
  teamOf: (s, id) => id === s.minotaurId ? 'Minotaur' : 'Runners',
  create(c) { const b = createBase(c), cells = generate(b), ids = Object.keys(b.players), minotaurId = ids[Math.floor(random(b) * ids.length)], starts = [{ x: 1.5, y: 1.5 }, { x: 33.5, y: 1.5 }, { x: 33.5, y: 33.5 }]; let runner = 0;
    return { ...b, cells, minotaurId, players: Object.fromEntries(ids.map((id) => [id, { ...b.players[id], ...(id === minotaurId ? { x: 17.5, y: 17.5 } : starts[runner++ % starts.length]), hp: 2, boostUntil: 0, protectedUntil: 0, attackAt: 0, eliminatedAt: null, facingX: 1, facingY: 0 }])), revealUntil: 0, nextRevealAt: c.endsAt - 150000, attackEndsAt: 0, finished: false, winners: null, plans: {} };
  }, parseInput: parseControl,
  applyInput(s, id, input, at) { if (s.players[id]?.hp === 0) throw new Error('You are eliminated.'); applyControl(s, id, input, at); },
  tick(s, now) { return step(s, now, (at, dt) => {
    if (at >= s.nextRevealAt && s.nextRevealAt < s.endsAt) {
      s.revealUntil = Math.max(s.revealUntil, s.nextRevealAt + 3000);
      const remaining = s.endsAt - s.nextRevealAt, interval = remaining <= 50000 ? 10000 : remaining <= 100000 ? 20000 : 30000;
      const threshold = remaining > 100000 ? s.endsAt - 100000 : remaining > 50000 ? s.endsAt - 50000 : s.endsAt;
      s.nextRevealAt = Math.min(s.nextRevealAt + interval, threshold);
    }
    for (const [id, p] of Object.entries(s.players)) {
      if (p.hp === 0) continue; const i = control(s, id, at), hunter = id === s.minotaurId;
      if (i && Math.hypot(i.x, i.y) > .1) { const len = Math.hypot(i.x, i.y); p.facingX = i.x / len; p.facingY = i.y / len; }
      mazeWalk(s, p, i, hunter ? 3.6 : at < p.boostUntil ? 4.5 : 3, dt);
      if (hunter && i?.action && !p.actionHeld && at >= p.nextActionAt) { p.attackAt = at + 350; s.attackEndsAt = p.attackAt + 150; p.nextActionAt = at + 1200; }
      p.actionHeld = i?.action ?? false;
      if (hunter && p.attackAt && at >= p.attackAt) { hit(s, at); p.attackAt = 0; }
    }
    if (Object.entries(s.players).every(([id, p]) => id === s.minotaurId || p.hp === 0)) finish(s, 'Minotaur'); else if (at >= s.endsAt) finish(s, 'Runners');
  }, () => s.finished); },
  botInputs(s, bot, now) {
    const p = s.players[bot.id]; if (!p || p.hp === 0 || now < (s.bots[bot.id] ?? s.startedAt)) return [];
    s.bots[bot.id] = now + Math.min(250, BOT_REACTION[bot.difficulty]);
    const hunter = bot.id === s.minotaurId, visible = Object.entries(s.players).filter(([id]) => id !== bot.id && (hunter ? id !== s.minotaurId : id === s.minotaurId) && mazeVisible(s, bot.id, id, now)).sort((a, b) => distance(p, a[1]) - distance(p, b[1]));
    const plan = s.plans[bot.id] ??= { target: cell(p), memory: null, memoryUntil: 0 };
    if (visible.length) { plan.memory = { x: visible[0][1].x, y: visible[0][1].y }; plan.memoryUntil = now + (hunter ? 8000 : 5000); }
    const danger = now < plan.memoryUntil ? plan.memory : null;
    if (hunter && danger) plan.target = cell(danger);
    else if (cell(p) === plan.target || (danger && !hunter && distance(p, { x: plan.target % MAZE_SIZE + .5, y: Math.floor(plan.target / MAZE_SIZE) + .5 }) < 2)) {
      const options = Array.from({ length: 12 }, () => Math.floor(random(s) * s.cells.length)).filter((n) => !s.cells[n]);
      options.sort((a, b) => { const ap = { x: a % MAZE_SIZE + .5, y: Math.floor(a / MAZE_SIZE) + .5 }, bp = { x: b % MAZE_SIZE + .5, y: Math.floor(b / MAZE_SIZE) + .5 }; return danger ? distance(bp, danger) - distance(ap, danger) : distance(bp, p) - distance(ap, p); }); plan.target = options[0] ?? cell(p);
    }
    // Center on the current cell before turning to avoid snagging on corridor corners.
    const n = nextCell(s.cells, cell(p), plan.target), center = { x: cell(p) % MAZE_SIZE + .5, y: Math.floor(cell(p) / MAZE_SIZE) + .5 }, dest = { x: n % MAZE_SIZE + .5, y: Math.floor(n / MAZE_SIZE) + .5 };
    const needsCenter = (dest.x !== center.x && Math.abs(p.y - center.y) > .12) || (dest.y !== center.y && Math.abs(p.x - center.x) > .12);
    const close = hunter && visible.length && distance(p, visible[0][1]) < 1.25;
    const input = toward(p, close ? visible[0][1] : needsCenter ? center : dest, bot.difficulty, !!close && !p.actionHeld && now >= p.nextActionAt);
    return [{ at: now, input }];
  }, scores, rank: rankScores, isFinished: (s) => s.finished,
  publicView(s, now, viewerId): MazeView { return { startedAt: s.startedAt, endsAt: s.endsAt, simTime: s.simTime, cells: [...s.cells], minotaurId: s.minotaurId, revealUntil: s.revealUntil, nextRevealAt: s.nextRevealAt, attackEndsAt: s.attackEndsAt, players: Object.fromEntries(Object.entries(s.players).filter(([id]) => id === viewerId || mazeVisible(s, viewerId ?? '', id, now)).map(([id, p]) => [id, { ...p }])), roster: Object.fromEntries(Object.entries(s.players).map(([id, p]) => [id, { hp: p.hp, eliminatedAt: p.eliminatedAt }])), winners: s.winners }; },
};
