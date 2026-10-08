import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DUEL_BOT_SKILL } from '../src/games/party/config.ts';
import { DIFFICULTIES } from '../src/games/party/difficulty.ts';
import { mapRegistry } from '../src/games/party/content/maps.ts';
import { createPlayer, createMatch, applyAction, advance, resolveTile } from '../src/games/party/engine/engine.ts';
import { parseMessage } from '../src/games/party/network/protocol.ts';
import { minigameRegistry } from '../src/games/party/minigames/index.ts';
import { startMinigame, readyMinigame, finishMinigame, refreshBotReadiness } from '../src/games/party/minigames/flow.ts';
import { SHOP_PRICES, shopPrice } from '../src/games/party/items/shop.ts';
import { itemRegistry } from '../src/games/party/items/registry.ts';
import { createItemInstance } from '../src/games/party/items/inventory.ts';
import { shapeOverlap } from '../src/games/party/minigames/circleShot/index.ts';
import { lavaKnockback, onHellIsland } from '../src/games/party/minigames/lavaKnockback/index.ts';
import { eruptionForecast, pirateTreasure, jungleBounty, calmWaters, coconutMarket, ruinsRelics } from '../src/games/party/events/definitions.ts';
import { routePreview, landingDescription } from '../src/games/party/engine/routePreview.ts';
import { PartyRooms } from '../server/party/rooms.ts';
const rng = (seed=19) => () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const players = () => ['a','b','c','d'].map((id,i)=>createPlayer(id,id,i));
const settings = {...DEFAULT_SETTINGS, roundLimit:0};
const match = (cfg=settings) => { const m=createMatch(players(),cfg,rng()); m.order=m.players.map(p=>p.id); m.phase='ITEM_PHASE'; return m; };
const action = (m,id,a,cfg=settings,at=1000) => applyAction(m,id,a,cfg,rng(),at);
const make = (def,difficulty='extreme',seed=19) => def.create({participants:players().map(p=>({...p,isBot:true,difficulty})),startedAt:0,endsAt:def.durationSeconds*1000,random:rng(seed)});

test('five difficulty levels validate and default Hard retains the previous normal tuning',()=>{
 assert.equal(DEFAULT_SETTINGS.difficulty,'hard'); assert.equal(DIFFICULTIES.length,5);
 assert.ok(DUEL_BOT_SKILL.extreme > DUEL_BOT_SKILL.hard);
 for(const difficulty of DIFFICULTIES) { assert.ok(parseMessage({type:'SETTINGS',settings:{...DEFAULT_SETTINGS,difficulty}})); assert.ok(parseMessage({type:'BOT_DIFFICULTY',playerId:'a',difficulty})); }
 assert.throws(()=>parseMessage({type:'SETTINGS',settings:{...DEFAULT_SETTINGS,difficulty:'impossible'}}));
});
test('human ready checks pause indefinitely, reject spectators, and reset the actual game at countdown',()=>{
 let m=match();m.players[3].isBot=true;startMinigame(m,'rhythm-rush',rng(),1000);
 const original=structuredClone(m.minigame.state);
 assert.equal(advance(m,settings,rng(),999999),m); assert.deepEqual(m.minigame.state,original);
 assert.throws(()=>readyMinigame(m,'spectator',rng(),2000));
 m=readyMinigame(m,'a',rng(),2000);assert.equal(readyMinigame(m,'a',rng(),2500),m);assert.equal(m.minigame.awaitingReady,true);
 m=readyMinigame(m,'b',rng(),3000);m=readyMinigame(m,'c',rng(),4000);
 assert.equal(m.minigame.startedAt,7000);assert.equal(m.minigame.awaitingReady,false);
 assert.equal(advance(m,settings,rng(),6999),m);m=advance(m,settings,rng(),7000);assert.equal(m.phase,'MINIGAME');
 assert.equal(m.minigame.state.startedAt,7000);assert.equal(m.minigame.state.notes[0].at,10000);
});
test('a disconnected participant converted to a bot cannot hold the ready check',()=>{
 let m=match();startMinigame(m,'comet-courier',rng(),1000);for(const id of ['a','b','c'])m=readyMinigame(m,id,rng(),2000);
 m.players[3].isBot=true;m=refreshBotReadiness(m,rng(),3000);assert.equal(m.minigame.awaitingReady,false);assert.equal(m.minigame.startedAt,6000);
});
test('festival uses the chosen bag, skips every board phase, and ends after exactly three minigames',()=>{
 const cfg={...DEFAULT_SETTINGS,mode:'festival',roundLimit:3,minigameIds:['rhythm-rush','circle-shot']}; let m=createMatch(players(),cfg,rng());
 const seen=[];for(let round=1;round<=3;round++) {assert.equal(m.phase,'MINIGAME_INTRO');seen.push(m.minigame.minigameId);
 for(const p of m.players)m=readyMinigame(m,p.id,rng(),round*100000);
 m=advance(m,cfg,rng(),m.minigame.startedAt);m=advance(m,cfg,rng(),m.minigame.endsAt);assert.equal(m.phase,'MINIGAME_RESULTS');
 m=advance(m,cfg,rng(),m.minigame.resultsEndsAt);assert.equal(m.phase,'ROUND_END');m=advance(m,cfg,rng(),round*100000+99999); }
 assert.notEqual(seen[0],seen[1]);assert.ok(seen.every(id=>cfg.minigameIds.includes(id)));assert.equal(m.phase,'GAME_OVER');assert.equal(m.round,3);assert.ok(m.winner);assert.equal(m.minigame,null);
 assert.throws(()=>parseMessage({type:'SETTINGS',settings:{...cfg,roundLimit:0}}));
});
test('zero grants exactly one chosen reward and never repeats the current space effect',()=>{
 let m=match();m.players[0].coins=10;m.players[0].hp=39;m.players[0].currentNodeId=mapRegistry.get(m.mapId).nodes.find(n=>n.type==='coin').id;
 m=applyAction(m,'a',{type:'ROLL_DICE'},settings,()=>0,1000);m=advance(m,settings,()=>0,2000);assert.equal(m.phase,'ZERO_BONUS');
 assert.throws(()=>action(m,'b',{type:'ZERO_REWARD',reward:'coins'}));let healed=action(m,'a',{type:'ZERO_REWARD',reward:'heal'});assert.equal(healed.players[0].hp,40);assert.equal(healed.players[0].coins,10);assert.equal(healed.phase,'TURN_END');assert.throws(()=>action(healed,'a',{type:'ZERO_REWARD',reward:'coins'}));
 const rich=action(m,'a',{type:'ZERO_REWARD',reward:'coins'});assert.equal(rich.players[0].coins,12);
});
test('waiting players shop once per round, share mystery limit, and cannot use purchases until the next round',()=>{
 let m=match();m.players[1].coins=50;m=action(m,'b',{type:'BUY_ITEM',mystery:false,itemId:'mega-medkit'});
 assert.equal(m.players[1].coins,50-SHOP_PRICES['mega-medkit']);assert.equal(m.players[1].inventory[0].usableFromRound,2);
 const copy=structuredClone(m);assert.throws(()=>action(m,'b',{type:'BUY_ITEM',mystery:true}));assert.deepEqual(m,copy);
 m.turnIndex=1;const itemInstanceId=m.players[1].inventory[0].instanceId;assert.throws(()=>action(m,'b',{type:'USE_ITEM',itemInstanceId}),/round 2/);
 m.round=2;m.players[1].hp=10;const next=action(m,'b',{type:'USE_ITEM',itemInstanceId});assert.ok(next.players[1].hp>10);
});
test('mystery can produce every item and failed purchases never charge coins or allocate an item',()=>{
 const pool=itemRegistry.all();for(let i=0;i<pool.length;i++){let m=match();m.players[2].coins=10;m=applyAction(m,'c',{type:'BUY_ITEM',mystery:true},settings,()=> (i+.5)/pool.length,1000);assert.equal(m.players[2].inventory[0].itemId,pool[i].id);assert.equal(m.players[2].coins,0);}
 for(const full of [false,true]){const m=match();m.players[1].coins=full?50:0;if(full)m.players[1].inventory=Array.from({length:3},()=>createItemInstance(m,'mega-medkit'));const copy=structuredClone(m);assert.throws(()=>action(m,'b',{type:'BUY_ITEM',mystery:true}));assert.deepEqual(m,copy);}
});
test('both maps contain three connected cleansing triples which neutralise radiation and heal 10',()=>{
 for(const map of mapRegistry.all()){assert.equal(map.cleansingNodeIds.length,9);for(let i=0;i<9;i+=3){const group=map.cleansingNodeIds.slice(i,i+3);assert.equal(new Set(group.map(id=>map.nodes.find(n=>n.id===id).region)).size,1);for(let j=1;j<3;j++)assert.ok(map.nodes.find(n=>n.id===group[j-1]).connections.includes(group[j]));}
 const m=match({...settings,mapId:map.id});m.players[0].currentNodeId=map.cleansingNodeIds[0];m.players[0].hp=8;m.players[0].statusEffects=[{id:'radiation',remainingTurns:3}];resolveTile(m,map,rng());assert.equal(m.players[0].hp,18);assert.deepEqual(m.players[0].statusEffects,[]);assert.ok(m.events.some(e=>e.kind==='CLEANSED'));}
});
test('regional events mark treasure, bounty and forecast damage on the authoritative map',()=>{
 const m=match(),map=mapRegistry.get(m.mapId);pirateTreasure.execute(m,{map,random:rng(),playerId:'a'});jungleBounty.execute(m,{map,random:rng(),playerId:'a'});eruptionForecast.execute(m,{map,random:rng(),playerId:'a'});
 assert.deepEqual(m.boardEffects.map(e=>e.kind),['treasure','breeze','eruption']);m.players[0].currentNodeId=m.boardEffects[0].nodeIds[0];const before=m.players[0].coins;resolveTile(m,map,rng());assert.ok(m.players[0].coins>=before+5);assert.equal(m.boardEffects[0].nodeIds.length,2);
 m.players[0].currentNodeId=m.boardEffects[2].nodeIds[0];m.phase='ROUND_END';m.round=2;m.minigame=null;const next=advance(m,settings,rng(),90000);assert.equal(next.players[0].hp,10);assert.equal(next.boardEffects.length,0);
});
test('team wins and draws give equal rewards to partners and award both winners a win',()=>{
 for(const id of ['rope-rescue','paddle-doubles'])for(const draw of [false,true]){const m=match();startMinigame(m,id,rng(),-7000);const d=minigameRegistry.get(id),s=m.minigame.state;
 if(id==='rope-rescue')for(const p of Object.values(s.players))p.score=draw?0:p.team===0?100:0;else s.teamScores=draw?[0,0]:[7,2];
 const scores=d.scores(s);finishMinigame(m,rng(),99999);for(const p of m.players){const win=d.teamOf(s,p.id)===d.teamOf(s,m.minigame.results[0].playerId);assert.equal(m.minigame.rewards[p.id],draw?5:win?8:3);assert.equal(m.stats[p.id].minigameWins,draw?0:win?1:0);assert.equal(m.minigame.results.find(r=>r.playerId===p.id).score,scores[p.id]);}}
});
test('all four new minigames simulate full matches at all five difficulties without exposing bot plans',()=>{
 for(const id of ['tide-treasure','comet-courier','rope-rescue','paddle-doubles'])for(const difficulty of DIFFICULTIES){const d=minigameRegistry.get(id),s=make(d,difficulty),random=rng(91);for(let now=0;now<=s.endsAt && !d.isFinished?.(s);now+=100){for(const bot of players())for(const a of d.botInputs(s,{...bot,isBot:true,difficulty},now,random)){const parsed=d.parseInput(a.input);assert.ok(parsed);d.tick?.(s,a.at);try{d.applyInput(s,bot.id,parsed,a.at);}catch(e){assert.match(e.message,/over|wait|finished|running/i);}}d.tick?.(s,Math.min(now+100,s.endsAt));}
 const scores=d.scores(s);assert.ok(Object.values(scores).every(Number.isFinite));assert.equal(new Set(d.rank(s,players().map(p=>p.id),random)).size,4);const view=d.publicView(s,s.endsAt,'a');assert.equal(view.bots,undefined);assert.equal(view.seed,undefined);assert.equal(view.controls,undefined);if(difficulty==='extreme')assert.ok(Object.values(scores).some(v=>v>0) || id==='paddle-doubles' && Object.values(s.players).some(p=>p.returns>0),id+' must have meaningful scores');}
});
test('Extreme consistently outperforms Beginner and Hard in rhythm timing',()=>{
 const means={};for(const difficulty of ['beginner','hard','extreme']){let sum=0;for(let seed=1;seed<=10;seed++){const d=minigameRegistry.get('rhythm-rush'),s=make(d,difficulty,seed),random=rng(seed+100);for(let now=0;now<s.endsAt;now+=50){for(const a of d.botInputs(s,{id:'a',isBot:true,difficulty},now,random))d.applyInput(s,'a',a.input,a.at);d.tick(s,now);}sum+=s.players.a.score;}means[difficulty]=sum/10;}assert.ok(means.extreme>means.hard*1.2);assert.ok(means.hard>means.beginner*1.3);
});
test('shape overlap follows drawn geometry, uncommon targets are smaller and rare',()=>{
 const d=minigameRegistry.get('circle-shot'),s=make(d);assert.equal(shapeOverlap('square',150,300),.5);assert.equal(shapeOverlap('diamond',150,300),.25);assert.equal(shapeOverlap('triangle',150,300),.25);assert.equal(new Set(s.circles.map(c=>c.shape)).size,4);assert.ok(new Set(s.circles.map(c=>c.windowMs)).size>3);assert.ok(s.circles.filter(c=>c.value===1).length>s.circles.filter(c=>c.value>1).length);assert.ok(s.circles.every(c=>c.value===1?c.radius===28:c.radius<28));
});
test('guard reduces damage and knockback, blocks punches, and collapsed islands cannot support a player',()=>{
 const s=make(lavaKnockback);Object.assign(s.players.a,{x:0,z:0,y:0,yaw:0});Object.assign(s.players.b,{x:0,z:-1.5,y:0,guarding:true});s.players.c.x=10;s.players.d.x=-10;
 lavaKnockback.applyInput(s,'a',{type:'KNOCKBACK_CONTROL',x:0,z:0,yaw:0,punch:true,jump:false},0);lavaKnockback.applyInput(s,'b',{type:'KNOCKBACK_CONTROL',x:0,z:0,yaw:0,punch:true,jump:false,guard:true},0);lavaKnockback.tick(s,20);assert.equal(s.players.b.hp,197);assert.equal(s.players.b.hits,0);assert.ok(Math.abs(s.players.b.vz)<=2.5);
 assert.equal(onHellIsland(-9,-9,24999),true);assert.equal(onHellIsland(-9,-9,25000),false);assert.equal(onHellIsland(0,0,74000),true);
});

test('Tide Treasure banks carried gems and rising water drops only unbanked treasure',()=>{
 const d=minigameRegistry.get('tide-treasure'),s=make(d);s.treasures=[];
 Object.assign(s.players.a,{x:10,y:50,carried:8,score:4});d.tick(s,20);assert.equal(s.players.a.score,12);assert.equal(s.players.a.carried,0);
 s.simTime=14000;Object.assign(s.players.a,{x:95,y:90,carried:5});d.tick(s,14020);
 assert.equal(s.players.a.score,12);assert.equal(s.players.a.carried,0);assert.equal(s.players.a.losses,1);assert.equal(s.players.a.x,10);assert.ok(s.players.a.stunnedUntil>14020);
});
test('Comet Courier rewards matching pads, guards dash cooldown and drops struck parcels',()=>{
 const d=minigameRegistry.get('comet-courier'),s=make(d);s.parcels=s.parcels.slice(0,1);const parcel=s.parcels[0];
 Object.assign(s.players.a,{x:10,y:12,parcel:0});Object.assign(parcel,{carrier:'a',destination:0,value:3});d.tick(s,20);
 assert.equal(s.players.a.score,3);assert.equal(s.players.a.parcel,null);assert.equal(parcel.carrier,null);assert.equal(parcel.respawnAt,1520);
 Object.assign(s.players.a,{x:50,y:50});Object.assign(s.players.b,{x:52,y:50,parcel:0});Object.assign(parcel,{carrier:'b',x:52,y:50,respawnAt:0});
 d.applyInput(s,'a',{type:'FESTIVAL_MOVE',x:0,y:0,action:true},20);d.tick(s,40);
 assert.equal(s.players.b.parcel,null);assert.equal(parcel.carrier,null);assert.equal(s.players.b.stunnedUntil,540);const nextDash=s.players.a.nextDashAt;
 d.applyInput(s,'a',{type:'FESTIVAL_MOVE',x:0,y:0,action:false},40);d.tick(s,60);d.applyInput(s,'a',{type:'FESTIVAL_MOVE',x:0,y:0,action:true},60);d.tick(s,80);assert.equal(s.players.a.nextDashAt,nextDash);
});
test('Rope Rescue allows safe waits, punishes unsafe jumps and swaps roles for both partners',()=>{
 const d=minigameRegistry.get('rope-rescue'),s=make(d),team=s.teams[0];const runner=team.ids.find(id=>!s.players[id].operator),operator=team.ids.find(id=>s.players[id].operator);
 team.progress=22;team.lever=50;d.applyInput(s,runner,{type:'FESTIVAL_MOVE',x:1,y:0,action:false},0);d.tick(s,20);assert.equal(team.progress,22);assert.equal(team.falls,0);
 d.applyInput(s,runner,{type:'FESTIVAL_MOVE',x:1,y:0,action:true},20);d.tick(s,40);assert.equal(team.progress,0);assert.equal(team.falls,1);
 s.simTime=1000;team.progress=22;team.lever=30;d.applyInput(s,runner,{type:'FESTIVAL_MOVE',x:1,y:0,action:false},1000);d.tick(s,1020);assert.ok(team.progress>22);assert.equal(team.checkpoint,24);
 s.simTime=29990;d.tick(s,30000);assert.equal(s.swapped,true);assert.equal(s.players[runner].operator,true);assert.equal(s.players[operator].operator,false);assert.deepEqual(s.controls,{});
});
test('Paddle Doubles scores golden comets equally, stops at seven, and validates movement',()=>{
 const d=minigameRegistry.get('paddle-doubles'),s=make(d);s.serveAt=0;s.ball={x:99.9,y:50,vx:40,vy:0,value:2};s.teamScores=[5,0];d.tick(s,10);
 assert.deepEqual(s.teamScores,[7,0]);assert.equal(d.isFinished(s),true);for(const p of Object.values(s.players))assert.equal(p.score,p.team===0?7:0);
 const before=structuredClone(s);d.tick(s,5000);assert.deepEqual(s,before);
 assert.equal(d.parseInput({type:'FESTIVAL_MOVE',x:Infinity,y:0,action:false}),null);assert.equal(d.parseInput({type:'FESTIVAL_MOVE',x:0,y:2,action:false}),null);
});

test('room snapshots broadcast all-human readiness and never include local practice rewards',()=>{
 const rooms=new PartyRooms(),messagesA=[],messagesB=[];
 const a=rooms.connect(undefined,m=>messagesA.push(structuredClone(m))),b=rooms.connect(undefined,m=>messagesB.push(structuredClone(m)));
 rooms.handle(a,{type:'CREATE',name:'Festival ready test',playerName:'Host',public:false});const room=rooms.rooms.get(a.room);
 rooms.handle(b,{type:'JOIN',code:room.code,playerName:'Guest'});
 rooms.handle(a,{type:'SETTINGS',settings:{...room.settings,mode:'festival',roundLimit:3,minigameIds:['comet-courier']}});
 for(const session of [a,b])rooms.handle(session,{type:'READY',ready:true});rooms.handle(a,{type:'START'});
 const startCoins=room.match.players.map(p=>p.coins);
 rooms.handle(a,{type:'ACTION',action:{type:'MINIGAME_READY'}});rooms.tick(Date.now()+100000);
 assert.equal(room.match.phase,'MINIGAME_INTRO');assert.equal(room.match.minigame.awaitingReady,true);assert.deepEqual(room.match.players.map(p=>p.coins),startCoins);
 rooms.handle(b,{type:'ACTION',action:{type:'MINIGAME_READY'}});
 for(const messages of [messagesA,messagesB]){const snapshot=messages.at(-1).lobby.match;assert.equal(snapshot.minigame.awaitingReady,false);assert.ok(snapshot.minigame.readyPlayerIds.includes(a.id));assert.ok(snapshot.minigame.readyPlayerIds.includes(b.id));assert.equal(snapshot.minigame.state.seed,undefined);assert.equal(snapshot.minigame.state.controls,undefined);assert.equal(snapshot.minigame.rewards,null);}
});

test('Bay, Club and Ruins events provide healing, location-based discounts and consumable relic caches',()=>{
 const map=mapRegistry.get('sunspill'),m=match();calmWaters.execute(m,{map,random:rng(),playerId:'a'});coconutMarket.execute(m,{map,random:rng(),playerId:'a'});ruinsRelics.execute(m,{map,random:rng(),playerId:'a'});
 assert.deepEqual(m.boardEffects.map(e=>e.kind),['sanctuary','sale','relic']);
 for(const e of m.boardEffects)assert.equal(new Set(e.nodeIds.map(id=>map.nodes.find(n=>n.id===id).region)).size,1);
 m.players[0].hp=10;m.players[0].currentNodeId=m.boardEffects[0].nodeIds.find(id=>map.nodes.find(n=>n.id===id).type==='coin');const wallet=m.players[0].coins;resolveTile(m,map,rng());assert.equal(m.players[0].hp,15);assert.equal(m.players[0].coins,wallet+3);
 const relic=m.boardEffects[2],node=relic.nodeIds[0];m.players[0].currentNodeId=node;const before=m.players[0].coins;resolveTile(m,map,rng());assert.equal(m.players[0].inventory.length,1);assert.equal(m.players[0].coins,before);assert.equal(relic.nodeIds.length,2);assert.ok(!relic.nodeIds.includes(node));
 m.players[1].currentNodeId=m.boardEffects[1].nodeIds[0];m.players[1].coins=30;assert.equal(shopPrice(m,'b','mega-medkit'),4);const normal=action(m,'b',{type:'BUY_ITEM',mystery:false,itemId:'mega-medkit'});assert.equal(normal.players[1].coins,26);
 const mystery=action(m,'b',{type:'BUY_ITEM',mystery:true});assert.equal(mystery.players[1].coins,20);
 m.players[1].currentNodeId=map.start;assert.equal(shopPrice(m,'b','mega-medkit'),6);
});
test('route previews describe exact landings, cleansing, event timing and relic field overrides',()=>{
 const m=match(),map=mapRegistry.get(m.mapId);m.movesRemaining=1;const next=map.nodes.find(n=>n.id===m.players[0].currentNodeId).connections[0];assert.deepEqual(routePreview(m,map,next).landings,[next]);
 const clean=map.cleansingNodeIds[0];assert.match(landingDescription(m,map,clean),/cleanse \+10 HP/);
 m.boardEffects=[{id:'forecast',kind:'eruption',nodeIds:[next],expiresAfterRound:3}];assert.match(routePreview(m,map,next).summaries[0],/10 HP at end of round 3/);
 m.boardEffects=[{id:'relic',kind:'relic',nodeIds:[next],expiresAfterRound:3}];assert.match(landingDescription(m,map,next),/relic item instead of normal field/);
});
test('fixed board matches do not end at the race target and rank only after the final round',()=>{
 const cfg={...DEFAULT_SETTINGS,roundLimit:1,plutoTarget:1},m=match(cfg);m.players[1].goldenPlutos=2;m.players[0].goldenPlutos=1;
 const rolling=action(m,'a',{type:'ROLL_DICE'},cfg);assert.equal(rolling.phase,'DICE_ROLL');assert.equal(rolling.winner,null);
 rolling.phase='ROUND_END';const ended=advance(rolling,cfg,rng(),90000);assert.equal(ended.phase,'GAME_OVER');assert.equal(ended.winner,'b');assert.equal(ended.round,1);
});
