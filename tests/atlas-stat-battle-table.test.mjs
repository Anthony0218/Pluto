import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { atlasEndpoint } from './helpers/atlas-endpoint.mjs';
import { STAT_BATTLE } from '../src/games/atlas/trials/config.ts';
import { buildTrialCountries, compareCountryStats } from '../src/games/atlas/trials/countryStats.ts';
import { battleCategoryById, MAX_BATTLE_REROLLS } from '../src/games/atlas/trials/statBattle.ts';
import { BATTLE_TABLE, createBattleTable, nextTableRound, pickTableCard, rerollTableHand, revealTablePicks, tableView } from '../src/games/atlas/trials/battleTable.ts';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const countries = await read('../data/geography/countries.json'), extras = await read('../data/geography/extras.json');
const version = (await read('../data/geography/version.json')).atlasDataVersion;
const pool = buildTrialCountries(countries, extras, 'intermediate'), byId = new Map(buildTrialCountries(countries, extras, 'expert').map(country => [country.id, country]));
const allCards = table => [...table.deck, ...table.discard, ...table.hands.flat(), ...(table.played?.cards ?? [])];

test('a Stat Battle table deals unique hands to three or four seats and nobody else', () => {
  for (const seats of [3, 4]) {
    const table = createBattleTable(pool, 'deal', seats);
    assert.equal(table.hands.length, seats);
    assert.ok(table.hands.every(hand => hand.length === STAT_BATTLE.handSize));
    assert.equal(new Set(allCards(table)).size, allCards(table).length, 'no card is dealt twice');
    assert.deepEqual(createBattleTable(pool, 'deal', seats), table, 'the same seed deals the same table');
  }
  for (const seats of [1, 2, 5, 2.5]) assert.throws(() => createBattleTable(pool, 'deal', seats), /three or four/);
});

test('each seat sees its own hand only, and cards stay face down until everyone has played', () => {
  let table = createBattleTable(pool, 'hidden', 3);
  assert.throws(() => pickTableCard(table, 0, table.hands[1][0]), /not in your hand/);
  assert.throws(() => pickTableCard(table, 3, table.hands[0][0]), /seated/);
  table = pickTableCard(table, 1, table.hands[1][2]);
  assert.throws(() => pickTableCard(table, 1, table.hands[1][0]), /already played/);
  assert.throws(() => rerollTableHand(table, 1), /already on the table/);
  assert.equal(revealTablePicks(table, byId), table, 'no reveal while a card is missing');
  const view = tableView(table, 0);
  assert.deepEqual(view.hand, table.hands[0]);
  assert.deepEqual(view.pickedSeats, [false, true, false]);
  assert.equal(view.picked, null); assert.equal(view.played, null);
  assert.ok(!JSON.stringify(view).includes(table.picks[1]) && !table.hands[2].some(card => JSON.stringify(view).includes(card)), 'other hands and face-down cards are not in the view');
  assert.equal(tableView(table, 1).picked, table.picks[1]);
});

test('the single best value takes the round, a shared best scores nobody, and the first to the target wins', () => {
  for (const seats of [3, 4]) for (let game = 0; game < 25; game++) {
    let table = createBattleTable(pool, `full-${seats}-${game}`, seats), ties = 0;
    while (table.phase !== 'finished') {
      const before = table;
      for (let seat = 0; seat < seats; seat++) table = pickTableCard(table, seat, table.hands[seat][(game + seat + table.round) % table.hands[seat].length]);
      table = revealTablePicks(table, byId);
      const { played } = table, category = battleCategoryById(played.categoryId);
      assert.equal(played.categoryId, before.categoryId);
      const cards = played.cards.map(card => byId.get(card));
      const beatsAll = seat => cards.every((other, index) => index === seat || compareCountryStats(cards[seat], other, category.statId, category.direction) > 0);
      const expected = cards.findIndex((_, seat) => beatsAll(seat));
      assert.equal(played.winner, expected < 0 ? null : expected);
      ties += Number(played.winner === null);
      assert.deepEqual(table.scores, before.scores.map((score, seat) => score + Number(seat === played.winner)));
      assert.ok(table.hands.every(hand => hand.length === STAT_BATTLE.handSize - 1));
      assert.equal(new Set(allCards(table)).size, allCards(table).length);
      table = nextTableRound(table);
      assert.ok(table.hands.every(hand => hand.length === STAT_BATTLE.handSize), 'hands are refilled, from the discard pile if the deck runs dry');
      assert.equal(new Set(allCards(table)).size, allCards(table).length);
    }
    assert.ok(Math.max(...table.scores) === STAT_BATTLE.winTarget || table.round === BATTLE_TABLE.maxRounds);
    assert.equal(table.scores.reduce((sum, score) => sum + score, 0) + ties, table.history.length);
    assert.equal(nextTableRound(table), table);
  }
  // Equal best values: build a round where two seats play the same country value.
  let table = createBattleTable(pool, 'tie', 3);
  const twin = table.hands[0][0];
  table = { ...table, hands: [table.hands[0], [twin, ...table.hands[1].slice(1)], table.hands[2]] };
  const category = battleCategoryById(table.categoryId);
  const weakest = [...table.hands[2]].sort((a, b) => compareCountryStats(byId.get(a), byId.get(b), category.statId, category.direction))[0];
  table = revealTablePicks(pickTableCard(pickTableCard(pickTableCard(table, 0, twin), 1, twin), 2, weakest), byId);
  if (compareCountryStats(byId.get(twin), byId.get(weakest), category.statId, category.direction) >= 0) { assert.equal(table.played.winner, null); assert.deepEqual(table.scores, [0, 0, 0]); }
});

test('every seat may replace its whole hand three times per game; a timeout plays the first card', () => {
  let table = createBattleTable(pool, 'reroll', 4);
  for (let use = 0; use < MAX_BATTLE_REROLLS; use++) {
    const old = table.hands[2];
    table = rerollTableHand(table, 2);
    assert.equal(table.hands[2].length, STAT_BATTLE.handSize);
    assert.ok(table.hands[2].every(card => !old.includes(card)));
    assert.equal(new Set(allCards(table)).size, allCards(table).length);
  }
  assert.throws(() => rerollTableHand(table, 2), /No rerolls/);
  assert.equal(tableView(table, 2).rerollsLeft, 0); assert.equal(tableView(table, 0).rerollsLeft, MAX_BATTLE_REROLLS);
  table = pickTableCard(table, 3, table.hands[3][4]);
  const forced = revealTablePicks(table, byId, true);
  assert.deepEqual(forced.played.cards, [table.hands[0][0], table.hands[1][0], table.hands[2][0], table.hands[3][4]]);
});

test('online Stat Battle runs a duel for two and a table for three or four, with hands kept private', async () => {
  const endpoint = await atlasEndpoint();
  try {
    const invoke = async (user, body, expected = 200) => {
      const response = await endpoint.call(user, { ...body, datasetVersion: version });
      assert.equal(response.status, expected, JSON.stringify(response.body));
      return response.body;
    };
    for (const users of [['a', 'b'], ['a', 'b', 'c'], ['a', 'b', 'c', 'd']]) {
      let room = await invoke('a', { op: 'create', mode: 'stat_battle', maxPlayers: users.length });
      const code = room.code, row = endpoint.matches.at(-1);
      for (const user of users.slice(1)) await invoke(user, { op: 'join', code });
      for (const user of users) room = await invoke(user, { op: 'ready', code });
      assert.equal(room.status, 'countdown');
      endpoint.advance(3001); room = await invoke('a', { op: 'get', code });
      assert.equal(room.status, 'round_active');
      if (users.length === 2) { assert.ok(room.battle); assert.equal(room.table, undefined); continue; }
      assert.equal(room.battle, undefined);
      assert.equal(room.table.hand.length, STAT_BATTLE.handSize); assert.deepEqual(room.table.handSizes, users.map(() => STAT_BATTLE.handSize));
      const hands = {};
      for (const user of users) hands[user] = (await invoke(user, { op: 'get', code })).table.hand;
      assert.equal(new Set(Object.values(hands).flat()).size, users.length * STAT_BATTLE.handSize);
      await invoke('a', { op: 'play', code, roundIndex: 0, card: hands.b[0] }, 400);
      await invoke('a', { op: 'play', code, roundIndex: 3, card: hands.a[0] }, 400);
      room = await invoke('a', { op: 'reroll', code, roundIndex: 0 });
      assert.equal(room.table.rerollsLeft, MAX_BATTLE_REROLLS - 1); assert.ok(room.table.hand.every(card => !hands.a.includes(card)));
      room = await invoke('a', { op: 'play', code, roundIndex: 0, card: room.table.hand[1] });
      assert.equal(room.status, 'round_active'); assert.equal(room.table.picked, room.table.hand[1]);
      const other = await invoke('b', { op: 'get', code });
      assert.deepEqual(other.table.pickedSeats.slice(0, 2), [true, false]); assert.ok(!JSON.stringify(other.table).includes(room.table.picked), 'a face-down card is not sent to the others');
      // Everybody else runs out of time: their first card is played and the round is revealed to all.
      endpoint.advance(30_001); room = await invoke('b', { op: 'get', code });
      assert.equal(room.status, 'round_resolving'); assert.equal(room.table.played.cards.length, users.length);
      assert.deepEqual(room.table.played.cards.slice(1), users.slice(1).map(user => hands[user][0]));
      assert.deepEqual(Object.values(room.scores).reduce((sum, score) => sum + score, 0), Number(room.table.played.winner !== null));
      endpoint.advance(6501); room = await invoke('c', { op: 'get', code });
      assert.equal(room.status, 'round_active'); assert.equal(room.roundIndex, 1); assert.equal(room.table.round, 2); assert.equal(room.table.played, null);
      assert.equal(room.table.hand.length, STAT_BATTLE.handSize);
      // Play on by the clock until somebody reaches the target; the room then finishes with the table's scores.
      for (let guard = 0; guard < 80 && room.status !== 'finished'; guard++) { endpoint.advance(30_001); await invoke('a', { op: 'get', code }); endpoint.advance(6501); room = await invoke('a', { op: 'get', code }); }
      assert.equal(room.status, 'finished');
      assert.deepEqual(Object.values(room.scores), row.state.table.scores);
      assert.ok(Math.max(...Object.values(room.scores)) === STAT_BATTLE.winTarget || row.state.table.round === BATTLE_TABLE.maxRounds);
      assert.equal(room.table.history.length, row.state.table.history.length);
      room = await invoke('a', { op: 'rematch', code }); assert.equal(room.status, 'ready'); assert.equal(room.table, undefined);
    }
  } finally { endpoint.close(); }
});
