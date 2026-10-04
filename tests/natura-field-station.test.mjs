import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, update, voleConcealed } from '../src/games/natura/naturafunctions.ts';
import { createExpedition, updateExpedition, idleExpeditionInput, spiderAI } from '../src/games/natura/expeditions.ts';
import { collectSharedFood, createFoodSites } from '../src/games/natura/sharedFood.ts';
import { createLaneOcean, makeOceanWave, updateLaneOcean } from '../src/games/natura/laneOcean.ts';
const idle=()=>[idleExpeditionInput(),idleExpeditionInput()];
function advance(fn,seconds){for(let i=0;i<Math.round(seconds*120);i++)fn(1/120);}

test('grass concealment prevents AI tracking of actual prey coordinates',()=>{
  const a=initialGame('solo','mouse'),b=initialGame('solo','mouse');
  for(const g of [a,b]){g.phase='hunt';g.coverTime=2;g.invincible=100;g.lastSeenPrey={x:480,y:378};g.mouse.y=378;}
  a.mouse.x=90;b.mouse.x=210;
  assert.equal(voleConcealed(a),true);assert.equal(voleConcealed(b),true);
  update(a,new Set(),.1,'hard');update(b,new Set(),.1,'hard');
  assert.deepEqual(a.falcon,b.falcon);assert.equal(a.dive,0);assert.equal(b.dive,0);
});
test('meadow ignores invalid deltas and a long stall is bounded',()=>{
  const g=initialGame();g.phase='hunt';const before=structuredClone(g);
  for(const dt of [NaN,Infinity,-1,0])update(g,new Set(),dt);
  assert.deepEqual(g,before);update(g,new Set(),100);assert.ok(g.timer>54.89);
});
test('dive warning precedes accelerated descent',()=>{
  const g=initialGame('duo');g.phase='hunt';g.invincible=100;
  update(g,new Set(['Space']),1/60);assert.equal(g.dive,0);assert.ok(g.diveWindup>0);
  advance(dt=>update(g,new Set(),dt),.15);const y=g.falcon.y;
  advance(dt=>update(g,new Set(),dt),.1);assert.ok(g.falcon.y-y>60);
});
test('one meal cannot award two full points or repeatedly collect during cooldown',()=>{
  const sites=createFoodSites([{x:10,y:10}]),players=[{x:10,y:10,food:0},{x:10,y:10,food:0}];
  collectSharedFood(sites,players,[true,true],25,.01);assert.equal(players[0].food+players[1].food,1);
  advance(dt=>collectSharedFood(sites,players,[true,true],25,dt),1);assert.equal(players[0].food+players[1].food,1);
  collectSharedFood(sites,players,[false,false],25,5);assert.equal(players[0].food+players[1].food,1);
  collectSharedFood(sites,players,[false,true],25,.01);assert.equal(players[1].food,1.5);
});
test('sonar samples once, reports bands, and expires without live tracking',()=>{
  const g=createExpedition('spermwhale');g.phase='playing';
  updateExpedition(g,[{...idleExpeditionInput(),special:true},idleExpeditionInput()],1/60,true);
  const echoes=structuredClone(g.players[0].echoes);assert.equal(echoes.length,3);
  assert.deepEqual(Object.keys(echoes[0]).sort(),['bearing','depth','range']);
  g.squids[0].x+=25;advance(dt=>updateExpedition(g,idle(),dt,true),1);
  assert.deepEqual(g.players[0].echoes,echoes);
  advance(dt=>updateExpedition(g,idle(),dt,true),3.1);assert.deepEqual(g.players[0].echoes,[]);
});
test('swimming builds velocity and release braking brings it down quickly',()=>{
  const g=createExpedition('spermwhale');g.phase='playing';
  updateExpedition(g,[{...idleExpeditionInput(),x:1},idleExpeditionInput()],1/60,true);
  assert.ok(g.players[0].velocity.x>0&&g.players[0].velocity.x<2);
  advance(dt=>updateExpedition(g,[{...idleExpeditionInput(),x:1},idleExpeditionInput()],dt,true),.5);
  assert.ok(g.players[0].velocity.x>9);
  advance(dt=>updateExpedition(g,idle(),dt,true),.5);assert.ok(g.players[0].velocity.x<.2);
});
test('Medium spider prepares at every platform; Hard can jump immediately',()=>{
  const g=createExpedition('jumpingspider');g.elapsed=10;g.players[1].groundedTime=.1;
  assert.equal(spiderAI(g,'normal').action,false);assert.equal(spiderAI(g,'hard').action,true);
});
test('side-changing ocean waves always keep an opening and lock before impact',()=>{
  const g=createLaneOcean();g.phase='playing';g.spawn=100;
  const wave=makeOceanWave(6,'sky',()=>0);g.waves=[wave];
  assert.ok(wave.switchLanes);assert.equal(wave.switchLanes.length,2);
  wave.z=-17;advance(dt=>updateLaneOcean(g,[0,0],dt,true),.1);
  assert.equal(wave.switched,true);assert.equal(wave.lanes.length,2);assert.ok(wave.z<0);
});

test('shared intent adapter keeps player controls independent, including whale depth', async()=>{
  const {readIntents}=await import('../src/games/natura/input.ts');
  const [a,b]=readIntents(new Set(['KeyD','KeyW','KeyQ','Space','ArrowLeft','ArrowDown','PageDown','ShiftRight']));
  assert.deepEqual([a.x,a.y,a.vertical,a.action,a.secondary],[1,-1,1,true,false]);
  assert.deepEqual([b.x,b.y,b.vertical,b.action,b.secondary],[-1,1,-1,false,true]);
});
test('all nine world adapters freeze before start and advance through the shared intent path',async()=>{
  const {makeWorld,startWorld,stepWorld}=await import('../src/games/natura/world.ts');
  const {IDLE_INTENT}=await import('../src/games/natura/input.ts');
  for(const id of ['meadow','bolas','coconut','trapjaw','cuttlefish','jumpingspider','spermwhale','archerfish','flyingfish']){
    for(const mode of ['ai','hotseat']){
      const world=makeWorld(id,mode,1,0,'normal'),before=structuredClone(world);
      stepWorld(world,[IDLE_INTENT(),IDLE_INTENT()],.1,mode==='ai','normal');assert.deepEqual(world,before,id);
      startWorld(world);stepWorld(world,[{...IDLE_INTENT(),x:1},IDLE_INTENT()],.1,mode==='ai','normal');
      const time=id==='meadow'?world.game.timer:id==='archerfish'?world.game.time:world.time;
      const original=id==='meadow'?before.game.timer:id==='archerfish'?before.game.time:before.time;
      assert.ok(time<original,id);
    }
  }
});

test('final-heart capture finishes only after the visible drag',async()=>{
  const {createToolGame,updateToolGame,idleToolInput}=await import('../src/games/natura/toolAnimals.ts');
  const g=createToolGame('coconut');g.phase='playing';g.players[0].lives=1;
  g.raid={stage:'attack',time:1.87,lanes:[180,360]};
  const inputs=[idleToolInput(),idleToolInput()];
  updateToolGame(g,inputs,.1,false);assert.equal(g.players[0].lives,0);assert.equal(g.phase,'playing');
  advance(dt=>updateToolGame(g,inputs,dt,false),1.1);assert.equal(g.phase,'finished');assert.equal(g.winner,1);
});
