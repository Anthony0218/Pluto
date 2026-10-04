const randomUUID=()=>crypto.randomUUID();
const randomBytes=(size:number)=>crypto.getRandomValues(new Uint8Array(size));
import { IDLE_INTENT, type PlayerIntent } from './input.ts';
import { makeWorld, startWorld, stepWorld, ended, result, type NaturaWorld } from './world.ts';
import { privateWorld } from './privateView.ts';
import { parseConfig, type NaturaClientMessage, type NaturaConfig, type NaturaHostMessage, type NaturaRoomView } from './protocol.ts';
import type { GameResult, Player } from './naturaData.ts';
export const RECONNECT_MS=20000;
export type NaturaSession={id:string;token:string;name:string;room:string|null;connected:boolean;ready:boolean;disconnectedAt:number;lastSeen:number;send:((m:NaturaHostMessage)=>void)|null;close?:()=>void;input:PlayerIntent;seq:number;inputAt:number;address:string;creates:number[]};
export type NaturaRoom={code:string;host:string;seats:[NaturaSession|null,NaturaSession|null];config:NaturaConfig;status:NaturaRoomView['status'];world:NaturaWorld|null;round:number;scores:[number,number];result:GameResult|null;version:number;startsAt:number;updatedAt:number};
export class NaturaRooms {
  sessions=new Map<string,NaturaSession>();rooms=new Map<string,NaturaRoom>();
  connect(token:string|undefined,send:(m:NaturaHostMessage)=>void,address='test',close?:()=>void,now=Date.now()):NaturaSession {
    let s=token?this.sessions.get(token):undefined;
    const resumed=!!s;
    if(!s){if(this.sessions.size>=256||[...this.sessions.values()].filter(s=>s.address===address).length>=12)throw new Error('Too many sessions. Try later.');s={id:randomUUID(),token:randomUUID(),name:'Player',room:null,connected:true,ready:false,disconnectedAt:0,lastSeen:now,send:null,input:IDLE_INTENT(),seq:-1,inputAt:0,address,creates:[]};this.sessions.set(s.token,s);}
    if(s.connected&&s.send)s.close?.();
    Object.assign(s,{send,close,connected:true,lastSeen:now,input:IDLE_INTENT(),seq:-1,inputAt:0});
    send({type:'SESSION',token:s.token,id:s.id,resumed});
    if(s.room){const room=this.rooms.get(s.room);if(room)this.broadcast(room,now);else s.room=null;}
    return s;
  }
  disconnect(s:NaturaSession,now=Date.now()) {
    s.connected=false;s.send=null;s.disconnectedAt=now;s.ready=false;s.input=IDLE_INTENT();
    const room=s.room?this.rooms.get(s.room):null;
    if(room){if(room.status==='playing')this.pause(room);this.broadcast(room,now);}
  }
  handle(s:NaturaSession,msg:NaturaClientMessage,now=Date.now()) {
    if(!s.connected)throw new Error('Reconnect first.');s.lastSeen=now;
    if(msg.type==='PING'){s.send?.({type:'PONG'});return;}
    if(msg.type==='CREATE') {
      if(s.room)throw new Error('Leave your current room first.');
      s.creates=s.creates.filter(t=>now-t<60000);if(s.creates.length>=3||this.rooms.size>=32)throw new Error('Room limit reached. Try later.');s.creates.push(now);
      const config=parseConfig(msg.config);let code='';do{code=[...randomBytes(6)].map(v=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[v%32]).join('');}while(this.rooms.has(code));
      s.name=msg.name;s.ready=false;s.room=code;
      const room:NaturaRoom={code,host:s.id,seats:[s,null],config,status:'lobby',world:null,round:1,scores:[0,0],result:null,version:0,startsAt:0,updatedAt:now};this.rooms.set(code,room);this.broadcast(room,now);return;
    }
    if(msg.type==='JOIN') {
      if(s.room)throw new Error('Leave your current room first.');
      const room=this.rooms.get(msg.code);if(!room||room.status!=='lobby'||room.seats.every(Boolean))throw new Error('Room unavailable. Check the code or ask the host to reopen the lobby.');
      const seat=room.seats[0]?1:0;s.room=room.code;s.name=msg.name;s.ready=false;room.seats[seat]=s;room.updatedAt=now;this.broadcast(room,now);return;
    }
    const room=s.room?this.rooms.get(s.room):undefined;if(!room)throw new Error('Join a room first.');
    const seat=room.seats.findIndex(p=>p?.id===s.id) as Player;if(seat<0)throw new Error('Seat unavailable.');
    if(msg.type==='LEAVE'){this.leave(s,now);return;}
    if(msg.type==='INPUT') {
      if(room.status!=='playing'||now<room.startsAt)return;
      if(msg.seq<=s.seq)return;s.seq=msg.seq;s.input=msg.intent;s.inputAt=now;return;
    }
    if(msg.type==='CONFIG') {
      if(room.host!==s.id||room.status!=='lobby')throw new Error('Only the host can change a lobby.');
      room.config=parseConfig(msg.config);room.seats.forEach(p=>{if(p)p.ready=false;});
    } else if(msg.type==='READY') {
      if(room.status!=='lobby'&&room.status!=='paused')throw new Error('This round is not waiting for readiness.');s.ready=msg.ready;
      if(room.status==='paused'&&room.seats.every(p=>p?.connected&&p.ready)){room.status='playing';room.startsAt=now+1000;}
    } else if(msg.type==='START') {
      if(room.host!==s.id||room.status!=='lobby'||!room.seats.every(p=>p?.connected&&p.ready))throw new Error('Both connected players must be ready before the host starts.');
      room.world=makeWorld(room.config.scenario,'hotseat',1,room.config.level,room.config.difficulty,room.config);startWorld(room.world);room.status='playing';room.startsAt=now+1200;room.result=null;
      room.seats.forEach(p=>{if(p){p.input=IDLE_INTENT();p.inputAt=0;}});
    } else if(msg.type==='PAUSE') {if(room.status==='playing')this.pause(room);}
    else if(msg.type==='REMATCH') {
      if(room.host!==s.id||room.status!=='finished')throw new Error('The host can reopen a finished round.');room.round++;room.status='lobby';room.world=null;room.result=null;room.config.seed=(room.config.seed+7919)>>>0;room.seats.forEach(p=>{if(p)p.ready=false;});
    } else throw new Error('Action unavailable.');
    room.updatedAt=now;this.broadcast(room,now);
  }
  pause(room:NaturaRoom) {room.status='paused';room.seats.forEach(p=>{if(p){p.ready=false;p.input=IDLE_INTENT();}});}
  finish(room:NaturaRoom,r:GameResult) {room.status='finished';room.result=r;if(r.winner!==null)room.scores[r.winner]+=3;}
  leave(s:NaturaSession,now=Date.now()) {
    const room=s.room?this.rooms.get(s.room):undefined;
    if(room){const seat=room.seats.findIndex(p=>p===s);if(seat>=0){if(room.status==='playing'||room.status==='paused')this.finish(room,{winner:(seat===0?1:0),detail:`${s.name} left the round.`});room.seats[seat]=null;}
      if(!room.seats.some(Boolean))this.rooms.delete(room.code);else{if(room.host===s.id)room.host=room.seats.find(Boolean)!.id;this.broadcast(room,now);}}
    s.room=null;s.ready=false;s.input=IDLE_INTENT();s.send?.({type:'LEFT'});
  }
  tick(dt=1/60,now=Date.now()) {
    for(const room of this.rooms.values()) {
      if(room.status==='lobby') {
        room.seats.forEach((p,i)=>{if(p&&!p.connected&&now-p.disconnectedAt>RECONNECT_MS){p.room=null;room.seats[i]=null;}});
        if(!room.seats.some(p=>p?.id===room.host)){const successor=room.seats.find(Boolean);if(successor)room.host=successor.id;}
      }
      if(room.status==='playing'&&room.world&&now>=room.startsAt&&room.seats.every(p=>p?.connected)) {
        const inputs=room.seats.map(p=>p&&now-p.inputAt<250?p.input:IDLE_INTENT()) as [PlayerIntent,PlayerIntent];
        stepWorld(room.world,inputs,Math.min(dt,0.05),false,room.config.difficulty);
        if(ended(room.world))this.finish(room,result(room.world,1));room.updatedAt=now;
      }
      if(room.status==='paused'&&room.world) {
        const lost=room.seats.findIndex(p=>p&&!p.connected&&now-p.disconnectedAt>RECONNECT_MS);
        if(lost>=0&&room.seats[1-lost]?.connected)this.finish(room,{winner:(1-lost) as Player,detail:'The other player did not reconnect within 20 seconds.'});
      }
      if(!room.seats.some(p=>p?.connected)&&now-room.updatedAt>120000){room.seats.forEach(p=>{if(p)p.room=null;});this.rooms.delete(room.code);}
    }
    for(const [token,s] of this.sessions)if(!s.connected&&!s.room&&now-s.lastSeen>120000)this.sessions.delete(token);
  }
  broadcast(room:NaturaRoom,now=Date.now()) {
    room.version++;
    const lost=room.seats.find(p=>p&&!p.connected);
    const view:NaturaRoomView={code:room.code,host:room.host,members:room.seats.map(p=>p?{id:p.id,name:p.name,connected:p.connected,ready:p.ready}:null) as NaturaRoomView['members'],config:room.config,status:room.status,round:room.round,scores:room.scores,countdown:room.status==='playing'?Math.max(0,room.startsAt-now)/1000:0,reconnectSeconds:lost?Math.max(0,RECONNECT_MS-now+lost.disconnectedAt)/1000:0};
    room.seats.forEach((s,seat)=>{if(!s?.send)return;const projected=room.world?privateWorld(room.world,seat as Player):{world:null,hidden:{vole:false,duelOpponent:false}};s.send({type:'STATE',room:view,seat:seat as Player,...projected,version:room.version,result:room.result});});
  }
}
