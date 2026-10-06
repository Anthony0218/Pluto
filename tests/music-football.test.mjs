import test from 'node:test';
import assert from 'node:assert/strict';
import { learningLessons } from '../src/data/learningCatalog.ts';
import { footballCategories, footballTopics, footballTopicRoute, resolveFootballTopic, footballStatsRoute } from '../src/data/footballReference.ts';
import { musicFootballLessons, subjectActivities, subjectExerciseIds } from '../src/data/musicFootball.ts';
import { drumVoice, bottomLineStep, staffY, writtenNote, resolveWrittenNote, midiName, frequency, musicInstruments, rhythmPatterns, rhythmTimeline, rhythmDuration } from '../src/data/musicReading.ts';
import { judgeOffside, offsidePresets, boundaryRestart, formationPlayers, roleResponsibilities } from '../src/data/footballLearning.ts';
import { clubHonours, domesticLeagues, mensWorldCups, womensWorldCups } from '../src/data/footballHonours.ts';
import { createLearningToolsStore, parseLearningToolsProgress } from '../src/data/learningToolsProgress.ts';

test('music publishes graded lessons while football reference content stays outside learning progress', () => {
  assert.deepEqual(['reading-pitches','reading-rhythm','rules','positions-tactics'].map(path => musicFootballLessons.filter(l => l.pathId === path).length), [6,5,7,6]);
  assert.equal(subjectActivities.length, 24);
  assert.equal(learningLessons.filter(l=>l.subjectId==='music').length,11);
  assert.equal(learningLessons.filter(l=>l.subjectId==='football').length,0);
  const auditedAnswers = ['E4','A','880 Hz','Makes it F natural','F-sharp','Alto clef','2','1.5','Two groups of three','On the and after 2','4','Inside their own penalty area','No','Play on','Direct free kick and yellow card','Goal kick','Corner kick','No, they are different competitions','No; add one goalkeeper','To protect against a counterattack','10','Pressure supported by cover','Outside and beyond the ball carrier','To use space a defender leaves'];
  subjectActivities.forEach((a, i) => assert.equal(a.practice[0].options[a.practice[0].answer], auditedAnswers[i]));
  for (const activity of subjectActivities) {
    const lesson = musicFootballLessons.find(l => l.id === activity.id);
    assert.ok(lesson);
    assert.ok(lesson.route.endsWith(lesson.id));
    for (const q of activity.practice) {
      assert.ok(q.options[q.answer]); assert.equal(new Set(q.options).size,q.options.length);
      if (activity.subjectId === 'music') assert.ok(subjectExerciseIds.get(activity.id).has(q.id));
      else assert.equal(subjectExerciseIds.has(activity.id),false);
    }
  }
  assert.ok(new Set(subjectActivities.map(a => a.practice[0].answer)).size > 1, 'correct options are not always in the same position');
});

test('clefs, ledger notes, accidentals and instrument transposition give known pitches', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(bottomLineStep).map(([clef, step])=>[clef,writtenNote(step).name])), { treble:'E4',bass:'G2',alto:'F3',tenor:'D3' });
  assert.equal(staffY(28,'alto'),82); assert.equal(staffY(28,'tenor'),68);
  assert.equal(staffY(28,'treble'),124); assert.equal(staffY(28,'bass'),40);
  assert.equal(writtenNote(28).midi,60); assert.equal(midiName(writtenNote(34,1).midi),'C5');
  assert.equal(midiName(writtenNote(28,-1).midi),'B3');
  assert.equal(midiName(60+musicInstruments.find(i=>i.id==='clarinet').transpose),'B♭3');
  assert.equal(midiName(60+musicInstruments.find(i=>i.id==='sax').transpose),'E♭3');
  assert.equal(midiName(60+musicInstruments.find(i=>i.id==='guitar').transpose),'C3');
  assert.equal(resolveWrittenNote(31,0,1).name,'F♯4');
  assert.equal(resolveWrittenNote(38,0,1).name,'F♯5');
  assert.equal(resolveWrittenNote(31,2,1).name,'F4');
  assert.equal(resolveWrittenNote(34,0,-1).name,'B♭4');
  assert.equal(resolveWrittenNote(34,1,-1).name,'B♯4');
  assert.equal(frequency(69),440); assert.equal(frequency(81),880);
  for (const invalid of [NaN, Infinity, 13,49,28.5]) assert.throws(()=>writtenNote(invalid),RangeError);
  assert.throws(()=>writtenNote(28,2),RangeError);
});

test('rhythm timelines preserve rest time, ties and compound-meter beat units', () => {
  for (const pattern of rhythmPatterns) {
    const timeline = rhythmTimeline(pattern.events);
    assert.ok(Math.abs(timeline.at(-1).end-({'4/4':4,'3/4':3,'6/8':2}[pattern.meter]))<1e-10);
    assert.equal(timeline[0].start,0);
    for (let i=1;i<timeline.length;i++) assert.equal(timeline[i].start,timeline[i-1].end);
    assert.ok(Math.abs(rhythmDuration(pattern.events,60)-timeline.at(-1).end)<1e-10);
  }
  const tied= rhythmPatterns.find(p=>p.id==='ties').events;
  assert.equal(tied[0].step,tied[1].step); assert.equal(tied[1].tie,true);
  assert.equal(tied[0].beats+tied[1].beats,1.5);
  assert.equal(drumVoice(tied[0].step),drumVoice(tied[1].step));
  assert.deepEqual([28,29,30,32].map(drumVoice),[0,1,2,2]);
  assert.throws(()=>rhythmDuration(tied,0),RangeError);
});

test('offside uses the pass snapshot, both references, strict level boundary and any opponent', () => {
  const base=offsidePresets[0].situation;
  assert.equal(judgeOffside(base).offence,true);
  assert.equal(judgeOffside({...base,attacker:70}).offence,false);
  assert.equal(judgeOffside({...base,attacker:70.01}).offence,true);
  assert.equal(judgeOffside({...base,ball:79}).offence,false);
  assert.equal(judgeOffside({...base,attacker:50,ball:35,opponents:[90,44]}).offence,false);
  assert.equal(judgeOffside({...base,attacker:50.01,ball:35,opponents:[90,44]}).offence,true);
  assert.equal(judgeOffside({...base,opponents:[92,61,70]}).secondLast,70);
  assert.equal(judgeOffside({...base,opponents:[70,92,61]}).secondLast,70);
  assert.equal(judgeOffside({...base,involved:false}).offence,false);
  for (const origin of ['throw-in','goal-kick','corner']) assert.equal(judgeOffside({...base,origin}).offence,false);
  assert.equal(judgeOffside({...base,origin:'free-kick'}).offence,true);
  for (const contact of ['deflection','save']) assert.equal(judgeOffside({...base,contact}).offence,true);
  assert.equal(judgeOffside({...base,contact:'deliberate-play'}).offence,false);
  assert.throws(()=>judgeOffside({...base,opponents:[92]}),RangeError);
  assert.throws(()=>judgeOffside({...base,attacker:NaN}),RangeError);
});

test('whole-ball boundaries and last touch select the right restart', () => {
  for(const boundary of ['touchline','goal-line']) for(const touch of ['attacker','defender']) assert.equal(boundaryRestart(boundary,touch,false),'Play on');
  assert.equal(boundaryRestart('touchline','attacker',true),'Throw-in to the other team');
  assert.equal(boundaryRestart('goal-line','attacker',true),'Goal kick');
  assert.equal(boundaryRestart('goal-line','defender',true),'Corner kick');
});

test('formations always contain ten outfield players and one goalkeeper within the pitch', () => {
  for(const formation of ['4-3-3','4-4-2','3-5-2']) for(const possession of [false,true]) {
    const players=formationPlayers(formation,possession);
    assert.ok(players.every(p=>roleResponsibilities[p.role]?.with && roleResponsibilities[p.role]?.without));
    assert.equal(players.length,11); assert.equal(new Set(players.map(p=>p.number)).size,11);
    assert.equal(players.filter(p=>p.role==='Goalkeeper').length,1);
    assert.ok(players.every(p=>p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100));
  }
});

test('3-5-2 wide midfielders form a back five without possession', () => {
  assert.equal(formationPlayers('3-5-2',false).filter(p=>p.x===28).length,5);
  assert.equal(formationPlayers('3-5-2',true).filter(p=>p.x===36).length,3);
});

test('honours have six domestic leagues, source provenance, separate categories and dated World Cup years', () => {
  assert.deepEqual([...new Set(clubHonours.map(c=>c.league))].sort(),[...domesticLeagues].sort());
  for(const club of clubHonours) {
    assert.ok(club.sources.length>0&&club.sources.every(s=>s.startsWith('https://')));
    for(const value of [club.leagueTitles,club.cupTitles,club.ucl,club.europa,club.conference]) assert.ok(Number.isInteger(value)&&value>=0);
  }
  assert.equal(clubHonours.find(c=>c.id==='bayern').leagueTitles,33);
  assert.equal(clubHonours.find(c=>c.id==='liverpool').leagueTitles,20);
  assert.equal(clubHonours.find(c=>c.id==='chelsea').conference,1);
  assert.equal(clubHonours.find(c=>c.id==='sevilla').europa,7);
  const men=mensWorldCups.flatMap(t=>t.years),women=womensWorldCups.flatMap(t=>t.years);
  assert.equal(men.length,23);assert.equal(new Set(men).size,23); assert.equal(Math.max(...men),2026);
  assert.equal(women.length,9);assert.equal(new Set(women).size,9);assert.equal(Math.max(...women),2023);
});

test('music exercises survive reload, reject unknown IDs, and reset separately from reading', () => {
  const entries=new Map();const storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};
  const store=createLearningToolsStore(storage);
  for(const path of ['reading-pitches','reading-rhythm']) {
    const lesson=musicFootballLessons.find(l=>l.pathId===path);
    const exercise=subjectActivities.find(a=>a.id===lesson.id).practice[0];
    store.setLessonStage('alice',lesson.id,'check',1);store.setLessonCompleted('alice',lesson.id,true,2);store.toggleBookmark('alice',lesson.id);
    store.recordSolvedExercise('alice',lesson.id,'fake');assert.equal(store.read('alice').solvedExercises[lesson.id],undefined);
    store.recordSolvedExercise('alice',lesson.id,exercise.id);
    const restored=createLearningToolsStore(storage);
    assert.deepEqual(restored.read('alice').solvedExercises[lesson.id],[exercise.id]);
    assert.equal(restored.read('alice').lessons[lesson.id].stage,'check');
    assert.deepEqual(restored.read('guest').solvedExercises,{});
    restored.resetLessonExercises('alice',lesson.id);
    assert.equal(restored.read('alice').solvedExercises[lesson.id],undefined);
    assert.equal(restored.read('alice').lessons[lesson.id].completed,true);
    assert.ok(restored.read('alice').bookmarks.includes(lesson.id));
  }
  assert.deepEqual(parseLearningToolsProgress(JSON.stringify({version:1,solvedExercises:{fake:['fake']}})).solvedExercises,{});
});


test('football references cover every IFAB law and preserve old explanation URLs', () => {
  assert.deepEqual(footballCategories.map(category=>category.id),['rules','positions','tactics']);
  const rules=footballTopics.filter(topic=>topic.categoryId==='rules');
  assert.deepEqual(rules.map(topic=>topic.law),Array.from({length:17},(_,i)=>i+1));
  assert.equal(new Set(footballTopics.map(footballTopicRoute)).size,footballTopics.length);
  for(const topic of footballTopics) {
    assert.ok(topic.title && topic.summary && topic.paragraphs.length && topic.elements.length);
    assert.equal(resolveFootballTopic(topic.categoryId,topic.id),topic);
    if(topic.law) assert.ok(topic.lawSlug);
  }
  for(const activity of subjectActivities.filter(a=>a.subjectId==='football')) {
    const resolved=resolveFootballTopic(activity.pathId,activity.id);
    assert.ok(resolved,activity.id);
    if(activity.topic==='competitions') assert.equal(resolved.categoryId,'stats');
    else assert.ok(footballTopics.includes(resolved));
  }
  assert.equal(footballStatsRoute,'/learn/football/stats');
  assert.equal(resolveFootballTopic('rules','nonexistent'),undefined);
  assert.equal(resolveFootballTopic('positions','offside'),undefined);
});

test('retired football course state never contributes to music or math learning progress', () => {
  const music=learningLessons.find(l=>l.subjectId==='music');
  const football=musicFootballLessons.find(l=>l.subjectId==='football');
  const exercise=subjectActivities.find(a=>a.id===football.id).practice[0].id;
  const legacy={version:1,lessons:{[music.id]:{stage:'learn',completed:true,updatedAt:1},[football.id]:{stage:'check',completed:true,updatedAt:2}},bookmarks:[music.id,football.id],solvedExercises:{[football.id]:[exercise]}};
  const parsed=parseLearningToolsProgress(JSON.stringify(legacy));
  assert.deepEqual(Object.keys(parsed.lessons),[music.id]);
  assert.deepEqual(parsed.bookmarks,[music.id]);
  assert.deepEqual(parsed.solvedExercises,{});
  const store=createLearningToolsStore(null);
  store.setLessonCompleted('guest',football.id,true);
  store.recordSolvedExercise('guest',football.id,exercise);
  assert.deepEqual(store.read('guest').lessons,{});
  assert.deepEqual(store.read('guest').solvedExercises,{});
});
