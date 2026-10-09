import test from 'node:test';
import assert from 'node:assert/strict';
import { minigameRegistry } from '../src/games/party/minigames/index.ts';
import { minotaurMaze, mazeVisible, MAZE_SIZE } from '../src/games/party/minigames/arcadeAdditions/maze.ts';
import { cascadeGroups, settleCascade, CASCADE_COLUMNS, constellationCascade } from '../src/games/party/minigames/arcadeAdditions/cascade.ts';
import { colorClash } from '../src/games/party/minigames/arcadeAdditions/colorClash.ts';
import { ricochetRivals, fuseFaceoff, gravityTug } from '../src/games/party/minigames/arcadeAdditions/duels.ts';
import { createPlayer, createMatch, advance } from '../src/games/party/engine/engine.ts';
import { readyMinigame, startMinigame, startDuelMinigame, finishMinigame } from '../src/games/party/minigames/flow.ts';
import { DEFAULT_SETTINGS } from '../src/games/party/config.ts';
import { festivalRoundPoints } from '../src/games/party/minigames/festivalScoring.ts';
import { DIFFICULTIES } from '../src/games/party/difficulty.ts';
import { parseMessage } from '../src/games/party/network/protocol.ts';
const rng = (seed = 71) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const defs = [ricochetRivals, fuseFaceoff, gravityTug, minotaurMaze, colorClash, constellationCascade];
const participants = (d, difficulty = 'hard') => (d.gameType === 'duel' ? 'ab' : 'abcd').split('').map((id, avatarId) => ({ id, avatarId, difficulty, isBot: true }));
const make = (d, difficulty = 'hard', seed = 71) => d.create({ participants: participants(d, difficulty), startedAt: 1000, endsAt: 1000 + d.durationSeconds * 1000, random: rng(seed) });
const input = (x = 0, y = 0, action = false, fire = false, aimX = 1, aimY = 0) => ({ type: 'ARCADE_CONTROL', x, y, action, fire, aimX, aimY });

for (const d of defs) for (const difficulty of DIFFICULTIES) test(`${d.id}: ${difficulty} bots play a complete seeded round with private runtime protected`, () => {
  const s = make(d, difficulty), random = rng(82), actors = participants(d, difficulty);
  for (let now = s.startedAt; now < s.endsAt && !d.isFinished?.(s); now += 100) {
    d.tick(s, now);
    for (const bot of actors) for (const action of d.botInputs(s, bot, now, random)) { const parsed = d.parseInput(action.input); assert.ok(parsed); d.applyInput(s, bot.id, parsed, action.at); }
    d.tick(s, Math.min(now + 100, s.endsAt));
  }
  assert.ok(Object.values(d.scores(s)).every(Number.isFinite));
  assert.ok(Object.values(d.scores(s)).some((n) => n > 0), `${d.id}: bots must achieve a result`);
  assert.equal(new Set(d.rank(s, actors.map((p) => p.id), random)).size, actors.length);
  const view = d.publicView(s, s.simTime, 'a');
  for (const key of ['seed', 'controls', 'bots', 'plans', 'sequence']) assert.equal(view[key], undefined);
  if (d.id === 'fuse-faceoff') assert.equal(Math.max(...Object.values(d.scores(s))), 3);
  if (d.id === 'minotaur-maze') assert.ok(s.winners);
});

test('all new games reject forged controls, outsiders, early and late inputs', () => {
  for (const d of defs) {
    const s = make(d), valid = d.id === 'constellation-cascade' ? { type: 'CASCADE_ACTION', action: 'left' } : input();
    assert.ok(d.parseInput(valid)); assert.equal(d.parseInput({ ...valid, type: 'UNKNOWN' }), null);
    assert.throws(() => d.applyInput(s, 'outsider', valid, s.startedAt));
    assert.throws(() => d.applyInput(s, 'a', valid, s.startedAt - 1));
    assert.throws(() => d.applyInput(s, 'a', valid, s.endsAt));
    if (d.id !== 'constellation-cascade') for (const bad of [NaN, Infinity, 1.01, -1.01, '1']) assert.equal(d.parseInput({ ...valid, x: bad }), null);
  }
});

test('maze geometry is connected, bounded, has loops, and all spawn cells are open', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const s = make(minotaurMaze, 'hard', seed), open = s.cells.flatMap((n, i) => n ? [] : [i]), seen = new Set([open[0]]), queue = [open[0]];
    for (let i = 0; i < queue.length; i++) { const n = queue[i]; for (const next of [n - 1, n + 1, n - MAZE_SIZE, n + MAZE_SIZE]) if (!s.cells[next] && !seen.has(next)) { seen.add(next); queue.push(next); } }
    assert.equal(seen.size, open.length);
    let edges = 0; for (const n of open) for (const next of [n + 1, n + MAZE_SIZE]) if (s.cells[next] === 0) edges++;
    assert.ok(edges > open.length - 1, 'alternate routes exist');
    for (const p of Object.values(s.players)) assert.equal(s.cells[Math.floor(p.y) * MAZE_SIZE + Math.floor(p.x)], 0);
    for (let i = 0; i < MAZE_SIZE; i++) for (const n of [i, (MAZE_SIZE - 1) * MAZE_SIZE + i, i * MAZE_SIZE, i * MAZE_SIZE + MAZE_SIZE - 1]) assert.equal(s.cells[n], 1);
  }
});

test('maze first hit boosts, protects, reveals for 3s; second hit eliminates; walls and wind-up are respected', () => {
  const d = minotaurMaze, s = make(d), hunter = s.players[s.minotaurId], id = Object.keys(s.players).find((id) => id !== s.minotaurId), p = s.players[id];
  s.cells = s.cells.map((_, n) => n % MAZE_SIZE && n % MAZE_SIZE < 34 && n >= 35 && n < 35 * 34 ? 0 : 1);
  Object.assign(hunter, { x: 10.5, y: 10.5 }); Object.assign(p, { x: 11.3, y: 10.5 });
  d.applyInput(s, s.minotaurId, input(0, 0, true), 1000); d.tick(s, 1320); assert.equal(p.hp, 2);
  d.tick(s, 1380); assert.equal(p.hp, 1); assert.equal(p.boostUntil - 1380, 3000); assert.equal(s.revealUntil, p.boostUntil);
  d.applyInput(s, id, input(1), 1380); const before = p.x; d.tick(s, 1480); assert.ok(Math.abs(p.x - before - .45) < .001);
  p.x = 11.3; d.applyInput(s, s.minotaurId, input(), 1480); d.tick(s, 1500); d.applyInput(s, s.minotaurId, input(0, 0, true), 2400); d.tick(s, 2760); assert.equal(p.hp, 1);
  d.applyInput(s, s.minotaurId, input(), 2760); d.tick(s, 4400); p.x = 11.3; d.applyInput(s, s.minotaurId, input(0, 0, true), 4400); d.tick(s, 4780); assert.equal(p.hp, 0); assert.equal(p.eliminatedAt, 4780); assert.throws(() => d.applyInput(s, id, input(), 4780));
});

test('maze collision blocks walls and visibility never leaks hidden positions to players or spectators', () => {
  const d = minotaurMaze, s = make(d), [a, b] = Object.keys(s.players);
  Object.assign(s.players[a], { x: 1.5, y: 1.5 }); Object.assign(s.players[b], { x: 33.5, y: 33.5 });
  assert.equal(mazeVisible(s, a, b, 1000), false); assert.equal(d.publicView(s, 1000, a).players[b], undefined); assert.deepEqual(d.publicView(s, 1000).players, {});
  d.applyInput(s, a, input(-1), 1000); d.tick(s, 1250); assert.ok(s.players[a].x >= 1.2);
  s.revealUntil = 4000; assert.ok(d.publicView(s, 3999, a).players[b]); assert.equal(d.publicView(s, 4000, a).players[b], undefined);
  const view = d.publicView(s, 4000, a); view.cells[0] = 0; view.players[a].x = 99; assert.equal(s.cells[0], 1); assert.notEqual(s.players[a].x, 99);
});

test('maze pulses start at exactly 150/100/50 seconds remaining and expire after 3 seconds', () => {
  const d = minotaurMaze, s = make(d);
  for (const remaining of [150, 120, 100, 80, 60, 50, 40, 30, 20, 10]) {
    const at = s.endsAt - remaining * 1000; d.tick(s, at - 1); assert.ok(s.revealUntil <= at - 1); d.tick(s, at); assert.equal(s.revealUntil, at + 3000); d.tick(s, at + 3000); assert.ok(s.revealUntil <= s.simTime);
  }
  d.tick(s, s.endsAt); assert.equal(s.winners, 'Runners');
});

test('maze team win pays every winning runner equally and conserves Festival budget in both outcomes', () => {
  for (const winner of ['Runners', 'Minotaur']) {
    const s = make(minotaurMaze); if (winner === 'Minotaur') for (const [id, p] of Object.entries(s.players)) if (id !== s.minotaurId) p.hp = 0;
    minotaurMaze.tick(s, winner === 'Minotaur' ? 1020 : s.endsAt);
    const results = minotaurMaze.rank(s, Object.keys(s.players), rng()).map((playerId, i) => ({ playerId, position: i + 1, score: s.players[playerId].score }));
    const points = festivalRoundPoints(results, (id) => minotaurMaze.teamOf(s, id)); assert.equal(Object.values(points).reduce((a, b) => a + b, 0), 12);
    for (const id of Object.keys(s.players)) assert.equal(points[id], minotaurMaze.teamOf(s, id) === winner ? winner === 'Runners' ? 4 : 12 : 0);
  }
});

test('Ricochet discs bounce once, expire on second wall, and their rebound can hit the owner', () => {
  const d = ricochetRivals, s = make(d); s.discs = [{ id: 1, owner: 'a', x: 1.5, y: 10, vx: -48, vy: 0, bounced: false, expiresAt: 9999 }];
  d.tick(s, 1020); assert.equal(s.discs[0].bounced, true); assert.ok(s.discs[0].vx > 0);
  Object.assign(s.players.a, { x: 3, y: 10 }); d.tick(s, 1040); assert.equal(s.players.a.hp, 2); assert.equal(s.discs.length, 0);
  s.discs = [{ id: 2, owner: 'a', x: 98.5, y: 10, vx: 48, vy: 0, bounced: true, expiresAt: 9999 }]; d.tick(s, 1060); assert.equal(s.discs.length, 0);
  d.applyInput(s, 'a', input(0, 0, true), 1060); d.tick(s, 1080); const cooldown = s.players.a.nextActionAt;
  d.applyInput(s, 'a', input(0, 0, true), 1080); d.tick(s, 1100); assert.equal(s.players.a.nextActionAt, cooldown);
});

test('Fuse passes separate players, prevent immediate pass-back, and award the non-carrier at explosion', () => {
  const d = fuseFaceoff, s = make(d); s.carrier = 'a'; Object.assign(s.players.a, { x: 20, y: 50 }); Object.assign(s.players.b, { x: 21, y: 50 }); s.passAfter = 1000;
  d.tick(s, 1020); assert.equal(s.carrier, 'b'); assert.ok(Math.abs(s.players.a.x - s.players.b.x) >= 9);
  Object.assign(s.players.a, { x: 20, y: 50 }); Object.assign(s.players.b, { x: 21, y: 50 }); d.tick(s, 1040); assert.equal(s.carrier, 'b');
  s.explodesAt = 1060; d.tick(s, 1060); assert.equal(s.players.a.score, 1); assert.equal(s.lastLoser, 'b'); assert.equal(s.round, 2);
});

test('Gravity beams slow movement, attract only within clear sight, preserve momentum and score goals', () => {
  const d = gravityTug, s = make(d); Object.assign(s.pluto, { x: 50, y: 50, vx: 0, vy: 0 });
  d.applyInput(s, 'a', input(1, 0, true), 1000); const x = s.players.a.x; d.tick(s, 1100); assert.ok(Math.abs(s.players.a.x - x - 1.6) < .001); assert.ok(s.pluto.vx < 0);
  d.applyInput(s, 'a', input(), 1100); const vx = s.pluto.vx; d.tick(s, 1200); assert.ok(s.pluto.vx < 0 && s.pluto.vx > vx);
  Object.assign(s.pluto, { x: 6, y: 50, vx: 0, vy: 0 }); d.tick(s, 1220); assert.equal(s.players.a.score, 1);
  s.simTime = s.breakUntil; Object.assign(s.pluto, { x: 30, y: 29, vx: 0, vy: 0 }); Object.assign(s.players.a, { x: 70, y: 29 }); d.applyInput(s, 'a', input(0, 0, true), s.simTime); d.tick(s, s.simTime + 20); assert.equal(s.pluto.vx, 0); assert.equal(s.players.a.pulling, false);
});

test('Color burst cannot be held to bypass cooldown; ownership is overwritten and warned strips wash clean', () => {
  const d = colorClash, s = make(d); Object.assign(s.players.a, { x: 50, y: 50 });
  d.applyInput(s, 'a', input(0, 0, true), 1000); d.tick(s, 1020); assert.equal(s.players.a.score, 13); const cooldown = s.players.a.nextActionAt;
  d.applyInput(s, 'a', input(0, 0, true), 1020); d.tick(s, 1040); assert.equal(s.players.a.nextActionAt, cooldown);
  Object.assign(s.players.b, { x: 50, y: 50 }); d.applyInput(s, 'b', input(0, 0, true), 1040); d.tick(s, 1060); assert.equal(s.players.b.score, 14); assert.equal(s.players.a.score, 0);
  s.washColumn = 0; s.washAt = 1080; for (let y = 0; y < 19; y++) s.owners[y * 19] = 'a'; d.tick(s, 1080); for (let y = 0; y < 19; y++) assert.equal(s.owners[y * 19], null);
});

test('Cascade matches connected moon glyphs, never full rows, and weights chain reactions', () => {
  const board = Array(90).fill(0); for (let x = 0; x < 9; x++) board[9 * 9 + x] = x % 3 + 1; assert.equal(cascadeGroups(board).length, 0);
  for (let y = 6; y < 10; y++) board[y * 9] = 1; assert.equal(cascadeGroups(board).length, 4); assert.equal(settleCascade(board).score, 4);
  const chain = Array(90).fill(0); for (let y = 6; y < 10; y++) chain[y * 9] = 1; chain[5 * 9] = 2; chain[9 * 9 + 1] = 2; chain[8 * 9 + 1] = 2; chain[9 * 9 + 2] = 2;
  const result = settleCascade(chain); assert.equal(result.chain, 2); assert.equal(result.cleared, 8); assert.equal(result.score, 12);
});

test('Cascade sequences are equal, boards and future glyphs remain private, drops are rate limited and overflow recovers', () => {
  const d = constellationCascade, s = make(d); assert.deepEqual(s.players.a.pair, s.players.b.pair);
  d.applyInput(s, 'a', { type: 'CASCADE_ACTION', action: 'swap' }, 1000); assert.deepEqual(s.players.a.pair, [...s.players.b.pair].reverse());
  d.applyInput(s, 'a', { type: 'CASCADE_ACTION', action: 'drop' }, 1100); assert.equal(s.players.a.pairIndex, 2); assert.throws(() => d.applyInput(s, 'a', { type: 'CASCADE_ACTION', action: 'drop' }, 1200));
  const view = d.publicView(s, 1200, 'a'); assert.equal(view.players, undefined); assert.equal(view.sequence, undefined); assert.equal(d.publicView(s, 1200).player, null); view.player.board[0] = 3; assert.notEqual(s.players.a.board[0], 3);
  s.players.a.score = 20; s.players.a.board[4] = 3; d.applyInput(s, 'a', { type: 'CASCADE_ACTION', action: 'drop' }, 1500); assert.equal(s.players.a.score, 15); assert.equal(s.players.a.overflows, 1); assert.ok(s.players.a.board.every((n) => !n)); assert.ok(s.players.a.resetUntil > 1500);
});

test('all six register and finish through real board/duel/festival flow with readiness and idempotent rewards', () => {
  const players = 'abcd'.split('').map((id, i) => createPlayer(id, id, i));
  assert.ok(parseMessage({ type: 'SETTINGS', settings: { ...DEFAULT_SETTINGS, minigameIds: minigameRegistry.pool('main').map((d) => d.id) } }));
  for (const d of defs) for (const mode of d.gameType === 'duel' ? ['board'] : ['board', 'festival']) {
    const settings = { ...DEFAULT_SETTINGS, mode, roundLimit: 3 }; let m = createMatch(players, settings, rng()); m.order = players.map((p) => p.id);
    if (d.gameType === 'duel') startDuelMinigame(m, d.id, ['a', 'b'], rng(), 1000); else startMinigame(m, d.id, rng(), 1000);
    for (const id of m.minigame.participants) m = readyMinigame(m, id, rng(), 1500);
    m = advance(m, settings, rng(), m.minigame.startedAt); assert.equal(m.phase, d.gameType === 'duel' ? 'DUEL_MINIGAME' : 'MINIGAME');
    m = advance(m, settings, rng(), m.minigame.endsAt); assert.equal(m.phase, d.gameType === 'duel' ? 'DUEL_RESULTS' : 'MINIGAME_RESULTS');
    if (d.gameType === 'main') { const rewards = structuredClone(m.minigame.rewards); finishMinigame(m, rng(), m.minigame.endsAt); assert.deepEqual(m.minigame.rewards, rewards); if (mode === 'festival') assert.equal(Object.values(rewards).reduce((a, b) => a + b, 0), 12); }
  }
});
