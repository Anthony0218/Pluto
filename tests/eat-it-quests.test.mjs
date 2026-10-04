import test from 'node:test';
import assert from 'node:assert/strict';
import { EAT, FOOD, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, stepGame, eliminate, checkWinner, fillBots } from '../src/games/eat-it/engine.ts';
import { foodFits, canopyFits, eyeProportion, isChoking, MOUTH } from '../src/games/eat-it/rules.ts';
import { QUEST, handPose, npcCanEnter, questAlert, stepEncounter, resolveShrine } from '../src/games/eat-it/quests.ts';
import { distance, validPosition } from '../src/games/eat-it/maps.ts';
import { advanceRoom } from '../src/games/eat-it/authority.ts';
import { SnapshotBuffer } from '../src/games/eat-it/presentation.ts';

function scene(map='city') {
 const s=createGame(map,[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],99,'quests',{livesEnabled:false});
 s.food=[];s.powerups=[];s.nextFactory=s.nextHumans=1e9;delete s.feast;s.nextFood=1e6;s.nextPower=1e6;s.nextBig=1e9;
 const p=s.players[0];Object.assign(p,{x:1000,y:1100,facing:0});
 Object.assign(s.players[1],{x:2800,y:2000});Object.assign(s.players[2],{x:2700,y:400});
 const e=s.encounter;e.shrine=null;Object.assign(e.npc,{x:1450,y:1100,phase:'idle',until:100});
 Object.assign(e.item,{x:1060,y:1100,home:{x:1060,y:1100}});
 return {s,p,e,n:e.npc};
}
const advance=(s,seconds)=>{for(let i=0;i<Math.round(seconds*30);i++)stepGame(s);};
const prop=(s,kind,p)=>{const f={id:s.nextId++,kind,x:p.x+5,y:p.y,vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0};s.food.push(f);return f;};
function help(s,p,e) {
 stepEncounter(s,1/30);assert.equal(e.item.ownerId,p.id);
 Object.assign(e.npc,{x:p.x+60,y:p.y});stepEncounter(s,1/30);
 assert.equal(e.npc.phase,'friendly');assert.equal(e.item.status,'delivered');
}
test('tree trunk enters, oversized canopy chokes, ejects without reward and locks movement for the choke duration',()=>{
 const {s,p}=scene();const f=prop(s,'tree',p);
 assert.ok(foodFits(p,f));assert.equal(canopyFits(p,f),false);
 stepGame(s);assert.equal(f.target,p.id);assert.ok(f.z<0);
 while(!isChoking(p,s.time))stepGame(s);
 const start=s.time, at={x:p.x,y:p.y};assert.equal(p.chokingUntil,start+EAT.eating.chokeDuration);assert.equal(f.target,null);assert.equal(f.stuck.playerId,p.id);assert.ok(f.z<0);
 assert.ok(distance(f,p)<playerRadius(p,s.time));assert.equal(p.mass,36);assert.equal(p.foodEaten,0);
 p.input={x:1,y:0};advance(s,EAT.eating.chokeDuration-.1);assert.deepEqual({x:p.x,y:p.y},at);assert.equal(p.mass,36);
 advance(s,.2);assert.ok(p.x>at.x);assert.equal(s.food.length,1);
});
test('large mouth eats complete tree and a bare trunk is a normal consumable',()=>{
 for(const kind of ['tree','treeTrunk','smallTree','bush']) {const {s,p}=scene();p.mass=1200;prop(s,kind,p);advance(s,2.3);assert.equal(p.foodEaten,1,kind);assert.equal(isChoking(p,s.time),false);}
});
test('oversized finite-mass props resist prolonged small-player contact, then become edible',()=>{
 for(const kind of ['bench','car','house','vendingMachine','treeTrunk']) {
  const {s,p}=scene();const f=prop(s,kind,p);f.x=p.x+FOOD[kind].width/2+playerRadius(p,0)-2;
  const start={x:f.x,y:f.y};p.input={x:1,y:0};advance(s,3);
  assert.ok(distance(f,start)<.3,kind);assert.equal(f.target,null);assert.equal(p.foodEaten,0);
  p.mass=2000;p.x=f.x;p.y=f.y;p.input={x:0,y:0};p.vx=0;advance(s,2.3);assert.equal(p.foodEaten,1,kind);
 }
});
for(const map of ['city','nature']) {
 test(`${map}: expanded map spawns safe quest, NPC, density and eight players`,()=>{
  const s=createGame(map,fillBots([],8),56),e=s.encounter;
  assert.equal(EAT.match.width,4000);assert.equal(EAT.match.height,3040);assert.ok(s.food.length>=500);
  assert.ok(validPosition(map,e.npc,22));assert.ok(s.food.every(f=>distance(f,e.npc)>FOOD[f.kind].radius+22));assert.ok(s.players.every(p=>distance(p,e.npc)>100));
  assert.ok(s.players.every(p=>distance(p,e.item.home)>150));
  assert.equal(e.item.kind,map==='city'?'scroll':'catTree');
  assert.ok(new Set(s.food.map(f=>Math.floor(f.x/(EAT.match.width/4)))).size===4);
  if(e.shrine) {assert.ok(s.food.every(f=>distance(f,e.shrine)>FOOD[f.kind].radius+100));const p={...e.shrine};resolveShrine(s,p,24);assert.ok(distance(p,e.shrine)>=QUEST.shrineRadius+24);}
 });
 test(`${map}: wander state varies naturally, pigeon flies and cat runs without flight`,()=>{
  const {s,n}=scene(map);s.rng=56;n.until=0;const start={x:n.x,y:n.y},phases=new Set();
  for(let i=0;i<1800;i++){s.time+=1/30;stepEncounter(s,1/30);phases.add(n.phase);}
  assert.ok(distance(start,n)>20);assert.ok(phases.has('idle'));assert.ok(phases.has('wandering'));
  assert.ok(phases.has(map==='city'?'flying':'running'));if(map==='nature')assert.equal(phases.has('flying'),false);
 });
 test(`${map}: alert has proximity hysteresis; hand touch is required and item stays carried`,()=>{
  const {s,p,e,n}=scene(map);assert.equal(questAlert(s,p),false);n.x=p.x+200;assert.equal(questAlert(s,p),true);
  n.x=p.x+playerRadius(p,0)+QUEST.alertRadius+15;assert.equal(questAlert(s,p),false);assert.equal(questAlert(s,p,true),true);
  e.item.x=p.x;e.item.y=p.y;stepEncounter(s,1/30);assert.equal(e.item.status,'ground','body overlap never collects');
  e.item.x=p.x+60;const hand=handPose(p,s);assert.ok(distance(hand.tip,e.item)<13);stepEncounter(s,1/30);assert.equal(e.item.ownerId,p.id);
  p.x+=100;p.facing=1.4;stepEncounter(s,1/30);assert.deepEqual({x:e.item.x,y:e.item.y},handPose(p,s).tip);
  assert.ok(distance(p,e.item)>playerRadius(p,0));assert.equal(s.food.length,0);
 });
 test(`${map}: handover is exclusive, rewards are discrete food and expire after 60 seconds`,()=>{
  const {s,p,e,n}=scene(map);help(s,p,e);assert.equal(n.until,60);assert.equal(e.completedBy,p.id);assert.equal(npcCanEnter(s,p),false);
  advance(s,3.8);assert.equal(p.mass,36);advance(s,2);assert.equal(p.mass,66);assert.equal(n.feeds,1);assert.equal(p.foodEaten,1);
  advance(s,54.3);assert.equal(n.phase,'leaving');assert.equal(n.feeds,14);assert.equal(p.foodEaten,14);assert.equal(p.mass,456);
  advance(s,2);assert.equal(n.feeds,14);assert.equal(n.targetId,null);
 });
 test(`${map}: ground NPC swallows, waits two seconds, emerges and attacks four times with half-second stuns then leaves`,()=>{
  const {s,p,e,n}=scene(map);p.mass=144;Object.assign(n,{x:p.x+10,y:p.y});
  if(map==='city'){n.phase='flying';assert.equal(npcCanEnter(s,p),false);n.phase='idle';}
  assert.equal(npcCanEnter(s,p),true);stepEncounter(s,1/30);assert.equal(n.phase,'swallowing');
  s.time=.49;stepEncounter(s,1/30);assert.equal(n.phase,'devoured');const until=n.until;
  s.time=until-.01;stepEncounter(s,1/30);assert.equal(n.phase,'devoured');
  s.time=until+.001;stepEncounter(s,1/30);assert.equal(n.phase,'emerging');assert.ok(s.events.some(ev=>ev.type==='npcEmerge'));
  s.time=n.until+.001;stepEncounter(s,1/30);assert.equal(n.phase,'hostile');const began=s.time;
  for(let attack=1;attack<=4;attack++){
   s.time=began+attack*5;Object.assign(n,{x:p.x+10,y:p.y});const mass=p.mass;
   stepEncounter(s,1/30);assert.equal(p.mass,mass);assert.equal(p.stunnedUntil,s.time+.5);const after=p.mass;stepEncounter(s,1/30);assert.equal(p.mass,after,'no replayed hit');
  }
  assert.equal(n.attacks,4);assert.equal(n.phase,'leaving');assert.ok(p.mass>=EAT.player.minMass);assert.equal(e.item.status,'removed');
 });
}
test('choking prevents quest pickup and handover while revenge attacks remain possible',()=>{
 const {s,p,e,n}=scene();p.chokingUntil=3;stepEncounter(s,1/30);assert.equal(e.item.status,'ground');
 p.chokingUntil=0;stepEncounter(s,1/30);p.chokingUntil=3;n.x=p.x+60;stepEncounter(s,1/30);assert.equal(n.phase,'idle');
 Object.assign(n,{phase:'hostile',targetId:p.id,until:30,nextAction:0});stepEncounter(s,1/30);assert.equal(p.mass,36);assert.equal(p.stunnedUntil,s.time+.5);
 p.mass=12;n.nextAction=0;stepEncounter(s,1/30);assert.equal(p.mass,12);
});
test('two simultaneous hands reserve exactly one item, disconnect drops it at reserved home',()=>{
 const {s,p,e}=scene();Object.assign(s.players[1],{x:p.x,y:p.y,facing:p.facing});stepEncounter(s,1/30);
 assert.equal(e.item.ownerId,'a');assert.equal(s.events.filter(ev=>ev.type==='questPickup').length,1);
 eliminate(s,p);assert.equal(e.item.ownerId,null);assert.equal(e.item.status,'ground');assert.equal(e.item.x,e.item.home.x);
});
test('disconnect authority clears carrier and death/match completion ends NPC timers',()=>{
 const {s,p,e,n}=scene();stepEncounter(s,1/30);
 const room={game_state:s,status:'playing',players:[{id:'a',name:'A',lastSeen:0}],host_id:'a',last_tick:0};
 advanceRoom(room,21000);assert.equal(p.alive,false);assert.equal(e.item.ownerId,null);assert.equal(e.item.status,'ground');
 n.phase='hostile';n.targetId='b';eliminate(s,s.players[1]);assert.equal(n.phase,'leaving');assert.equal(n.targetId,null);
 checkWinner(s);assert.equal(s.status,'finished');assert.equal(e.item.status,'removed');
});
test('JSON reconnect and two replicas agree on ownership, timers, feeds and attacks',()=>{
 const {s,p,e}=scene();help(s,p,e);advance(s,5);const replica=JSON.parse(JSON.stringify(s));
 for(let i=0;i<1200;i++){stepGame(s);stepGame(replica);}assert.deepEqual(s,replica);
 const a=scene();Object.assign(a.n,{phase:'hostile',since:0,until:30,targetId:a.p.id,nextAction:10,x:a.p.x,y:a.p.y});
 const b=JSON.parse(JSON.stringify(a.s));for(let i=0;i<930;i++){stepGame(a.s);stepGame(b);}assert.deepEqual(a.s,b);assert.equal(a.n.phase,'gone');
});
test('snapshot NPC transforms interpolate but never advance attacks or reward counters',()=>{
 const {s}=scene();const b=structuredClone(s);b.time=.1;b.encounter.npc.x+=100;
 const buffer=new SnapshotBuffer();buffer.push(s,1000);buffer.push(b,1100);const rendered=buffer.sample(1170,'a',{x:0,y:0});
 assert.equal(rendered.encounter.npc.x,s.encounter.npc.x+50);assert.equal(rendered.encounter.npc.attacks,0);assert.equal(rendered.players[0].mass,36);
});
test('cute eyes scale down gradually while remaining visible and smaller than mouth',()=>{
 const radii=[14,24,48,100,240], proportions=radii.map(eyeProportion);
 assert.ok(proportions[1]>.18);assert.ok(proportions.at(-1)>.1);
 for(let i=1;i<radii.length;i++)assert.ok(proportions[i]<proportions[i-1]);
 for(const proportion of proportions)assert.ok(proportion*2<MOUTH.radius);
});

test('eight-bot stress runs bound objects and remain finite through carrying, friendly and hostile states',t=>{
 for(const map of ['city','nature'])for(const phase of ['carried','friendly','hostile']){
  const s=createGame(map,fillBots([],8),177),p=s.players[0],e=s.encounter,n=e.npc;
  // Shield isolates NPC load from premature player elimination; NPC hits still apply.
  p.effects.shield=60;
  if(phase==='carried'){e.item.status='carried';e.item.ownerId=p.id;}
  else Object.assign(n,{phase,targetId:p.id,until:30,nextAction:phase==='friendly'?4:10,x:p.x+50,y:p.y});
  const start=performance.now();
  for(let i=0;i<1050&&s.status==='playing';i++){
   stepGame(s);assert.ok(s.food.length<=EAT.food.maxObjects);assert.ok(s.events.length<=80);
   assert.ok(s.players.every(p=>[p.x,p.y,p.mass,p.vx,p.vy].every(Number.isFinite)));
   assert.ok(s.food.every(f=>[f.x,f.y,f.z,f.vx,f.vy].every(Number.isFinite)));
   assert.ok([n.x,n.y,n.until,n.nextAction].every(Number.isFinite));
  }
  if(phase!=='carried'){assert.equal(n.phase,'gone');assert.equal(n.targetId,null);assert.equal(n.nextAction,0);}
  t.diagnostic(`${map}/${phase}: ${((performance.now()-start)/1050).toFixed(2)} ms/tick including assertions`);
 }
});
