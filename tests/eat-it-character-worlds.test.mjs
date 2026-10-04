import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { EAT, FOOD, isBigProp } from '../src/games/eat-it/config.ts';
import { EMOTIONS, characterEmotion } from '../src/games/eat-it/characters.ts';
import { spawnFactory, spawnBig, spawnFood, updateSpawns } from '../src/games/eat-it/spawn.ts';
import { ModelLibrary } from '../src/games/eat-it/models.ts';
import { objectHeight, beginFall, fallPose } from '../src/games/eat-it/falling.ts';
import { consumptionDuration, foodFits } from '../src/games/eat-it/rules.ts';

const themes = {
  nature: ['giantMushroom', 'mossBoulder', 'ancientStump'],
  candy: ['giantCandy', 'chocolateStack', 'giantCupcake', 'jellyMountain'],
  frozen: ['iceBlock', 'iceberg', 'glacier'],
};
function state(map) {
  return {map, rng:567, nextId:1, time:0, phase:'normal', settings:{matchDuration:600}, players:[], food:[], powerups:[], spawnSector:0, nextFood:1e9, nextPower:1e9, nextFactory:0};
}
test('appearance is stable through snapshots and varies across matches and participants',()=>{
  const moods=new Set();
  for(let seed=1;seed<=48;seed++) {
    const a=characterEmotion(seed,'you');
    assert.ok(EMOTIONS.includes(a));
    assert.equal(a,characterEmotion(JSON.parse(JSON.stringify({seed})).seed,'you'));
    moods.add(a);moods.add(characterEmotion(seed,'bot-1'));
  }
  assert.equal(moods.size,EMOTIONS.length);
});
for(const map of ['city','nature','candy','frozen'])test(`${map}: factory restrictions, cadence and population cap`,()=>{
  const s=state(map),allowed=['city','frozen'].includes(map);
  assert.equal(spawnFactory(s,0),allowed);
  s.food=[];updateSpawns(s);
  assert.equal(s.food.length,allowed?1:0);
  assert.equal(s.nextFactory,30);
  s.time=29.9;updateSpawns(s);assert.equal(s.food.length,allowed?1:0);
  for(let i=0;i<20;i++)spawnFactory(s);
  assert.ok(s.food.length<=5);
  if(allowed)assert.ok(s.food.length>=3);
  else assert.equal(s.food.length,0);
});
for(const [map,kinds] of Object.entries(themes))test(`${map}: themed large props spawn and replenish without ordinary buildings`,()=>{
  const s=state(map);
  for(let i=0;i<100;i++)spawnFood(s,true);
  assert.ok(s.food.some(f=>kinds.includes(f.kind)));
  assert.equal(s.food.some(f=>FOOD[f.kind].building),false);
  s.food=[];
  for(let i=0;i<12;i++)assert.equal(spawnBig(s),true);
  assert.ok(s.food.some(f=>kinds.includes(f.kind)));
  assert.equal(s.food.some(f=>FOOD[f.kind].building),false);
  assert.ok(s.food.every(f=>isBigProp(f.kind)));
});
test('all new landmarks stay within physical footprints and sink completely before rewards',()=>{
  const lib=new ModelLibrary();
  for(const kind of Object.values(themes).flat()) {
    const f=FOOD[kind],model=lib.prop(kind),box=new T.Box3().setFromObject(model);
    assert.ok(model.children.length>=3,kind);
    assert.ok(box.max.x<=f.width/2+1&&box.min.x>=-f.width/2-1,`${kind}: width`);
    assert.ok(box.max.z<=f.height/2+1&&box.min.z>=-f.height/2-1,`${kind}: depth`);
    assert.ok(box.max.y<=objectHeight(kind)+1,`${kind}: height`);
    const player={id:'a',x:1500,y:1400,mass:12000,facing:0,vx:0,vy:0};
    const prop={kind,x:1500,y:1400,z:0,rotation:0,vx:0,vy:0};
    assert.equal(foodFits(player,prop),true,kind);
    beginFall(prop,player,0);
    model.position.y=fallPose(prop,consumptionDuration(prop)).z;
    assert.ok(new T.Box3().setFromObject(model).max.y<0,`${kind}: complete swallow`);
  }
  lib.dispose();
});
test('factories remain occasional high-reward encounters',()=>{
  assert.equal(EAT.factories.initialCount,3);
  assert.equal(EAT.factories.interval,30);
  assert.equal(EAT.factories.maxActive,5);
  assert.equal(FOOD.factorySky.growth,3200);
});
