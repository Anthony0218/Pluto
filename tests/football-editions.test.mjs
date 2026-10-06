import test from 'node:test';
import assert from 'node:assert/strict';
import { championshipEditions, chronologicalGoals, footballTournaments, previousChampionship } from '../src/data/footballTournaments.ts';
import { getPathLessons, learningPaths } from '../src/data/learningCatalog.ts';
import { mathTopicExample } from '../src/data/mathTopicPreview.ts';

const worldCup = footballTournaments.find(t => t.id === 'world-men');
test('history preserves every recorded edition, repeated wins and unavailable final details', () => {
  const entries = championshipEditions(worldCup);
  assert.equal(entries.length, worldCup.winners.reduce((sum, winner) => sum + winner.years.length, 0));
  assert.equal(new Set(entries.map(entry => entry.year)).size, entries.length);
  assert.equal(entries.find(entry => entry.year === 2022).winner, 'Argentina');
  assert.equal(entries.find(entry => entry.year === 2022).runnerUp, 'France');
  assert.equal(entries.find(entry => entry.year === 2014).winner, 'Germany');
  assert.equal(entries.find(entry => entry.year === 2014).runnerUp, undefined);
  assert.ok(entries.filter(entry => entry.winner === 'Argentina').length > 1);
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
