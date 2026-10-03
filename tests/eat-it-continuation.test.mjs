import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { EAT, FOOD, playerRadius, massToRadius, cameraZoom } from '../src/games/eat-it/config.ts';
import { createGame, fillBots, stepGame, collectPower, eliminate, checkWinner } from '../src/games/eat-it/engine.ts';
import { matchSettings, foodReward, grantGrowth, activateGrowth, respawn, safePosition } from '../src/games/eat-it/progression.ts';
import { mouthOpening, mouthPosition, mouthEntryProgress, entersMouth, foodFits, consumptionDuration } from '../src/games/eat-it/rules.ts';
import { beginFall, fallPose } from '../src/games/eat-it/falling.ts';
import { stepEncounter } from '../src/games/eat-it/quests.ts';
import { citySlots, cityZone } from '../src/games/eat-it/cityLayout.ts';
import { updateSpawns, spawnFood } from '../src/games/eat-it/spawn.ts';
import { startHell, blackHoles, cellCenter, cellPhase, cellIndex, stepEruptions, stepHell, crackTile, supported, safeGround, nearbyLanding, hellBotInput, sweepPoint } from '../src/games/eat-it/hell.ts';
import { activateEscape } from '../src/games/eat-it/escape.ts';
import { HellVisuals } from '../src/games/eat-it/hellVisuals.ts';
import { readFileSync } from 'node:fs';
function scene(options={}) {const s=createGame('city',[{id:'a',name:'A'},{id:'b',name:'B'}],913,'regression',{mode:'solo',...options});s.food=[];s.powerups=[];s.nextFood=s.nextPower=s.nextPluto=1e9;delete s.encounter;s.players.forEach((p,i)=>Object.assign(p,{x:1500+i*1000,y:1500,facing:0}));return s;}
function solo(options={}) {return createGame('city',fillBots([{id:'a',name:'A'}],4),221,'solo',{mode:'solo',botsEnabled:false,...options});}
function prop(s,kind,p=s.players[0]) {const f={...p,id:s.nextId++,kind,x:p.x,y:p.y,vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0};s.food.push(f);return f;}
function ticks(s,n){for(let i=0;i<n;i++)stepGame(s);}
function freezeHoles(s){for(const b of blackHoles(s))b.warnUntil=1e9;}

test('city buildings occupy frontage slots, cars align with roads, props and seeds vary',()=>{
 const worlds=[41,42,43].map(seed=>createGame('city',[{id:'a',name:'A'}],seed,'layout',{mode:'solo',botsEnabled:false}));
 for(const s of worlds){
  const buildings=s.food.filter(f=>FOOD[f.kind].building),cars=s.food.filter(f=>FOOD[f.kind].shape==='vehicle');
  assert.ok(buildings.length>15);assert.ok(cars.length>5);
  for(const f of [...buildings,...cars])assert.ok(citySlots(f.kind).some(at=>at.x===f.x&&at.y===f.y&&at.rotation===f.rotation),f.kind);
  for(const b of buildings){assert.equal(cityZone(b),'block');const f=FOOD[b.kind];for(const x of [-1,1])for(const y of [-1,1])assert.notEqual(cityZone({x:b.x+x*f.width/2,y:b.y+y*f.height/2}),'street');}
  for(const c of cars)assert.equal(cityZone(c),'street');
  for(let i=0;i<s.food.length;i++)for(let j=i+1;j<s.food.length;j++)assert.ok(Math.hypot(s.food[i].x-s.food[j].x,s.food[i].y-s.food[j].y)>=FOOD[s.food[i].kind].radius+FOOD[s.food[j].kind].radius, 'no initial overlaps');
  // Every road intersection remains free of structures and parked cars.
  for(let x=800;x<4000;x+=800)for(let y=760;y<3040;y+=760)assert.ok([...buildings,...cars].every(f=>Math.hypot(f.x-x,f.y-y)>FOOD[f.kind].radius+45));
 }
 assert.notDeepEqual(worlds[0].food.map(f=>[f.kind,f.x,f.y]),worlds[1].food.map(f=>[f.kind,f.x,f.y]));
});
for(const mass of [100,1000,3600,10000,1e6,1e9])test(`growth ${mass} to ${mass*2} increases physical, mouth and screen radius`,()=>{
 const p={mass,facing:0,x:0,y:0},a=playerRadius(p),m=mouthOpening(p),screen=a*cameraZoom(mass);p.mass*=2;
 assert.ok(playerRadius(p)>a*1.4);assert.ok(mouthOpening(p)>m*1.4);assert.ok(playerRadius(p)*cameraZoom(p.mass)>screen*1.14);
 assert.equal(playerRadius(p),massToRadius(p.mass));assert.equal(mouthOpening(p),playerRadius(p)*1.64);
});
test('2x, Pluto and /2 all change actual size through the shared reward model',()=>{
 const a=scene(),b=scene(),p=a.players[0],q=b.players[0];p.mass=q.mass=5000;p.storedGrowth=true;activateGrowth(a,p);
 for(let i=0;i<20;i++){foodReward(a,p,{kind:'house'});foodReward(b,q,{kind:'house'});}
 assert.ok(playerRadius(p)>playerRadius(q)*1.08);
 const before=playerRadius(p);foodReward(a,p,{kind:'plutoGiant'});assert.ok(playerRadius(p)>before);
 p.growthModifier=.5;const r=playerRadius(p);grantGrowth(a,p,100);assert.ok(playerRadius(p)>r);
});
for(const kind of ['house','car','shrine'])test(`${kind}: normalized 25% commits, no pre-entry suction, full-size gradual fall`,()=>{
 const s=scene(),p=s.players[0];p.mass=4000;const f=prop(s,kind),m=mouthPosition(p),r=mouthOpening(p)/2,extent=FOOD[kind].width/2;
 for(const progress of [.1,.249,.251]){f.x=m.x+r+extent-2*extent*progress;assert.ok(Math.abs(mouthEntryProgress(p,f)-progress)<1e-8);assert.equal(entersMouth(p,f,s.time),progress>=.25);}
 f.x=m.x+r+extent-2*extent*.249;const x=f.x;ticks(s,5);assert.equal(f.target,null);assert.equal(f.x,x);assert.equal(f.vx,0);
 f.x=m.x+r+extent-2*extent*.251;stepGame(s);assert.equal(f.target,p.id);const rotation=f.rotation;
 const early=fallPose(f,.1),late=fallPose(f,.8);assert.ok(early.angle<late.angle);assert.ok(late.z<early.z);assert.ok(early.angle>0);
 ticks(s,60);assert.equal(p.stats.collected[kind],1);assert.equal(f.rotation,rotation);
});
test('quest landmark stays protected, then shrine uses fit, fall, growth and collection rules',()=>{
 const s=solo(),e=s.encounter,p=s.players[0];assert.ok(e.shrine);const home={...e.shrine};
 p.mass=5000;stepEncounter(s,1/30);assert.ok(e.shrine);assert.ok(!s.food.some(f=>f.kind==='shrine'));assert.equal(e.item.status,'ground');
 e.item.status='carried';e.item.ownerId=p.id;stepEncounter(s,1/30);assert.ok(e.shrine);
 e.item.status='delivered';e.completedBy=p.id;stepEncounter(s,1/30);assert.equal(e.shrine,null);const f=s.food.find(f=>f.kind==='shrine');assert.ok(f);assert.equal(f.x,home.x);
 p.mass=36;assert.equal(foodFits(p,f),false);p.mass=5000;assert.ok(foodFits(p,f));Object.assign(p,home);s.food=[f];s.nextFood=s.nextPower=s.nextPluto=1e9;const before=p.mass;ticks(s,60);
 assert.equal(p.stats.collected.shrine,1);assert.ok(p.mass>before+100);assert.equal(e.item.status,'delivered');
});
test('Bots preference defaults ON, persists in the existing store, and strips all AI seats when OFF',()=>{
 assert.equal(matchSettings({mode:'solo'}).botsEnabled,true);
 const previous=globalThis.localStorage,storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 return import('../src/games/eat-it/preferences.ts').then(({loadPreferences,savePreferences,SETTINGS_KEY})=>{
 try{savePreferences(matchSettings({mode:'solo',botsEnabled:false}));assert.equal(loadPreferences().botsEnabled,false);assert.deepEqual([...storage.keys()],[SETTINGS_KEY]);}finally{globalThis.localStorage=previous;}
 const s=solo();assert.equal(s.players.length,1);assert.equal(s.players[0].bot,false);assert.ok(s.encounter);assert.ok(s.food.length>600);ticks(s,40);assert.equal(s.players[0].nextDecision,0);assert.equal(s.status,'playing');
 const on=createGame('city',fillBots([{id:'a',name:'A'}],3),1,'on',{mode:'solo',botDifficulty:'hard'});assert.equal(on.players.filter(p=>p.bot).length,2);assert.equal(on.settings.botDifficulty,'hard');
 });
});
for(const livesEnabled of [true,false])test(`solo retains Lives=${livesEnabled} and normal timer`,()=>{
 const s=solo({livesEnabled,hellEnabled:false,matchDuration:120}),p=s.players[0];assert.equal(p.lives,livesEnabled?3:1);stepGame(s);assert.equal(s.status,'playing');
 if(livesEnabled){eliminate(s,p);s.time=p.respawnAt;assert.ok(respawn(s,p));}
 s.time=120;stepGame(s);assert.equal(s.winnerId,p.id);
});
test('solo Hell requires 60 seconds survival, and a fall loses rather than awarding a solo tie',()=>{
 const s=solo({matchDuration:120});s.time=120;stepGame(s);assert.equal(s.phase,'transition');freezeHoles(s);s.hell.nextEruption=1e9;s.time=s.hell.readyAt;stepGame(s);assert.equal(s.status,'playing');
 s.time=s.hell.readyAt+59;checkWinner(s);assert.equal(s.status,'playing');s.time=s.hell.readyAt+60;checkWinner(s);assert.equal(s.winnerId,'a');assert.equal(s.players[0].stats.survivedHell,true);
 const loss=solo();startHell(loss);freezeHoles(loss);loss.time=loss.hell.readyAt;loss.hell.cells.fill(-1);ticks(loss,30);assert.equal(loss.result,'loss');assert.equal(loss.winnerId,null);
});
test('one or two independent authoritative paths preserve serialized determinism, warnings and pauses',()=>{
 const counts=new Set();for(let seed=1;seed<30;seed++){const t=createGame('city',[{id:'a',name:'A'},{id:'b',name:'B'}],seed,'holes',{mode:'solo'});startHell(t);counts.add(blackHoles(t).length);}
 assert.deepEqual([...counts].sort(),[1,2]);
 let seed=1,s;do{s=createGame('city',[{id:'a',name:'A'},{id:'b',name:'B'}],seed++,'holes',{mode:'solo'});startHell(s);}while(blackHoles(s).length!==2);
 assert.equal(new Set(blackHoles(s).map(b=>`${b.x},${b.y}`)).size,2);assert.equal(new Set(blackHoles(s).map(b=>JSON.stringify(b.destination))).size,2);
 const holes=blackHoles(s);for(let i=0;i<2;i++){const b=holes[i];b.control={x:b.x+200,y:b.y+100};b.speed=[160,230,360][i];b.warnUntil=10+i;b.pausedUntil=15;b.pauseUsed=true;}
 s.time=3;stepHell(s,1/30);assert.ok(holes.every(b=>!b.progress));s.time=13;const positions=holes.map(b=>[b.x,b.y]);stepHell(s,1/30);assert.deepEqual(holes.map(b=>[b.x,b.y]),positions);
 s.time=16;stepHell(s,1/30);for(const b of holes)assert.deepEqual({x:b.x,y:b.y},sweepPoint(b,b.progress));
 const clone=JSON.parse(JSON.stringify(s));ticks(s,80);ticks(clone,80);assert.deepEqual(s,clone);
 const scene3d=new T.Scene(),visuals=new HellVisuals(scene3d);for(const b of holes)b.warnUntil=s.time+2;visuals.draw(s);for(const name of ['sweep-arrow','sweep-arrow-1'])assert.equal(scene3d.getObjectByName(name).visible,true);assert.equal(scene3d.getObjectByName('sweep-arrow-2').visible,false);visuals.dispose();assert.equal(scene3d.children.length,0);
});
test('eruption warning -> eruption -> collapse -> permanent hole; duplicate cracks do not reset clocks',()=>{
 const s=scene();startHell(s);s.time=s.hell.readyAt;freezeHoles(s);s.hell.nextEruption=1e9;const p=s.players[0],at=cellCenter(200),i=cellIndex(at);Object.assign(p,at);
 s.hell.eruptions=[{...at,id:999,warningAt:s.time,eruptAt:s.time+2,endsAt:s.time+3.2,hit:[p.id]}];assert.ok(supported(s,p));assert.equal(safeGround(s,p),false);
 s.time+=2;stepEruptions(s);assert.ok(supported(s,p));s.time+=1.2;stepEruptions(s);assert.equal(cellPhase(s,i),'destroying');const clock=s.hell.cells[i];assert.equal(crackTile(s,i),false);assert.equal(s.hell.cells[i],clock);
 s.time+=.5;stepHell(s,1/30);assert.equal(cellPhase(s,i),'destroyed');assert.ok(p.fallingAt);assert.equal(p.alive,true);ticks(s,30);assert.equal(p.alive,false);assert.equal(s.hell.cells[i],-1);assert.equal(crackTile(s,i,true),false);
});
test('bots avoid permanent holes and warned eruptions; pigeon lands locally away from telegraphs',()=>{
 const s=scene();startHell(s);s.time=s.hell.readyAt;freezeHoles(s);const p=s.players[0];Object.assign(p,cellCenter(400));s.hell.eruptions=[{...cellCenter(402),id:77,warningAt:s.time-1,eruptAt:s.time+1,endsAt:s.time+2.2,hit:[]}];
 const input=hellBotInput(s,p);assert.ok(safeGround(s,{x:p.x+input.x*95,y:p.y+input.y*95},10));const landing=nearbyLanding(s,p);assert.ok(landing);assert.ok(Math.hypot(landing.x-p.x,landing.y-p.y)<=120);assert.ok(safeGround(s,landing,playerRadius(p)));
});
test('pigeon flies five seconds across holes; cat keeps its two-second ground assist',()=>{
 for(const kind of ['pigeon','cat']){const s=scene();startHell(s);s.phase='hell';s.time=s.hell.readyAt;freezeHoles(s);const p=s.players[0];p.helper={kind,used:false,hell:true,until:0};assert.ok(activateEscape(s,p));assert.equal(p.escape.endsAt-s.time,kind==='pigeon'?5:2);assert.equal(activateEscape(s,p),false);
 if(kind==='pigeon'){s.hell.cells[cellIndex(p)]=-1;ticks(s,145);assert.equal(p.fallingAt,undefined);ticks(s,8);assert.equal(p.escape,undefined);assert.ok(supported(s,p));}
 }
});
test('shield deadline and hit ripple timestamp stay authoritative without changing protection',()=>{
 const s=scene(),[a,b]=s.players;Object.assign(b,{x:a.x+28,y:a.y});const item={id:99,kind:'shield',x:b.x,y:b.y};s.powerups=[item];collectPower(s,b,item);assert.equal(b.effects.shield,EAT.powerups.shield.duration);a.mass=100;stepGame(s);assert.ok(b.alive);assert.equal(b.shieldHitAt,s.time);s.time=EAT.powerups.shield.duration;assert.equal(b.effects.shield>s.time,false);
});
test('denser sky drops have category weighting, no houses/cars/shrine, finite cap and cleanup',()=>{
 const s=scene();s.nextFood=0;assert.ok(EAT.food.spawnCount>540);assert.ok(EAT.food.respawnInterval<.22);let small=0,medium=0,large=0;
 for(let i=0;i<300;i++){s.food=[];assert.ok(spawnFood(s));const f=s.food[0];assert.ok(f.z>=280);assert.ok(FOOD[f.kind].skyDrop);assert.ok(!FOOD[f.kind].building);assert.notEqual(FOOD[f.kind].shape,'vehicle');if(['tiny','small'].includes(FOOD[f.kind].category))small++;else if(FOOD[f.kind].category==='medium')medium++;else large++;}
 assert.ok(small>medium&&medium>large);s.food=Array.from({length:EAT.food.maxObjects},(_,i)=>({...s.food[0],id:i}));assert.equal(spawnFood(s),false);s.food=[{...s.food[0],x:NaN},{...s.food[0],x:-999}];updateSpawns(s);assert.ok(s.food.every(f=>Number.isFinite(f.x)&&f.x>=0));
 const fresh=solo();fresh.nextFood=0;const count=fresh.food.length;fresh.time=1;updateSpawns(fresh);assert.ok(fresh.food.length>count);assert.ok(fresh.food.some(f=>f.z>=280));
});
test('all new labels and legend items are localized for all seven languages',()=>{
 const data=JSON.parse(readFileSync(new URL('../src/i18n/eatItTranslations.json',import.meta.url)));
 for(const lang of ['en','de','bar','ko','ru','es','pt'])for(const key of ['Item Legend','Bots','Survive Hell for {seconds}s','Shield','Magnet','Speed Boost','2x Growth','Growth /2','Pluto Bonus','Shrine','Coffee cup','Tent'])assert.ok(data[lang][key],`${lang}: ${key}`);
});
