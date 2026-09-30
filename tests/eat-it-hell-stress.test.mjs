import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createGame,fillBots,stepGame } from '../src/games/eat-it/engine.ts';
import { EAT } from '../src/games/eat-it/config.ts';
for(const map of ['city','nature'])test(`${map}: eight-participant timed solo match completes with bounded Hell state`,t=>{
 const s=createGame(map,fillBots([],8),886,'stress',{mode:'solo',matchDuration:120});const start=performance.now();let ticks=0,hellTicks=0,hellMs=0;
 while(s.status==='playing'&&ticks<30*900){const before=performance.now();stepGame(s);ticks++;if(s.phase==='hell'){hellTicks++;hellMs+=performance.now()-before}if(ticks%300===0){assert.ok(s.food.length<=EAT.food.maxObjects);assert.ok(s.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.mass)));assert.ok((s.timeline?.length??0)<=256)}}
 assert.equal(s.status,'finished');assert.ok(s.result==='winner'||s.result==='tie');assert.ok(s.players.every(p=>p.lives>=0));if(s.hell){assert.equal(s.hell.cells.length,EAT.hell.columns*EAT.hell.rows);assert.ok(hellTicks>0)}
 t.diagnostic(JSON.stringify({map,ticks,seconds:s.time,wallMs:performance.now()-start,hellTicks,hellMeanMs:hellMs/Math.max(1,hellTicks),snapshotBytes:JSON.stringify(s).length,result:s.result}));
});
