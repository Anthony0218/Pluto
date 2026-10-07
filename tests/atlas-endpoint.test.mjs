import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {atlasEndpoint} from './helpers/atlas-endpoint.mjs';
import {raceQuestions} from '../src/games/atlas/serverRace.ts';
import {generateMatchQuestions} from '../src/games/atlas/matchQuestions.ts';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const data={countries:await read('../data/geography/countries.json'),extras:await read('../data/geography/extras.json'),history:await read('../data/geography/history.json'),topology:await read('../public/data/geography/world-110m.json'),version:await read('../data/geography/version.json')};
const version=data.version.atlasDataVersion;
test('real handler validates participants, answer generations, retries, race resume, history and BO3 lifecycle',async()=>{
 const e=await atlasEndpoint();
 try {
  const invoke=async(user,body,expected=200)=>{const r=await e.call(user,{...body,datasetVersion:version});assert.equal(r.status,expected,JSON.stringify(r.body));return r.body;};
  const start=async mode=>{const room=await invoke('a',{op:'create',mode,difficulty:'expert'});const code=room.code;await invoke('b',{op:'join',code});await invoke('a',{op:'ready',code});await invoke('b',{op:'ready',code});e.advance(3001);return invoke('a',{op:'get',code});};
  let room=await start('speed_run'),row=e.matches.at(-1),code=room.code;
  assert.equal(room.seed,undefined);assert.equal(room.run.index,0);await invoke('outsider',{op:'get',code},403);
  await invoke('a',{op:'progress',code,score:1000000,done:true},400);
  const q=raceQuestions(data,'speed_run',row.seed,'expert','Europe',row.settings.categories)[0],id=room.run.question.id;
  room=await invoke('a',{op:'race',action:'answer',code,questionId:id,answer:q.answer,requestId:'answer-1'});const score=room.run.score;
  assert.ok(room.run.feedback.correct);room=await invoke('a',{op:'race',action:'answer',code,questionId:id,answer:q.answer,requestId:'answer-1'});assert.equal(room.run.score,score);
  const restored=await invoke('a',{op:'get',code});assert.deepEqual(restored.run,room.run);
  const opponent=await invoke('b',{op:'get',code});assert.equal(opponent.run.index,0);assert.equal(opponent.run.feedback,null);
  room=await invoke('a',{op:'race',action:'next',code,questionId:id});await invoke('a',{op:'race',action:'answer',code,questionId:id,answer:q.answer},400);assert.equal(room.run.index,1);
  e.advance(90001);room=await invoke('a',{op:'get',code});assert.equal(room.status,'finished');assert.equal(room.race.a.done,true);
  room=await start('guess_country');code=room.code;const first=room.question.id;assert.equal(room.question.clues.length,1);e.advance(25001);room=await invoke('a',{op:'get',code});assert.equal(room.tipIndex,1);assert.equal(Date.parse(room.roundStartedAt),e.now());await invoke('a',{op:'submit',code,questionId:first,answer:'country:FRA'},400);
  // History Battle is a server-graded race: no answer, record or seed on the wire until the answer is in.
  room=await start('history_battle');code=room.code;row=e.matches.at(-1);const history=raceQuestions(data,'history_battle',row.seed,'expert');
  assert.equal(room.run.count,12);assert.equal(room.run.question.prompt,history[0].prompt);assert.equal(room.run.question.choices.length,4);
  assert.ok(!/explanation|answer|\d{1,2} [A-Z][a-z]+ \d{4}/.test(JSON.stringify(room.run.question)));
  await invoke('a',{op:'race',action:'answer',code,questionId:room.run.question.id,answer:'country:XXX'},400);
  const wrong=history[0].choices.find(choice=>choice.id!==history[0].answer).id;
  room=await invoke('b',{op:'race',action:'answer',code,questionId:room.run.question.id,answer:wrong});assert.equal(room.run.feedback.correct,false);assert.equal(room.run.score,0);
  room=await invoke('a',{op:'race',action:'answer',code,questionId:room.run.question.id,answer:history[0].answer});
  assert.equal(room.run.feedback.correct,true);assert.equal(room.run.score,1000);assert.match(room.run.feedback.explanation,/The World Factbook$/);assert.equal(room.scores.a,1000);assert.equal(room.scores.b,0);
  room=await start('stat_battle');row=e.matches.at(-1);row.match_kind='ranked';row.state.ranked={bans:{a:[],b:[]},order:['stat_battle','map_battle','language_guesser'],gameIndex:0,wins:{a:0,b:0},results:[]};
  // Restarting a ranked duel from countdown retains the ranked-series object.
  row.status='countdown';row.round_started_at=new Date(e.now()).toISOString();room=await invoke('a',{op:'get',code:row.room_code});assert.ok(row.state.ranked);assert.ok(room.battle);assert.equal(room.seed,undefined);
  row.status='finished';row.scores={a:5,b:2};room=await invoke('a',{op:'get',code:row.room_code});assert.equal(room.status,'intermission');assert.equal(room.series.wins.a,1);e.advance(45001);room=await invoke('a',{op:'get',code:row.room_code});assert.equal(room.status,'countdown');
  // A tied second game becomes a three-question challenge, never a seeded coin toss.
  row.status='finished';row.scores={a:1000,b:1000};room=await invoke('a',{op:'get',code:row.room_code});assert.equal(room.tiebreak.attempt,1);assert.equal(room.rounds,3);assert.equal(room.series.results.length,1);
  row.status='finished';row.scores={a:3000,b:1000};room=await invoke('a',{op:'get',code:row.room_code});assert.equal(room.status,'finished');assert.equal(room.series.wins.a,2);assert.equal(e.results.length,1);await invoke('a',{op:'get',code:row.room_code});assert.equal(e.results.length,1);
  // Every draw consumes one of the three game slots and the series can settle a genuine draw.
  row.state={ranked:{bans:{a:[],b:[]},order:['map_battle','map_fill','language_guesser'],gameIndex:2,wins:{a:0,b:0},results:[{mode:'map_battle',winnerId:null,scores:{a:0,b:0}},{mode:'map_fill',winnerId:null,scores:{a:0,b:0}}]},tie:{mode:'language_guesser',attempt:2,baseScores:{a:0,b:0}}};row.status='finished';row.scores={a:0,b:0};room=await invoke('a',{op:'get',code:row.room_code});assert.equal(room.series.results.length,3);assert.equal(room.series.results[2].winnerId,null);assert.deepEqual(room.scores,{a:0,b:0});
  // Optimistic-update collisions are revalidated, so another player's answer is not lost.
  room=await start('map_battle');row=e.matches.at(-1);code=room.code;const deck=generateMatchQuestions({entities:data.countries,extras:data.extras,datasetVersion:version,seed:row.seed,difficulty:'expert',count:10,mode:'map_battle',categories:row.settings.categories});
  e.collide(()=>{row.version++;row.submissions.push({userId:'b',round:0,answer:deck[0].answer,submittedAt:e.now(),correct:true});});
  room=await invoke('a',{op:'submit',code,questionId:room.question.id,answer:deck[0].answer,requestId:'collision'});assert.equal(row.submissions.length,2);assert.equal(room.status,'round_resolving');
 }finally{e.close();}
});
