import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld,startWorld,stepWorld,measureRun } from '../src/games/natura/world.ts';
import { IDLE_INTENT } from '../src/games/natura/input.ts';
import { NATURA_SCENARIOS,parseConfig,parseIntent,parseNaturaMessage } from '../src/games/natura/protocol.ts';
import { hotseatTurns,hotseatStandings,compareRuns } from '../src/games/natura/hotseat.ts';
import { privateWorld } from '../src/games/natura/privateView.ts';
import { createAbyssDuel,updateAbyssDuel,duelEcho,duelOpponentVisible } from '../src/games/natura/abyssDuel.ts';
import { createSnapGame,snapPlatforms,snapGates,snapTrajectory,updateWildGame,idleWildInput,SNAP_LEVELS } from '../src/games/natura/wildModes.ts';
import { createExpedition,expeditionPlatforms,spiderGates,updateExpedition,idleExpeditionInput,SPIDER_STUDIES } from '../src/games/natura/expeditions.ts';
const config=(scenario='meadow',variant='race')=>({scenario,variant,level:0,seed:420,difficulty:'normal'});
test('all nine hotseat schedules pair identical seeds, roles and initial worlds',()=>{
  for(const scenario of NATURA_SCENARIOS)for(const variant of scenario==='spermwhale'?['race','pursuit']:['race']){
    const turns=hotseatTurns(config(scenario,variant));assert.equal(turns.length,scenario==='meadow'||variant==='pursuit'?4:2);
    for(let i=0;i<turns.length;i+=2){const [a,b]=turns.slice(i,i+2);assert.notEqual(a.player,b.player);assert.equal(a.seed,b.seed);assert.equal(a.role,b.role);
      const x=makeWorld(scenario,'ai',1,0,'normal',{...config(scenario,variant),...a}),y=makeWorld(scenario,'ai',1,0,'normal',{...config(scenario,variant),...b});assert.deepEqual(x,y);}
  }
});
test('hotseat compares role pairs independently, handles draws and rounds time ties',()=>{
  const turns=hotseatTurns(config()),p=(progress,elapsed=10)=>({completed:false,progress,health:3,elapsed,label:'test'});
  assert.equal(compareRuns(p(2,10.01),p(2,10.04)),null);assert.equal(compareRuns({...p(1),completed:true},p(100)),0);
  const records=turns.map((turn,i)=>({turn,performance:p(i===0||i===3?10:5)}));assert.deepEqual(hotseatStandings(records),{points:[1,1],winner:null});
});
test('seeded meadow respawns and ocean waves are independent of other simulations',()=>{
  for(const scenario of ['meadow','flyingfish']){
    const a=makeWorld(scenario,'ai',1,0,'normal',{seed:71}),b=makeWorld(scenario,'ai',1,0,'normal',{seed:71}),noise=makeWorld(scenario,'ai',1,0,'normal',{seed:72});[a,b,noise].forEach(startWorld);
    if(scenario==='meadow'){a.game.phase=b.game.phase='capture';a.game.captureTime=b.game.captureTime=0.01;}
    for(let i=0;i<300;i++){stepWorld(a,[IDLE_INTENT(),IDLE_INTENT()],1/60,true,'normal');stepWorld(noise,[IDLE_INTENT(),IDLE_INTENT()],1/30,true,'normal');stepWorld(b,[IDLE_INTENT(),IDLE_INTENT()],1/60,true,'normal');}
    assert.deepEqual(a,b);assert.notDeepEqual(a,noise);
  }
});
test('cosmetic dive particles do not change the seeded prey respawn schedule',()=>{
  const a=makeWorld('meadow','hotseat',1,0,'normal',{seed:91}),b=structuredClone(a);startWorld(a);startWorld(b);
  stepWorld(a,[{...IDLE_INTENT(),action:true},IDLE_INTENT()],0.01,false,'normal');assert.notEqual(a.game.visualRandomState,b.game.visualRandomState);assert.equal(a.game.randomState,b.game.randomState);
  a.game.phase=b.game.phase='capture';a.game.captureTime=b.game.captureTime=0.001;stepWorld(a,[IDLE_INTENT(),IDLE_INTENT()],0.01,false,'normal');stepWorld(b,[IDLE_INTENT(),IDLE_INTENT()],0.01,false,'normal');assert.deepEqual(a.game.mouse,b.game.mouse);
});
test('concealed vole position, patch, tunnel exit, shadow inputs and RNG never enter predator payload',()=>{
  const a=makeWorld('meadow','hotseat',1,0,'normal'),b=structuredClone(a);startWorld(a);startWorld(b);
  a.game.mouse={x:70,y:378};b.game.mouse={x:680,y:378};a.game.coverTime=b.game.coverTime=2;a.game.coverPatch=0;b.game.coverPatch=4;a.game.burrowExit=0;b.game.burrowExit=1;
  assert.deepEqual(privateWorld(a,0),privateWorld(b,0));assert.equal(privateWorld(a,0).hidden.vole,true);assert.deepEqual(privateWorld(a,1).world.game.mouse,a.game.mouse);
  a.game.coverTime=0;assert.equal(privateWorld(a,0).hidden.vole,false);
});
test('squid private payload has no live hidden position, velocity, AI memory or remote echoes',()=>{
  const a=createAbyssDuel(),b=structuredClone(a);b.players[1].x=-25;b.players[1].velocity.x=7;b.lastSeen.x=17;
  assert.deepEqual(privateWorld(a,0),privateWorld(b,0));assert.equal(privateWorld(a,0).hidden.duelOpponent,true);
  assert.deepEqual(privateWorld(a,1).world.players[1],a.players[1]);
});
test('protocol rejects invalid magnitudes, NaN, targets, skin and incompatible course variants',()=>{
  for(const bad of [{...IDLE_INTENT(),x:2},{...IDLE_INTENT(),y:NaN},{...IDLE_INTENT(),pattern:6},{...IDLE_INTENT(),target:{x:Infinity,y:0}}])assert.throws(()=>parseIntent(bad));
  assert.deepEqual(parseIntent({...IDLE_INTENT(),score:999,id:'other',position:{x:100}}),IDLE_INTENT());
  assert.throws(()=>parseConfig({...config('coconut'),variant:'pursuit'}));assert.throws(()=>parseConfig({...config('jumpingspider'),level:8}));assert.throws(()=>parseConfig({...config('bolas'),level:1}));assert.throws(()=>parseNaturaMessage({type:'INPUT',seq:-1,intent:IDLE_INTENT()}));
  assert.equal(parseConfig({...config('trapjaw'),level:15}).level,15);
});
test('burst and ink have bounded duration, recharge and no repeated held activation',()=>{
  const g=createAbyssDuel();g.phase='playing';const squid=g.players[1];
  updateAbyssDuel(g,[IDLE_INTENT(),{...IDLE_INTENT(),x:1,action:true,secondary:true}],0.1,false);assert.ok(squid.burst>0&&squid.cooldown>5);assert.equal(g.ink.length,1);
  for(let i=0;i<50;i++)updateAbyssDuel(g,[IDLE_INTENT(),{...IDLE_INTENT(),action:true,secondary:true}],0.1,false);
  assert.equal(g.ink.length,0);assert.equal(squid.burst,0);assert.ok(squid.specialCooldown>4);assert.ok(Math.abs(squid.velocity.x)<0.01);
});
test('duel sonar is quantized, fixed at pulse time and disrupted by ink',()=>{
  const g=createAbyssDuel();g.phase='playing';updateAbyssDuel(g,[{...IDLE_INTENT(),secondary:true},IDLE_INTENT()],0.01,false);const echoes=structuredClone(g.players[0].echoes);assert.equal(echoes.length,1);assert.equal(echoes[0].bearing%45,0);
  g.players[1].x=-28;updateAbyssDuel(g,[IDLE_INTENT(),IDLE_INTENT()],0.1,false);assert.deepEqual(g.players[0].echoes,echoes);
  g.ink.push({...g.players[0],radius:8,life:5});assert.deepEqual(duelEcho(g),[]);assert.equal(duelOpponentVisible(g,0),false);
});
test('whale bites resolve health once, win after three and squid survival is a real objective',()=>{
  const g=createAbyssDuel();g.phase='playing';Object.assign(g.players[1],{x:g.players[0].x,y:g.players[0].y,z:g.players[0].z});
  for(let i=0;i<3;i++){g.players[1].flash=0;g.players[0].cooldown=0;updateAbyssDuel(g,[{...IDLE_INTENT(),action:true},IDLE_INTENT()],0.01,false);assert.equal(g.players[1].lives,2-i);}
  assert.equal(g.winner,0);assert.equal(g.phase,'finished');const timed=createAbyssDuel(1);timed.phase='playing';timed.time=0.001;updateAbyssDuel(timed,[IDLE_INTENT(),IDLE_INTENT()],0.01,false);assert.equal(timed.winner,1);assert.equal(measureRun(timed,1).completed,true);
});
test('new course metadata denotes actual mechanics, with hard final four and expert final two',()=>{
  assert.equal(SNAP_LEVELS.length,16);assert.ok(SNAP_LEVELS.slice(-4,-2).every(c=>c.difficulty==='Hard'));assert.ok(SNAP_LEVELS.slice(-2).every(c=>c.difficulty==='Expert'));
  assert.equal(SPIDER_STUDIES.length,8);assert.ok(SPIDER_STUDIES.slice(3).every(c=>c.moving||c.wind||c.gates||c.crumble));
  const ant=createSnapGame(10);assert.notDeepEqual(snapPlatforms(ant,0),snapPlatforms(ant,1));assert.ok(snapGates(createSnapGame(12),0).some(g=>g.active));assert.ok(snapGates(createSnapGame(12),5.1).some(g=>g.warning));
  const spider=createExpedition('jumpingspider',4);assert.notDeepEqual(expeditionPlatforms(spider,0),expeditionPlatforms(spider,1));assert.ok(spiderGates(createExpedition('jumpingspider',3),0).some(g=>g.active));
});
test('wind-aware trajectory guide agrees with an actual airborne launch',()=>{
  const g=createSnapGame(11);g.phase='playing';const expected=snapTrajectory(g,g.players[0])[11];
  for(let i=0;i<60;i++)updateWildGame(g,[{...idleWildInput(),action:true},idleWildInput()],1/120,false);
  assert.ok(Math.abs(g.players[0].x-expected.x)<1e-5);assert.ok(Math.abs(g.players[0].y-expected.y)<1e-5);
});
test('crumbling surfaces cannot be immediately relanded; hazards consume a fall/rescue once',()=>{
  const ant=createSnapGame(13);ant.phase='playing';const a=ant.players[0],ledge=snapPlatforms(ant)[1];Object.assign(a,{x:ledge.x+ledge.width/2,y:ledge.y,checkpoint:1,dwell:3.59});updateWildGame(ant,[idleWildInput(),idleWildInput()],0.03,false);assert.equal(a.grounded,false);assert.equal(a.broken,1);
  const g=createExpedition('jumpingspider',6);g.phase='playing';const p=g.players[0],t=expeditionPlatforms(g)[1];Object.assign(p,{x:t.x,y:t.y,z:t.z,standing:1,groundedTime:3.59});updateExpedition(g,[idleExpeditionInput(),idleExpeditionInput()],0.03,false);assert.equal(p.grounded,false);assert.equal(p.broken,1);
  const cave=createExpedition('jumpingspider',3);cave.phase='playing';const gate=spiderGates(cave)[0];Object.assign(cave.players[0],{...gate,grounded:false});updateExpedition(cave,[idleExpeditionInput(),idleExpeditionInput()],0.02,false);assert.equal(cave.players[0].falls,1);assert.equal(cave.players[0].silk,1);assert.equal(cave.players[0].lives,3);
});
