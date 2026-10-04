import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateQuestions,validateAnswer,normalizedContinent} from '../src/games/atlas/engine.ts';
import {toPublicQuestion} from '../src/games/atlas/publicQuestion.ts';
import {generateMatchQuestions} from '../src/games/atlas/matchQuestions.ts';
import {generateAdvancedQuestions,generateDensityQuestion} from '../src/games/atlas/advancedQuestions.ts';
import {raceQuestions,createRaceRun,raceView,applyRaceAction} from '../src/games/atlas/serverRace.ts';
import {ATLAS_RACE_MODES,resolveRoundScores} from '../src/games/atlas/multiplayer.ts';
import {answerTerritory,createTerritoryCampaign,legalTerritoryTargets,planTerritory,resolveTerritory,territoryKnowledge,territoryView,territoryBotPlan} from '../src/games/atlas/territoryStrategy.ts';
import {calculateMatchResult,INITIAL_RATING} from '../src/games/atlas/rankedRating.ts';
import {certifiedRating,getRankFromProfile} from '../src/games/atlas/ranked.ts';
import {masteryQuestions,recordMastery} from '../src/games/atlas/mastery.ts';
import {FILL_SCOPES,entitiesInFillScope} from '../src/games/atlas/scopes.ts';
const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const data={countries:await read('../data/geography/countries.json'),extras:await read('../data/geography/extras.json'),version:await read('../data/geography/version.json'),topology:await read('../public/data/geography/world-110m.json')};
const common={entities:data.countries,extras:data.extras,datasetVersion:data.version.atlasDataVersion,seed:'private-seed',difficulty:'expert',count:20};
test('unresolved snapshots have no hidden targets, seeds, answer fields or future clues',()=>{
 for(const mode of ['map_battle','closest_wins','higher_lower','flag_battle','guess_country'])for(const q of generateMatchQuestions({...common,mode})){
  const safe=toPublicQuestion(q,'public-round',false,0),text=JSON.stringify(safe);
  for(const field of ['seed','entityId','answer','targetGeometryId','targetCoordinates','comparisonEntityId','secondValue'])assert.equal(Object.hasOwn(safe,field),false,mode+' '+field);
  assert.ok(!text.includes('private-seed'));
  if(q.interaction==='guess_country')assert.equal(safe.clues.length,1);
  if(q.interaction==='higher_lower')assert.equal(safe.stat.secondValue,undefined);
 }
});
test('continent choices vary answer position and all displayed language/currency distractors are invalid',()=>{
 const qs=generateQuestions({...common,count:195,categories:['continents','languages','currency'],interaction:'choice'}), positions=new Set();
 for(const q of qs){const entity=data.countries.find(c=>c.id===q.entityId);if(q.category==='continents'){positions.add(q.choices.findIndex(c=>c.id===q.answer));assert.equal(q.answer,normalizedContinent(entity));}if(q.category==='languages')for(const c of q.choices)assert.equal(entity.officialLanguages.includes(c.id),c.id===q.answer);if(q.category==='currency')for(const c of q.choices)assert.equal(entity.currencies.some(v=>v.name===c.id),c.id===q.answer);}
 assert.ok(positions.size>=3);assert.equal(normalizedContinent(data.countries.find(c=>c.iso3==='BRA')),'South America');
});
test('every online race completes from authoritative answers; stale/repeated actions and bogus options cannot score',()=>{
 for(const mode of ATLAS_RACE_MODES){const qs=raceQuestions(data,mode,'race-seed','expert'), gen='game-generation';let run=createRaceRun(1000);
  const stale=raceView(run,qs,gen).question.id;
  assert.throws(()=>applyRaceAction(run,qs,gen,mode,'answer','old',qs[0].answer,1001),/changed/);
  assert.throws(()=>applyRaceAction(run,qs,gen,mode,'score',stale,1000000,1001),/Unknown/);
  for(let guard=0;!run.done&&guard<200;guard++){
   const before=JSON.parse(JSON.stringify(run));const q=qs[run.index],id=raceView(run,qs,gen).question.id;
   run=applyRaceAction(run,qs,gen,mode,'answer',id,q.answer,2000+guard*100);
   assert.ok(run.feedback?.correct,mode);assert.throws(()=>applyRaceAction(run,qs,gen,mode,'answer',id,q.answer,3000),/already saved/);
   assert.deepEqual(raceView(JSON.parse(JSON.stringify(run)),qs,gen),raceView(run,qs,gen),'reconnect restores exact progress');
   assert.equal(before.index,run.index);run=applyRaceAction(run,qs,gen,mode,'next',id,null,2001+guard*100);
  }
  assert.ok(run.done,mode);assert.equal(run.ledger.length,qs.length);assert.ok(run.score>0&&run.score<200000);
  assert.throws(()=>applyRaceAction(run,qs,gen,mode,'answer',stale,qs[0].answer,30000),/finished/);
 }
});
test('race ordering rejects duplicate and missing cards; clue advancement rejects old generations',()=>{
 const qs=raceQuestions(data,'stat_ranking','order','intermediate'),run=createRaceRun(0),id=raceView(run,qs,'gen').question.id;
 assert.throws(()=>applyRaceAction(run,qs,'gen','stat_ranking','answer',id,[qs[0].answer[0],qs[0].answer[0]],1),/once each/);
 const clues=raceQuestions(data,'country_guesser','clues','expert'),first=raceView(run,clues,'gen').question.id,next=applyRaceAction(run,clues,'gen','country_guesser','clue',first,null,1);
 assert.throws(()=>applyRaceAction(next,clues,'gen','country_guesser','answer',first,clues[0].answer,2),/changed/);
});
test('territory boards stay connected with fair homes; actions need adjacency and both orders resolve simultaneously',()=>{
 const boards=new Set();for(let i=0;i<80;i++){
  let state=createTerritoryCampaign(data.countries,`board:${i}`);boards.add(state.ids[0]);assert.ok(Math.abs(state.edges[state.homes.player_a].length-state.edges[state.homes.player_b].length)<=1);
  const visited=[state.ids[0]];for(const id of visited)for(const next of state.edges[id])if(!visited.includes(next))visited.push(next);assert.equal(visited.length,state.ids.length);
  assert.throws(()=>planTerritory(state,'player_a',state.homes.player_b),/supplied/);
  for(let cycle=0;cycle<6;cycle++){
   for(const seat of ['player_a','player_b']){const target=territoryBotPlan(state,seat);assert.ok(legalTerritoryTargets(state,seat).includes(target));state=planTerritory(state,seat,target);const q=territoryKnowledge(state,seat,data.countries,'expert');assert.equal(validateAnswer(q,q.answer),true);state=answerTerritory(state,seat,q,q.answer);}
   assert.equal(territoryView(state,'player_a',data.countries,'expert','g').opponentPlanned,true);state=resolveTerritory(state);
  }assert.ok(state.done);assert.equal(state.history.length,6);assert.equal(state.ownership[state.homes.player_a],'player_a');assert.equal(state.ownership[state.homes.player_b],'player_b');
 }assert.equal(boards.size,2);
});
test('a correct defense holds a country even when an attack is also correct',()=>{
 let s=createTerritoryCampaign(data.countries,'defense');const a=s.homes.player_a,target=s.edges[a].find(id=>id!==s.homes.player_b);s.ownership[target]='player_b';s=planTerritory(s,'player_a',target);s=planTerritory(s,'player_b',target);
 for(const seat of ['player_a','player_b']){const q=territoryKnowledge(s,seat,data.countries,'expert');s=answerTerritory(s,seat,q,q.answer);}s=resolveTerritory(s);assert.equal(s.ownership[target],'player_b');
 const review=territoryView(s,'player_a',data.countries,'expert','g',true);assert.equal(review.feedback.correct,true);assert.equal(review.cycle,0);assert.ok(review.history.every(h=>!Object.hasOwn(h,'feedback')));
});
test('advanced constraints each have exactly one world solution and density uses the displayed operands',()=>{
 for(const tier of ['master','grandmaster'])for(let i=0;i<20;i++){
  const qs=generateAdvancedQuestions(data.countries,'advanced:'+i,10,tier,true);assert.equal(new Set(qs.map(q=>q.entityId)).size,10);
  for(const q of qs){assert.ok(q.prompt.includes('both'));assert.ok(q.targetCoordinates);assert.equal(validateAnswer(q,q.answer),true);}
  const q=generateDensityQuestion(data.countries,'density',i,tier);const ranked=q.choices.map(c=>{const match=c.label.match(/· ([\d,]+) people \/ ([\d,]+) km²/);return {id:c.id,ratio:Number(match[1].replaceAll(',',''))/Number(match[2].replaceAll(',',''))};}).sort((a,b)=>b.ratio-a.ratio);assert.equal(ranked[0].id,q.answer);assert.ok(ranked[0].ratio>ranked[1].ratio*1.05);
 }
});
test('rating rewards opponent strength and high ranks require consistent evidence',()=>{
 const strong={...INITIAL_RATING,rating:2300,deviation:60,matchesPlayed:40},weak={...strong,rating:1800};const expected=calculateMatchResult(strong,weak,'a'),equal=calculateMatchResult(strong,strong,'a');assert.ok(expected.a.rating-strong.rating<equal.a.rating-strong.rating);assert.ok(expected.a.rating-strong.rating<10);assert.ok(equal.a.rating-strong.rating<=18);
 assert.equal(getRankFromProfile({rating:2500,deviation:300,matches_played:2}).provisional,true);assert.equal(getRankFromProfile({rating:2450,deviation:60,matches_played:29}).tier,'Master');assert.equal(getRankFromProfile({rating:2450,deviation:60,matches_played:30}).tier,'Grandmaster');assert.equal(certifiedRating(1920,100,20),1870);
 const shared=resolveRoundScores({submissions:[{userId:'a',correct:true,distanceKm:0,submittedAt:1},{userId:'b',correct:true,distanceKm:0,submittedAt:500}],playerIds:['a','b'],roundStartedAt:0,roundDurationMs:20000,currentScores:{a:0,b:0}});assert.deepEqual(shared.scores,{a:1000,b:1000});assert.equal(shared.winnerId,null);
});
test('all regions support all mastery stages; repeats cannot claim progress twice',()=>{
 for(const region of FILL_SCOPES.filter(r=>r!=='World'))for(let stage=0;stage<3;stage++){const qs=masteryQuestions(data,region,stage,'mastery');assert.equal(qs.length,10);assert.ok(qs.every(q=>validateAnswer(q,q.answer)));}
 let progress={};for(let i=0;i<8&&(!progress.Europe||progress.Europe.stage===0);i++){const seed='mastery'+i,answers=masteryQuestions(data,'Europe',0,seed).map(q=>({question:q,correct:true}));progress=recordMastery(progress,'Europe',seed,0,answers,entitiesInFillScope(data.countries,'Europe').length);assert.equal(recordMastery(progress,'Europe',seed,0,answers,44),progress);}assert.equal(progress.Europe.stage,1);
});

test('server flag media covers every quiz flag and strips answer-bearing SVG metadata',async()=>{
 const media=await read('../supabase/functions/atlas-match/flag-media.json');
 for(const country of data.countries.filter(c=>c.flagAsset)) {
  assert.ok(media[country.flagAsset]?.startsWith('data:image/svg+xml;base64,'),country.iso3);
  const svg=Buffer.from(media[country.flagAsset].split(',')[1],'base64').toString();
  assert.doesNotMatch(svg,/<(?:title|desc)\b|<!--|<svg[^>]*\bid=/i);
  for(const [,id] of svg.matchAll(/\bid="([^"]+)"/g))assert.match(id,/^art\d+$/);
  for(const [,id] of svg.matchAll(/(?:href="#|url\(#)([^"\)]+)/g))assert.ok(svg.includes(`id="${id}"`),country.iso3+" "+id);
 }
});

test('hotseat decks use distinct deterministic seeds and preserve the shared content format',async()=>{
 const {calibratedHotseatSeeds}=await import('../src/games/atlas/hotseatCalibration.ts');
 const {DEFAULT_SOLO_SETTINGS}=await import('../src/games/atlas/soloSettings.ts');
 for(const mode of ['map_battle','flag_battle','higher_lower','guess_country','language_guesser']){
  const seeds=calibratedHotseatSeeds(data,mode,DEFAULT_SOLO_SETTINGS,'calibration',4);
  assert.equal(new Set(seeds).size,4);
  assert.deepEqual(seeds,calibratedHotseatSeeds(data,mode,DEFAULT_SOLO_SETTINGS,'calibration',4));
  const decks=seeds.map(seed=> mode==='language_guesser'?raceQuestions(data,mode,seed,'intermediate','Europe',DEFAULT_SOLO_SETTINGS.categories):generateMatchQuestions({...common,seed,mode,difficulty:'intermediate',count:10,categories:DEFAULT_SOLO_SETTINGS.categories,stats:DEFAULT_SOLO_SETTINGS.stats}));
  assert.ok(decks.every(deck=>deck.length===decks[0].length));
  assert.ok(decks.every(deck=>deck.every(q=>q.interaction===decks[0][0].interaction)));
  assert.ok(new Set(decks.map(deck=>deck.map(q=>q.entityId).join(','))).size>1);
 }
});

test('spherical distance follows short dateline arcs, polar edges, and exact city-radius boundaries',async()=>{
 const {distanceToTerritory,pointAlongGreatCircle}=await import('../src/games/atlas/territoryDistance.ts');
 const {haversineKm}=await import('../src/games/atlas/rules.ts');
 const shapes=new Map([['edge',[[[[170,0],[-170,0]]]]],['polar',[[[[-60,80],[60,80]]]]]]);
 const dateline=distanceToTerritory([180,1],{geometryId:'edge',point:null},shapes);
 assert.ok(Math.abs(dateline.distanceKm-haversineKm([180,1],[180,0]))<.001);
 const polar=distanceToTerritory([0,89],{geometryId:'polar',point:null},shapes);
 assert.ok(polar.distanceKm<haversineKm([0,89],[-60,80]));
 for(const [a,b] of [[[179,60],[-175,62]],[[30,85],[-120,84]],[[0,0],[140,-20]]]) {
  const edge=pointAlongGreatCircle(a,b,20);
  assert.ok(Math.abs(haversineKm(a,edge)-20)<1e-6);
  const measured=distanceToTerritory(b,{geometryId:null,point:a,radiusKm:20});
  assert.ok(Math.abs(measured.distanceKm-(haversineKm(a,b)-20))<1e-6);
 }
});


test('established promotion pace keeps early momentum and slows at higher ranks',()=>{
 for(const [rating,expectedDelta] of [[800,20],[1500,20],[1800,16],[2100,12],[2300,9]]) {
  const player={...INITIAL_RATING,rating,deviation:30,matchesPlayed:40};
  const win=calculateMatchResult(player,player,'a').a,loss=calculateMatchResult(player,player,'b').a;
  assert.ok(Math.abs(win.rating-rating-expectedDelta)<1e-8);
  assert.ok(Math.abs(rating-loss.rating-expectedDelta)<1e-8);
  const easy=calculateMatchResult(player,{...player,rating:rating-500},'a').a;
  assert.ok(easy.rating-rating<expectedDelta/2);
 }
});

test('dataset loads are shared; one unmount cannot cancel another and late effects use the completed cache',async()=>{
 const ts=(await import('typescript')).default;
 const source=await readFile(new URL('../src/games/atlas/useAtlasData.ts',import.meta.url),'utf8');
 const javascript=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}}).outputText;
 let active;const exports={};
 const react={useState(initial){active.state=typeof initial==='function'?initial():initial;const instance=active;return [instance.state,next=>instance.state=next];},useEffect(effect){active.effects.push(effect);}};
 new Function('require','exports',javascript)(()=>react,exports);
 const mount=()=>{const instance={effects:[],state:null};active=instance;exports.useAtlasData();return instance;};
 const savedFetch=globalThis.fetch,requests=[];
 globalThis.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
 try {
  const first=mount(),second=mount(),late=mount();
  const cleanup=first.effects[0]();second.effects[0]();cleanup();
  assert.equal(requests.length,4);assert.ok(requests.every(r=>!r.options?.signal));
  const fixtures=[data.countries,data.topology,data.version,data.extras];requests.forEach((r,i)=>r.resolve({ok:true,json:async()=>fixtures[i]}));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(first.state.data,null);assert.deepEqual(second.state.data.countries,data.countries);assert.equal(second.state.loading,false);
  late.effects[0]();assert.equal(late.state.loading,false);assert.deepEqual(late.state.data.version,data.version);
 }finally{globalThis.fetch=savedFetch;}
});
