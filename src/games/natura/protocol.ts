import type { BotDifficulty, GameResult, Player, ScenarioId } from './naturaData.ts';
import type { PlayerIntent } from './input.ts';
import type { NaturaWorld } from './world.ts';
export const NATURA_SCENARIOS:ScenarioId[]=['meadow','bolas','coconut','trapjaw','cuttlefish','jumpingspider','spermwhale','archerfish','flyingfish'];
export type NaturaConfig={scenario:ScenarioId;level:number;seed:number;variant:'race'|'pursuit';difficulty:BotDifficulty};
export type RoomMember={id:string;name:string;connected:boolean;ready:boolean};
export type NaturaRoomView={code:string;host:string;members:[RoomMember|null,RoomMember|null];config:NaturaConfig;status:'lobby'|'playing'|'paused'|'finished';round:number;scores:[number,number];countdown:number;reconnectSeconds:number};
export type PrivateState={type:'STATE';room:NaturaRoomView;seat:Player;world:NaturaWorld|null;hidden:{vole:boolean;duelOpponent:boolean};version:number;result:GameResult|null};
export type NaturaHostMessage=PrivateState|{type:'SESSION';token:string;id:string;resumed:boolean}|{type:'LEFT'}|{type:'ERROR';message:string}|{type:'PONG'};
export type NaturaClientMessage={type:'HELLO';token?:string}|{type:'CREATE';name:string;config:NaturaConfig}|{type:'JOIN';name:string;code:string}|{type:'CONFIG';config:NaturaConfig}|{type:'READY';ready:boolean}|{type:'INPUT';seq:number;intent:PlayerIntent}|{type:'START'}|{type:'PAUSE'}|{type:'REMATCH'}|{type:'LEAVE'}|{type:'DETACH'}|{type:'PING'};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const fail=():never=>{throw new Error('Invalid Natura message.');};
export function parseConfig(v:unknown):NaturaConfig {
  if(!record(v)||!NATURA_SCENARIOS.includes(v.scenario as ScenarioId)||!num(v.level,0,15)||!Number.isInteger(v.level)||!num(v.seed,0,0xffffffff)||!Number.isInteger(v.seed)||!['race','pursuit'].includes(String(v.variant))||!['easy','normal','hard'].includes(String(v.difficulty)))return fail();
  if(v.variant==='pursuit'&&v.scenario!=='spermwhale')return fail();
  if(v.scenario==='jumpingspider'&&v.level>7||v.scenario!=='jumpingspider'&&v.scenario!=='trapjaw'&&v.level!==0)return fail();
  return {scenario:v.scenario as ScenarioId,level:v.level,seed:v.seed,variant:v.variant as 'race'|'pursuit',difficulty:v.difficulty as BotDifficulty};
}
export function parseIntent(v:unknown):PlayerIntent {
  if(!record(v)||!num(v.x,-1,1)||!num(v.y,-1,1)||!num(v.vertical,-1,1)||typeof v.action!=='boolean'||typeof v.secondary!=='boolean')return fail();
  const input:PlayerIntent={x:v.x,y:v.y,vertical:v.vertical,action:v.action,secondary:v.secondary};
  if(v.target!==undefined){if(!record(v.target)||!num(v.target.x,0,960)||!num(v.target.y,0,540))return fail();input.target={x:v.target.x,y:v.target.y};}
  if(v.pattern!==undefined){if(!num(v.pattern,0,5)||!Number.isInteger(v.pattern))return fail();input.pattern=v.pattern as PlayerIntent['pattern'];}
  if(v.bumpy!==undefined){if(typeof v.bumpy!=='boolean')return fail();input.bumpy=v.bumpy;}
  return input; // Never accept positions, health, score, phase, player id or elapsed time from clients.
}
export function parseNaturaMessage(v:unknown):NaturaClientMessage {
  if(!record(v)||typeof v.type!=='string')return fail();
  const name=()=>{if(typeof v.name!=='string')return fail();const s=v.name.trim().slice(0,24);if(!s||/[\u0000-\u001f]/.test(s))return fail();return s;};
  switch(v.type){
    case 'HELLO':return {type:'HELLO',token:typeof v.token==='string'&&/^[a-f0-9-]{36}$/.test(v.token)?v.token:undefined};
    case 'CREATE':return {type:'CREATE',name:name(),config:parseConfig(v.config)};
    case 'JOIN':if(typeof v.code!=='string'||!/^[A-Z2-9]{6}$/.test(v.code.toUpperCase()))return fail();return {type:'JOIN',code:v.code.toUpperCase(),name:name()};
    case 'CONFIG':return {type:'CONFIG',config:parseConfig(v.config)};
    case 'READY':if(typeof v.ready!=='boolean')return fail();return {type:'READY',ready:v.ready};
    case 'INPUT':if(!num(v.seq,0,Number.MAX_SAFE_INTEGER)||!Number.isInteger(v.seq))return fail();return {type:'INPUT',seq:v.seq,intent:parseIntent(v.intent)};
    case 'START':case 'PAUSE':case 'REMATCH':case 'LEAVE':case 'DETACH':case 'PING':return {type:v.type};
    default:return fail();
  }
}
