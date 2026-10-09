import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { entitiesForScope, generateQuestions } from '../src/games/atlas/engine.ts';
import { generateMatchQuestions } from '../src/games/atlas/matchQuestions.ts';
import { buildComparables } from '../src/games/atlas/comparisons.ts';
import { entitiesInFillScope } from '../src/games/atlas/scopes.ts';
import { buildTrialCountries, formatCountryStat } from '../src/games/atlas/trials/countryStats.ts';
import { battleDeckPool, createBattle, BATTLE_CATEGORIES } from '../src/games/atlas/trials/statBattle.ts';
import { createBattleMatch } from '../src/games/atlas/trials/battleMatch.ts';
import { createBattleTable } from '../src/games/atlas/trials/battleTable.ts';
import { generateDetectiveRound } from '../src/games/atlas/trials/statDetective.ts';
import { generateRankingRound } from '../src/games/atlas/trials/statRanking.ts';
import { generateExtremeRound } from '../src/games/atlas/trials/extremeGeography.ts';
import { generateRegionRound } from '../src/games/atlas/trials/regionBuilder.ts';
import { REGIONS } from '../src/games/atlas/trials/regions.ts';
import { historyDeck, historyExplanation } from '../src/games/atlas/trials/historyBattle.ts';
import { applyCountrySupplements } from '../scripts/geography/country-supplements.mjs';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const countries = await read('../data/geography/countries.json');
const extras = await read('../data/geography/extras.json');
const history = await read('../data/geography/history.json');
const version = await read('../data/geography/version.json');
// Independent roster: 193 UN member states plus the Holy See and Palestine.
const expected = new Set(`AFG ALB DZA AND AGO ATG ARG ARM AUS AUT AZE BHS BHR BGD BRB BLR BEL BLZ BEN BTN BOL BIH BWA BRA BRN BGR BFA BDI CPV KHM CMR CAN CAF TCD CHL CHN COL COM COG COD CRI CIV HRV CUB CYP CZE PRK DNK DJI DMA DOM ECU EGY SLV GNQ ERI EST SWZ ETH FJI FIN FRA GAB GMB GEO DEU GHA GRC GRD GTM GIN GNB GUY HTI HND HUN ISL IND IDN IRN IRQ IRL ISR ITA JAM JPN JOR KAZ KEN KIR KWT KGZ LAO LVA LBN LSO LBR LBY LIE LTU LUX MDG MWI MYS MDV MLI MLT MHL MRT MUS MEX FSM MDA MCO MNG MNE MAR MOZ MMR NAM NRU NPL NLD NZL NIC NER NGA MKD NOR OMN PAK PLW PAN PNG PRY PER PHL POL PRT QAT KOR ROU RUS RWA KNA LCA VCT WSM SMR STP SAU SEN SRB SYC SLE SGP SVK SVN SLB SOM ZAF SSD ESP LKA SDN SUR SWE CHE SYR TJK THA TLS TGO TON TTO TUN TUR TKM TUV UGA UKR ARE GBR TZA USA URY UZB VUT VEN VNM YEM ZMB ZWE PSE VAT`.split(' '));
const full = entitiesForScope(countries, 'un195');
const pool = buildTrialCountries(countries, extras);
const expectedIds = new Set([...expected].map(iso => `country:${iso}`));
const assertAllCountries = (ids, label) => assert.deepEqual(new Set(ids), expectedIds, label);

test('both shipped snapshots include the exact 195-country roster and all required card/map data', async () => {
  assert.equal(expected.size, 195);
  assert.deepEqual(new Set(full.map(country => country.iso3)), expected);
  assert.equal(full.length, 195, 'no duplicate country records');
  assertAllCountries(pool.map(country => country.id), 'Trials');
  assertAllCountries(Object.keys(history.countries), 'History Battle');
  for (const name of ['countries', 'extras', 'history', 'version']) {
    assert.deepEqual(await read(`../public/data/geography/${name}.json`), await read(`../data/geography/${name}.json`), name);
  }
  for (const country of full) {
    assert.equal(country.dataVersion, version.atlasDataVersion);
    for (const stat of ['population', 'areaKm2']) {
      assert.ok(country[stat]?.value > 0 && country[stat].source && country[stat].year, `${country.iso3}: ${stat}`);
    }
    for (const field of ['centroid', 'capitalCoordinates']) {
      assert.ok(country[field]?.length === 2 && country[field].every(Number.isFinite), `${country.iso3}: ${field}`);
    }
    await access(new URL(`../public${country.flagAsset}`, import.meta.url));
    assert.ok(extras.highestPoints[country.id]?.elevationM >= 0, country.iso3);
    assert.ok(history.countries[country.id].events.length || history.countries[country.id].formerNames.length, country.iso3);
  }
  assert.equal(extras.atlasDataVersion, version.atlasDataVersion);
  assert.equal(history.atlasDataVersion, version.atlasDataVersion);
});

test('Stat Battle deals all 195 countries in solo, duel and table decks with no blank battle stats', () => {
  assertAllCountries(battleDeckPool(pool).map(country => country.id));
  for (const country of pool) for (const category of BATTLE_CATEGORIES) {
    assert.ok(Number.isFinite(country.stats[category.statId]), `${country.iso3}: ${category.id}`);
  }
  for (const level of ['easy', 'normal', 'hard']) {
    const battle = createBattle(pool, 'all-countries', level);
    assertAllCountries([...battle.deck, ...battle.player, ...battle.opponent]);
  }
  const { battle } = createBattleMatch(pool, 'duel');
  assertAllCountries([...battle.deck, ...battle.player, ...battle.opponent]);
  for (const seats of [3, 4]) {
    const table = createBattleTable(pool, 'table', seats);
    assertAllCountries([...table.deck, ...table.hands.flat()]);
  }
  assert.equal(formatCountryStat('areaKm2', pool.find(country => country.iso3 === 'VAT').stats.areaKm2), '0.44 km²');
});

test('map, speed, flag, guess and higher/lower modes can use every country in the full pool', () => {
  const options = { entities: countries, extras, datasetVersion: version.atlasDataVersion, seed: 'coverage', difficulty: 'expert', count: 195 };
  for (const mode of ['map_battle', 'closest_wins', 'guess_country']) {
    assertAllCountries(generateMatchQuestions({ ...options, mode, categories: ['locations'] }).map(question => question.entityId), mode);
  }
  const seenFlags = new Set();
  for (let seed = 0; seed < 20; seed++) for (const question of generateMatchQuestions({ ...options, mode: 'flag_battle', seed: `coverage:${seed}` })) seenFlags.add(question.entityId);
  assertAllCountries(seenFlags, 'Flag Battle');
  for (const category of ['countries', 'capitals', 'flags', 'continents', 'languages', 'currency']) {
    assertAllCountries(generateQuestions({ ...options, categories: [category], interaction: 'choice' }).map(question => question.entityId), `Speed Run: ${category}`);
  }
  assertAllCountries(entitiesInFillScope(countries, 'World').map(country => country.id), 'Map Fill');
  assertAllCountries(buildComparables(countries, extras, 'expert').filter(item => item.kind === 'country').map(item => item.id), 'Higher or Lower');
});

test('every country can appear in generated stat, history and region rounds', () => {
  assert.deepEqual(new Set(REGIONS.flatMap(region => region.members)), expected, 'every country has a correct Region Builder membership');
  const seen = Object.fromEntries(['detective', 'ranking', 'extreme', 'history', 'region'].map(mode => [mode, new Set()]));
  for (let seed = 0; seed < 2000; seed++) {
    const key = `coverage:${seed}`;
    seen.detective.add(generateDetectiveRound(pool, key, 0, 'expert').answerId);
    for (const id of generateRankingRound(pool, key, 0, 'expert').countryIds) seen.ranking.add(id);
    for (const id of generateExtremeRound(pool, key, 0, 'expert').countryIds) seen.extreme.add(id);
    for (const round of historyDeck(history, pool, key, 'expert')) seen.history.add(round.countryId);
    for (const id of generateRegionRound(pool, key, 7).targetIds) seen.region.add(id);
  }
  for (const [mode, ids] of Object.entries(seen)) assertAllCountries(ids, mode);
});

test('synchronization restores sourced gaps without replacing newer observations', () => {
  const vatican = structuredClone(full.find(country => country.iso3 === 'VAT'));
  vatican.population = null; vatican.areaKm2 = null;
  const israel = structuredClone(full.find(country => country.iso3 === 'ISR'));
  const palestine = structuredClone(full.find(country => country.iso3 === 'PSE'));
  for (const country of [israel, palestine]) { country.centroid = null; country.capitalCoordinates = null; }
  applyCountrySupplements([vatican, israel, palestine], 'synced');
  assert.equal(vatican.population.value, 882); assert.equal(vatican.population.year, 2024);
  assert.equal(vatican.areaKm2.value, 0.44);
  assert.deepEqual(israel.capitalCoordinates, full.find(country => country.iso3 === 'ISR').capitalCoordinates);
  assert.deepEqual(palestine.capitalCoordinates, full.find(country => country.iso3 === 'PSE').capitalCoordinates);
  vatican.population = { value: 900, year: 2027, source: 'New observation', sourceUpdatedAt: 'new' };
  applyCountrySupplements([vatican], 'synced');
  assert.equal(vatican.population.value, 900);
  const round = historyDeck(history, [pool.find(country => country.iso3 === 'PSE')], 'palestine', 'expert', 1)[0];
  assert.equal(round.answerId, '2012');
  assert.match(historyExplanation(round, id => id), /United Nations/);
  assert.doesNotMatch(historyExplanation(round, id => id), /World Factbook/);
});
