import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, breakdown, byHour, dominantSubject, eachDay, hourSubjects, indexRows, levelOf, rangeOf, ranked, shiftAnchor, startOfWeek, subjectIndex, subjectOf, isShown, summarize, weekday, yearsOf } from '../src/components/App/dashboard/activity/activityModel.ts';

test('weeks start on Monday and ranges cover whole calendar units', () => {
  assert.equal(weekday('2026-10-08'), 3); // Thursday
  assert.equal(startOfWeek('2026-10-08'), '2026-10-05');
  assert.equal(startOfWeek('2026-10-11'), '2026-10-05'); // Sunday belongs to the week before
  assert.deepEqual(rangeOf('week', '2026-10-08'), { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(rangeOf('month', '2026-02-10'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(rangeOf('month', '2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(rangeOf('year', '2026-10-08'), { from: '2026-01-01', to: '2026-12-31' });
  assert.deepEqual(rangeOf('day', '2026-10-08'), { from: '2026-10-08', to: '2026-10-08' });
  assert.equal(eachDay('2026-12-30', '2027-01-02').length, 4);
});

test('stepping never skips or repeats a day, across month, year and daylight-saving changes', () => {
  assert.equal(shiftAnchor('month', '2026-01-31', 1), '2026-02-01');
  assert.equal(shiftAnchor('month', '2026-01-15', -1), '2025-12-01');
  assert.equal(shiftAnchor('year', '2028-02-29', 1), '2029-02-28');
  assert.equal(shiftAnchor('week', '2026-12-30', 1), '2027-01-06');
  assert.equal(addDays('2026-03-28', 1), '2026-03-29'); // European clocks go forward on this day
  assert.equal(addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(addDays('2026-10-25', 1), '2026-10-26'); // and back on this one
  assert.deepEqual(yearsOf('2026-12-28', '2027-01-03'), [2026, 2027]);
  assert.deepEqual(yearsOf('2026-01-01', '2026-12-31'), [2026]);
});

const rows = [
  { day: '2026-10-07', kind: 'game', label: 'chess', n: 3 },
  { day: '2026-10-08', kind: 'game', label: 'atlas', n: 2 },
  { day: '2026-10-08', kind: 'puzzle', label: 'chess', n: 4 },
  { day: '2026-10-08', kind: 'explore', label: '/games/go', n: 1 },
  { day: '2026-10-08', kind: 'explore', label: '/games/chess/variants', n: 1 },
  { day: '2026-10-09', kind: 'explore', label: '/learn/math', n: 1 },
  { day: '2026-10-09', kind: 'bogus', label: 'x', n: 5 },
  { day: '2026-10-09', kind: 'game', label: 'chess', n: 0 },
];

test('rows are totalled per day, ignoring unknown kinds and empty counts', () => {
  const index = indexRows(rows);
  assert.deepEqual(index.get('2026-10-08'), { game: 2, puzzle: 4, explore: 2, total: 8 });
  assert.deepEqual(index.get('2026-10-09'), { game: 0, puzzle: 0, explore: 1, total: 1 }); // the lesson visit counts; unknown kinds and zero counts do not
  assert.equal(index.get('2026-10-10'), undefined);
});

test('a summary counts active days, the best day and only the days that have happened', () => {
  const summary = summarize(indexRows(rows), '2026-10-05', '2026-10-11', '2026-10-09');
  assert.equal(summary.total, 12);
  assert.equal(summary.activeDays, 3);
  assert.deepEqual(summary.best, { day: '2026-10-08', total: 8 });
  assert.equal(summary.elapsedDays, 5); // Mon–Fri: the weekend has not happened yet
  assert.deepEqual(summary.byKind, { game: 5, puzzle: 4, explore: 3 });
  const quiet = summarize(new Map(), '2026-10-01', '2026-10-31', '2026-10-08');
  assert.deepEqual([quiet.total, quiet.activeDays, quiet.best, quiet.elapsedDays], [0, 0, null, 8]);
});

test('intensity levels are stable', () => {
  assert.deepEqual([0, 1, 2, 3, 5, 6, 9, 10, 99].map(levelOf), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
});

test('every kind of label maps to the game or subject it is about', () => {
  assert.equal(subjectOf('atlas'), 'atlas-arena');
  assert.equal(subjectOf('chess'), 'chess');
  assert.equal(subjectOf('/games/chess/variants'), 'chess');
  assert.equal(subjectOf('/games/atlas-arena'), 'atlas-arena');
  assert.equal(subjectOf('/learn/math/fractions'), 'learning');
  assert.equal(subjectOf('/'), 'other');
  assert.equal(subjectOf('/games/schafkopf?rules=open#rules'), 'schafkopf');
  assert.equal(subjectOf('/games/pluto-party'), 'pluto-party');
  assert.equal(isShown('/games/shogi'), false);
  assert.equal(isShown('shogi'), false);
  assert.equal(isShown('/games/pluto-party'), true);
});

test('the breakdown ranks games and subjects inside the range', () => {
  const top = breakdown(rows, '2026-10-07', '2026-10-09');
  assert.deepEqual(top.map(item => [item.subject, item.total]), [['chess', 8], ['atlas-arena', 2], ['go', 1], ['learning', 1]]);
  assert.deepEqual(top[0].byKind, { game: 3, puzzle: 4, explore: 1 });
  assert.deepEqual(breakdown(rows, '2026-10-09', '2026-10-09').map(item => item.subject), ['learning']);
  assert.equal(breakdown(rows, '2026-10-07', '2026-10-09', 2).length, 2);
});

test('events are bucketed by local hour; untimed ones are kept apart', () => {
  const noon = new Date(2026, 9, 8, 12, 30).toISOString();
  const evening = new Date(2026, 9, 8, 20, 5).toISOString();
  const { hours, untimed } = byHour([
    { at: noon, kind: 'game', label: 'chess', detail: 'win' },
    { at: evening, kind: 'puzzle', label: 'chess', detail: '0' },
    { at: evening, kind: 'game', label: 'go', detail: 'loss' },
    { at: null, kind: 'explore', label: '/learn/math', detail: null },
  ]);
  assert.equal(hours.length, 24);
  assert.equal(hours[12].game, 1);
  assert.deepEqual([hours[20].game, hours[20].puzzle, hours[20].total], [1, 1, 2]);
  assert.equal(untimed.length, 1); // the lesson visit has no time of day
});

test('games are counted per day and per hour, most played first', () => {
  const days = subjectIndex(rows);
  assert.deepEqual(days.get('2026-10-08'), { 'atlas-arena': 2, chess: 5, go: 1 });
  assert.deepEqual(ranked(days.get('2026-10-08')).map(([name]) => name), ['chess', 'atlas-arena', 'go']);
  assert.deepEqual(days.get('2026-10-09'), { learning: 1 });
  assert.equal(dominantSubject(days.get('2026-10-08')), 'chess');
  assert.equal(dominantSubject(days.get('2026-10-10')), null);
  assert.equal(dominantSubject({ b: 2, a: 2 }), 'a'); // a tie goes to the name that sorts first
  const noon = new Date(2026, 9, 8, 12, 30).toISOString();
  const hours = hourSubjects([{ at: noon, kind: 'game', label: 'chess', detail: 'win' }, { at: noon, kind: 'puzzle', label: 'chess', detail: '0' }, { at: noon, kind: 'game', label: 'atlas', detail: 'loss' }, { at: noon, kind: 'explore', label: '/learn/math', detail: null }]);
  assert.deepEqual(hours[12], { chess: 2, 'atlas-arena': 1, learning: 1 });
  assert.deepEqual(hours[3], {});
});
