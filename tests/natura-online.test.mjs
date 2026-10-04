import test from 'node:test';
import assert from 'node:assert/strict';
import { NaturaRooms, RECONNECT_MS } from '../src/games/natura/rooms.ts';
import { NATURA_SCENARIOS } from '../src/games/natura/protocol.ts';
import { IDLE_INTENT } from '../src/games/natura/input.ts';
const config=(scenario='meadow')=>({scenario,variant:'race',level:0,seed:777,difficulty:'normal'});
const connect=(rooms)=>{const messages=[];const session=rooms.connect(undefined,m=>messages.push(structuredClone(m)));return {session,messages};};
const setup=(scenario='meadow')=>{const rooms=new NaturaRooms(),a=connect(rooms),b=connect(rooms);rooms.handle(a.session,{type:'CREATE',name:'Coral',config:config(scenario)});const room=rooms.rooms.get(a.session.room);rooms.handle(b.session,{type:'JOIN',name:'Gold',code:room.code});return {rooms,a,b,room};};
const start=({rooms,a,b,room},now=1000)=>{rooms.handle(a.session,{type:'READY',ready:true},now);rooms.handle(b.session,{type:'READY',ready:true},now);rooms.handle(a.session,{type:'START'},now);return room;};
test('all nine habitats start as browser-hosted simulations with separate seat snapshots',()=>{
  for(const scenario of NATURA_SCENARIOS){const s=setup(scenario),room=start(s);s.rooms.tick(1/60,2300);s.rooms.broadcast(room,2300);assert.equal(room.status,'playing');assert.ok(room.world);assert.equal(s.a.messages.at(-1).seat,0);assert.equal(s.b.messages.at(-1).seat,1);assert.ok(room.world.kind==='meadow'?room.world.game.t>0:'game' in room.world?room.world.game.elapsed>0:room.world.elapsed>0);}
});
test('membership, readiness, host configuration and rematch transitions are enforced',()=>{
  const s=setup();assert.throws(()=>s.rooms.handle(s.b.session,{type:'START'}));assert.throws(()=>s.rooms.handle(s.a.session,{type:'START'}));assert.throws(()=>s.rooms.handle(s.b.session,{type:'CONFIG',config:config('bolas')}));
  s.rooms.handle(s.a.session,{type:'READY',ready:true});s.rooms.handle(s.a.session,{type:'CONFIG',config:config('bolas')});assert.equal(s.a.session.ready,false);
  start(s);assert.throws(()=>s.rooms.handle(s.a.session,{type:'CONFIG',config:config()}));s.rooms.finish(s.room,{winner:1,detail:'Done'});assert.deepEqual(s.room.scores,[0,3]);assert.throws(()=>s.rooms.handle(s.b.session,{type:'REMATCH'}));s.rooms.handle(s.a.session,{type:'REMATCH'});assert.equal(s.room.status,'lobby');assert.equal(s.room.round,2);assert.equal(s.room.world,null);assert.ok(s.room.seats.every(p=>!p.ready));
});
test('input is applied only to sender seat, ordered and expires instead of leaving held movement',()=>{
  const s=setup('coconut');start(s);const before=s.room.world.players.map(p=>p.x);
  s.rooms.handle(s.b.session,{type:'INPUT',seq:5,intent:{...IDLE_INTENT(),x:1}},2300);s.rooms.handle(s.b.session,{type:'INPUT',seq:4,intent:{...IDLE_INTENT(),x:-1}},2300);s.rooms.tick(0.05,2300);
  assert.equal(s.room.world.players[0].x,before[0]);assert.ok(s.room.world.players[1].x>before[1]);const x=s.room.world.players[1].x;s.rooms.tick(0.05,2700);assert.equal(s.room.world.players[1].x,x);
});
test('disconnect pauses, token resumes same seat, both players consent to resume, grace forfeits',()=>{
  const s=setup('coconut');start(s);s.rooms.tick(0.05,2300);const elapsed=s.room.world.elapsed;s.rooms.disconnect(s.b.session,2400);s.rooms.tick(0.05,2450);assert.equal(s.room.world.elapsed,elapsed);assert.equal(s.room.status,'paused');
  const received=[];const resumed=s.rooms.connect(s.b.session.token,m=>received.push(m),'test',undefined,2500);assert.equal(resumed.id,s.b.session.id);assert.equal(received[0].resumed,true);assert.equal(received.at(-1).seat,1);
  s.rooms.handle(s.a.session,{type:'READY',ready:true},2600);assert.equal(s.room.status,'paused');s.rooms.handle(resumed,{type:'READY',ready:true},2600);assert.equal(s.room.status,'playing');s.rooms.tick(0.05,2700);assert.equal(s.room.world.elapsed,elapsed);
  s.rooms.disconnect(resumed,3800);s.rooms.tick(0.05,3801+RECONNECT_MS);assert.equal(s.room.status,'finished');assert.equal(s.room.result.winner,0);assert.deepEqual(s.room.scores,[3,0]);
});
test('expired disconnected lobby seat is released and host transfers safely',()=>{
  const s=setup();s.rooms.disconnect(s.a.session,1000);s.rooms.tick(0,1001+RECONNECT_MS);assert.equal(s.room.seats[0],null);assert.equal(s.room.host,s.b.session.id);assert.equal(s.a.session.room,null);const c=connect(s.rooms);s.rooms.handle(c.session,{type:'JOIN',name:'New',code:s.room.code});assert.equal(s.room.seats[0].id,c.session.id);
});
test('outsiders cannot input, unknown tokens cannot reclaim identity, leaves award one forfeit',()=>{
  const s=setup(),outsider=connect(s.rooms);assert.throws(()=>s.rooms.handle(outsider.session,{type:'INPUT',seq:0,intent:IDLE_INTENT()}));const stranger=s.rooms.connect('wrong-token',()=>{});assert.notEqual(stranger.id,s.a.session.id);start(s);s.rooms.leave(s.b.session);assert.equal(s.room.result.winner,0);assert.deepEqual(s.room.scores,[3,0]);s.rooms.leave(s.b.session);assert.deepEqual(s.room.scores,[3,0]);
});
