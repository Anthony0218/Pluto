import test from 'node:test';
import assert from 'node:assert/strict';
import { initialGame, update } from '../src/games/natura/naturafunctions.ts';
import { GRASS, PERCH } from '../src/games/natura/naturaData.ts';
import { createLaneOcean, makeOceanWave, updateLaneOcean } from '../src/games/natura/laneOcean.ts';
import { createExpedition, updateExpedition, idleExpeditionInput, spiderAI, SPIDER_COURSES } from '../src/games/natura/expeditions.ts';
const advance=(fn,seconds,fps=60)=>{for(let i=0;i<seconds*fps;i++)fn(1/fps);};
const idle=()=>[idleExpeditionInput(),idleExpeditionInput()];
test('meadow has seven shelters; each dive consumes one charge and climbs back',()=>{
  assert.equal(GRASS.length,7);const g=initialGame('duo');g.phase='hunt';g.invincible=999;
  for(let i=0;i<5;i++) { update(g,new Set(['Space']),1/60); assert.equal(g.attacks,4-i);advance(dt=>update(g,new Set(),dt),2.5);assert.ok(g.falcon.y<=106);assert.equal(g.recovering,false); }
  update(g,new Set(['Space']),1/60);assert.equal(g.dive,0);assert.equal(g.attacks,0);
});
test('holding attack cannot spend multiple charges and recharge requires staying at perch',()=>{
  const g=initialGame('duo');g.phase='hunt';g.invincible=999;advance(dt=>update(g,new Set(['Space']),dt),5);assert.equal(g.attacks,4);
  g.attacks=0;advance(dt=>update(g,new Set(),dt),2.2);assert.equal(g.attacks,0);
  g.falcon={x:PERCH.x+PERCH.width/2,y:PERCH.y-16};advance(dt=>update(g,new Set(),dt),1);assert.equal(g.attacks,0);
  update(g,new Set(['KeyD']),0.1);assert.equal(g.perchFocus,0);
  g.falcon={x:PERCH.x+PERCH.width/2,y:PERCH.y-16};advance(dt=>update(g,new Set(),dt),2.1);assert.equal(g.attacks,5);
});
test('AI kestrel returns to the perch after spending its dives',()=>{
  const g=initialGame('solo','mouse');g.phase='hunt';g.attacks=0;g.falcon={x:700,y:300};g.invincible=999;
  advance(dt=>update(g,new Set(),dt),5);assert.ok(g.attacks>0);
});
test('bot difficulty changes kestrel chase speed and spider opening',()=>{
  const easy=initialGame('solo','mouse'), hard=initialGame('solo','mouse');
  for(const game of [easy,hard]) { game.phase='hunt'; game.falcon={x:100,y:110}; game.mouse={x:700,y:350}; game.invincible=999; }
  update(easy,new Set(),0.1,'easy');update(hard,new Set(),0.1,'hard');
  assert.ok(hard.falcon.x>easy.falcon.x);
  const spider=createExpedition('jumpingspider');spider.elapsed=1;
  assert.equal(spiderAI(spider,'easy').action,false);
  assert.equal(spiderAI(spider,'hard').action,true);
});
test('ocean waves always leave a safe lane and cover all possible lanes',()=>{
  const seen=new Set();for(let i=0;i<90;i++){const w=makeOceanWave(i,'sky',()=>i%3/3);assert.ok(w.lanes.length<=2);w.lanes.forEach(l=>seen.add(l));assert.equal(w.kind,'gull');assert.equal(makeOceanWave(i,'water').kind,'tuna');}assert.equal(seen.size,3);
});
test('lane controls need release and interpolate to exact lane positions',()=>{
  const g=createLaneOcean();g.phase='playing';advance(dt=>updateLaneOcean(g,[-1,0],dt,true),0.5);assert.equal(g.players[0].lane,0);assert.equal(g.players[0].x,-5);
  advance(dt=>updateLaneOcean(g,[1,0],dt,true),0.5);assert.equal(g.players[0].lane,1);updateLaneOcean(g,[0,0],1/60,true);advance(dt=>updateLaneOcean(g,[1,0],dt,true),0.5);assert.equal(g.players[0].lane,2);assert.equal(g.players[0].x,5);
});
test('head-on arrivals resolve collision and dodge once for both players',()=>{
  const g=createLaneOcean();g.phase='playing';g.spawn=100;g.players[0].x=-5;g.players[0].lane=0;g.players[1].x=5;g.players[1].lane=2;
  g.waves=[{id:0,z:-0.05,lanes:[0,1],kind:'gull',resolved:[false,false]}];updateLaneOcean(g,[0,0],1/60,false);
  assert.equal(g.players[0].lives,2);assert.equal(g.players[1].score,1);advance(dt=>updateLaneOcean(g,[0,0],dt,false),0.5);assert.equal(g.players[0].lives,2);assert.equal(g.players[1].score,1);
});
test('new worlds stay frozen when paused and ignore invalid frame deltas',()=>{
  for(const g of [createExpedition('jumpingspider'),createExpedition('spermwhale')]){
    g.phase='paused';const before=structuredClone(g);updateExpedition(g,idle(),0.1,true);assert.deepEqual(g,before);
    g.phase='playing';const active=structuredClone(g);for(const t of [NaN,-1,0])updateExpedition(g,idle(),t,true);assert.deepEqual(g,active);
  }
  const o=createLaneOcean();o.phase='paused';const before=structuredClone(o);updateLaneOcean(o,[1,1],0.1,false);assert.deepEqual(o,before);
});
test('all eight large spider courses are completable by the rival using normal jumps',()=>{
  SPIDER_COURSES.forEach((_,level)=>{const g=createExpedition('jumpingspider',level);g.phase='playing';assert.equal(g.platforms.length,24);assert.ok(Math.abs(g.platforms.at(-1).z)>120);advance(dt=>updateExpedition(g,idle(),dt,true),180);assert.equal(g.winner,1);assert.equal(g.players[1].progress,23);});
});
test('silk rescue consumes silk before hearts; checkpoint landing restores silk',()=>{
  const g=createExpedition('jumpingspider');g.phase='playing';const p=g.players[0];p.y=-12;p.grounded=false;updateExpedition(g,idle(),1/60,false);assert.equal(p.silk,1);assert.equal(p.lives,3);assert.equal(p.y,0);
  p.silk=0;p.y=-12;p.grounded=false;updateExpedition(g,idle(),1/60,false);assert.equal(p.lives,2);
  const checkpoint=g.platforms[4];Object.assign(p,{x:checkpoint.x,z:checkpoint.z,y:checkpoint.y+0.001,vy:-1,grounded:false});updateExpedition(g,idle(),1/60,false);assert.equal(p.checkpoint,4);assert.equal(p.silk,2);
});
test('whale sonar has a cooldown; prey need proximity and repeated bites; victory needs surfacing',()=>{
  const g=createExpedition('spermwhale');g.phase='playing';const p=g.players[0];
  updateExpedition(g,[{...idleExpeditionInput(),special:true},idleExpeditionInput()],1/60,true);assert.ok(p.sonar>3);assert.ok(p.sonarCooldown>5);
  for(const squid of g.squids.filter(s=>s.owner===0)){
    Object.assign(p,{x:squid.x,y:squid.y,z:squid.z,flash:100});
    for(let i=0;i<3;i++){updateExpedition(g,[{...idleExpeditionInput(),action:true},idleExpeditionInput()],1/60,true);advance(dt=>updateExpedition(g,idle(),dt,true),0.85);}
    assert.equal(squid.health,0);
  }
  assert.equal(p.food,3);assert.equal(g.phase,'playing');p.y=-1;updateExpedition(g,idle(),1/60,true);assert.equal(g.winner,0);assert.equal(g.phase,'finished');
});
test('squid attacks are telegraphed and leaving the radius avoids damage',()=>{
  const g=createExpedition('spermwhale');g.phase='playing';const p=g.players[0],s=g.squids[0];Object.assign(p,{x:s.x,y:s.y,z:s.z});s.cooldown=0;
  updateExpedition(g,idle(),1/60,true);assert.ok(s.warning>1);assert.equal(p.lives,3);p.x+=15;advance(dt=>updateExpedition(g,idle(),dt,true),1.5);assert.equal(p.lives,3);
  Object.assign(p,{x:s.x,y:s.y,z:s.z});s.cooldown=0;advance(dt=>updateExpedition(g,idle(),dt,true),1.5);assert.equal(p.lives,2);
});
test('surfacing refills breath and oxygen exhaustion costs health',()=>{
  const g=createExpedition('spermwhale');g.phase='playing';const p=g.players[0];p.oxygen=1;p.y=-30;advance(dt=>updateExpedition(g,idle(),dt,true),1.1);assert.equal(p.lives,2);p.y=-1;advance(dt=>updateExpedition(g,idle(),dt,true),2);assert.ok(p.oxygen>45);
});
test('spider traversal is stable across common frame rates',()=>{
  const outcomes=[30,60,120].map(fps=>{const g=createExpedition('jumpingspider',2);g.phase='playing';advance(dt=>updateExpedition(g,idle(),dt,true),70,fps);return [g.players[1].progress,g.players[1].lives];});assert.deepEqual(outcomes[0],outcomes[1]);assert.deepEqual(outcomes[1],outcomes[2]);
});
