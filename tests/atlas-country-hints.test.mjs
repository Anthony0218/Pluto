import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seededRandom } from '../src/games/atlas/random.ts';
import { countryHintCandidates, namesCountry } from '../src/games/atlas/countryHints.ts';
import { countryClues, generateGuessCountryQuestions } from '../src/games/atlas/guessCountry.ts';
import { buildTrialCountries } from '../src/games/atlas/trials/countryStats.ts';
import { guesserClues, generateGuesserRound } from '../src/games/atlas/trials/countryGuesser.ts';
const countries = JSON.parse(readFileSync(new URL('../data/geography/countries.json', import.meta.url)));
const extras = JSON.parse(readFileSync(new URL('../data/geography/extras.json', import.meta.url)));
const pool = buildTrialCountries(countries, extras);

test('both modes vary the first four subjects and orders while keeping the fifth reveal fixed', () => {
  const entity = countries.find(country => country.iso3 === 'KEN'), trial = pool.find(country => country.iso3 === 'KEN');
  for (const make of [random => countryClues(entity, extras, random), random => guesserClues(trial, random)]) {
    const runs = Array.from({ length: 80 }, (_, index) => make(seededRandom(`clue-variety-${index}`)));
    const firstKinds = new Set(runs.map(clues => clues[0].kind));
    assert.ok(firstKinds.size >= 7, [...firstKinds].join(', '));
    const subjects = new Set(runs.flatMap(clues => clues.slice(0, 4).map(clue => clue.kind)));
    for (const kind of ['region', 'population', 'geography', 'summit', 'language', 'phrase', 'density', 'location', 'name', 'capital']) assert.ok(subjects.has(kind), kind);
    assert.ok(new Set(runs.map(clues => clues.slice(0, 4).map(clue => clue.kind).join(','))).size > 50);
    for (const clues of runs) {
      assert.equal(clues.length, 5);
      assert.deepEqual(clues[4], runs[0][4]);
      assert.equal(new Set(clues.slice(0, 4).map(clue => clue.kind)).size, 4);
      assert.ok(clues.slice(0, 4).every(clue => !clue.flagAsset));
    }
  }
});

test('seeded rounds reproduce exactly for all players and no sampled early clue names its answer', () => {
  const options = { entities: countries, extras, datasetVersion: 'test', seed: 'shared', difficulty: 'expert', count: 195 };
  assert.deepEqual(generateGuessCountryQuestions(options), generateGuessCountryQuestions(options));
  for (const country of pool) {
    const entity = countries.find(item => item.id === country.id);
    const facts = { name: country.name, otherNames: country.otherNames };
    for (let index = 0; index < 10; index++) {
      const mini = guesserClues(country, seededRandom(`${country.id}:${index}`));
      const classic = countryClues(entity, extras, seededRandom(`${country.id}:${index}`));
      for (const clues of [mini, classic]) {
        assert.equal(clues.length, 5, country.name);
        assert.ok(clues.slice(0, 4).every(clue => !namesCountry(clue.text, facts)), country.name);
      }
      assert.equal(mini[4].kind, 'final');
      assert.equal(classic[4].flagAsset, country.flag);
    }
  }
  for (let index = 0; index < 30; index++) assert.deepEqual(generateGuesserRound(pool, 'shared', index), generateGuesserRound(pool, 'shared', index));
});

test('new facts use available data and do not invent values for missing facts', () => {
  const facts = { name: 'Example', continent: 'Europe', subregion: 'Western Europe', neighborCount: 2, capital: 'Paris', officialLanguages: ['French'], population: 1_000_000, areaKm2: 10_000, currencies: [{ name: 'Euro' }], highestPointM: 1234, summitName: 'Mount Example' };
  const clues = countryHintCandidates(facts);
  assert.match(clues.find(clue => clue.kind === 'currency').text, /Euro/);
  assert.match(clues.find(clue => clue.kind === 'density').text, /between 100 and 250/);
  assert.match(clues.find(clue => clue.kind === 'summit').text, /1,234/);
  assert.doesNotMatch(clues.find(clue => clue.kind === 'summit').text, /Mount Example/);
  const missing = countryHintCandidates({ ...facts, population: undefined, areaKm2: undefined, highestPointM: undefined });
  for (const kind of ['region', 'population', 'density', 'summit', 'temperature', 'location']) assert.ok(!missing.some(clue => clue.kind === kind), kind);
});
