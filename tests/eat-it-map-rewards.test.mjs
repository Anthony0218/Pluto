import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, movePlayer } from '../src/games/eat-it/engine.ts';
import { EAT, FOOD } from '../src/games/eat-it/config.ts';
import { foodFits } from '../src/games/eat-it/rules.ts';
import { canUnderpass, foodReward } from '../src/games/eat-it/progression.ts';
import { stepWorld, fishGrowth, SURFACES, surfaceAt } from '../src/games/eat-it/world.ts';
import { ModelLibrary } from '../src/games/eat-it/models.ts';
import { resolveShrine, shrineClear } from '../src/games/eat-it/quests.ts';
function scene(map='city') {
  const s=createGame(map,[{id:'a',name:'A'},{id:'b',name:'B'}],567,'rewards',{mode:'solo',hellEnabled:false,livesEnabled:false,animalsEnabled:false});
  s.food=[];s.powerups=[];s.nextFood=s.nextPower=s.nextFactory=s.nextHumans=s.nextBig=1e9;delete s.feast;delete s.encounter;
  Object.assign(s.players[0],{x:1200,y:1400,mass:12,facing:0,input:{x:1,y:0}});
  Object.assign(s.players[1],{x:3400,y:2800});return s;
}
const prop=(s,kind,extra={})=>({id:s.nextId++,kind,x:1400,y:1400,z:0,vz:0,vx:0,vy:0,rotation:.35,target:null,capturedAt:0,...extra});
test('every oversized prop allows the same continuous movement as empty ground, without moving or rewarding the prop',()=>{
  const base=scene(),empty=structuredClone(base);for(let i=0;i<75;i++)stepGame(empty);
  for(const kind of Object.keys(FOOD)) {
    const s=structuredClone(base),p=s.players[0],f=prop(s,kind);if(foodFits(p,f,0))continue;
    s.food=[f];assert.ok(canUnderpass(p,f,0),kind);
    for(let i=0;i<75;i++)stepGame(s);
    assert.equal(p.x,empty.players[0].x,kind);assert.equal(p.vx,empty.players[0].vx,kind);
    assert.equal(f.target,null,kind);assert.equal(f.x,1400,kind);assert.equal(f.y,1400,kind);assert.equal(p.foodEaten,0,kind);
  }
});
test('characters can pass beneath the fixed shrine while other props retain its collision',()=>{
  const s=scene(),p=s.players[0];s.encounter={shrine:{x:p.x,y:p.y}};
  const before={x:p.x,y:p.y};resolveShrine(s,p,24);assert.deepEqual({x:p.x,y:p.y},before);
  assert.ok(shrineClear(s,p,{x:p.x+200,y:p.y},24));
  const food={...before};resolveShrine(s,food,24);assert.notDeepEqual(food,before);
});
test('fish rolls follow all six specified reward probabilities, including both rare tiers',()=>{
  const s={rng:731},counts=[0,0,0,0,0,0];
  for(let i=0;i<100000;i++) {
    const growth=fishGrowth(s);assert.ok(Number.isInteger(growth));
    const tier=growth<=50?0:[100,200,500,1000,10000].indexOf(growth)+1;
    assert.ok(tier>=0);if(tier===0)assert.ok(growth>=20);counts[tier]++;
  }
  for(const [i,probability] of [.8,.1,.05,.03,.01,.01].entries())assert.ok(Math.abs(counts[i]/100000-probability)<.004,JSON.stringify(counts));
});
test('Nature waves land five fish per bank and mark only the 1,000/10,000 fish gold',()=>{
  const s=scene('nature');let gold=0;
  for(let wave=0;wave<200;wave++) {
    s.food=[];s.feast={nextAt:s.time,wave};stepWorld(s,1/30);
    const fish=s.food.filter(f=>f.kind==='fish');assert.equal(fish.length,10);
    assert.equal(fish.filter(f=>f.leap.to.x<2560).length,5);assert.equal(fish.filter(f=>f.leap.to.x>2750).length,5);
    for(const f of fish){assert.equal(f.golden,f.rewardGrowth>=1000);if(f.golden)gold++;}
    s.time+=18;
  }
  assert.ok(gold>0);
});
test('rolled fish and conveyor coin rewards stay exact at large sizes and modifiers apply once',()=>{
  for(const kind of ['fish','coin'])for(const rewardGrowth of kind==='fish'?[20,50,100,200,500,1000,10000]:[50,100,150]) {
    const s=scene(),p=s.players[0];p.mass=100000;
    const f=prop(s,kind,{rewardGrowth});foodReward(s,p,f);assert.equal(p.mass,100000+rewardGrowth);
    p.effects.multiplier=30;foodReward(s,p,f);assert.equal(p.mass,100000+rewardGrowth*3);
  }
});
test('gold fish use distinct metallic gold meshes without recoloring ordinary fish',()=>{
  const lib=new ModelLibrary(),normal=lib.prop('fish'),gold=lib.prop('fish',true);
  assert.notEqual(normal.getObjectByName('fish-body').material,gold.getObjectByName('fish-body').material);
  for(const name of ['fish-body','tail','fin'])assert.equal(gold.getObjectByName(name).material.color.getHexString(),'ffd34e');
  assert.equal(lib.prop('fish').getObjectByName('fish-body').material.color.getHexString(),FOOD.fish.color.slice(1));lib.dispose();
});
test('Candy distributes a random 10–20 coin quota across each 30-second interval on conveyors',()=>{
  assert.equal(EAT.candyCoins.interval,30);
  const s=scene('candy');stepWorld(s,1/30);const cycle=s.candyCoins,count=cycle.count,emissions=[];
  assert.ok(count>=10&&count<=20);
  for(let i=cycle.emitted;i<count;i++) {
    s.time=cycle.nextAt+1e-6;const before=cycle.emitted;stepWorld(s,1/30);
    assert.equal(cycle.emitted,before+1);const coin=s.food.find(f=>f.spawnedAt===s.time&&f.kind==='coin');assert.ok(coin);
    assert.ok(coin.rewardGrowth>=50&&coin.rewardGrowth<=150);
    assert.ok(SURFACES.candy.some(b=>coin.x>=b.x&&coin.x<=b.x+b.w&&coin.y>=b.y&&coin.y<=b.y+b.h));emissions.push(s.time);
  }
  assert.ok(emissions.every((at,i)=>i===0||at>emissions[i-1]));assert.ok(emissions.at(-1)<30);
  const snapshot=JSON.parse(JSON.stringify(s));s.time=snapshot.time=30;stepWorld(s,1/30);stepWorld(snapshot,1/30);assert.deepEqual(s,snapshot);assert.equal(s.candyCoins.startAt,30);
  s.phase='hell';const before=structuredClone(s);s.time+=30;stepWorld(s,1/30);assert.deepEqual(s.candyCoins,before.candyCoins);
});
test('expanded ice covers almost twice the former area and adds a bounded speed bonus',()=>{
  const area=SURFACES.frozen.filter(p=>p.kind==='ice').reduce((n,p)=>n+p.w*p.h,0),previous=2*950*220+440*950;
  assert.ok(area>previous*1.9&&area<previous*2.1);
  const s=scene('frozen'),p=s.players[0];Object.assign(p,{x:600,y:550});assert.equal(surfaceAt('frozen',p).speed,1.32);
  const plain=structuredClone(s);plain.players[0].y=1400;
  for(let i=0;i<20;i++){movePlayer(s,p,{x:1,y:0},1/30);movePlayer(plain,plain.players[0],{x:1,y:0},1/30);}
  assert.ok(p.vx>plain.players[0].vx&&p.vx<plain.players[0].vx*1.8);
});
