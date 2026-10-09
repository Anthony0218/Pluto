import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, startWorld, stepWorld, measureRun } from '../src/games/natura/world.ts';
import { IDLE_INTENT } from '../src/games/natura/input.ts';
import { stepPractice } from '../src/games/natura/practice.ts';
import { practiceComplete, observe, observeChanges, freshTelemetry, reviewRun } from '../src/games/natura/observations.ts';
import { loadJournal, recordRun, recordQuiz, recordPractice, recordKey, habitatRecord, dailyExpedition, expeditionPoints } from '../src/games/natura/journal.ts';
import { SNAP_LEVELS, chooseSnapInput, idleWildInput, updateWildGame } from '../src/games/natura/wildModes.ts';
import { NaturaParticles } from '../src/games/natura/particles.ts';
import { updateLaneOcean } from '../src/games/natura/laneOcean.ts';
import { updateExpedition, idleExpeditionInput, spiderAI } from '../src/games/natura/expeditions.ts';
const idle=()=>[IDLE_INTENT(),IDLE_INTENT()];
const wild=(id,level=0)=>makeWorld(id,'ai',1,level,'normal',{challenge:'wild',seed:123});
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
test('journal keeps comparable course, difficulty, role and challenge records and preserves personal bests',()=>{
  storage.clear();const context={scenario:'jumpingspider',level:0,difficulty:'normal'};
  const result={winner:0,detail:'Summit',performance:{completed:true,progress:23,health:0,elapsed:80,label:'Platform 24 · 0 falls'}};
  recordRun(context,result);recordRun(context,{...result,performance:{...result.performance,elapsed:95}});
  recordRun({...context,challenge:'wild'},result);recordRun({...context,difficulty:'hard'},result);
  recordRun({...context,level:1},result);recordQuiz('jumpingspider',5);recordQuiz('jumpingspider',2);recordPractice('jumpingspider');
  const journal=loadJournal(),record=journal.runs[recordKey(context)];assert.equal(record.attempts,2);assert.equal(record.bestTime,80);assert.equal(record.medal,'gold');assert.equal(journal.quizzes.jumpingspider,5);assert.equal(journal.practice.jumpingspider,true);assert.equal(Object.keys(journal.runs).length,4);assert.equal(habitatRecord(journal,'jumpingspider').wins,5);
  recordRun(context,{...result,winner:1,performance:{...result.performance,completed:false,elapsed:30,progress:10}});assert.equal(loadJournal().runs[recordKey(context)].bestTime,80);
});
test('journal recovers from malformed storage and gracefully tolerates disabled storage',()=>{
  storage.set('natura.field-journal.v1','{broken');assert.deepEqual(loadJournal().runs,{});
  storage.set('natura.field-journal.v1',JSON.stringify({version:1,runs:{bad:{attempts:'wrong'}},quizzes:{meadow:999},practice:{meadow:'yes'},expeditions:{bad:-1}}));assert.deepEqual(loadJournal(),{version:1,runs:{},quizzes:{},practice:{},expeditions:{}});
  const saved=globalThis.localStorage;globalThis.localStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};assert.doesNotThrow(()=>recordQuiz('meadow',4));globalThis.localStorage=saved;
});
test('daily expedition is fixed within a Berlin day, changes at midnight and scores are bounded',()=>{
  const a=dailyExpedition(new Date('2026-10-09T00:00:00Z')),b=dailyExpedition(new Date('2026-10-09T21:59:59Z')),c=dailyExpedition(new Date('2026-10-09T22:00:00Z'));
  assert.deepEqual(a,b);assert.notEqual(a.seed,c.seed);assert.equal(new Set(a.habitats).size,3);
  for(const id of a.habitats){assert.equal(expeditionPoints(id,{winner:1,detail:'',performance:{completed:false,progress:0,health:0,elapsed:180,label:''}}),0);assert.ok(expeditionPoints(id,{winner:0,detail:'',performance:{completed:true,progress:999,health:3,elapsed:10,label:''}})<=100);}
});
test('practice holds time, restores hearts, stops the rival and never writes a scored record',()=>{
  storage.clear();for(const id of ['meadow','archerfish','flyingfish','bolas','coconut','trapjaw','cuttlefish','jumpingspider','spermwhale']){
    const w=makeWorld(id,'ai',1,0,'normal');startWorld(w);const g='game'in w?w.game:w,timer='timer'in g?g.timer:g.time;
    for(let i=0;i<100;i++)stepPractice(w,id==='jumpingspider'?[{...IDLE_INTENT(),y:-1},IDLE_INTENT()]:idle(),0.02);
    assert.equal('timer'in g?g.timer:g.time,timer,id);if(id==='jumpingspider')assert.equal(w.players[0].lives,3);
  }
  assert.deepEqual(loadJournal().runs,{});
  const meadow=makeWorld('meadow','ai',1,0,'normal',{role:'mouse'});startWorld(meadow);const x=meadow.game.mouse.x,bird=structuredClone(meadow.game.falcon);stepPractice(meadow,[{...IDLE_INTENT(),x:1},IDLE_INTENT()],0.1);assert.ok(meadow.game.mouse.x>x);assert.equal(meadow.game.falcon.x,bird.x);assert.equal(meadow.game.mode,'solo');
});
test('practice goals require successful actions and whale sonar requires a dive and return',()=>{
  const whale=makeWorld('spermwhale','ai',1,0,'normal'),seen=new Set();assert.equal(practiceComplete(whale,0,seen),false);whale.players[0].y=-10;whale.players[0].sonarCooldown=6;assert.equal(practiceComplete(whale,0,seen),false);whale.players[0].y=-2;assert.equal(practiceComplete(whale,0,seen),true);
  const fish=makeWorld('archerfish','ai',1,0,'normal');fish.game.fish[0].shotCooldown=0.8;assert.equal(practiceComplete(fish,0,new Set()),false);fish.game.fish[0].catches=1;assert.equal(practiceComplete(fish,0,new Set()),true);
});
test('wild routes are optional and side leaves preserve main-course progress and checkpoints',()=>{
  const classic=makeWorld('jumpingspider','ai',1,0,'normal'),w=wild('jumpingspider');assert.equal(classic.platforms.length,24);assert.equal(w.platforms.length,47);assert.equal(w.platforms[23].checkpoint,true);
  w.phase='playing';const pad=w.platforms[24],p=w.players[0];Object.assign(p,{x:pad.x,y:pad.y+0.015,z:pad.z,vy:-2,grounded:false});updateExpedition(w,[idleExpeditionInput(),idleExpeditionInput()],0.02,false);assert.equal(p.standing,24);assert.equal(p.progress,0);assert.equal(p.checkpoint,0);assert.equal(measureRun(w).progress,0);
  assert.ok(wild('trapjaw').detours.length>0);assert.equal(makeWorld('trapjaw','ai',1,0,'normal').detours,undefined);
});
test('wild reef shelter blocks a warned capture and rich meals preserve tie fairness',()=>{
  const w=wild('coconut');w.phase='playing';Object.assign(w.players[0],{x:300,y:90});w.raid={stage:'attack',time:2.2*(1-380/1120),lanes:[90]};const exposed=structuredClone(w);delete exposed.reefShelters;stepWorld(w,idle(),0.01,false,'normal');stepWorld(exposed,idle(),0.01,false,'normal');assert.equal(w.players[0].lives,3);assert.equal(exposed.players[0].lives,2);
  const food=wild('coconut');food.phase='playing';const site=food.foodSites[2];Object.assign(food.players[0],{x:site.x,y:site.y});Object.assign(food.players[1],{x:site.x,y:site.y});stepWorld(food,idle(),0.01,false,'normal');assert.equal(food.players[0].food,1);assert.equal(food.players[1].food,1);
});
test('changing camouflage patches updates matching logic and deep-water currents are frame-rate consistent',()=>{
  const cuttle=wild('cuttlefish'),patterns=cuttle.patches.map(p=>p.pattern);cuttle.phase='playing';cuttle.elapsed=11.99;stepWorld(cuttle,idle(),0.02,false,'normal');assert.equal(cuttle.tideStep,1);assert.ok(cuttle.patches.some((p,i)=>p.pattern!==patterns[i]));
  const states=[30,60,120].map(fps=>{const w=wild('spermwhale');w.phase='playing';w.players[0].y=-20;for(let i=0;i<2*fps;i++)stepWorld(w,idle(),1/fps,true,'normal');return w.players[0];});for(const p of states.slice(1))assert.ok(Math.abs(p.x-states[0].x)<1e-6);assert.equal(wild('spermwhale').squids[2].y,-58);
});
test('manual flying-fish crossing is edge triggered, drains glide energy and keeps incoming waves',()=>{
  const w=wild('flyingfish');w.phase='playing';for(let i=0;i<40;i++)updateLaneOcean(w,[0,0],0.02,true,true);assert.equal(w.zone,'water');assert.ok(w.waves.length>0);updateLaneOcean(w,[0,0],0.02,true,false);updateLaneOcean(w,[0,0],0.02,true,true);assert.equal(w.zone,'sky');w.glide=0.001;updateLaneOcean(w,[0,0],0.02,true,false);assert.equal(w.zone,'water');
  const paused=structuredClone(w);w.phase='paused';const before=structuredClone(w);updateLaneOcean(w,[1,0],0.1,true,true);assert.deepEqual(w,before);assert.ok(paused.glide>=0);
});
test('particles are bounded, freeze at zero delta, expire and never affect world RNG',()=>{
  const p=new NaturaParticles(32);for(let i=0;i<100;i++)p.burst([1,2,3],'#fff',14);assert.equal(p.sparks.length,32);const before=structuredClone(p.sparks);p.step(0);assert.deepEqual(p.sparks,before);for(let i=0;i<20;i++)p.step(0.1);assert.equal(p.sparks.length,0);
  const a=wild('flyingfish'),b=structuredClone(a);startWorld(a);startWorld(b);p.burst([0,0,0],'#fff');stepWorld(a,idle(),0.1,true,'normal');stepWorld(b,idle(),0.1,true,'normal');assert.deepEqual(a,b);
});
test('run observations count meaningful cues and coaching uses actual breath and fall data',()=>{
  const w=wild('spermwhale'),before=observe(w),t=freshTelemetry();w.players[0].food=1;w.players[0].lives=2;w.players[0].oxygen=12;w.players[0].cooldown=0.8;w.players[0].sonarCooldown=6;const cues=observeChanges(before,observe(w),t);assert.ok(cues.includes('catch')&&cues.includes('hurt')&&cues.includes('sonar'));assert.equal(t.injuries,1);assert.equal(t.lowestBreath,12);assert.match(reviewRun(w,0,t).tip,/return sooner/);
});

test('wild branching courses remain completable using the same ordinary AI physics',()=>{
  for(let level=0;level<8;level++) {
    const w=wild('jumpingspider',level);w.phase='playing';w.players[0].lives=999;
    for(let i=0;i<180*60&&w.phase==='playing';i++)updateExpedition(w,[idleExpeditionInput(),spiderAI(w)],1/60,false);
    assert.equal(w.players[1].progress,23,`spider wild course ${level}`);
  }
  for(let level=0;level<SNAP_LEVELS.length;level++) {
    const w=wild('trapjaw',level);w.phase='playing';w.players[0].lives=999;w.aiReadyAt=0;
    for(let i=0;i<90*60&&w.phase==='playing';i++)updateWildGame(w,[idleWildInput(),chooseSnapInput(w,1)],1/60,false);
    assert.equal(w.players[1].checkpoint,SNAP_LEVELS[level].platforms.length-1,`ant wild course ${level}`);
  }
});
