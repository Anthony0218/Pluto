import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { HellVisuals } from '../src/games/eat-it/hellVisuals.ts';
import { EAT, FOOD, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, stepGame, eliminate, collectPower, fillBots } from '../src/games/eat-it/engine.ts';
import { matchSettings, respawn, safePosition } from '../src/games/eat-it/progression.ts';
import { animalScale, encounterScale, animalPlayer, powerVisual, questScale } from '../src/games/eat-it/scaling.ts';
import { canopyFits, foodFits, mouthOpening, isChoking } from '../src/games/eat-it/rules.ts';
import { stepEncounter, npcRadius } from '../src/games/eat-it/quests.ts';
import { treeGeometry } from '../src/games/eat-it/treeGeometry.ts';
import { ModelLibrary } from '../src/games/eat-it/models.ts';
import { stepBurp, burpAmount } from '../src/games/eat-it/expressions.ts';
import { BOT_POLICY, botPolicy, botInput } from '../src/games/eat-it/bots.ts';
import { startHell, stepHell, hellBotInput } from '../src/games/eat-it/hell.ts';
import { validPosition, distance } from '../src/games/eat-it/maps.ts';
import { activateEscape } from '../src/games/eat-it/escape.ts';
import { parseSettings, applyRoomAction } from '../src/games/eat-it/authority.ts';
import { reviewSettings } from '../src/games/eat-it/review.ts';
import { loadPreferences, savePreferences } from '../src/games/eat-it/preferences.ts';
import { readFileSync } from 'node:fs';
const make=(options={},map='city')=>{
 const s=createGame(map,[{id:'a',name:'A'},{id:'b',name:'B',bot:true},{id:'c',name:'C'}],33,'test',{mode:'solo',...options});
 s.food=[];s.powerups=[];s.nextFood=s.nextPower=s.nextPluto=1e6;
 s.players.forEach((p,i)=>Object.assign(p,{x:900+i*600,y:1200,bot:false}));
 if(s.encounter)s.encounter.shrine=null;
 return s;
};
const ticks=(s,n)=>{for(let i=0;i<n;i++)stepGame(s)};
const tree=(s,kind='tree')=>{const p=s.players[0],f={id:s.nextId++,kind,x:p.x+2,y:p.y,z:0,vz:0,vx:0,vy:0,rotation:.9,target:null,capturedAt:0};s.food.push(f);return f};
test('defaults, persistence and sanitization keep one shared rules configuration',()=>{
 const defaults=matchSettings();assert.equal(defaults.animalsEnabled,true);assert.equal(defaults.hellEnabled,true);assert.equal(defaults.livesEnabled,true);assert.equal(defaults.botDifficulty,'medium');
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 const settings=matchSettings({mode:'solo',animalsEnabled:false,livesEnabled:false,hellEnabled:false,botDifficulty:'easy'});savePreferences(settings);assert.deepEqual(loadPreferences(),settings);
 storage.set('eat-it-settings','{bad');assert.equal(loadPreferences().botDifficulty,'medium');delete globalThis.localStorage;
 assert.equal(matchSettings({botDifficulty:'impossible'}).botDifficulty,'medium');
});
for(const animalsEnabled of [true,false])for(const hellEnabled of [true,false])for(const livesEnabled of [true,false])test(`combined rules animals=${animalsEnabled} hell=${hellEnabled} lives=${livesEnabled}`,()=>{
 const s=make({animalsEnabled,hellEnabled,livesEnabled});assert.equal(!!s.encounter,animalsEnabled);assert.ok(s.players.every(p=>p.lives===(livesEnabled?3:1)));
 s.players[0].mass=100;s.time=EAT.hell.normalDuration-1/60;stepGame(s);
 assert.equal(!!s.hell,hellEnabled);if(!hellEnabled){assert.equal(s.status,'finished');assert.equal(s.winnerId,'a');assert.equal(s.phase,'normal')}
 if(!animalsEnabled)assert.ok(s.players.every(p=>!p.helper&&!p.escape));
});
test('one-life humans and bots cannot respawn, three-life participants can',()=>{
 for(const mode of ['solo','multiplayer'])for(const livesEnabled of [true,false]){
  const s=make({mode,livesEnabled});const p=s.players[0];eliminate(s,p);ticks(s,160);assert.equal(respawn(s,p),livesEnabled);
  const b=s.players[1];b.bot=true;eliminate(s,b);ticks(s,160);assert.equal(b.alive,livesEnabled);
 }
});
test('timeout mass/score ties are explicit and independent of player order',()=>{
 for(const reverse of [false,true]){const s=make({hellEnabled:false});if(reverse)s.players.reverse();s.time=EAT.hell.normalDuration;stepGame(s);assert.equal(s.result,'tie');assert.equal(s.winnerId,null);assert.equal(s.tiedIds.length,3)}
 const s=make({hellEnabled:false});s.players[1].score=10;s.time=EAT.hell.normalDuration;stepGame(s);assert.equal(s.winnerId,'b');
});
test('server owns rules, respawn eligibility and multiplayer difficulty',()=>{
 const settings=parseSettings({map:'city',count:3,animalsEnabled:false,livesEnabled:true,hellEnabled:false,botDifficulty:'easy'});
 const room={id:'r',room_code:'ABC123',host_id:'a',players:[{id:'a',name:'A',ready:true,lastSeen:1000}],settings,game_state:null,status:'waiting',version:0,last_tick:1000};
 applyRoomAction(room,'a','A',{op:'start',animalsEnabled:true,livesEnabled:false},1000,33,'room');
 const s=room.game_state,p=s.players[0];assert.equal(s.encounter,undefined);assert.equal(p.lives,3);assert.equal(botPolicy(s),BOT_POLICY.hard);
 eliminate(s,p);applyRoomAction(room,'a','A',{op:'respawn',lives:99},1000,33,'room');assert.equal(p.alive,false);
 s.time=p.respawnAt;applyRoomAction(room,'a','A',{op:'respawn'},1000,33,'room');assert.equal(p.alive,true);assert.equal(p.lives,2);
 assert.deepEqual(reviewSettings(s.settings).find(([k])=>k==='Starting lives'),['Starting lives',3]);
});
test('animal dimensions grow gradually, cap, and preserve special form hierarchy',()=>{
 for(const form of ['neutral','friendly','hostile','escape']){const sizes=[24,60,140,312,10000].map(r=>animalScale(r,form));assert.equal(sizes[0],animalScale(14,form));assert.ok(sizes[1]<sizes[2]&&sizes[2]<sizes[3]);assert.equal(sizes[3],sizes[4]);}
 for(const r of [24,60,240,312])assert.ok(animalScale(r,'escape')>animalScale(r,'hostile')&&animalScale(r,'hostile')>animalScale(r,'friendly'));
});
test('animal owner/attacker determines shared hitbox, neutral selects nearest and replicas agree',()=>{
 const s=make({mode:'multiplayer'}),e=s.encounter,[a,b]=s.players;a.mass=3600;b.mass=36;e.npc.targetId=a.id;e.npc.phase='hostile';e.npc.until=100;e.npc.nextAction=100;
 Object.assign(e.npc,{x:b.x,y:b.y});assert.equal(animalPlayer(s).id,'a');const clone=JSON.parse(JSON.stringify(s));stepEncounter(s,1/30);stepEncounter(clone,1/30);assert.deepEqual(s,clone);assert.equal(e.npc.scale,encounterScale(s));assert.equal(npcRadius(e),16*e.npc.scale);
 e.npc.targetId=null;e.npc.phase='idle';assert.equal(animalPlayer(s).id,'b');
});
test('scaled animals give the same fixed base reward',()=>{
 for(const mass of [144,1000]){const s=make(),p=s.players[0],n=s.encounter.npc;p.mass=mass;Object.assign(n,{phase:'swallowing',targetId:p.id,until:0});stepEncounter(s,1/30);assert.equal(p.mass-mass,8);assert.equal(p.score,40)}
});
test('power-up mesh, glow, indicators and quests scale with a bound; pickup effects stay fixed',()=>{
 const a=powerVisual(24),b=powerVisual(120),c=powerVisual(312);assert.ok(a.scale<b.scale&&b.scale<c.scale);assert.ok(a.glow<b.glow&&b.glow<c.glow);assert.ok(a.indicator<c.indicator);assert.deepEqual(c,powerVisual(1e6));assert.equal(questScale(312),questScale(1e6));
 for(const kind of ['speed','shield','magnet'])for(const mass of [36,3600]){const s=make(),p=s.players[0];p.mass=mass;const power={id:999,kind,x:p.x,y:p.y};s.powerups=[power];collectPower(s,p,power);assert.equal(p.effects[kind],EAT.powerups[kind].duration)}
});
for(const map of ['city','nature'])test(`${map}: expanded coverage, NPC bounds, escape and safe respawn`,()=>{
 const s=createGame(map,fillBots([],8),44,'world',{mode:'solo'});assert.equal(EAT.match.width,4000);assert.equal(EAT.match.height,3040);assert.ok(s.food.length>=500);
 for(const f of s.food)assert.ok(validPosition(map,f,FOOD[f.kind].radius));for(const p of s.powerups)assert.ok(validPosition(map,p,15));
 assert.ok(s.food.some(f=>f.x>3500));assert.ok(s.food.some(f=>f.y>2700));
 s.food=[];const p=s.players[0],e=s.encounter;Object.assign(e.npc,{phase:'friendly',targetId:p.id,until:100});e.completedBy=p.id;assert.ok(activateEscape(s,p));assert.ok(validPosition(map,p.escape.destination,playerRadius(p,s.time)));delete p.escape;
 Object.assign(e.npc,{phase:'wandering',targetId:null,until:1e6,x:10,y:10,destination:{x:-100,y:-100}});for(let i=0;i<100;i++){s.time+=1/30;stepEncounter(s,1/30);assert.ok(validPosition(map,e.npc,npcRadius(e)-.01))}
 s.players[1].mass=9000;eliminate(s,p);s.time=p.respawnAt;assert.ok(respawn(s,p));assert.ok(safePosition(s,p,24,p.id));
 const input=botInput(s,s.players[2]);assert.ok(Number.isFinite(input.x)&&Number.isFinite(input.y));
});
test('canopy regression: visible canopy fits even when old rectangular area test failed',()=>{
 const s=make(),p=s.players[0];p.mass=(65/4)**2;const f=tree(s),g=treeGeometry('tree');assert.ok(mouthOpening(p)>2*Math.max(g.canopyX,g.canopyZ));assert.ok(FOOD.tree.width*FOOD.tree.height>Math.PI*(mouthOpening(p)/2)**2);
 assert.ok(canopyFits(p,f));ticks(s,48);assert.equal(p.stats.chokes,0);assert.equal(p.stats.trees,1);
});
test('model canopy and authoritative cross-section share world dimensions at all orientations',()=>{
 const lib=new ModelLibrary();for(const kind of ['tree','smallTree','bush']){const model=lib.prop(kind),g=treeGeometry(kind),canopy=model.children[1];assert.equal(canopy.scale.x,g.canopyX);assert.equal(canopy.scale.z,g.canopyZ);const s=make(),p=s.players[0];p.mass=(Math.max(g.canopyX,g.canopyZ)/.82/4)**2;for(const rotation of [0,.5,1.5,3])assert.ok(canopyFits(p,{kind,rotation}));}lib.dispose();
});
test('trunk too wide cannot start swallowing, Hell scale affects both fit and visible mouth',()=>{
 const s=make(),p=s.players[0],f=tree(s);const width=FOOD.tree.width;try{FOOD.tree.width=400;assert.equal(foodFits(p,f),false);ticks(s,20);assert.equal(f.target,null);assert.equal(p.stats.chokes,0)}finally{FOOD.tree.width=width}
 p.mass=(50/4)**2;p.hellScale=1;assert.equal(canopyFits(p,f,s.time),false);p.hellScale=2;assert.ok(canopyFits(p,f,s.time));assert.equal(mouthOpening(p,s.time),2*.82*playerRadius(p,s.time));
});
test('choking keeps canopy stuck, then spits locally, settles in bounds and gives no reward',()=>{
 const s=make(),p=s.players[0],f=tree(s);ticks(s,21);assert.ok(isChoking(p,s.time));assert.equal(f.stuck.playerId,p.id);assert.ok(f.z<0&&distance(f,p)<10);const origin={x:p.x,y:p.y};p.input={x:1,y:0};ticks(s,80);assert.equal(p.x,origin.x);assert.ok(f.stuck);ticks(s,12);assert.ok(f.spit);assert.ok(f.spit.fromZ<0);ticks(s,27);assert.equal(f.stuck,undefined);assert.equal(f.spit,undefined);assert.equal(f.z,0);assert.ok(validPosition(s.map,f,FOOD.tree.radius));assert.ok(distance(f,origin)<400);assert.equal(p.mass,36);assert.equal(p.stats.trees,0);assert.ok(p.x>origin.x);
});
test('stuck/spit snapshots and mass expiry remain deterministic',()=>{
 const s=make();tree(s);ticks(s,10);const replica=JSON.parse(JSON.stringify(s));ticks(s,130);ticks(replica,130);assert.deepEqual(s,replica);
});
test('burps are periodic, staggered for humans/bots and never change movement or stats',()=>{
 const s=make({animalsEnabled:false}),p=s.players[0];assert.equal(new Set(s.players.map(p=>p.nextBurp)).size,3);p.input={x:1,y:0};s.time=27;const mass=p.mass;stepGame(s);assert.ok(p.burpAt);assert.ok(p.vx>0);assert.equal(p.mass,mass);assert.ok(p.nextBurp>=54&&p.nextBurp<=60.1);assert.ok(burpAmount(s,p)>0 || s.time===p.burpAt);
 const b=s.players[1];b.bot=true;s.time=b.nextBurp;stepBurp(s,b);assert.equal(b.burpAt,s.time);
});
test('burps delay while dead, respawning, choking, swallowed, escaping or in Hell',()=>{
 for(const block of [p=>p.alive=false,p=>p.respawnAt=5,p=>p.chokingUntil=10,p=>p.escape={},p=>p.fallingAt=0]){const s=make(),p=s.players[0];p.nextBurp=0;block(p);stepBurp(s,p);assert.equal(p.burpAt,undefined);assert.equal(p.nextBurp,1)}
 const s=make(),p=s.players[0];p.nextBurp=0;startHell(s);s.time=200;stepBurp(s,p);assert.equal(p.burpAt,undefined);
});
test('Hard policy preserves old capabilities; Medium/Easy slow decisions and reduce pursuit without changing physics',()=>{
 assert.equal(BOT_POLICY.hard.interval,EAT.bots.decisionInterval);assert.equal(BOT_POLICY.hard.prediction,.2);assert.equal(BOT_POLICY.hard.hellSamples,16);
 assert.ok(BOT_POLICY.easy.interval>BOT_POLICY.medium.interval&&BOT_POLICY.medium.interval>BOT_POLICY.hard.interval);
 for(const difficulty of ['easy','medium','hard']){const s=make({botDifficulty:difficulty}),p=s.players[0];p.bot=true;const mass=p.mass;p.nextDecision=0;stepGame(s);assert.equal(p.nextDecision,s.time+BOT_POLICY[difficulty].interval);assert.equal(p.mass,mass);assert.ok(Math.hypot(p.input.x,p.input.y)<=1.0001)}
 const solo=make({botDifficulty:'hard'}),multi=structuredClone(solo);multi.settings.mode='multiplayer';assert.deepEqual(botInput(solo,solo.players[0]),botInput(multi,multi.players[0]));
});
test('bot vision cannot see distant food and Hell reaction uses only revealed path',()=>{
 const s=make(),p=s.players[0];const a=botInput(s,p);tree(s).x=p.x+1000;assert.deepEqual(botInput(s,p),a);
 for(const difficulty of ['easy','medium']){const h=make({botDifficulty:difficulty});startHell(h);h.time=h.hell.readyAt;h.phase='hell';const clone=structuredClone(h);clone.hell.blackHole.destination={x:9999,y:9999};assert.deepEqual(hellBotInput(h,h.players[0]),hellBotInput(clone,clone.players[0]));}
 assert.ok(BOT_POLICY.easy.warningDelay>BOT_POLICY.medium.warningDelay&&BOT_POLICY.medium.warningDelay>BOT_POLICY.hard.warningDelay);
});
test('black-hole warning freezes origin/destination for 1.1s and actual sweep follows exact vector',()=>{
 const s=make();startHell(s);s.time=s.hell.readyAt;const b=s.hell.blackHole,origin={x:b.x,y:b.y},dest={...b.destination};assert.equal(EAT.hell.sweepWarning,1.1);
 while(s.time+1/30<b.warnUntil){s.time+=1/30;stepHell(s,1/30);assert.deepEqual({x:b.x,y:b.y},origin);assert.deepEqual(b.destination,dest)}
 s.time=b.warnUntil+1/30;stepHell(s,1/30);const dx=b.x-origin.x,dy=b.y-origin.y;assert.ok(Math.hypot(dx,dy)>0);assert.ok(Math.abs(dx*(dest.y-origin.y)-dy*(dest.x-origin.x))<1e-7);assert.deepEqual(b.destination,dest);
});
test('rendered laser arrow matches the shared destination and disappears when sweeping',()=>{
 const scene=new T.Scene(),visuals=new HellVisuals(scene),s=make();startHell(s);s.time=s.hell.readyAt;visuals.draw(s);
 const arrow=scene.getObjectByName('sweep-arrow'),laser=scene.getObjectByName('sweep-laser'),b=s.hell.blackHole;
 assert.ok(arrow.visible&&laser.visible);assert.equal(arrow.position.x,b.destination.x);assert.equal(arrow.position.z,b.destination.y);
 const direction=new T.Vector3(0,1,0).applyQuaternion(arrow.quaternion),expected=new T.Vector3(b.destination.x-b.x,0,b.destination.y-b.y).normalize();assert.ok(direction.distanceTo(expected)<1e-8);
 s.time=b.warnUntil;visuals.draw(s);assert.equal(arrow.visible,false);assert.equal(laser.visible,false);visuals.dispose();assert.equal(scene.children.length,0);
});
test('new player-facing settings and alerts translated into all supported languages',()=>{
 const strings=JSON.parse(readFileSync(new URL('../src/i18n/eatItTranslations.json',import.meta.url),'utf8'));
 for(const lang of ['en','de','bar','ko','ru','es','pt'])for(const key of ['Animals','Hell Sudden Death','Lives','Bot Difficulty','Easy','Medium','Hard','Choking…','Jump','Strike','Pluto Growth Multiplier','Respawn','Black hole incoming!','Match Settings'])assert.ok(strings[lang][key],`${lang}:${key}`);
});
