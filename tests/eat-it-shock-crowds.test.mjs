import test from 'node:test';
import assert from 'node:assert/strict';
import { EAT, FOOD } from '../src/games/eat-it/config.ts';
import { createGame, stepGame, collectPower, eliminate } from '../src/games/eat-it/engine.ts';
import { activateAbility, abilityAvailable, canStorePower } from '../src/games/eat-it/abilities.ts';
import { stepShockShots } from '../src/games/eat-it/shock.ts';
import { stepWorld, spawnHumans } from '../src/games/eat-it/world.ts';
import { stepEncounter } from '../src/games/eat-it/quests.ts';
import { updateSpawns } from '../src/games/eat-it/spawn.ts';
import { applyRoomAction } from '../src/games/eat-it/authority.ts';
import { ModelLibrary } from '../src/games/eat-it/models.ts';
import { startHell } from '../src/games/eat-it/hell.ts';
const participants=[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}];
function scene(map='candy') {
 const s=createGame(map,participants,981,'shock-test',{mode:'solo',livesEnabled:false,hellEnabled:false,animalsEnabled:false});
 s.food=[];s.powerups=[];s.nextFood=s.nextBig=s.nextFactory=s.nextHumans=s.nextPower=1e9;delete s.feast;delete s.candyCoins;
 s.players.forEach((p,i)=>Object.assign(p,{x:1000+i*200,y:1400,mass:100,facing:0,input:{x:0,y:0}}));return s;
}
function pickup(s,p=s.players[0]) {const item={id:s.nextId++,kind:'shock',x:p.x,y:p.y};s.powerups.push(item);collectPower(s,p,item);return item;}
test('Shock grants exactly three charges, cannot refill a held weapon, and has a ten-second shot cooldown',()=>{
 const s=scene(),p=s.players[0];pickup(s);assert.equal(p.shockAmmo,3);assert.equal(canStorePower(s,p,'shock'),false);
 const extra=pickup(s);assert.equal(p.shockAmmo,3);assert.ok(s.powerups.includes(extra));
 for(let i=0;i<3;i++){s.time=i*10;assert.ok(activateAbility(s,p,'shock'));assert.equal(p.shockAmmo,2-i);assert.equal(activateAbility(s,p,'shock'),false);s.time+=9.999;assert.equal(abilityAvailable(s,p,'shock'),false);}
 s.time=30;assert.equal(activateAbility(s,p,'shock'),false);assert.equal(s.shockShots.length,3);
});
test('a swept bolt hits the first intersected rival once, regardless of player order, removing 20% growth',()=>{
 const s=scene(),[p,near,far]=s.players;near.mass=1000;far.mass=1000;s.players=[p,far,near];pickup(s);activateAbility(s,p,'shock');
 stepShockShots(s,1);assert.equal(near.mass,800);assert.equal(far.mass,1000);assert.equal(s.shockShots.length,0);
 stepShockShots(s,1);assert.equal(near.mass,800);assert.equal(s.events.filter(e=>e.type==='shockHit').length,1);
});
test('missed bolts expire; jumping/escaping/dead rivals cannot be hit; mass never falls below its floor',()=>{
 for(const unavailable of [p=>p.alive=false,p=>p.escape={},p=>p.ability={kind:'jump'}]){
  const s=scene(),p=s.players[0];s.players[2].y+=1000;unavailable(s.players[1]);pickup(s);activateAbility(s,p,'shock');stepShockShots(s,1);assert.equal(s.players[1].mass,100);assert.equal(s.shockShots.length,0);
 }
 const s=scene();s.players[1].mass=12;s.players[2].y+=1000;pickup(s);activateAbility(s,s.players[0],'shock');stepShockShots(s,1);assert.equal(s.players[1].mass,EAT.player.minMass);
});
test('bolts cross props but stop at the Nature river instead of hitting through water',()=>{
 const s=scene('nature'),p=s.players[0],v=s.players[1];Object.assign(p,{x:2500,y:500});Object.assign(v,{x:2820,y:500});s.players[2].y=1400;
 pickup(s);activateAbility(s,p,'shock');stepShockShots(s,1);assert.equal(v.mass,100);assert.equal(s.shockShots.length,0);
});
test('shock charges cannot fire in blocked states and death/Hell transition clear the held weapon',()=>{
 const s=scene(),p=s.players[0];pickup(s);s.phase='hell';assert.equal(activateAbility(s,p,'shock'),false);assert.equal(canStorePower(s,p,'shock'),false);s.phase='normal';
 for(const field of ['stunnedUntil','chokingUntil']) {p[field]=10;assert.equal(activateAbility(s,p,'shock'),false);p[field]=0;}
 activateAbility(s,p,'shock');eliminate(s,p);assert.equal(p.shockAmmo,0);assert.equal(s.shockShots.length,0);
 const final=scene();final.settings.hellEnabled=true;pickup(final);activateAbility(final,final.players[0],'shock');startHell(final);
 assert.equal(final.phase,'transition');assert.equal(final.players[0].shockAmmo,0);assert.equal(final.players[0].nextShockAt,undefined);assert.equal(final.shockShots.length,0);
});
test('room authority ignores forged damage/ammo and replayed fire intents cannot bypass cooldown',()=>{
 const s=scene(),p=s.players[0];pickup(s);const room={game_state:s,status:'playing',players:participants.map(p=>({...p,ready:true,lastSeen:1000})),host_id:'a',last_tick:1000};
 for(let i=0;i<4;i++)applyRoomAction(room,'a','A',{op:'shock',playerId:'b',shockAmmo:99,loss:1,targetId:'b'},1000,1,'match');
 assert.equal(p.shockAmmo,2);assert.equal(s.shockShots.length,1);assert.equal(s.players[1].mass,100);assert.equal(s.players[1].shockAmmo,undefined);
 const clone=JSON.parse(JSON.stringify(s));for(let i=0;i<30;i++){stepGame(s);stepGame(clone);}assert.deepEqual(s,clone);assert.ok(s.players[1].mass<100);
});
test('rare Shock rolls have a 1% weight, wait before first eligibility, obey a two-minute spawn cooldown and one-active cap',()=>{
 assert.equal(EAT.powerups.shock.weight,1);assert.equal(EAT.powerups.shock.cooldown,120);const s=scene();
 // Exercise normal weighted spawning repeatedly, retaining authority's actual RNG.
 let spawned=0,last=-Infinity;
 for(let i=0;i<10000;i++){s.time=i*2;s.nextPower=0;s.powerups=[];updateSpawns(s);if(s.powerups[0]?.kind==='shock'){assert.ok(s.time>=30);assert.ok(s.time-last>=120);last=s.time;spawned++;}}
 assert.ok(spawned>5&&spawned<200,`${spawned}`);
 const held={id:s.nextId++,kind:'shock',x:800,y:800};
 for(let i=0;i<2000;i++){s.time+=2;s.nextPower=0;s.nextRare.shock=0;s.powerups=[held];updateSpawns(s);assert.equal(s.powerups.filter(p=>p.kind==='shock').length,1);}
 const material=new ModelLibrary();assert.ok(material.power('shock').children.length>=3);material.dispose();
});
test('City starts with two separated 30-person crowds, waits at rest, flees together, and remains capped at sixty',()=>{
 const s=createGame('city',participants,781,'crowds',{mode:'solo',animalsEnabled:false,hellEnabled:false});const humans=s.food.filter(f=>f.kind==='human');assert.equal(humans.length,60);
 const groups=[0,1].map(id=>humans.filter(f=>f.citizen.crowdId===id));groups.forEach(group=>assert.equal(group.length,30));
 const center=group=>({x:group.reduce((n,f)=>n+f.x,0)/30,y:group.reduce((n,f)=>n+f.y,0)/30});const [a,b]=groups.map(center);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>900);
 s.food=humans;s.players.forEach(p=>Object.assign(p,{x:3900,y:100}));s.nextHumans=1e9;delete s.feast;stepWorld(s,1/30);assert.ok(humans.every(f=>f.vx===0&&f.vy===0));
 Object.assign(s.players[0],{x:a.x-180,y:a.y});stepWorld(s,1/30);assert.ok(groups[0].every(f=>Math.hypot(f.vx,f.vy)>80));assert.ok(groups[1].every(f=>f.vx===0&&f.vy===0));
 for(let i=0;i<10;i++)assert.equal(spawnHumans(s),false);assert.equal(s.food.length,60);
 s.food=s.food.filter(f=>f.citizen.crowdId!==0);assert.ok(spawnHumans(s));assert.equal(s.food.filter(f=>f.citizen.crowdId===0).length,30);
});
test('a swallowed human awards exactly 100 score and 50 base growth',()=>{
 const s=scene(),p=s.players[0];p.mass=36;s.food=[{id:s.nextId++,kind:'human',x:p.x+2,y:p.y,vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0}];
 for(let i=0;i<45;i++)stepGame(s);assert.equal(p.foodEaten,1);assert.equal(p.score,100);assert.equal(p.mass,86);assert.equal(FOOD.human.score,100);
});
test('animal devours and friendly feeds use the increased base rewards',()=>{
 for(const kind of ['pigeon','cat']){
  const s=scene(),p=s.players[0];s.settings.animalsEnabled=true;s.encounter={shrine:null,completedBy:null,item:{kind:'scroll',home:{x:0,y:0},x:0,y:0,status:'ground',ownerId:null},npc:{kind,phase:'swallowing',since:0,until:0,targetId:p.id,x:p.x,y:p.y,facing:0,origin:{x:p.x,y:p.y},destination:{x:p.x,y:p.y},nextAction:0,actionAt:0,attacks:0,feeds:0}};
  const before=p.mass;stepEncounter(s,1/30);assert.equal(p.mass-before,kind==='pigeon'?80:120);
  Object.assign(s.encounter.npc,{phase:'friendly',until:60,nextAction:0});stepEncounter(s,1/30);assert.equal(s.food[0].rewardGrowth,30);
 }
});
