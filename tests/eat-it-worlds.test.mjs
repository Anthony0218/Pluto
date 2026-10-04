import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { EAT, FOOD, FACTORY_TIERS, massToSpeed, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, movePlayer, stepGame } from '../src/games/eat-it/engine.ts';
import { foodFits, playerFits } from '../src/games/eat-it/rules.ts';
import { foodReward, canUnderpass } from '../src/games/eat-it/progression.ts';
import { parseSettings, applyRoomAction } from '../src/games/eat-it/authority.ts';
import { ModelLibrary } from '../src/games/eat-it/models.ts';
import { startHell } from '../src/games/eat-it/hell.ts';
import { spawnFactory, updateSpawns } from '../src/games/eat-it/spawn.ts';
import { spawnHumans, stepWorld, stepLeap, surfaceAt, SURFACES } from '../src/games/eat-it/world.ts';
import { stepEscape } from '../src/games/eat-it/escape.ts';
import { BOT_POLICY, botInput } from '../src/games/eat-it/bots.ts';
import { validPosition } from '../src/games/eat-it/maps.ts';
const players=[{id:'a',name:'A'},{id:'b',name:'B'}];
function scene(map='city') {
  const s=createGame(map,players,567,'worlds',{mode:'solo',hellEnabled:false,livesEnabled:false,animalsEnabled:false});
  s.food=[];s.powerups=[];s.nextFood=s.nextPower=s.nextFactory=s.nextHumans=s.nextBig=1e9;delete s.feast;
  s.players.forEach((p,i)=>Object.assign(p,{x:1000+i*2200,y:1400,facing:0}));return s;
}
function prop(s,kind,at={x:1500,y:1400}) { const f={...at,kind,id:s.nextId++,vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0};s.food.push(f);return f; }
function ticks(s,n){for(let i=0;i<n;i++)stepGame(s);}
for(const map of ['city','nature','candy','frozen'])test(`${map}: valid shared room, fresh factory tiers and no Pluto`,()=>{
  assert.equal(parseSettings({map,count:2}).map,map);
  const s=createGame(map,players,74,'worlds',{mode:'solo'});
  assert.equal(s.food.some(f=>FOOD[f.kind].shape==='pluto'),false);
  assert.equal(s.food.some(f=>FOOD[f.kind].shape==='factory'),['city','frozen'].includes(map));
  assert.ok(s.food.every(f=>validPosition(map,f,FOOD[f.kind].radius)));
  assert.ok(s.players.every(p=>s.food.filter(f=>f.kind==='apple'&&Math.hypot(f.x-p.x,f.y-p.y)<=101).length>=8));
  const room={id:'room',room_code:'ABCDEF',host_id:'a',players:players.map(p=>({...p,ready:true,lastSeen:1000})),settings:parseSettings({map,count:2}),game_state:null,status:'waiting',version:0,last_tick:1000};
  assert.equal(applyRoomAction(room,'a','A',{op:'start'},1000,74,'shared'),true);assert.equal(room.game_state.map,map);
});
test('unknown map IDs are rejected before authoritative allocation',()=>assert.throws(()=>parseSettings({map:'moon',count:2}),/Unknown map/));
for(const map of ['city','nature','candy','frozen'])test(`${map}: crowds use map-specific batch sizes, caps and cadence`,()=>{
  const s=scene(map);s.nextHumans=0;stepWorld(s,1/30);assert.equal(s.food.filter(f=>f.kind==='human').length,map==='city'?60:4);
  assert.equal(s.nextHumans,map==='city'?12:26);
  for(let i=0;i<10;i++)spawnHumans(s);
  assert.equal(s.food.filter(f=>f.kind==='human').length,map==='city'?60:24);
  const before=s.food.length;s.phase='hell';assert.equal(spawnHumans(s),false);assert.equal(s.food.length,before);
});
test('a failed crowd allocation never leaves one, two or three humans behind',()=>{
  const s=scene();s.food=Array.from({length:EAT.food.maxObjects-2},(_,i)=>({...prop(s,'apple'),id:i+10000}));
  assert.equal(spawnHumans(s),false);assert.equal(s.food.some(f=>f.kind==='human'),false);
});
test('humans flee the nearest mouth and remain catchable at every size/difficulty',()=>{
  const s=scene(),f=prop(s,'human',{x:1200,y:1400});f.citizen={nextTurn:0,direction:Math.PI};
  stepWorld(s,1/30);assert.ok(f.vx>0);assert.equal(Math.hypot(f.vx,f.vy),EAT.humans.runSpeed);
  for(const mass of [300,1000,10000,1e7])for(const policy of Object.values(BOT_POLICY)){
    assert.ok(massToSpeed(mass)*policy.speed>EAT.humans.driveSpeed);
    assert.ok(EAT.humans.driveSpeed>EAT.humans.runSpeed);
  }
});
test('a human gives 50 base growth even to a huge mouth; modifiers apply once',()=>{
  for(const mass of [36,3600,12000]){const s=scene(),p=s.players[0],f=prop(s,'human');p.mass=mass;foodReward(s,p,f);assert.equal(p.mass-mass,50);assert.equal(p.stats.collected.human,1);}
  const s=scene(),p=s.players[0];p.effects.multiplier=20;foodReward(s,p,prop(s,'human'));assert.equal(p.mass,136);
});
test('a fleeing human takes an available car; consuming it awards the passenger once',()=>{
  const s=scene(),p=s.players[0],car=prop(s,'car',{x:1200,y:1400}),f=prop(s,'human',{x:1180,y:1400});
  f.citizen={nextTurn:0,direction:0};stepWorld(s,1/30);
  assert.equal(f.citizen.carId,car.id);assert.equal(car.driverId,f.id);assert.equal(Math.hypot(car.vx,car.vy),EAT.humans.driveSpeed);
  p.mass=3600;p.x=car.x;p.y=car.y;car.target=p.id;car.capturedAt=0;
  ticks(s,65);assert.equal(p.stats.collected.human,1);assert.equal(p.stats.collected.car,1);
  const mass=p.mass;ticks(s,60);assert.equal(p.mass,mass);
});
test('retired drivers release cars and cannot leave orphaned drive state',()=>{
  const s=scene(),car=prop(s,'car',{x:2000,y:2800}),f=prop(s,'human',{x:2000,y:2800});f.citizen={carId:car.id,nextTurn:0,direction:0};f.expiresAt=.1;car.driverId=f.id;car.vx=110;s.time=1;stepWorld(s,1/30);
  assert.equal(s.food.includes(f),false);assert.equal(car.driverId,undefined);assert.equal(car.vx,0);
});
test('factory footprints form a meaningful ladder and their generous rewards never soften',()=>{
  const s=scene(),p=s.players[0];let last=0;
  for(const kind of FACTORY_TIERS){const f=prop(s,kind);assert.ok(FOOD[kind].growth>last);last=FOOD[kind].growth;
    p.mass=36;assert.equal(foodFits(p,f,0),false);assert.equal(canUnderpass(p,f,0),true);
    p.mass=12000;assert.equal(foodFits(p,f,0),true);const before=p.mass;foodReward(s,p,f);assert.equal(p.mass-before,FOOD[kind].growth);
  }
  s.food=[];for(let i=0;i<30;i++)spawnFactory(s);assert.ok(s.food.length<=EAT.factories.maxActive);assert.ok(s.food.length>0);
});
test('Candy conveyor direction changes movement and carries loose treats',()=>{
  const s=scene('candy'),p=s.players[0];Object.assign(p,{x:1000,y:775,input:{x:0,y:0}});const f=prop(s,'candyMint',{x:1350,y:775});
  const start=p.x;movePlayer(s,p,p.input,1/30);assert.equal(p.x-start,75/30);
  const at=f.x;stepGame(s);assert.ok(f.x>at);assert.equal(surfaceAt('city',p).x,0);
});
test('Frozen retains momentum only on marked shortcuts; snow gives reliable grip',()=>{
  const ice=scene('frozen'),snow=scene('frozen'),plain=scene('frozen');
  const a=ice.players[0],b=snow.players[0],c=plain.players[0];Object.assign(a,{x:1000,y:750,vx:150});Object.assign(b,{x:1000,y:960,vx:150});Object.assign(c,{x:1000,y:1400,vx:150});
  for(let i=0;i<15;i++)for(const [s,p] of [[ice,a],[snow,b],[plain,c]])movePlayer(s,p,{x:0,y:0},1/30);
  assert.ok(a.vx>c.vx*5);assert.ok(b.vx<c.vx);assert.equal(SURFACES.frozen.filter(p=>p.kind==='ice').length,3);
  ice.phase='hell';assert.equal(surfaceAt('frozen',a).drag,.16);const before=a.vx;movePlayer(ice,a,{x:0,y:0},1/30);assert.ok(a.vx<before*.9);
});
test('Nature fish follow a deterministic water-to-bank arc and become normal edible food',()=>{
  const s=scene('nature');s.feast={nextAt:1,wave:0};s.time=1;stepWorld(s,1/30);
  const fish=s.food.filter(f=>f.kind==='fish');assert.equal(fish.length,10);assert.equal(s.feast.nextAt,19);
  s.time=1.6;for(const f of fish){assert.equal(stepLeap(s,f),true);assert.ok(f.z>90);}
  s.time=2.3;for(const f of fish){assert.equal(stepLeap(s,f),false);assert.equal(f.z,0);assert.ok(validPosition('nature',f,FOOD.fish.radius));assert.equal(f.leap,undefined);}
  s.time=18;stepWorld(s,1/30);assert.equal(s.food.filter(f=>f.kind==='fish').length,0);
});
test('world timers, moving prey and scheduled treats survive JSON snapshots deterministically',()=>{
  for(const map of ['city','nature','candy','frozen']){
    const s=scene(map);s.nextHumans=0;s.nextFactory=0;s.feast={nextAt:0,wave:0};stepGame(s);
    const clone=JSON.parse(JSON.stringify(s));ticks(s,45);ticks(clone,45);assert.deepEqual(s,clone);
  }
});
test('Hell is still a fresh showdown and never spawns normal-map encounters',()=>{
  const s=scene('candy');s.settings.hellEnabled=true;s.players[0].mass=8000;s.nextHumans=0;s.nextFactory=0;s.feast={nextAt:0,wave:0};stepWorld(s,1/30);
  startHell(s);assert.ok(s.players.every(p=>p.mass===EAT.player.startingMass));assert.equal(s.food.length,0);stepWorld(s,1/30);assert.equal(s.food.length,0);
});
test('devourability respects shields and unavailable characters',()=>{
  const s=scene(),[a,b]=s.players;a.mass=1000;assert.equal(playerFits(a,b,0),true);b.effects.shield=15;assert.equal(playerFits(a,b,0),false);b.effects.shield=0;b.alive=false;assert.equal(playerFits(a,b,0),false);
});
test('crowded escape landing always releases immunity after bounded retries',()=>{
  const s=scene(),p=s.players[0];p.escape={kind:'pigeon',startedAt:0,endsAt:0,origin:{...p},animalOrigin:{...p},destination:{...p},path:[],pathIndex:0,hell:false,gapDistance:0};
  prop(s,'apartment',{x:p.x,y:p.y});s.players[1].mass=1e8;s.players[1].x=2000;s.players[1].y=1500;
  for(let i=0;i<100&&p.escape;i++){s.time+=1/30;stepEscape(s,p,1/30);}
  assert.equal(p.escape,undefined);assert.ok(validPosition(s.map,p,playerRadius(p,s.time)));
});
test('new prey, factories, candy and power-ups have real reusable 3D silhouettes',()=>{
  const library=new ModelLibrary();for(const kind of ['human','fish',...FACTORY_TIERS,'candyMint','chocolate','jelly','snowCone','iceCrystal']){
    const group=library.prop(kind),box=new T.Box3().setFromObject(group);assert.ok(group.children.length>1,kind);assert.ok(Number.isFinite(box.max.y));assert.ok(box.max.y-box.min.y>2);
  }
  for(const kind of ['speed','shield','magnet','multiplier','divider','jump','strike'])assert.ok(library.power(kind).children.length>=3);library.dispose();
});

test('bots leave hidden car passengers alone and forage reachable food instead',()=>{
  const s=scene(),p=s.players[0];p.bot=true;s.settings.botDifficulty='hard';
  const car=prop(s,'car',{x:1200,y:1400}),f=prop(s,'human',{x:1200,y:1400});f.citizen={carId:car.id,nextTurn:0,direction:0};car.driverId=f.id;
  prop(s,'apple',{x:800,y:1400});const input=botInput(s,p);assert.equal(p.botState,'FORAGE');assert.ok(input.x<0);
});

test('crowds use their own lifetime and never disappear mid-chase as old sky drops',()=>{
  const s=scene(),f=prop(s,'human');f.citizen={nextTurn:0,direction:0};f.spawnedAt=0;f.expiresAt=90;
  s.time=50;updateSpawns(s);assert.ok(s.food.includes(f));
  s.time=91;stepWorld(s,1/30);assert.ok(s.food.includes(f));
  s.players.forEach(p=>{p.x=100;p.y=100});stepWorld(s,1/30);assert.equal(s.food.includes(f),false);
});
