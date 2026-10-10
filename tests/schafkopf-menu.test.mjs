import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame } from '../src/games/schafkopf/schafkopf.ts';
import { recordDifficultyWin } from '../src/games/schafkopf/progression.ts';
import { SCHAFKOPF_LESSONS } from '../src/games/schafkopf/lessons.ts';
import { SCHAFKOPF_LESSON_EXAMPLES } from '../src/games/schafkopf/lessonExamples.ts';
const win = round => ({ ...createGame(), round, phase: 'finished', result: { deltas: [10,-10,10,-10] } });

test('offers exactly the next bot level after each 20 wins on that level', () => {
  let progress = { wins: {}, processed: [] };
  for (let round = 1; round <= 40; round++) {
    const result = recordDifficultyWin(progress, win(round), 'beginner');
    progress = result.progress;
    assert.equal(result.offer, round % 20 === 0 ? 'amateur' : null);
  }
  assert.equal(progress.wins.beginner, 40);
  const advanced = recordDifficultyWin(progress, win(41), 'advanced');
  assert.equal(advanced.progress.wins.advanced, 1);
  assert.equal(advanced.offer, null);
});

test('reloads, losses and uncompleted games do not create additional wins', () => {
  const game = win(1);
  const counted = recordDifficultyWin({ wins: {}, processed: [] }, game, 'beginner');
  assert.equal(recordDifficultyWin(counted.progress, game, 'pro').progress, counted.progress);
  assert.equal(recordDifficultyWin(counted.progress, { ...win(2), phase: 'trick' }, 'beginner').progress, counted.progress);
  assert.equal(recordDifficultyWin(counted.progress, { ...win(2), result: { deltas: [-10,10,-10,10] } }, 'beginner').progress, counted.progress);
});

test('legend has no further level and online wins use the own seat and room', () => {
  const progress = { wins: { legend: 19 }, processed: [] };
  const result = recordDifficultyWin(progress, win(1), 'legend', 2, 'ROOM01');
  assert.equal(result.progress.wins.legend, 20);
  assert.equal(result.offer, null);
  assert.equal(recordDifficultyWin(progress, win(1), 'legend', 1, 'ROOM01').progress, progress);
  assert.equal(recordDifficultyWin(result.progress, win(1), 'legend', 2, 'ROOM02').progress.wins.legend, 21);
});

test('every tip has a caption and valid Schafkopf cards', () => {
  const deck = new Set(createGame().initialHands.flat().map(card => card.id));
  for (const tip of SCHAFKOPF_LESSONS.filter(lesson => lesson.kind === 'tip')) {
    const example = SCHAFKOPF_LESSON_EXAMPLES[tip.id];
    assert.ok(example, tip.id);
    assert.ok(example.caption.length > 20, tip.id);
    assert.ok(example.cards.length >= 2, tip.id);
    for (const card of example.cards) assert.ok(deck.has(card.id), card.id);
  }
});

test('each variant can have its own tariff while old saved rules keep the shared price', async () => {
  const { baseGameValue } = await import('../src/games/schafkopf/tariffs.ts');
  const { scoreRound, DEFAULT_GAME_RULES } = await import('../src/games/schafkopf/schafkopf.ts');
  const rules = { ...DEFAULT_GAME_RULES, soloValue: 43, farbwenzValue: 51, geierValue: 61, farbgeierValue: 71, bettelValue: 81, laufendeAktiv: false, schneiderValue: 0, schwarzValue: 0 };
  for (const [kind, expected] of [['farbwenz',51],['geier',61],['farbgeier',71],['bettel',81],['solo',43]]) {
    const game = createGame(undefined, undefined, undefined, undefined, undefined, rules);
    game.contract = { kind, suit: 'Herz' }; game.declarer = 0; game.points = [70,20,20,10];
    assert.equal(scoreRound(game).value, expected, kind);
    assert.equal(baseGameValue({ kind }, { soloValue: 43 }), 43, `legacy ${kind}`);
  }
});
