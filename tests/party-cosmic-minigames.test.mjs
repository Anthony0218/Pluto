import test from 'node:test';
import assert from 'node:assert/strict';
import { minigameRegistry } from '../src/games/party/minigames/index.ts';
import { DIFFICULTIES } from '../src/games/party/difficulty.ts';
import { createMatch, createPlayer, advance } from '../src/games/party/engine/engine.ts';
import { startMinigame, finishMinigame, readyMinigame } from '../src/games/party/minigames/flow.ts';
import { DEFAULT_SETTINGS } from '../src/games/party/config.ts';
import { parseMessage } from '../src/games/party/network/protocol.ts';
import { HEIST_DOCKS, inHeistLaser } from '../src/games/party/minigames/expansionGames/plutoHeist.ts';
import { KITCHEN_X, kitchenY } from '../src/games/party/minigames/expansionGames/kitchenChaos.ts';
import { RALLY_HAZARDS, RALLY_CELLS } from '../src/games/party/minigames/expansionGames/orbitalRally.ts';

const IDS = ['disco-freeze', 'pluto-heist', 'kitchen-chaos', 'rocket-rumble', 'orbital-rally', 'island-impostor', 'penalty-shootout'];
const rng = (seed = 39) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const participants = (difficulty = 'hard') => 'abcd'.split('').map((id, avatarId) => ({ id, avatarId, isBot: true, difficulty }));
const make = (id, difficulty = 'hard') => { const d = minigameRegistry.get(id); return d.create({ participants: participants(difficulty), startedAt: 1000, endsAt: 1000 + d.durationSeconds * 1000, random: rng() }); };
const move = (x = 0, y = 0, action = false) => ({ type: 'FESTIVAL_MOVE', x, y, action });

for (const id of IDS) for (const difficulty of DIFFICULTIES) test(`${id}: complete ${difficulty} bot match has finite scores, no hidden runtime, and meaningful play`, () => {
  const d = minigameRegistry.get(id), s = make(id, difficulty), random = rng(91);
  for (let now = s.startedAt; now < s.endsAt && !d.isFinished?.(s); now += 100) {
    d.tick(s, now);
    for (const bot of participants(difficulty)) for (const action of d.botInputs(s, bot, now, random)) {
      const parsed = d.parseInput(action.input); assert.ok(parsed, `${id} bot produced invalid input`);
      d.applyInput(s, bot.id, parsed, action.at);
    }
    d.tick(s, Math.min(now + 100, s.endsAt));
  }
  assert.ok(Object.values(d.scores(s)).every(Number.isFinite));
  assert.ok(Object.values(d.scores(s)).some((score) => score > 0), `${id} ${difficulty} should score`);
  assert.equal(new Set(d.rank(s, 'abcd'.split(''), random)).size, 4);
  const view = d.publicView(s, s.simTime, 'a');
  for (const privateKey of ['seed', 'bots', 'controls', 'choices', 'before', 'after', 'schedule']) assert.equal(view[privateKey], undefined, `${id} leaked ${privateKey}`);
  if (id === 'penalty-shootout') {
    assert.equal(s.attempt, 12); assert.equal(s.phase, 'finished');
    for (const p of Object.values(s.players)) { assert.equal(p.shots, 3); assert.equal(p.keeperTurns, 3); assert.equal(p.score, p.goals + p.saves); }
  }
  if (id === 'orbital-rally') for (const p of Object.values(s.players)) { assert.equal(p.progress, 3); assert.ok(p.finishedAt); assert.ok(p.charges >= 0 && p.charges <= 3); }
  if (id === 'kitchen-chaos') for (const team of s.teams) assert.equal(s.players[team.ids[0]].score, s.players[team.ids[1]].score);
});

test('all seven games are selectable in validated lobby lineups and finish through the actual festival flow', () => {
  const cfg = { ...DEFAULT_SETTINGS, mode: 'festival', roundLimit: 3, minigameIds: IDS };
  assert.ok(parseMessage({ type: 'SETTINGS', settings: cfg }));
  assert.ok(parseMessage({ type: 'SETTINGS', settings: { ...cfg, minigameIds: minigameRegistry.pool('main').map((g) => g.id) } }));
  for (const id of IDS) {
    const players = 'abcd'.split('').map((id, i) => createPlayer(id, id, i));
    let match = createMatch(players, { ...cfg, minigameIds: [id] }, rng());
    for (const p of players) match = readyMinigame(match, p.id, rng(), 1000);
    match = advance(match, cfg, rng(), match.minigame.startedAt);
    match = advance(match, cfg, rng(), match.minigame.endsAt);
    assert.equal(match.phase, 'MINIGAME_RESULTS', id);
    assert.equal(Object.values(match.minigame.rewards).reduce((sum, p) => sum + p, 0), 12, id);
  }
});

test('Disco Freeze rewards movement, tolerates the reaction window, and penalizes one slip per freeze', () => {
  const d = minigameRegistry.get('disco-freeze'), s = make(d.id);
  for (let at = 1000; at < 2100; at += 100) { d.applyInput(s, 'a', move(1), at); d.tick(s, at + 100); }
  assert.equal(s.players.a.score, 1);
  s.phase = 'freeze'; s.phaseStartedAt = s.simTime; s.phaseEndsAt = s.simTime + 2000;
  d.applyInput(s, 'a', move(1), s.simTime); d.tick(s, s.simTime + 300); assert.equal(s.players.a.failed, false);
  d.applyInput(s, 'a', move(1), s.simTime); d.tick(s, s.simTime + 200); assert.equal(s.players.a.failed, true); assert.equal(s.players.a.score, 0);
  d.tick(s, s.phaseEndsAt); assert.equal(s.players.b.score, 3); assert.equal(s.players.b.stops, 1); assert.equal(s.players.a.stops, 0);
  s.phase = 'scratch'; s.phaseEndsAt = s.simTime + 1000;
  const scratchEnd = s.phaseEndsAt;
  for (let at = s.simTime; at < scratchEnd; at += 100) { d.applyInput(s, 'b', move(-1), at); d.tick(s, at + 100); }
  assert.equal(s.players.b.failed, false);
});

test('Pluto Heist banks only at your own shuttle, enforces cargo limits and preserves banked points when caught', () => {
  const d = minigameRegistry.get('pluto-heist'), s = make(d.id), p = s.players.a;
  s.gems = []; p.cargo = 5; Object.assign(p, HEIST_DOCKS[1]); d.tick(s, 1020); assert.equal(p.score, 0); assert.equal(p.cargo, 5);
  Object.assign(p, HEIST_DOCKS[p.dock]); d.tick(s, 1040); assert.equal(p.score, 5); assert.equal(p.cargo, 0);
  p.cargo = 7; s.gems = [{ id: 0, x: p.x, y: p.y, value: 3, respawnAt: 0 }]; p.x = 20; s.gems[0].x = 20; d.tick(s, 1060); assert.equal(p.cargo, 7);
  s.gems = []; s.simTime = 3000; const angle = (3020 - s.startedAt) / 1000 * .48;
  Object.assign(p, { x: 50 + Math.cos(angle) * 20, y: 50 + Math.sin(angle) * 20, cargo: 5 });
  assert.equal(inHeistLaser(p, angle), true); d.tick(s, 3020);
  assert.equal(p.cargo, 0); assert.equal(p.score, 5); assert.equal(p.caught, 1); assert.equal(p.x, HEIST_DOCKS[p.dock].x);
});

test('Pluto Heist cloak blocks security detection and cannot be retriggered by holding or replaying action', () => {
  const d = minigameRegistry.get('pluto-heist'), s = make(d.id), p = s.players.a;
  s.gems = []; s.simTime = 3000;
  const angle = (3020 - s.startedAt) / 1000 * .48;
  Object.assign(p, { x: 50 + Math.cos(angle) * 20, y: 50 + Math.sin(angle) * 20, cargo: 5 });
  d.applyInput(s, 'a', move(0, 0, true), 3000); d.tick(s, 3020);
  assert.equal(p.caught, 0); assert.equal(p.cargo, 5); const cooldown = p.nextCloakAt;
  d.applyInput(s, 'a', move(0, 0, true), 3020); d.tick(s, 3040); assert.equal(p.nextCloakAt, cooldown);
  d.applyInput(s, 'a', move(), 3040); d.tick(s, 3060); d.applyInput(s, 'a', move(0, 0, true), 3060); d.tick(s, 3080); assert.equal(p.nextCloakAt, cooldown);
});

test('Kitchen Chaos supports teammate retrieval, burnt pots and full-hand swaps without unequal rewards', () => {
  const d = minigameRegistry.get('kitchen-chaos'), s = make(d.id), team = s.teams[0], [chef, partner] = team.ids, p = s.players[chef], q = s.players[partner];
  const place = (player, x) => Object.assign(player, { x, y: kitchenY(player.team) });
  place(p, KITCHEN_X.supply); d.applyInput(s, chef, move(0, 0, true), 1000); d.tick(s, 1020); assert.equal(p.holding, 'raw');
  place(p, KITCHEN_X.chop);
  for (let at = 1020; at < 2320; at += 100) { d.applyInput(s, chef, move(0, 0, true), at); d.tick(s, at + 100); }
  assert.equal(p.holding, 'chopped');
  d.applyInput(s, chef, move(), s.simTime); d.tick(s, s.simTime + 20);
  place(p, KITCHEN_X.oven); d.applyInput(s, chef, move(0, 0, true), s.simTime); d.tick(s, s.simTime + 20); assert.equal(p.holding, null); assert.ok(team.pots[0]);
  d.tick(s, team.pots[0].readyAt); place(q, KITCHEN_X.oven); d.applyInput(s, partner, move(0, 0, true), s.simTime); d.tick(s, s.simTime + 20); assert.equal(q.holding, 'cooked');
  d.applyInput(s, partner, move(), s.simTime); d.tick(s, s.simTime + 20); place(q, KITCHEN_X.serve); d.applyInput(s, partner, move(0, 0, true), s.simTime); d.tick(s, s.simTime + 20);
  assert.equal(team.served, 1); assert.equal(p.score, 1); assert.equal(q.score, 1);
  team.pots[0] = { readyAt: s.simTime, burnsAt: s.simTime + 1000 }; p.holding = 'chopped'; place(p, KITCHEN_X.oven); p.actionHeld = false;
  d.applyInput(s, chef, move(0, 0, true), s.simTime); d.tick(s, s.simTime + 20); assert.equal(p.holding, 'cooked'); assert.ok(team.pots[0].readyAt > s.simTime);
  d.tick(s, team.pots[0].burnsAt); assert.equal(team.pots[0], null); assert.equal(team.burnt, 1);
});

test('Rocket Rumble scores stars, charges collision penalties once and limits boost stealing with shields', () => {
  const d = minigameRegistry.get('rocket-rumble'), s = make(d.id), p = s.players.a, q = s.players.b;
  s.fuel = [{ id: 0, x: p.x, y: p.y, value: 3, respawnAt: 0 }]; d.tick(s, 1020); assert.equal(p.score, 3);
  d.tick(s, 1040); assert.equal(p.score, 3);
  s.fuel = []; Object.assign(p, { x: 10, y: 50, boostUntil: 2000, shieldUntil: 0 }); Object.assign(q, { x: 13, y: 50, score: 3, shieldUntil: 0 });
  d.tick(s, 1060); assert.equal(p.score, 4); assert.equal(q.score, 2); d.tick(s, 1080); assert.equal(p.score, 4);
  Object.assign(p, { x: 32, y: 32, vx: 0, vy: 0, shieldUntil: 0 }); d.tick(s, 1100); assert.equal(p.score, 3); assert.ok(Math.hypot(p.x - 32, p.y - 32) >= 7);
});

test('Orbital Rally uses authoritative laps, limited cells, lane hazards and finish times', () => {
  const d = minigameRegistry.get('orbital-rally'), s = make(d.id), p = s.players.a;
  const h = RALLY_HAZARDS[0]; p.progress = h.t; p.lane = h.lane; p.speed = 20; d.tick(s, 1020); assert.equal(p.hits, 1); assert.ok(p.speed < 10);
  p.progress = RALLY_CELLS[0].t; p.lane = RALLY_CELLS[0].lane; p.charges = 0; d.tick(s, 1040); assert.equal(p.charges, 1);
  d.tick(s, 1060); assert.equal(p.charges, 1);
  p.stunnedUntil = 0;
  d.applyInput(s, 'a', move(0, -1, true), 1060); d.tick(s, 1080); assert.equal(p.charges, 0); assert.ok(p.boostUntil > 1080);
  p.progress = 2.9999; p.speed = 20; d.tick(s, 1100); assert.equal(p.progress, 3); assert.equal(p.finishedAt, 1100); assert.ok(p.score > 300);
  const finished = p.score; d.tick(s, 5000); assert.equal(p.score, finished);
  assert.equal(d.parseInput({ ...move(), x: Infinity, progress: 999 }), null);
});

test('Island Impostor changes exactly one souvenir and conceals the answer, previous board and other guesses', () => {
  const d = minigameRegistry.get('island-impostor'), s = make(d.id);
  assert.equal(s.before.filter((object, i) => JSON.stringify(object) !== JSON.stringify(s.after[i])).length, 1);
  assert.equal(d.publicView(s, 1000, 'a').changed, null);
  d.tick(s, 3400); assert.deepEqual(d.publicView(s, 3400, 'a').objects, []);
  d.tick(s, 4000); const original = structuredClone(s.before);
  d.applyInput(s, 'a', { type: 'IMPOSTOR_GUESS', tile: s.changed, round: 1 }, 4100);
  assert.equal(s.players.a.score, 0); assert.throws(() => d.applyInput(s, 'a', { type: 'IMPOSTOR_GUESS', tile: 0, round: 1 }, 4200));
  const guest = d.publicView(s, 4200, 'b'); assert.equal(guest.changed, null); assert.equal(guest.yourChoice, null); assert.equal(guest.players.a.choice, undefined); assert.equal(guest.before, undefined);
  assert.equal(guest.players.a.score, 0); assert.equal(d.publicView(s, 4200, 'a').yourCorrect, null);
  assert.deepEqual(s.before, original); d.tick(s, 7200); assert.equal(d.publicView(s, 7200, 'b').changed, s.changed); assert.equal(s.players.a.score, 2);
  d.tick(s, 7300); assert.equal(s.players.a.score, 2);
  d.tick(s, 8200); assert.equal(s.round, 2); assert.throws(() => d.applyInput(s, 'a', { type: 'IMPOSTOR_GUESS', tile: 0, round: 1 }, 8200));
});

test('penalty schedule gives every player exactly one shot against and one keeper turn for each opponent', () => {
  const s = make('penalty-shootout'); assert.equal(s.schedule.length, 12);
  assert.equal(new Set(s.schedule.map((p) => `${p.shooter}:${p.keeper}`)).size, 12);
  for (const id of 'abcd') { assert.equal(s.schedule.filter((p) => p.shooter === id).length, 3); assert.equal(s.schedule.filter((p) => p.keeper === id).length, 3); }
  assert.ok(s.schedule.every((pair) => pair.shooter !== pair.keeper));
});

for (const outcome of ['goal', 'save', 'miss']) test(`penalties ${outcome}: reward only the correct role, never reveal locked choices early, and reject replay`, () => {
  const d = minigameRegistry.get('penalty-shootout'), s = make(d.id), pair = s.schedule[0];
  const at = outcome === 'miss' ? 1385 : 1100;
  d.applyInput(s, pair.shooter, { type: 'PENALTY_CHOICE', attempt: 1, lane: 0, action: 'kick' }, at);
  d.applyInput(s, pair.keeper, { type: 'PENALTY_CHOICE', attempt: 1, lane: outcome === 'goal' ? 2 : 0, action: 'dive' }, at);
  const view = d.publicView(s, at, 'spectator'); assert.equal(view.shot, null); assert.equal(view.keeper, null); assert.equal(view.yourLane, null);
  assert.throws(() => d.applyInput(s, pair.shooter, { type: 'PENALTY_CHOICE', attempt: 1, lane: 1, action: 'kick' }, at));
  d.tick(s, at + 800); assert.equal(s.outcome, outcome);
  assert.equal(s.players[pair.shooter].score, outcome === 'goal' ? 1 : 0); assert.equal(s.players[pair.keeper].score, outcome === 'save' ? 1 : 0);
  assert.equal(s.players[pair.shooter].shots, 1); assert.equal(s.players[pair.keeper].keeperTurns, 1);
});

test('penalty timeouts finish all twelve attempts with equal turns and no free save points', () => {
  const d = minigameRegistry.get('penalty-shootout'), s = make(d.id);
  d.tick(s, s.endsAt); assert.equal(s.phase, 'finished'); assert.equal(s.attempt, 12);
  for (const p of Object.values(s.players)) { assert.equal(p.shots, 3); assert.equal(p.keeperTurns, 3); assert.equal(p.score, 0); }
});

test('Kitchen Chaos integrates equal board and festival team rewards', () => {
  for (const mode of ['board', 'festival']) {
    const cfg = { ...DEFAULT_SETTINGS, mode, roundLimit: 3 }, match = createMatch('abcd'.split('').map((id, i) => createPlayer(id, id, i)), cfg, rng());
    match.order = match.players.map((p) => p.id);
    startMinigame(match, 'kitchen-chaos', rng(), 0);
    for (const p of Object.values(match.minigame.state.players)) p.score = p.team === 0 ? 9 : 1;
    finishMinigame(match, rng(), 65000);
    for (const p of Object.values(match.minigame.state.players)) {
      const playerId = Object.entries(match.minigame.state.players).find(([, chef]) => chef === p)[0];
      assert.equal(match.minigame.rewards[playerId], mode === 'festival' ? p.team === 0 ? 5 : 1 : p.team === 0 ? 8 : 3);
    }
  }
});
