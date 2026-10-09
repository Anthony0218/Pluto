import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ARENA_MODES, ONLINE_ARENA_MODES, modeById, modeForTrial } from '../src/games/atlas/modeCatalog.ts';
import { rankedModes, sanitizeBans } from '../src/games/atlas/ranked.ts';
import { ATLAS_MULTIPLAYER_MODES, createAuthoritativeSubmission, resolveRoundScores } from '../src/games/atlas/multiplayer.ts';
import { generateMatchQuestions } from '../src/games/atlas/matchQuestions.ts';
import { generateFlagQuestions } from '../src/games/atlas/flags.ts';
import { normalScore } from '../src/games/atlas/rules.ts';
import { extremePoints, answerExtreme, createExtremeRun } from '../src/games/atlas/trials/extremeGeography.ts';
import { buildTrialCountries } from '../src/games/atlas/trials/countryStats.ts';
import { atlasEndpoint } from './helpers/atlas-endpoint.mjs';
const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const countries = await read('../data/geography/countries.json'), extras = await read('../data/geography/extras.json');
const version = (await read('../data/geography/version.json')).atlasDataVersion;
const base = { entities: countries, extras, datasetVersion: version, difficulty: 'intermediate', count: 12, seed: 'merged-map' };

test('consolidated modes and local-only games are consistent across online, ranked and legacy links', () => {
  assert.ok(!ARENA_MODES.some(mode => ['speed-run','closest-wins','guess-country-mini'].includes(mode.id)));
  assert.deepEqual(rankedModes(), ONLINE_ARENA_MODES);
  assert.deepEqual(new Set(ATLAS_MULTIPLAYER_MODES), new Set(ONLINE_ARENA_MODES.map(mode => mode.online)));
  for (const mode of ['speed_run','closest_wins','country_guesser','map_fill','region_builder']) assert.ok(!ATLAS_MULTIPLAYER_MODES.includes(mode));
  assert.deepEqual(sanitizeBans(['map_fill','region_builder','speed_run']), []);
  assert.equal(modeById('closest-wins').id, 'map-battle');
  assert.equal(modeById('guess-country-mini').id, 'guess-country');
  assert.equal(modeForTrial('country-guesser').id, 'guess-country');
  assert.equal(modeById('speed-run'), undefined);
});

test('Map Battle mixes confirmed country selections and authoritative capital/country pins', () => {
  for (const categories of [['locations'], ['capitals'], ['flags'], ['countries','capitals']]) {
    const deck = generateMatchQuestions({...base,mode:'map_battle',categories});
    assert.equal(deck.length, 12);
    for (const [index, q] of deck.entries()) {
      assert.equal(q.interaction, index % 2 ? 'closest_click' : 'map_click');
      const submission = createAuthoritativeSubmission({userId:'a',round:index,mode:'map_battle',question:q,answer:q.answer,submittedAt:100});
      assert.equal(submission.correct, true);
      if (q.interaction === 'closest_click') {
        assert.equal(submission.distanceKm, 0);
        if (q.targetRadiusKm) { assert.equal(q.targetGeometryId,null); assert.equal(q.targetRadiusKm,20); }
        assert.throws(() => createAuthoritativeSubmission({userId:'a',round:index,mode:'map_battle',question:q,answer:q.entityId,submittedAt:100}),/coordinate/);
      }
    }
  }
});

test('casual speed cannot change awards or break ties; Ranked retains its bounded bonus', () => {
  for (const remaining of [1,1000,19999,20000]) assert.equal(normalScore(true,remaining,20000),1000);
  assert.equal(normalScore(false,20000,20000),0);
  assert.equal(normalScore(true,20000,20000,true),1050);
  const submissions = [{userId:'a',correct:true,submittedAt:1},{userId:'b',correct:true,submittedAt:19000}];
  const options = {submissions,playerIds:['a','b'],roundStartedAt:0,roundDurationMs:20000,currentScores:{a:0,b:0}};
  const casual = resolveRoundScores(options);
  assert.deepEqual(casual,{scores:{a:1000,b:1000},winnerId:null});
  const ranked = resolveRoundScores({...options,ranked:true});
  assert.ok(ranked.scores.a > ranked.scores.b);
  assert.equal(ranked.winnerId,'a');
  assert.equal(extremePoints(1,false),extremePoints(9999,false));
  assert.equal(extremePoints(10000,false),0);
  const run = createExtremeRun(buildTrialCountries(countries,extras),'late-answer','intermediate');
  assert.equal(answerExtreme(run,run.round.answerId,10000).score,0);
});

test('Flag Battle never reuses a country target during the next ten rounds, including outline fallback', () => {
  for (const difficulty of ['beginner','intermediate','expert']) for (let index = 0; index < 80; index++) {
    const deck = generateFlagQuestions({...base,difficulty,seed:`flag-variety:${index}`,count:100});
    for (let round = 0; round < deck.length; round++) {
      assert.ok(!deck.slice(Math.max(0,round-10),round).some(q => q.entityId === deck[round].entityId),`${difficulty}, seed ${index}, round ${round}`);
      assert.equal(deck[round].choices.filter(choice => choice.id === deck[round].answer).length,1);
    }
  }
});

test('server random series start with the roulette mode for every format and exclude removed modes', async () => {
  const endpoint = await atlasEndpoint();
  try {
    for (const bestOf of [1,3,5]) for (const mode of ATLAS_MULTIPLAYER_MODES) {
      const result = await endpoint.call('a',{op:'create',mode,randomBestOf:bestOf,datasetVersion:version});
      assert.equal(result.status,200,JSON.stringify(result.body));
      assert.equal(result.body.mode,mode);
      assert.equal(result.body.series.order[0],mode);
      assert.equal(result.body.series.order.length,bestOf);
      assert.ok(result.body.series.order.every(item => ATLAS_MULTIPLAYER_MODES.includes(item)));
    }
    for (const mode of ['speed_run','map_fill','region_builder','country_guesser','closest_wins']) {
      assert.equal((await endpoint.call('a',{op:'create',mode,datasetVersion:version})).status,400);
    }
  } finally { endpoint.close(); }
});

test('server rejects country and pin answers at the deadline without awarding points', async () => {
  const e = await atlasEndpoint();
  try {
    const invoke = async (user,body) => e.call(user,{...body,datasetVersion:version});
    let result = await invoke('a',{op:'create',mode:'map_battle'}), code=result.body.code;
    await invoke('b',{op:'join',code}); await invoke('a',{op:'ready',code}); await invoke('b',{op:'ready',code});
    e.advance(3000);
    result = await invoke('a',{op:'get',code});
    const row=e.matches.at(-1), deck=generateMatchQuestions({...base,count:10,seed:row.seed,mode:'map_battle',categories:row.settings.categories});
    for (const round of [0,1]) {
      if (round) { e.advance(3200); result=await invoke('a',{op:'get',code}); e.advance(1400); result=await invoke('a',{op:'get',code}); }
      assert.equal(result.body.question.interaction,round ? 'closest_click' : 'map_click');
      e.setTime(Date.parse(result.body.roundEndsAt));
      const late=await invoke('a',{op:'submit',code,questionId:result.body.question.id,answer:deck[round].answer});
      assert.equal(late.status,400);
      assert.deepEqual(row.scores,{a:0,b:0});
      result=await invoke('b',{op:'get',code});
      assert.deepEqual(result.body.scores,{a:0,b:0});
    }
  } finally { e.close(); }
});

test('actual casual and Ranked handlers apply their own scoring rules to equally correct answers', async () => {
  const e = await atlasEndpoint();
  try {
    const invoke = async (user,body) => {const r = await e.call(user,{...body,datasetVersion:version});assert.equal(r.status,200,JSON.stringify(r.body));return r.body;};
    for (const ranked of [false,true]) {
      let room=await invoke('a',{op:'create',mode:'flag_battle'}),code=room.code,row=e.matches.at(-1);
      await invoke('b',{op:'join',code});
      if (ranked) row.match_kind='ranked';
      await invoke('a',{op:'ready',code});await invoke('b',{op:'ready',code});e.advance(3000);room=await invoke('a',{op:'get',code});
      const q=generateFlagQuestions({...base,seed:row.seed,count:10})[0];
      e.advance(50);await invoke('a',{op:'submit',code,questionId:room.question.id,answer:q.answer});
      e.advance(19000);room=await invoke('b',{op:'submit',code,questionId:room.question.id,answer:q.answer});
      if (ranked) {assert.ok(room.scores.a>room.scores.b);assert.ok(room.scores.a<=1050);}
      else assert.deepEqual(room.scores,{a:1000,b:1000});
    }
  } finally {e.close();}
});

test('personal bests compare the revised scoring rules without discarding earlier records', async () => {
  const { bestKey } = await import('../src/games/atlas/arenaStorage.ts');
  assert.equal(bestKey('flag-battle','expert'),'flag-battle:expert:knowledge-v2');
  assert.equal(bestKey('map-battle','beginner'),'map-battle:beginner:knowledge-v2');
  assert.equal(bestKey('stat-ranking','expert'),'stat-ranking:expert');
  assert.equal(bestKey('map-fill','expert','Europe'),'map-fill:expert:Europe');
});
