import test from 'node:test';
import assert from 'node:assert/strict';
import { NaturaRelay } from '../src/games/natura/relay.ts';
import { makeRelayIdentity, pairRelayKey, sealRelay, openRelay } from '../src/games/natura/relayCrypto.ts';
import { IDLE_INTENT } from '../src/games/natura/input.ts';

const config={scenario:'spermwhale',variant:'pursuit',level:0,seed:123,difficulty:'normal'};
const wait=async(predicate)=>{for(let i=0;i<300;i++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Relay response timed out');};
class Bus {
  channels=[];packets=[];
  factory=topic=>{
    const c={topic,callback:null,status:null,online:true,
      on:(_event,_filter,callback)=>{c.callback=callback;return c;},
      subscribe:callback=>{c.status=callback;queueMicrotask(()=>callback('SUBSCRIBED'));return c;},
      send:async message=>{this.packets.push(structuredClone(message.payload));if(c.online)for(const other of this.channels)if(other!==c&&other.online&&other.topic===topic)queueMicrotask(()=>other.callback?.({payload:structuredClone(message.payload)}));return 'ok';},
      unsubscribe:async()=>{c.online=false;return 'ok';},
    };this.channels.push(c);return c;
  };
}
async function pair(t) {
  const bus=new Bus(),errors=[],a=new NaturaRelay(bus.factory,()=>{},(_s,e)=>{if(e)errors.push(e);}),b=new NaturaRelay(bus.factory,()=>{},(_s,e)=>{if(e)errors.push(e);});
  t.after(()=>{a.close();b.close();});a.send({type:'CREATE',name:'Whale',config});await wait(()=>a.state&&a.connected);
  b.send({type:'JOIN',name:'Squid',code:a.state.room.code});await wait(()=>b.state?.room.members.every(Boolean));
  return {a,b,bus,errors};
}
async function start({a,b}) {
  a.send({type:'READY',ready:true});b.send({type:'READY',ready:true});await wait(()=>a.state.room.members.every(p=>p?.ready));a.send({type:'START'});await wait(()=>b.state?.room.status==='playing');
}
test('pair encryption conceals snapshots and rejects unrelated keys, tampering and context substitution',async()=>{
  const a=await makeRelayIdentity(),b=await makeRelayIdentity(),c=await makeRelayIdentity();
  const ka=await pairRelayKey(a.keys.privateKey,b.publicKey),kb=await pairRelayKey(b.keys.privateKey,a.publicKey),kc=await pairRelayKey(c.keys.privateKey,a.publicKey);
  const box=await sealRelay(ka,{position:[12,20,30]},'room:host:guest:1');assert.deepEqual(await openRelay(kb,box,'room:host:guest:1'),{position:[12,20,30]});
  await assert.rejects(openRelay(kc,box,'room:host:guest:1'));await assert.rejects(openRelay(kb,box,'different-room'));
  await assert.rejects(openRelay(kb,{...box,data:'AAAA'+box.data.slice(4)},'room:host:guest:1'));assert.ok(!JSON.stringify(box).includes('position'));
});
test('two relay clients configure, ready, start, use squid actions and receive only encrypted seat views',async t=>{
  const s=await pair(t);assert.equal(s.b.state.seat,1);assert.equal(s.a.state.seat,0);await start(s);
  assert.equal(s.b.state.hidden.duelOpponent,true);assert.equal(s.b.state.world.players[0].x,0);assert.equal(s.a.state.world.players[1].x,0);
  assert.ok(s.bus.packets.every(p=>p.type==='hello'||p.type==='welcome'||p.type==='box'));
  assert.ok(!JSON.stringify(s.bus.packets).includes('world'));assert.ok(!JSON.stringify(s.bus.packets).includes('token'));
  await wait(()=>s.b.state.room.countdown===0);
  s.b.setInput({...IDLE_INTENT(),action:true,secondary:true});s.b.clearInput(); // Latching is cleared by explicit handover/pause.
  s.b.setInput({...IDLE_INTENT(),action:true,secondary:true});
  s.b.setInput(IDLE_INTENT()); // A tap shorter than the 100 ms transmit interval must still arrive.
  await wait(()=>s.b.state.world.players[1].cooldown>0&&s.b.state.world.players[1].specialCooldown>0);
  s.b.setInput(IDLE_INTENT());assert.equal(s.errors.length,0);
  s.a.send({type:'PAUSE'});await wait(()=>s.b.state.room.status==='paused');const time=s.a.state.world.time;
  s.a.send({type:'READY',ready:true});assert.equal(s.a.state.room.status,'paused');s.b.send({type:'READY',ready:true});await wait(()=>s.b.state.room.status==='playing');assert.equal(s.a.state.world.time,time);
});
test('guest leave awards one forfeit; host can rematch without changing transports',async t=>{
  const s=await pair(t);await start(s);s.b.send({type:'LEAVE'});await wait(()=>s.a.state.room.status==='finished');assert.deepEqual(s.a.state.room.scores,[3,0]);assert.equal(s.a.state.result.winner,0);
  s.a.send({type:'REMATCH'});assert.equal(s.a.state.room.status,'lobby');assert.equal(s.a.state.room.round,2);
});
test('closing the host ends the guest room and leaves them able to create a new one',async t=>{
  const s=await pair(t);await start(s);s.a.close();await wait(()=>s.b.state===null&&s.b.connected);assert.ok(s.errors.some(e=>e.includes('host left')));
  s.b.send({type:'CREATE',name:'New host',config});await wait(()=>s.b.state&&s.b.connected);assert.equal(s.b.state.room.members[0].name,'New host');
});
test('invalid guest input, host-only commands, replayed packets and outsider ciphertext cannot mutate a match',async t=>{
  const s=await pair(t);await start(s);s.b.send({type:'CONFIG',config:{...config,seed:999}});await wait(()=>s.errors.length>0);assert.equal(s.a.state.room.config.seed,123);
  s.b.send({type:'INPUT',seq:1,intent:{...IDLE_INTENT(),x:99}});assert.equal(s.b.state.world.players[1].x,12);
  const channel=s.bus.channels[1],last=s.bus.packets.findLast(p=>p.type==='box'&&p.from===s.b.peer);await channel.send({type:'broadcast',event:'relay',payload:last});
  await channel.send({type:'broadcast',event:'relay',payload:{...last,data:'AAAA'+last.data.slice(4),seq:9999}});
  await new Promise(r=>setTimeout(r,30));assert.equal(s.a.state.room.config.seed,123);assert.equal(s.a.state.room.status,'playing');
});
test('a guest refresh reclaims the same seat and old transport timeouts cannot disconnect it',async t=>{
  const memory=new Map();Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)}});t.after(()=>delete globalThis.sessionStorage);
  const s=await pair(t);await start(s);const id=s.b.id,code=s.a.state.room.code;
  // Abrupt tab loss: no LEAVE message. Drive the heartbeat deadline without a multi-second sleep.
  s.b.detach();await wait(()=>!s.b.connected);
  const old=[...s.a.links.values()][0];old.lastSeen=Date.now()-4000;
  await wait(()=>s.a.state.room.status==='paused');assert.equal(s.a.state.room.members[1].connected,false);
  const c=new NaturaRelay(s.bus.factory,()=>{},()=>{});t.after(()=>c.close());c.resume(code);
  await wait(()=>c.state?.room.status==='paused');assert.equal(c.id,id);assert.equal(c.state.seat,1);assert.equal(s.a.state.room.members[1].connected,true);assert.equal(old.session,undefined);
  old.lastSeen=Date.now()-8000;await new Promise(r=>setTimeout(r,50));assert.equal(s.a.state.room.members[1].connected,true);
  s.a.send({type:'READY',ready:true});c.send({type:'READY',ready:true});await wait(()=>c.state.room.status==='playing');
});
