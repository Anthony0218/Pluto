import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { EAT, FOOD, playerRadius } from '../src/games/eat-it/config.ts';
import { createGame, stepGame, eliminate, checkWinner, fillBots } from '../src/games/eat-it/engine.ts';
import { canUnderpass, respawn, safePosition } from '../src/games/eat-it/progression.ts';
import { choosePluto, spawnPluto } from '../src/games/eat-it/spawn.ts';
import { foodFits, entersMouth } from '../src/games/eat-it/rules.ts';
import { activateEscape, escapeAvailable, ridePose, catRoute } from '../src/games/eat-it/escape.ts';
import { startHell, supported, cellCenter, cellPhase, hellBotInput } from '../src/games/eat-it/hell.ts';
import { applyRoomAction, parseSettings } from '../src/games/eat-it/authority.ts';
import { ModelLibrary } from '../src/games/eat-it/models.ts';
import { reviewStats } from '../src/games/eat-it/review.ts';
const make = (map = 'city', mode = 'solo') => {
 const s = createGame(map,[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C',bot:true}],543,'test',{mode,hellEnabled:true});
 s.food=[];s.powerups=[];s.nextFactory=s.nextHumans=1e9;delete s.feast;s.nextFood=s.nextPower=s.nextPluto=1e6;
 s.players.forEach((p,i)=>Object.assign(p,{x:1000+i*600,y:1200,bot:false}));
 delete s.encounter;return s;
};
const ticks=(s,n)=>{for(let i=0;i<n;i++)stepGame(s)};
const prop=(s,kind,x=1000,y=1200)=>{const f={id:s.nextId++,kind,x,y,vx:0,vy:0,z:0,vz:0,rotation:0,target:null,capturedAt:0};s.food.push(f);return f};
function friendly(s,kind='pigeon') {
 const p=s.players[0];s.encounter={shrine:null,completedBy:p.id,item:{kind:kind==='cat'?'catTree':'scroll',home:{x:500,y:500},x:500,y:500,status:'delivered',ownerId:null},npc:{kind,phase:'friendly',since:s.time,until:s.time+EAT.escape.friendshipDuration,x:p.x-80,y:p.y,facing:0,targetId:p.id,destination:{x:0,y:0},origin:{x:0,y:0},nextAction:4,actionAt:0,attacks:0,feeds:0}};
 p.helper={kind,until:s.encounter.npc.until,used:false,hell:false};return p;
}
for(const kind of ['car','house','garage','foodTruck'])test(`${kind}: underpass continues until the devour threshold`,()=>{
 const s=make(),p=s.players[0],f=prop(s,kind);p.x=1000-FOOD[kind].width/2-30;p.input={x:1,y:0};
 assert.ok(canUnderpass(p,f,0));assert.equal(foodFits(p,f),false);ticks(s,70);assert.ok(p.x>f.x+FOOD[kind].width/2);assert.equal(p.foodEaten,0);assert.equal(f.x,1000);
 p.mass=100;p.x=1000-FOOD[kind].width/2-42;p.input={x:1,y:0};assert.equal(canUnderpass(p,f,s.time),true);ticks(s,100);assert.ok(p.x>f.x+FOOD[kind].width/2);assert.equal(f.vx,0);
 p.mass=3000;p.x=1000;p.y=1200;p.input={x:0,y:0};p.vx=0;assert.ok(foodFits(p,f,s.time));ticks(s,75);assert.equal(p.foodEaten,1);
});
test('raised geometry clears the small monster and ground-level logs also permit passage',()=>{
 const lib=new ModelLibrary();for(const kind of ['car','house']) {
  const model=lib.prop(kind),body=model.children[0];model.updateMatrixWorld(true);
  assert.ok(new T.Box3().setFromObject(body).min.y>25,kind);
  assert.equal(FOOD[kind].renderLayer,'raised');
 }
 const s=make(),p=s.players[0],f=prop(s,'treeTrunk');p.x=920;p.input={x:1,y:0};assert.equal(canUnderpass(p,f,0),true);ticks(s,50);assert.ok(p.x>1050);assert.equal(f.target,null);lib.dispose();
});
test('legacy Pluto distribution stays readable but new rooms disable Pluto',()=>{
 const s=make();assert.equal(s.settings.plutoMultiplier,4);assert.equal(s.settings.plutoEnabled,false);
 const counts={};for(let i=0;i<10000;i++){const k=choosePluto(s);counts[k]=(counts[k]??0)+1}
 assert.ok(counts.plutoTiny>5200&&counts.plutoTiny<5800);assert.ok(counts.plutoGiant<260&&counts.plutoGiant>140);
 // Client-supplied Pluto values are ignored: the bonus is no longer a room setting.
 assert.equal(parseSettings({map:'city',count:2,plutoMultiplier:99}).plutoMultiplier,4);
 assert.equal(parseSettings({map:'city',count:2,plutoMultiplier:1.25,plutoEnabled:false}).plutoEnabled,false);
});
for(const map of ['city','nature'])test(`${map}: Pluto spawn clearance and cap`,()=>{
 const s=createGame(map,fillBots([],8),99,'test',{mode:'solo'});
 assert.equal(s.food.some(f=>FOOD[f.kind].shape==='pluto'),false);
 s.settings.plutoEnabled=true; // Historical states can still render/replay their old objects.
 for(let i=0;i<100;i++)spawnPluto(s);
 const plutos=s.food.filter(f=>FOOD[f.kind].shape==='pluto');assert.ok(plutos.length>0&&plutos.length<=EAT.pluto.maxActive);
 for(const f of plutos){assert.ok(s.players.every(p=>Math.hypot(p.x-f.x,p.y-f.y)>playerRadius(p,0)+FOOD[f.kind].radius));assert.ok(!s.encounter.shrine||Math.hypot(f.x-s.encounter.shrine.x,f.y-s.encounter.shrine.y)>FOOD[f.kind].radius+135)}
 s.settings.plutoEnabled=false;assert.equal(spawnPluto(s),false);
});
for(const multiplier of [1.25,2,5])test(`Pluto ${multiplier}x requires entry and grants one configured reward`,()=>{
 const s=make(),p=s.players[0];s.settings.plutoMultiplier=multiplier;const f=prop(s,'plutoTiny',1100);
 ticks(s,15);assert.equal(p.foodEaten,0);assert.equal(f.x,1100);f.x=p.x;assert.ok(entersMouth(p,f,s.time));ticks(s,50);
 assert.equal(p.mass,36+FOOD.plutoTiny.growth*multiplier);assert.equal(p.stats.plutos,1);assert.equal(p.stats.plutoBonus,FOOD.plutoTiny.growth*(multiplier-1));ticks(s,30);assert.equal(p.stats.plutos,1);
});
test('oversized Pluto ignores magnet and resists pushing',()=>{
 const s=make(),p=s.players[0],f=prop(s,'plutoGiant',1150);p.effects.magnet=100;p.input={x:1,y:0};assert.equal(foodFits(p,f),false);ticks(s,50);assert.equal(f.target,null);assert.ok(Math.abs(f.x-1150)<.1);assert.equal(p.stats.plutos,0);
});
test('three lives, five-second manual human respawn and full cleanup',()=>{
 const s=make(),p=s.players[0];assert.deepEqual(s.players.map(p=>p.lives),[3,3,3]);p.mass=500;p.effects.speed=100;p.chokingUntil=90;
 for(let death=1;death<=3;death++){
  assert.ok(eliminate(s,p));assert.equal(p.lives,3-death);assert.equal(eliminate(s,p),false);checkWinner(s);assert.equal(s.status,'playing');
  if(death<3){assert.equal(respawn(s,p),false);ticks(s,149);assert.equal(respawn(s,p),false);ticks(s,2);assert.equal(p.alive,false);assert.ok(respawn(s,p));assert.equal(p.mass,36);assert.ok(Object.values(p.effects).every(v=>v===0));assert.equal(p.chokingUntil,0);assert.ok(safePosition(s,p,24,p.id));}
 }
 ticks(s,200);assert.equal(respawn(s,p),false);assert.equal(p.stats.deaths,3);assert.equal(p.stats.respawns,2);
});
test('bots automatically respawn under the same rules, multiplayer shares the life setting',()=>{
 const s=make(),p=s.players[2];p.bot=true;eliminate(s,p);ticks(s,149);assert.equal(p.alive,false);ticks(s,3);assert.ok(p.alive);assert.equal(p.mass,36);
 const m=make('city','multiplayer');assert.equal(m.players[0].lives,3);eliminate(m,m.players[0]);ticks(m,160);assert.equal(m.players[0].alive,false);assert.ok(respawn(m,m.players[0]));
});
for(const kind of ['pigeon','cat'])test(`${kind}: earned escape, animated ride and authoritative 60-second entitlement`,()=>{
 const s=make(kind==='cat'?'nature':'city'),p=s.players[0];assert.equal(activateEscape(s,p),false);friendly(s,kind);
 p.chokingUntil=1;assert.equal(activateEscape(s,p),false);p.chokingUntil=0;
 if(kind==='cat')assert.ok(catRoute(s,p)?.length);
 assert.ok(activateEscape(s,p));assert.equal(activateEscape(s,p),false);assert.ok(safePosition(s,p.escape.destination,24,p.id));const origin={x:p.x,y:p.y};
 ticks(s,30);assert.ok(ridePose(s,p).scale>2);assert.ok(ridePose(s,p).mounted);assert.ok(kind==='cat'?ridePose(s,p).altitude===0:ridePose(s,p).altitude>0);
 assert.ok(Math.hypot(p.x-origin.x,p.y-origin.y)>0);const f=prop(s,'berry',p.x,p.y);assert.equal(entersMouth(p,f,s.time),false);
 for(let i=0;i<600&&p.escape;i++)stepGame(s);assert.equal(p.escape,undefined);assert.equal(p.stats.escapes,1);assert.equal(escapeAvailable(s,p),false);assert.equal(p.helper.until,60);
 const serialized=JSON.parse(JSON.stringify(s));assert.equal(escapeAvailable(serialized,serialized.players[0]),false);
});
test('cat routes around a major building without going airborne',()=>{
 const s=make('nature'),p=friendly(s,'cat');prop(s,'apartment',1250,1200);const path=catRoute(s,p);assert.ok(path?.length);for(const at of path)assert.ok(Math.hypot(at.x-1250,at.y-1200)>100);
});
test('timer transitions all eligible contenders, including a waiting life, and clears normal world',()=>{
 const s=make();s.time=EAT.hell.normalDuration-1/60;friendly(s);eliminate(s,s.players[1]);prop(s,'car');stepGame(s);
 assert.equal(s.phase,'transition');assert.equal(s.hell.participants.length,3);assert.equal(s.food.length,0);assert.equal(s.powerups.length,0);assert.equal(s.encounter,undefined);assert.ok(s.players[0].helper.hell);assert.ok(s.players.every(p=>p.alive&&p.mass===36));assert.equal(respawn(s,s.players[1]),false);
 ticks(s,61);assert.equal(s.phase,'hell');
});
test('expired or hostile NPCs cannot carry into Hell',()=>{
 for(const phase of ['hostile','devoured','gone','friendly']){const s=make();friendly(s);s.encounter.npc.phase=phase;if(phase==='friendly')s.encounter.npc.until=0;startHell(s);assert.equal(s.players[0].helper,undefined);assert.equal(s.encounter,undefined)}
});
test('black hole telegraphs, traverses, warns, destroys and never restores cells',()=>{
 const s=make();startHell(s);const b=s.hell.blackHole;b.harmless=false;s.hell.blackHoles=[b];s.time=s.hell.readyAt;b.x=cellCenter(0).x;b.y=cellCenter(0).y;b.destination=cellCenter(10);b.warnUntil=s.time+.2;
 ticks(s,4);assert.ok(s.hell.cells.every(v=>v===0));ticks(s,5);assert.ok(s.hell.cells.some(v=>v>0));const i=s.hell.cells.findIndex(v=>v>0);assert.equal(cellPhase(s,i),'warning');ticks(s,20);assert.equal(cellPhase(s,i),'destroying');ticks(s,15);assert.equal(cellPhase(s,i),'destroyed');const destroyed=s.hell.cells.map((v,i)=>v<0?i:-1).filter(i=>i>=0);ticks(s,100);assert.ok(destroyed.every(i=>s.hell.cells[i]===-1));
});
test('unsupported characters visibly fall before lava death; same-tick final falls tie regardless of array order',()=>{
 for(const reverse of [false,true]){const s=make();startHell(s);s.time=s.hell.readyAt;s.hell.cells.fill(-1);if(reverse)s.players.reverse();stepGame(s);assert.ok(s.players.every(p=>p.alive&&p.fallingAt!==undefined));assert.equal(s.status,'playing');ticks(s,25);assert.equal(s.status,'finished');assert.equal(s.result,'tie');assert.equal(s.winnerId,null);assert.equal(s.tiedIds.length,3);assert.ok(s.players.every(p=>p.stats.fellInLava&&p.placement===1))}
});
test('one survivor wins after all eliminations in the tick are committed',()=>{
 const s=make();startHell(s);s.time=s.hell.readyAt;s.players[1].x=0;s.players[2].x=0;ticks(s,25);assert.equal(s.winnerId,'a');assert.equal(s.players[0].stats.survivedHell,true);
});
for(const kind of ['pigeon','cat'])test(`${kind}: Hell assist is one use, uses the species-specific duration and cannot respawn`,()=>{
 const s=make(),p=friendly(s,kind);startHell(s);s.time=s.hell.readyAt;stepGame(s);assert.ok(activateEscape(s,p));const at=s.time;assert.equal(p.escape.endsAt-at,kind==='pigeon'?5:2);assert.equal(activateEscape(s,p),false);p.input={x:-1,y:0};ticks(s,kind==='pigeon'?149:59);assert.ok(p.escape);ticks(s,2);assert.equal(p.escape,undefined);assert.equal(activateEscape(s,p),false);assert.equal(p.stats.hellAssists,1);assert.equal(respawn(s,p),false);
});
test('pigeon survives missing ground during flight; cat cannot cross an unlimited gap',()=>{
 for(const kind of ['pigeon','cat']){const s=make(),p=friendly(s,kind);startHell(s);s.time=s.hell.readyAt;stepGame(s);activateEscape(s,p);s.hell.cells.fill(-1); const q=s.players[1]; const index=Math.floor((q.y-EAT.hell.top)/80)*EAT.hell.columns+Math.floor((q.x-EAT.hell.left)/80); s.hell.cells[index]=0; s.hell.blackHole.warnUntil=1e6; p.input={x:1,y:0};ticks(s,35);if(kind==='pigeon')assert.equal(p.fallingAt,undefined);else assert.ok(p.fallingAt!==undefined||!p.alive);ticks(s,kind==='pigeon'?145:55);assert.equal(p.alive,false)}
});
test('Hell bots use public safe geometry, and snapshots remain deterministic',()=>{
 const s=make();startHell(s);s.time=s.hell.readyAt;s.phase='hell';const p=s.players[0];const input=hellBotInput(s,p);assert.ok(supported(s,{x:p.x+input.x*50,y:p.y+input.y*50}));
 const clone=JSON.parse(JSON.stringify(s));ticks(s,200);ticks(clone,200);assert.deepEqual(s,clone);
 assert.ok(reviewStats(s,p).some(([key])=>key==='Monster factories eaten'));
});
test('server ignores client growth and Hell claims, and repeated escape cannot replay',()=>{
 const s=make('city','multiplayer'),p=friendly(s);s.settings.plutoMultiplier=3;
 const room={id:'r',room_code:'ABC123',host_id:'a',players:[{id:'a',name:'A',ready:true,lastSeen:1000}],settings:{map:'city',count:3,plutoMultiplier:3},game_state:s,status:'playing',version:0,last_tick:1000};
 for(let i=0;i<5;i++)applyRoomAction(room,'a','A',{op:'escape',mass:999999,plutoMultiplier:5,alive:true,cells:[]},1000,2,'game');
 assert.equal(p.stats.escapes,1);assert.equal(s.settings.plutoMultiplier,3);assert.equal(p.mass,36);
});
