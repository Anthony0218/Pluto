import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/games/party/config.ts';
import { createMatch, createPlayer, advance } from '../src/games/party/engine/engine.ts';
import { rankedPlayers } from '../src/games/party/engine/economy.ts';
import { festivalRoundPoints, festivalWinners } from '../src/games/party/minigames/festivalScoring.ts';
import { startMinigame, finishMinigame, applyMinigameRewards } from '../src/games/party/minigames/flow.ts';
import { minigameRegistry } from '../src/games/party/minigames/index.ts';
import { PartyRooms } from '../server/party/rooms.ts';

const players = () => ['a', 'b', 'c', 'd'].map((id, i) => createPlayer(id, id, i));
const settings = { ...DEFAULT_SETTINGS, mode: 'festival', roundLimit: 3 };
const results = (scores) => scores.map((score, i) => ({ playerId: 'abcd'[i], position: i + 1, score }));
const total = (points) => Object.values(points).reduce((sum, value) => sum + value, 0);

test('solo games normalize scores and split tied places without changing the twelve-point budget', () => {
  const cases = [
    [[90, 30, 20, 0], [6, 4, 2, 0]],
    [[9000, 3000, 2000, 0], [6, 4, 2, 0]],
    [[10, 10, 5, 0], [5, 5, 2, 0]],
    [[10, 5, 5, 0], [6, 3, 3, 0]],
    [[10, 5, 0, 0], [6, 4, 1, 1]],
    [[10, 10, 10, 0], [4, 4, 4, 0]],
    [[0, 0, 0, 0], [3, 3, 3, 3]],
  ];
  for (const [scores, expected] of cases) {
    const points = festivalRoundPoints(results(scores));
    assert.deepEqual('abcd'.split('').map((id) => points[id]), expected);
    assert.equal(total(points), 12);
    assert.deepEqual(festivalRoundPoints(results(scores).reverse()), points);
  }
});

test('2v2 wins and draws have the same point budget as solo games', () => {
  const team = (id) => 'ab'.includes(id) ? '0' : '1';
  assert.deepEqual(festivalRoundPoints(results([7, 7, 2, 2]), team), { a: 5, b: 5, c: 1, d: 1 });
  assert.deepEqual(festivalRoundPoints(results([0, 0, 0, 0]), team), { a: 3, b: 3, c: 3, d: 3 });
});

test('authoritative festival rewards are points, applied once, and coins cannot break final ties', () => {
  const match = createMatch(players(), settings, () => 0.3);
  startMinigame(match, 'circle-shot', () => 0.3, 0);
  const state = match.minigame.state;
  for (const [id, score] of Object.entries({ a: 10, b: 10, c: 5, d: 0 })) state.players[id].score = score;
  const coins = match.players.map((p) => p.coins);
  finishMinigame(match, () => 0.7, 100000);
  assert.deepEqual(match.festivalScores, { a: 5, b: 5, c: 2, d: 0 });
  assert.deepEqual(match.minigame.rewards, match.festivalScores);
  assert.deepEqual(match.minigame.results.map((r) => r.position), [1, 1, 3, 4]);
  assert.deepEqual(match.players.map((p) => p.coins), coins);
  applyMinigameRewards(match);
  assert.deepEqual(match.festivalScores, { a: 5, b: 5, c: 2, d: 0 });
  match.players[1].coins = 9999;
  match.order = ['b', 'd', 'c', 'a'];
  match.round = 3;
  match.phase = 'ROUND_END';
  const ended = advance(match, settings, () => 0.7, 200000);
  assert.equal(ended.phase, 'GAME_OVER');
  assert.deepEqual(festivalWinners(ended), ['a', 'b']);
  assert.equal(rankedPlayers(ended, settings)[0].id, 'a');
});

test('both team games award festival points equally to partners, including draws', () => {
  for (const id of ['rope-rescue', 'paddle-doubles']) for (const draw of [false, true]) {
    const match = createMatch(players(), settings, () => 0.3);
    startMinigame(match, id, () => 0.3, 0);
    const state = match.minigame.state;
    if (id === 'rope-rescue') for (const p of Object.values(state.players)) p.score = draw ? 0 : p.team === 0 ? 10 : 0;
    else state.teamScores = draw ? [0, 0] : [7, 2];
    finishMinigame(match, () => 0.3, 100000);
    const def = minigameRegistry.get(id);
    const winningTeam = def.teamOf(state, match.minigame.results[0].playerId);
    for (const p of match.players) assert.equal(match.festivalScores[p.id], draw ? 3 : def.teamOf(state, p.id) === winningTeam ? 5 : 1);
    assert.equal(total(match.festivalScores), 12);
  }
});

test('lobby discovery exposes festival mode and only the host may choose a lineup', () => {
  const rooms = new PartyRooms();
  const host = rooms.connect(undefined, () => {});
  const guest = rooms.connect(undefined, () => {});
  rooms.handle(host, { type: 'CREATE', name: 'Festival', playerName: 'Host', public: true });
  const room = rooms.rooms.get(host.room);
  rooms.handle(guest, { type: 'JOIN', code: room.code, playerName: 'Guest' });
  const cfg = { ...settings, minigameIds: ['circle-shot'] };
  assert.throws(() => rooms.handle(guest, { type: 'SETTINGS', settings: cfg }));
  rooms.handle(host, { type: 'READY', ready: true });
  rooms.handle(host, { type: 'SETTINGS', settings: cfg });
  assert.equal(room.players[0].ready, false);
  assert.equal(rooms.lobbySummaries('')[0].mode, 'festival');
  assert.deepEqual(room.settings.minigameIds, ['circle-shot']);
});
