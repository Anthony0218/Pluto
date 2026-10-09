import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { instrumentBot, independentResult, checkFinished, seatLevelsFor, mixSeed, endgameAlternatives } from '../scripts/schafkopf-audit/core.mjs';
import * as engine from '../src/games/schafkopf/schafkopf.ts';
import { seededRandom } from '../src/games/schafkopf/botConfig.ts';

test('audit seat schedule balances every tier in all seats and all dealer positions', () => {
  for (const level of ['beginner', 'amateur', 'pro', 'legend']) {
    const seatCounts = [0, 0, 0, 0], positions = [0, 0, 0, 0];
    for (let index = 0; index < 96; index++) {
      const seat = seatLevelsFor(index).indexOf(level);
      assert.ok(seat >= 0); seatCounts[seat]++; positions[(seat - (Math.floor(index / 24) + 1) + 4) % 4]++;
    }
    assert.deepEqual(seatCounts, [24, 24, 24, 24]); assert.deepEqual(positions, [24, 24, 24, 24]);
  }
});

test('read-only telemetry preserves complete seeded bot decisions and results', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'schafkopf-observer-test-'));
  try {
    for (const file of ['schafkopf.ts', 'bot.ts', 'botConfig.ts', 'knowledge.ts']) {
      const original = fs.readFileSync(new URL(`../src/games/schafkopf/${file}`, import.meta.url), 'utf8');
      fs.writeFileSync(path.join(directory, file), file === 'bot.ts' ? instrumentBot(original) : original);
    }
    const observed = await import(pathToFileURL(path.join(directory, 'schafkopf.ts')));
    let events = 0; globalThis.__schafkopfAudit = () => { events++; };
    const rules = { ...engine.DEFAULT_GAME_RULES, bot: { legendIterations: 2, legendTimeMs: 2000, announcementSamples: 2 } };
    for (let index = 0; index < 4; index++) {
      const deck = engine.shuffledDeck(seededRandom(mixSeed(1, index)));
      let original = engine.createGame(undefined, index, deck, undefined, 1, rules);
      let copy = observed.createGame(undefined, index, deck, undefined, 1, rules);
      const rngA = seededRandom(index + 1), rngB = seededRandom(index + 1);
      for (let step = 0; !['finished', 'redeal'].includes(original.phase); step++) {
        assert.ok(step < 160);
        const level = seatLevelsFor(index)[original.turn];
        const a = engine.chooseAiAction(engine.viewFor(original, original.turn), level, rngA);
        const b = observed.chooseAiAction(observed.viewFor(copy, copy.turn), level, rngB);
        assert.deepEqual(b, a);
        original = engine.applyAction(original, original.turn, a, rngA);
        copy = observed.applyAction(copy, copy.turn, b, rngB);
      }
      assert.deepEqual(copy.result, original.result); assert.deepEqual(copy.tricks, original.tricks);
    }
    assert.ok(events > 0);
  } finally { delete globalThis.__schafkopfAudit; fs.rmSync(directory, { recursive: true, force: true }); }
});

test('independent audit detects a corrupted trick winner, ledger and score', () => {
  let game = engine.createGame(undefined, 3, engine.shuffledDeck(seededRandom(6)));
  const random = seededRandom(8);
  while (!['finished', 'redeal'].includes(game.phase)) game = engine.applyAction(game, game.turn, engine.chooseAiAction(engine.viewFor(game, game.turn), 'pro', random), random);
  assert.equal(game.phase, 'finished'); checkFinished(game, engine);
  let broken = structuredClone(game); broken.tricks[0].winner = (broken.tricks[0].winner + 1) % 4;
  assert.throws(() => checkFinished(broken, engine), /independent trick winner/);
  broken = structuredClone(game); broken.result.value++;
  assert.throws(() => checkFinished(broken, engine), /independent settlement/);
  broken = structuredClone(game); broken.totals[0]++;
  assert.throws(() => checkFinished(broken, engine), /per-game ledger/);
});

test('independent settlement handles 60/61 after spritz, lost Tout and Sie', () => {
  for (const [contract, points, winners] of [
    [{kind:'solo',suit:'Herz'},[60,20,20,20],[0,0,0,0,1,2,3,3]],
    [{kind:'solo',suit:'Herz',tout:true},[21,11,0,0],[0,1]],
    [{kind:'sie'},[120,0,0,0],[]],
  ]) {
    for (const spritzCount of [0,1,2,3,4]) {
      const state = engine.createGame(); Object.assign(state, {contract,points,declarer:0,partner:null,spritzCount,multiplier:2**spritzCount,tricks:winners.map(winner=>({winner,points:0,plays:[]}))});
      const expected = independentResult(state), actual = engine.scoreRound(state);
      for (const key of Object.keys(expected)) assert.deepEqual(actual[key], expected[key]);
    }
  }
});

test('exact endgame ranks tariff-changing alternatives without changing the original game', () => {
  const game = engine.createGame();
  const card = id => engine.createDeck().find(card => card.id === id);
  Object.assign(game,{phase:'play',turn:0,contract:{kind:'solo',suit:'Herz'},declarer:0,partner:null,
    points:[50,30,20,0],hands:[['Gras-Ass','Herz-7'],['Schellen-König','Gras-9'],['Schellen-9','Eichel-Unter'],['Eichel-Ober','Gras-König']].map(hand=>hand.map(card)),
    tricks:Array.from({length:6},(_,i)=>({winner:i===0?0:1,points:0,plays:[]}))});
  const snapshot=structuredClone(game);
  const result=endgameAlternatives(game,0,engine);
  assert.equal(result.alternatives.length,2);
  const ass=result.alternatives.find(item=>item.card==='Gras-Ass');
  const seven=result.alternatives.find(item=>item.card==='Herz-7');
  assert.ok(seven.delta>ass.delta);
  assert.deepEqual(game,snapshot);
});
