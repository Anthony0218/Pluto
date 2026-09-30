import test from 'node:test';
import assert from 'node:assert/strict';
import { EAT, FOOD, POWER_KINDS, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, collectPower, stepGame, movePlayer, eliminate } from '../src/games/eat-it/engine.ts';
import { activateGrowth, foodReward, grantGrowth, liveLeaders, matchSettings, respawn } from '../src/games/eat-it/progression.ts';
import { startHell, stepHell, stepEruptions, spawnHellSpeed, safeGround, cellIndex, cellCenter, sweepPoint, sweepPath, hellBotInput } from '../src/games/eat-it/hell.ts';
import { botInput } from '../src/games/eat-it/bots.ts';
import { updateSpawns } from '../src/games/eat-it/spawn.ts';
import { applyRoomAction, parseSettings } from '../src/games/eat-it/authority.ts';
import { stepEncounter, QUEST } from '../src/games/eat-it/quests.ts';
import { readFileSync } from 'node:fs';
function scene(options={}) {
 const s=createGame('city',[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],937,'balance',{mode:'solo',...options});
 s.food=[];s.powerups=[];s.nextFood=s.nextPower=s.nextPluto=1e9;
 s.players.forEach((p,i)=>Object.assign(p,{x:1100+i*600,y:800}));return s;
}
function pickup(s,kind,p=s.players[0]) { const item={id:s.nextId++,kind,x:p.x,y:p.y};s.powerups.push(item);collectPower(s,p,item);return item; }
function ticks(s,n) { for(let i=0;i<n;i++)stepGame(s); }
const apple=p=>({kind:'apple',id:999,x:p.x,y:p.y,vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0});
test('2/10/20-minute settings persist through validation and authority; 10 is default',()=>{
 assert.equal(matchSettings().matchDuration,600);
 for(const duration of [120,600,1200])for(const hellEnabled of [true,false]) {
  const s=scene({matchDuration:duration,hellEnabled});s.time=duration-1/60;stepGame(s);
  assert.equal(hellEnabled?s.phase:s.status,hellEnabled?'transition':'finished');
  assert.equal(parseSettings({map:'city',count:3,matchDuration:duration}).matchDuration,duration);
 }
 for(const duration of [0,-2,180,'120',NaN,Infinity])assert.equal(matchSettings({matchDuration:duration}).matchDuration,600);
});
test('shield 30s and magnet/speed 15s use exact simulation deadlines',()=>{
 for(const [kind,duration] of [['shield',30],['magnet',15],['speed',15]]){
  const s=scene(),p=s.players[0];s.time=10;pickup(s,kind);assert.equal(p.effects[kind],10+duration);
  s.time=10+duration-.001;assert.ok(p.effects[kind]>s.time);s.time=10+duration;assert.ok(!(p.effects[kind]>s.time));
  if(kind==='speed'){p.input={x:1,y:0};ticks(s,30);assert.ok(Math.hypot(p.vx,p.vy)<=EAT.player.baseSpeed+.001);}
 }
});
test('stored 2x needs manual activation; duplicate remains for another player; expiration keeps all growth',()=>{
 const s=scene(),p=s.players[0];pickup(s,'multiplier');assert.equal(p.storedGrowth,true);assert.equal(p.effects.multiplier,0);assert.equal(p.mass,36);
 const duplicate=pickup(s,'multiplier');assert.ok(s.powerups.includes(duplicate));assert.equal(p.powerupsCollected,1);
 assert.equal(activateGrowth(s,p),true);assert.equal(p.effects.multiplier,20);assert.equal(p.storedGrowth,false);
 assert.equal(activateGrowth(s,p),false);grantGrowth(s,p,50);assert.equal(p.mass,136);assert.equal(s.events.at(-1).amount,100);
 s.time=20;assert.equal(p.mass,136);grantGrowth(s,p,10);assert.equal(p.mass,146);assert.equal(p.stats.growthActivations,1);
 collectPower(s,s.players[1],duplicate);assert.equal(s.players[1].storedGrowth,true);
});
test('/2 is immediate, nonstacking, preserves mass, composes with 2x, resets on respawn',()=>{
 const s=scene(),p=s.players[0];p.mass=200;pickup(s,'divider');pickup(s,'divider');assert.equal(p.mass,200);assert.equal(p.growthModifier,.5);
 grantGrowth(s,p,30);assert.equal(p.mass,215);assert.equal(s.events.at(-1).amount,15);
 pickup(s,'multiplier');activateGrowth(s,p);grantGrowth(s,p,30);assert.equal(p.mass,245);assert.equal(s.events.at(-1).amount,30);
 s.time=20;grantGrowth(s,p,30);assert.equal(p.mass,260);eliminate(s,p);s.time=p.respawnAt;assert.ok(respawn(s,p));assert.equal(p.growthModifier,1);assert.equal(p.mass,36);
});
test('food, buildings, Pluto, friendly food, neutral animals and player rewards use the same modifiers',()=>{
 for(const kind of ['apple','house','plutoTiny']){
  const s=scene(),p=s.players[0];pickup(s,'multiplier');activateGrowth(s,p);const before=p.mass;
  foodReward(s,p,{...apple(p),kind});const base=FOOD[kind].growth*(kind==='plutoTiny'?2:1);
  assert.equal(p.mass-before,base*2);assert.equal(s.events.at(-1).amount,base*2);assert.equal(p.stats.collected[kind],1);
 }
 const s=scene(),p=s.players[0];pickup(s,'multiplier');activateGrowth(s,p);foodReward(s,p,{...apple(p),rewardOwner:p.id,rewardMultiplier:3});assert.equal(p.stats.friendlyGrowth,30);
 const before=p.mass;eliminate(s,s.players[1],p);assert.ok(Math.abs(p.mass-before-36*.7*2)<1e-9);assert.equal(p.stats.collected.player,1);
 Object.assign(s.encounter.npc,{phase:'swallowing',targetId:p.id,until:s.time});const mass=p.mass;stepEncounter(s,1/30);assert.equal(p.mass-mass,16);
});
test('rare item weights, caps and cooldowns are deterministic, without initial rare items',()=>{
 const s=scene();assert.ok(!createGame('city',[{id:'a',name:'A'},{id:'b',name:'B'}],2).powerups.some(p=>['multiplier','divider'].includes(p.kind)));
 const spawned={multiplier:[],divider:[]};
 for(let i=1;i<=1800;i++){
  s.time=i*5;s.nextPower=0;s.powerups=[];updateSpawns(s);
  for(const item of s.powerups)if(item.kind in spawned)spawned[item.kind].push(s.time);
 }
 for(const kind of ['multiplier','divider']){
  assert.ok(spawned[kind].length>2&&spawned[kind].length<75,`${kind}: ${spawned[kind].length}`);
  spawned[kind].slice(1).forEach((time,i)=>assert.ok(time-spawned[kind][i]>=EAT.powerups[kind].cooldown));
 }
 const replica=structuredClone(s);s.nextPower=replica.nextPower=0;updateSpawns(s);updateSpawns(replica);assert.deepEqual(s,replica);
});
test('authority accepts only the requesting member activation and ignores forged charge/timers',()=>{
 const s=scene(),p=s.players[0],room={game_state:s,status:'playing',players:[{id:'a',name:'A',ready:true,lastSeen:1000}],host_id:'a',last_tick:1000};
 applyRoomAction(room,'a','A',{op:'growth',storedGrowth:true,multiplier:999999},1000,1,'id');assert.equal(p.effects.multiplier,0);
 pickup(s,'multiplier');for(let i=0;i<3;i++)applyRoomAction(room,'a','A',{op:'growth',playerId:'b',duration:999},1000,1,'id');
 assert.equal(p.effects.multiplier,20);assert.equal(p.stats.growthActivations,1);assert.equal(s.players[1].effects.multiplier,0);
 assert.throws(()=>applyRoomAction(room,'intruder','X',{op:'growth'},1000,1,'id'));
});
test('bots use stored growth from visible opportunities with difficulty-specific timing',()=>{
 for(const difficulty of ['easy','medium','hard']){
  const s=scene({botDifficulty:difficulty}),p=s.players[0];pickup(s,'multiplier');botInput(s,p);
  assert.equal(p.effects.multiplier>0,difficulty==='easy');
  if(difficulty!=='easy'){for(let i=0;i<6;i++)s.food.push({...apple(p),id:i,x:p.x+50+i*10});botInput(s,p);assert.equal(p.effects.multiplier,20);}
 }
 const s=scene({botDifficulty:'hard'}),p=s.players[0];s.powerups=[{id:999,kind:'divider',x:p.x+50,y:p.y}];botInput(s,p);assert.notEqual(p.botState,'POWERUP');
 pickup(s,'divider');assert.equal(p.growthModifier,.5);
});
test('removed items are absent and old snapshots safely discard obsolete state',()=>{
 assert.deepEqual(POWER_KINDS,['speed','shield','magnet','multiplier','divider','jump','strike']);
 const s=scene(),p=s.players[0];p.effects.size=100;p.effects.growth=100;s.powerups=[{id:77,kind:'size',x:p.x,y:p.y},{id:78,kind:'growth',x:p.x,y:p.y}];stepGame(s);
 assert.equal(s.powerups.length,0);assert.equal('size' in p.effects,false);assert.equal('growth' in p.effects,false);assert.equal(playerRadius(p,s.time),24);
});
test('Hell has 3.086 times the floor area and consistent double-radius characters',()=>{
 const s=scene();startHell(s);assert.equal(s.hell.cells.length,864);assert.ok(864/280>3);
 assert.equal(EAT.hell.columns*EAT.hell.cellSize,2880);assert.equal(EAT.hell.rows*EAT.hell.cellSize,1920);
 for(const p of s.players){assert.equal(playerRadius(p,s.time),48);assert.ok(safeGround(s,p,48));}
});
test('Hell speed spawns only on reachable intact floor away from hole; uses 15s',()=>{
 const s=scene();startHell(s);s.time=s.hell.readyAt;s.nextPower=0;spawnHellSpeed(s);assert.equal(s.powerups.length,1);
 const item=s.powerups[0];assert.ok(safeGround(s,item,15));assert.ok(Math.hypot(item.x-s.hell.blackHole.x,item.y-s.hell.blackHole.y)>EAT.hell.radius+120);
 collectPower(s,s.players[0],item);assert.equal(s.players[0].effects.speed,s.time+15);
 s.hell.cells.fill(-1);s.nextPower=0;spawnHellSpeed(s);assert.equal(s.powerups.length,0);
});
test('eruptions warn for 2s then push once, never remove mass or automatically eliminate',()=>{
 const s=scene();startHell(s);s.time=s.hell.readyAt+30;stepEruptions(s);assert.ok(s.hell.eruptions.length>=1);const e=s.hell.eruptions[0],p=s.players[0];Object.assign(p,{x:e.x,y:e.y});
 stepEruptions(s);assert.equal(p.knockback,undefined);assert.ok(s.hell.nextEruption-s.time>=27&&s.hell.nextEruption-s.time<=33);
 s.time=e.eruptAt;stepEruptions(s);assert.ok(p.knockback);assert.equal(p.mass,36);assert.equal(p.alive,true);const until=p.knockback.until;stepEruptions(s);assert.equal(p.knockback.until,until);
 const before=p.x;movePlayer(s,p,{x:0,y:0},1/30);assert.notEqual(p.x,before);
 s.time=e.endsAt;stepEruptions(s);assert.ok(!s.hell.eruptions.includes(e));
});
test('locked sweeps cover all speed categories, rare curves, pauses and matching telegraphs',()=>{
 const categories=new Set();let curves=0,extremes=0,pauses=0;
 const s=scene();startHell(s);s.phase='hell';s.time=s.hell.readyAt;
 const b=s.hell.blackHole;
 for(let i=0;i<300;i++){
  s.hell.cells.fill(0);b.progress=1;b.warnUntil=s.time;b.pausedUntil=0;b.pauseUsed=true;stepHell(s,1/30);
  categories.add(b.speedCategory);if(b.control)curves++;if(b.speedCategory==='extreme'){extremes++;assert.ok(b.warnUntil-s.time>=2);}
  assert.deepEqual(sweepPoint(b,0),b.from);assert.deepEqual(sweepPoint(b,1),b.destination);
  const locked=JSON.stringify({from:b.from,destination:b.destination,control:b.control,speed:b.speed});
  s.time=b.warnUntil;b.progress=.2;b.pauseUsed=false;
  for(let j=0;j<20;j++){stepHell(s,1/30);s.time+=1/30;if(b.pausedUntil>s.time){pauses++;break;}if(b.progress>=.8)break;}
  if(b.progress<.8)assert.equal(JSON.stringify({from:b.from,destination:b.destination,control:b.control,speed:b.speed}),locked);
 }
 assert.equal(categories.size,4);assert.ok(curves>10&&curves<70);assert.ok(extremes>2&&extremes<35);assert.ok(pauses>0);
});
test('curved movement lies on preview and random pause holds dangerous floor position',()=>{
 const s=scene();startHell(s);s.time=s.hell.readyAt+5;s.phase='hell';const b=s.hell.blackHole;
 Object.assign(b,{from:cellCenter(0),destination:cellCenter(35),control:cellCenter(400),progress:.25,warnUntil:0,speed:300,pauseUsed:true,pausedUntil:s.time+1});Object.assign(b,sweepPoint(b,.25));
 const before={x:b.x,y:b.y};stepHell(s,1/30);assert.deepEqual({x:b.x,y:b.y},before);assert.ok(s.hell.cells.some(v=>v>0));
 s.time+=1;stepHell(s,1/30);assert.deepEqual({x:b.x,y:b.y},sweepPoint(b,b.progress));assert.equal(sweepPath(b).length,25);
});
test('Hell bot decisions do not use hidden random generator or future pauses/eruption timers',()=>{
 const s=scene({botDifficulty:'hard'});startHell(s);s.time=s.hell.readyAt;const copy=structuredClone(s);
 copy.rng=999;copy.hell.nextEruption+=100;copy.hell.blackHole.pausedUntil=999;copy.hell.blackHole.pauseUsed=true;
 assert.deepEqual(hellBotInput(s,s.players[0]),hellBotInput(copy,copy.players[0]));
 const p=s.players[0];s.hell.blackHole.warnUntil=0;const before=hellBotInput(s,p);
 s.hell.eruptions=[{id:999,x:p.x+before.x*95,y:p.y+before.y*95,warningAt:s.time,eruptAt:s.time+2,endsAt:s.time+3,hit:[]}];
 assert.notDeepEqual(hellBotInput(s,p),before);
});
test('friendly food starts at the animal and falls into the mouth through ordinary reward events',()=>{
 const s=scene(),p=s.players[0],n=s.encounter.npc;Object.assign(n,{phase:'friendly',since:0,until:30,targetId:p.id,nextAction:0,x:p.x+65,y:p.y});s.encounter.completedBy=p.id;
 stepEncounter(s,1/30);assert.equal(p.mass,36);assert.ok(s.food[0].delivery);ticks(s,8);assert.ok(s.food[0].x>p.x);assert.equal(p.mass,36);ticks(s,35);assert.equal(p.mass,51);assert.equal(p.stats.collected.apple,1);
});
test('hostile animals attack at 5/10/15/20s, stun for 1s and never shrink the victim',()=>{
 assert.equal(QUEST.hostileDuration,20);assert.equal(QUEST.attackInterval,5);assert.equal(QUEST.stunDuration,1);
 for(const kind of ['pigeon','cat']){
  const s=scene(),p=s.players[0],n=s.encounter.npc;Object.assign(n,{kind,phase:'hostile',since:0,until:20,targetId:p.id,nextAction:5});
  for(let i=1;i<=4;i++){
   s.time=i*5-.01;Object.assign(n,{x:p.x+10,y:p.y});stepEncounter(s,1/30);assert.equal(n.attacks,i-1);
   s.time=i*5;stepEncounter(s,1/30);assert.equal(n.attacks,i);assert.equal(p.stunnedUntil,s.time+1);assert.equal(p.mass,36);
   const before=p.x;movePlayer(s,p,{x:1,y:0},1/30);assert.equal(p.x,before);s.time+=1;movePlayer(s,p,{x:1,y:0},1/30);assert.ok(p.x>before);
  }
  assert.equal(n.phase,'leaving');s.time=21;stepEncounter(s,1/30);assert.equal(n.phase,'gone');assert.equal(n.targetId,null);assert.equal(n.nextAction,0);assert.equal(p.stats.hostileAttacks,4);
 }
});
test('live leaderboard uses displayed size then lives then neutral seat order',()=>{
 const s=scene(),[a,b,c]=s.players;a.mass=200;b.mass=200.1;c.mass=300;a.lives=2;b.lives=3;
 assert.deepEqual(liveLeaders(s.players).map(p=>p.id),['c','b','a']);grantGrowth(s,a,200);assert.equal(liveLeaders(s.players)[0].id,'a');
 pickup(s,'divider',a);assert.equal(liveLeaders(s.players)[0].id,'a');a.mass=b.mass;a.lives=b.lives;assert.ok(liveLeaders(s.players).indexOf(a)<liveLeaders(s.players).indexOf(b));
});
test('growth popups carry actual fractional deltas, expire and remain bounded',()=>{
 const s=scene(),p=s.players[0];p.mass=5000;pickup(s,'divider');const before=p.mass;foodReward(s,p,apple(p));assert.ok(Math.abs(s.events.at(-1).amount-(p.mass-before))<1e-9);
 for(let i=0;i<200;i++)grantGrowth(s,p,1);stepGame(s);assert.ok(s.events.length<=80);s.time+=2.1;stepGame(s);assert.equal(s.events.filter(e=>e.type==='growth').length,0);
});
test('new labels exist in English, German, Spanish and Portuguese and obsolete labels are retired',()=>{
 const translations=JSON.parse(readFileSync(new URL('../src/i18n/eatItTranslations.json',import.meta.url)));
 for(const lang of ['en','de','es','pt'])for(const key of ['2 min','10 min','20 min','USE 2x NOW','2x Growth Ready','Growth /2','Growth','Stunned','Objects collected','Total growth','apple'])assert.ok(translations[lang][key],`${lang}:${key}`);
 for(const strings of Object.values(translations)){assert.equal(strings['Temporary Size'],undefined);assert.equal(strings['Growth Boost'],undefined);}
});

test('final players falling on adjacent ticks share the no-survivor Hell tie',()=>{
 const s=scene();startHell(s);s.phase='hell';s.time=s.hell.readyAt;s.hell.blackHole.warnUntil=1e9;
 s.players[2].alive=false;s.players[2].lives=0;
 s.players[0].fallingAt=s.time-.74;s.players[1].fallingAt=s.time-.6;
 ticks(s,8);assert.equal(s.result,'tie');assert.deepEqual(s.tiedIds,['a','b']);assert.equal(s.players[0].placement,1);assert.equal(s.players[1].placement,1);
});
