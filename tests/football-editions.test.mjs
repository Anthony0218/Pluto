import test from 'node:test';
import assert from 'node:assert/strict';
import { championshipEditions, chronologicalGoals, footballTournaments, previousChampionship } from '../src/data/footballTournaments.ts';
import { mensWorldCups, womensWorldCups } from '../src/data/footballHonours.ts';
import { getPathLessons, learningPaths } from '../src/data/learningCatalog.ts';
import { mathTopicExample } from '../src/data/mathTopicPreview.ts';

const worldCup = footballTournaments.find(t => t.id === 'world-men');
test('World Cup history includes every winner and runner-up, independently of detailed goals', () => {
  const entries = championshipEditions(worldCup);
  assert.equal(entries.length, worldCup.winners.reduce((sum, winner) => sum + winner.years.length, 0));
  assert.equal(new Set(entries.map(entry => entry.year)).size, entries.length);
  assert.equal(entries.find(entry => entry.year === 2022).winner, 'Argentina');
  assert.equal(entries.find(entry => entry.year === 2022).runnerUp, 'France');
  assert.equal(entries.find(entry => entry.year === 2014).winner, 'Germany');
  assert.equal(entries.find(entry => entry.year === 2014).runnerUp, 'Argentina');
  assert.equal(entries.find(entry => entry.year === 2026).runnerUp, 'Argentina');
  assert.equal(entries.find(entry => entry.year === 1930).runnerUp, 'Argentina');
  assert.equal(entries.find(entry => entry.year === 1950).runnerUp, 'Brazil');
  const women = championshipEditions(footballTournaments.find(t => t.id === 'world-women'));
  assert.equal(women.find(entry => entry.year === 1991).runnerUp, 'Norway');
  assert.equal(women.find(entry => entry.year === 1999).runnerUp, 'China');
  assert.equal(women.find(entry => entry.year === 2011).runnerUp, 'United States');
  assert.equal(women.find(entry => entry.year === 2023).runnerUp, 'England');
  assert.ok([...entries, ...women].every(entry => entry.winner && entry.runnerUp));
  assert.ok(entries.filter(entry => entry.winner === 'Argentina').length > 1);
});
test('all six tournament histories start at their first edition and include every completed season', () => {
  const expected = {
    'world-men': [1930, 2026, 23], 'world-women': [1991, 2023, 9],
    'ucl-men': [1956, 2026, 71], 'ucl-women': [2002, 2026, 25],
    'europa-men': [1972, 2026, 55], 'conference-men': [2022, 2026, 5],
  };
  for (const tournament of footballTournaments) {
    const entries = championshipEditions(tournament), [first, last, count] = expected[tournament.id];
    assert.equal(entries.length, count, tournament.id);
    assert.equal(entries.at(-1).year, first, tournament.id);
    assert.equal(entries[0].year, last, tournament.id);
    assert.equal(new Set(entries.map(entry => entry.year)).size, count);
    assert.ok(entries.every(entry => entry.winner && entry.runnerUp && entry.winner !== entry.runnerUp && entry.source?.startsWith('https://')));
    if (!tournament.national) assert.deepEqual(entries.map(entry => entry.year), Array.from({ length: count }, (_, i) => last - i));
  }
  assert.equal(championshipEditions(worldCup).some(e => [1942, 1946].includes(e.year)), false);
  for (const [id, honours] of [['world-men', mensWorldCups], ['world-women', womensWorldCups]]) {
    const entries = championshipEditions(footballTournaments.find(t => t.id === id));
    for (const nation of honours) for (const year of nation.years) assert.equal(entries.find(e => e.year === year)?.winner, nation.team);
  }
});
test('edition placements survive missing finals, tied aggregate scores and incomplete match data', () => {
  const tournament = {
    id: 'example', name: 'Example', national: false, coverage: 'Example', source: 'https://example.com',
    winners: [{ team: 'A', years: [1980, 1979] }],
    editions: [{ year: 1980, winner: 'A', runnerUp: 'B', source: 'https://example.com/1980' }, { year: 1979, winner: 'A', runnerUp: 'C', source: 'https://example.com/1979' }],
    finals: [{ year: 1980, teams: ['B', 'A'], score: [3, 3], format: 'aggregate', source: 'https://example.com/1980' }],
  };
  const entries = championshipEditions(tournament);
  assert.equal(entries[0].winner, 'A');
  assert.equal(entries[0].runnerUp, 'B');
  assert.equal(entries[1].runnerUp, 'C');
  assert.equal(entries[1].final, undefined);
  assert.equal(previousChampionship(tournament, 1980).winner, 'A');
});
test('historical finals keep shootouts separate and distinguish aggregate, replay and final-round matches', () => {
  const final = (id, year) => footballTournaments.find(t => t.id === id).finals.find(f => f.year === year);
  for (const [year, score, penalties] of [[1984, [1, 1], [4, 2]], [1986, [0, 0], [2, 0]], [1988, [0, 0], [6, 5]], [1991, [0, 0], [5, 3]], [1996, [1, 1], [4, 2]]]) {
    assert.deepEqual(final('ucl-men', year).score, score);
    assert.deepEqual(final('ucl-men', year).penalties, penalties);
  }
  assert.deepEqual(final('ucl-men', 1974).score, [4, 0]);
  assert.equal(final('ucl-men', 1974).format, 'replay');
  assert.equal(final('ucl-women', 2003).format, 'aggregate');
  assert.equal(final('world-men', 1950).format, 'final-round');
  assert.deepEqual(final('world-women', 1999).penalties, [5, 4]);
  assert.equal(championshipEditions(footballTournaments.find(t => t.id === 'europa-men')).find(e => e.year === 2010).winner, 'Atlético Madrid');
});
test('previous champion uses available editions for four-year and annual competitions', () => {
  assert.equal(previousChampionship(worldCup, 2022).winner, 'France');
  assert.equal(previousChampionship(worldCup, 2022).year, 2018);
  assert.equal(previousChampionship(worldCup, 1930), undefined);
  const championsLeague = footballTournaments.find(t => t.id === 'ucl-men');
  assert.equal(previousChampionship(championsLeague, 2025).year, 2024);
  assert.equal(previousChampionship(championsLeague, 2025).winner, 'Real Madrid');
  assert.equal(championshipEditions(championsLeague).find(entry => entry.year === 2024).runnerUp, 'Borussia Dortmund');
});
test('competition histories are isolated and tied to their own final years', () => {
  for (const competition of footballTournaments) {
    for (const edition of championshipEditions(competition)) {
      if (edition.final) {
        assert.equal(edition.final.year, edition.year);
        assert.ok(competition.finals.includes(edition.final));
        assert.ok(edition.final.teams.includes(edition.runnerUp));
        assert.notEqual(edition.winner, edition.runnerUp);
        const score = edition.final.penalties ?? edition.final.score;
        if (score[0] !== score[1]) assert.equal(edition.final.teams[score[0] > score[1] ? 0 : 1], edition.winner);
      }
    }
  }
});
test('timeline sorts stoppage and extra time without mutating source, preserving missing data and own goals', () => {
  const goals = [{team:'A',minute:'108',player:'Later'}, {team:'B',minute:'90+5',kind:'penalty'}, {team:'A',minute:'45+2'}, {team:'B',minute:'46',kind:'own-goal'}, {team:'A'}, {team:'B',minute:'91'}, {team:'A',minute:'90+1'}];
  assert.deepEqual(chronologicalGoals(goals).map(goal => goal.minute), ['45+2','46','90+1','90+5','91','108',undefined]);
  assert.equal(goals[0].minute, '108');
  assert.equal(chronologicalGoals(goals)[1].kind, 'own-goal');
  const final = worldCup.finals.find(final => final.year === 2022);
  assert.equal(chronologicalGoals(final.goals).length, 6, 'shootout score stays separate');
});
test('every published math topic previews its existing worked example', () => {
  for (const path of learningPaths.filter(path => path.subjectId === 'math')) {
    for (const lesson of getPathLessons('math', path.id)) {
      const example = mathTopicExample(lesson.id);
      assert.ok(example?.problem && example.steps.length && example.verification, lesson.id);
    }
  }
  assert.equal(mathTopicExample('vectors').notation, 'u = (3, 4); |u| = ?');
  assert.equal(mathTopicExample('not-a-lesson'), undefined);
});
