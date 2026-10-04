import { NaturaRooms, type NaturaSession } from './rooms.ts';
import { parseNaturaMessage, type NaturaClientMessage, type NaturaHostMessage, type PrivateState } from './protocol.ts';
import { IDLE_INTENT, type PlayerIntent } from './input.ts';
import type { NaturaWorld } from './world.ts';
import { makeRelayIdentity, pairRelayKey, sealRelay, openRelay } from './relayCrypto.ts';

/** Small injectable boundary: production uses Supabase, tests use a message bus. */
export interface NaturaRelayChannel {
  on(event:'broadcast',filter:{event:string},callback:(message:{payload:unknown})=>void):NaturaRelayChannel;
  subscribe(callback:(status:string)=>void):NaturaRelayChannel;
  send(message:{type:'broadcast';event:string;payload:unknown}):Promise<unknown>;
  unsubscribe():Promise<unknown>;
}
export type RelayFactory=(topic:string)=>NaturaRelayChannel;
type Hello={type:'hello';from:string;nonce:string;publicKey:JsonWebKey};
type Welcome={type:'welcome';from:string;to:string;nonce:string;publicKey:JsonWebKey};
type Box={type:'box';from:string;to:string;nonce:string;seq:number;iv:string;data:string};
type Packet=Hello|Welcome|Box;
type Link={id:string;nonce:string;key:CryptoKey;publicKey:JsonWebKey;session?:NaturaSession;lastSeen:number;out:number;incoming:number;queue:Promise<void>;receiving:Promise<void>;receivingPending:number;pending:number};
const SESSION_PREFIX='natura-relay-session-v1:';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const packet=(v:unknown):v is Packet=>{
  if(!object(v)||!uuid(v.from)||!uuid(v.nonce))return false;
  if(v.type==='hello'||v.type==='welcome')return object(v.publicKey)&&v.publicKey.kty==='EC'&&v.publicKey.crv==='P-256'&&(v.type==='hello'||uuid(v.to));
  return v.type==='box'&&uuid(v.to)&&typeof v.seq==='number'&&Number.isSafeInteger(v.seq)&&v.seq>=0&&typeof v.iv==='string'&&typeof v.data==='string'&&v.data.length<=180000;
};
const context=(code:string,p:Pick<Box,'from'|'to'|'nonce'|'seq'>)=>`${code}:${p.from}:${p.to}:${p.nonce}:${p.seq}`;
const sessionToken=(code:string)=>{try{return sessionStorage.getItem(SESSION_PREFIX+code)??undefined;}catch{return undefined;}};

export class NaturaRelay {
  state:PrivateState|null=null;input:PlayerIntent=IDLE_INTENT();id='';connected=true;
  private factory:RelayFactory;private onState:(state:PrivateState|null)=>void;private onStatus:(status:string,error?:string)=>void;
  private channel:NaturaRelayChannel|null=null;private subscribed=false;private stopped=false;private closing=false;private epoch=0;
  private code='';private role:'host'|'guest'|null=null;private peer=crypto.randomUUID();private nonce=crypto.randomUUID();
  private identity:Awaited<ReturnType<typeof makeRelayIdentity>>|null=null;
  private links=new Map<string,Link>();private hostPeer='';private handshake=false;
  private authority:NaturaRooms|null=null;private localSession:NaturaSession|null=null;
  private join:Extract<NaturaClientMessage,{type:'JOIN'}>|null=null;
  private seq=0;private lastHello=0;private lastPulse=0;private lastSnapshot=0;private began=0;private lastTick=performance.now();
  private timer:ReturnType<typeof setInterval>;private previous:NaturaWorld|null=null;private receivedAt=0;
  private pendingAction=false;private pendingSecondary=false;
  constructor(factory:RelayFactory,onState:(state:PrivateState|null)=>void,onStatus:(status:string,error?:string)=>void) {
    this.factory=factory;this.onState=onState;this.onStatus=onStatus;
    this.timer=setInterval(()=>this.tick(),1000/60);this.onStatus('Ready to connect');
  }
  send(raw:NaturaClientMessage) {
    let msg:NaturaClientMessage;try{msg=parseNaturaMessage(raw);}catch(e){this.problem(e);return;}
    if(msg.type==='CREATE'||msg.type==='JOIN') {
      if(this.role){this.problem(new Error('Leave your current room first.'));return;}
      void this.enter(msg).catch(e=>this.reset(e instanceof Error?e.message:'Could not connect to Supabase.'));return;
    }
    if(msg.type==='LEAVE'){void this.leave();return;}
    if(!this.connected){if(msg.type!=='INPUT')this.problem(new Error('Wait for the connection before trying that action.'));return;}
    if(this.role==='host'&&this.localSession){try{this.authority!.handle(this.localSession,msg);}catch(e){this.problem(e);}}
    else if(this.role==='guest'){const link=this.links.get(this.hostPeer);if(link)void this.sendBox(link,msg);}
  }
  resume(code:string){if(/^[A-Z2-9]{6}$/.test(code)&&sessionToken(code))this.send({type:'JOIN',name:'Player',code});}
  private async enter(msg:Extract<NaturaClientMessage,{type:'CREATE'|'JOIN'}>) {
    this.connected=false;this.began=Date.now();this.onStatus('Connecting to Supabase…');this.role=msg.type==='CREATE'?'host':'guest';
    const epoch=++this.epoch,identity=await makeRelayIdentity();if(this.stopped||this.closing||epoch!==this.epoch)return;this.identity=identity;
    this.peer=crypto.randomUUID();this.nonce=crypto.randomUUID();this.began=Date.now();this.lastHello=0;this.lastTick=performance.now();
    if(msg.type==='CREATE') {
      this.authority=new NaturaRooms();this.localSession=this.authority.connect(undefined,m=>this.accept(m));
      this.authority.handle(this.localSession,msg);this.code=this.localSession.room!;
      this.connected=false;
    } else {this.join=msg;this.code=msg.code;}
    this.channel=this.factory(`natura-v2:${this.code}`);
    this.channel.on('broadcast',{event:'relay'},({payload})=>{if(epoch===this.epoch)void this.receive(payload).catch(()=>{/* Malformed/unauthenticated packets have no effect. */});});
    this.channel.subscribe(status=>{
      if(this.stopped||epoch!==this.epoch)return;
      if(status==='SUBSCRIBED') {
        this.subscribed=true;this.lastTick=performance.now();
        if(this.role==='host'){this.connected=true;this.onStatus('Connected');this.authority!.broadcast(this.authority!.rooms.get(this.code)!);}
        else {this.began=Date.now();void this.hello();}
      } else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED') {
        this.subscribed=false;this.connected=false;this.clearInput();
        if(this.role==='host'){const room=this.authority?.rooms.get(this.code);if(room?.status==='playing')this.authority!.pause(room);}
        this.onStatus('Reconnecting…','Supabase connection interrupted. The match is paused.');
      }
    });
  }
  private async publish(payload:Packet) {
    if(!this.channel||!this.subscribed||this.stopped)return;
    const status=await this.channel.send({type:'broadcast',event:'relay',payload});
    if(status==='error'||status==='timed out')throw new Error('Supabase could not relay this message.');
  }
  private async hello() {
    if(!this.identity||this.role!=='guest'||!this.subscribed)return;
    this.lastHello=Date.now();await this.publish({type:'hello',from:this.peer,nonce:this.nonce,publicKey:this.identity.publicKey}).catch(e=>this.problem(e));
  }
  private async receive(value:unknown) {
    if(!packet(value)||value.from===this.peer||!this.identity||!this.role)return;
    const epoch=this.epoch;
    if(value.type==='hello'&&this.role==='host') {
      let link=this.links.get(value.from);
      if(!link||link.nonce!==value.nonce) {
        if(this.links.size>=8)return;
        const key=await pairRelayKey(this.identity.keys.privateKey,value.publicKey);if(epoch!==this.epoch)return;
        link={id:value.from,nonce:value.nonce,key,publicKey:value.publicKey,lastSeen:Date.now(),out:0,incoming:-1,queue:Promise.resolve(),receiving:Promise.resolve(),receivingPending:0,pending:0};this.links.set(link.id,link);
      }
      await this.publish({type:'welcome',from:this.peer,to:link.id,nonce:link.nonce,publicKey:this.identity.publicKey});return;
    }
    if(value.type==='welcome'&&this.role==='guest'&&value.to===this.peer&&value.nonce===this.nonce) {
      if(this.hostPeer&&this.hostPeer!==value.from)return;
      let link=this.links.get(value.from);
      if(!link) {
        if(this.handshake)return;this.handshake=true;
        try{const key=await pairRelayKey(this.identity.keys.privateKey,value.publicKey);if(epoch!==this.epoch)return;
          link={id:value.from,nonce:this.nonce,key,publicKey:value.publicKey,lastSeen:Date.now(),out:0,incoming:-1,queue:Promise.resolve(),receiving:Promise.resolve(),receivingPending:0,pending:0};this.links.set(link.id,link);this.hostPeer=link.id;
        }finally{this.handshake=false;}
      }
      if(!this.connected)await this.sendBox(link,{type:'HELLO',token:sessionToken(this.code)});return;
    }
    if(value.type!=='box'||value.to!==this.peer)return;
    const link=this.links.get(value.from);if(!link||link.nonce!==value.nonce)return;
    if(link.receivingPending>=8)return;link.receivingPending++;
    // Serialized decrypt prevents an older asynchronous decode from overwriting newer state.
    link.receiving=link.receiving.then(async()=>{
      if(epoch!==this.epoch||value.seq<=link.incoming)return;
      const msg=await openRelay(link.key,value,context(this.code,value));if(epoch!==this.epoch)return;
      link.incoming=value.seq;link.lastSeen=Date.now();
      if(this.role==='host')this.command(link,parseNaturaMessage(msg));
      else if(object(msg)&&msg.type==='CLOSED')this.reset('The host left or restarted the room. Create or join a new room.');
      else this.accept(msg as NaturaHostMessage);
    }).catch(()=>{/* Invalid ciphertext/input cannot mutate the world. */}).finally(()=>{link.receivingPending--;});
    await link.receiving;
  }
  private command(link:Link,msg:NaturaClientMessage) {
    if(!this.authority)return;
    try {
      if(msg.type==='HELLO') {
        if(link.session?.connected){link.session.seq=-1;link.session.input=IDLE_INTENT();void this.sendBox(link,{type:'SESSION',id:link.session.id,token:link.session.token,resumed:!!link.session.room});const room=this.authority.rooms.get(this.code);if(room)this.authority.broadcast(room);return;}
        link.session=this.authority.connect(msg.token,m=>{void this.sendBox(link,m);},'relay',()=>{void this.sendBox(link,{type:'CLOSED',message:'Session replaced.'});});
        // Reclaimed sessions belong to the new transport. An old link's timeout must not disconnect it.
        for(const other of this.links.values())if(other!==link&&other.session===link.session)other.session=undefined;
      } else {
        if(!link.session?.connected)throw new Error('Reconnect first.');
        if(msg.type==='CREATE'||msg.type==='CONFIG'||msg.type==='START'||msg.type==='REMATCH')throw new Error('Only the room host can do that.');
        if(msg.type==='JOIN'&&msg.code!==this.code)throw new Error('Room unavailable.');
        if(msg.type==='DETACH'){this.authority.disconnect(link.session);return;}
        this.authority.handle(link.session,msg);
      }
    }catch(e){void this.sendBox(link,{type:'ERROR',message:e instanceof Error?e.message:'Action unavailable.'});}
  }
  private sendBox(link:Link,message:unknown):Promise<void> {
    if(link.pending>=8)return Promise.resolve(); // Bounded queue; never accumulate stale snapshots.
    const epoch=this.epoch;link.pending++;
    link.queue=link.queue.then(async()=>{
      if(epoch!==this.epoch||!this.subscribed)return;
      const header={type:'box' as const,from:this.peer,to:link.id,nonce:link.nonce,seq:link.out++};
      const box=await sealRelay(link.key,message,context(this.code,header));if(epoch!==this.epoch)return;
      await this.publish({...header,...box});
    }).catch(e=>{if(epoch===this.epoch)this.problem(e);}).finally(()=>{link.pending--;});
    return link.queue;
  }
  private accept(msg:NaturaHostMessage) {
    if(!object(msg))return;
    if(msg.type==='SESSION'&&uuid(msg.id)&&uuid(msg.token)) {
      this.id=msg.id;this.seq=0;
      if(this.role==='guest') {
        try{sessionStorage.setItem(SESSION_PREFIX+this.code,msg.token);}catch{/* Tab-local reconnect remains optional. */}
        this.connected=true;this.onStatus('Connected');
        if(!msg.resumed&&this.join){const link=this.links.get(this.hostPeer);if(link)void this.sendBox(link,this.join);}
      }
    } else if(msg.type==='STATE'&&object(msg.room)&&msg.room.code===this.code&&(msg.seat===0||msg.seat===1)&&Number.isSafeInteger(msg.version)) {
      if(this.state&&msg.version<=this.state.version)return;
      this.previous=this.state?.world??null;this.state=msg;this.receivedAt=performance.now();this.onState(msg);
      if(this.role==='guest'){this.connected=true;this.onStatus('Connected');}
    } else if(msg.type==='LEFT'){this.state=null;this.previous=null;this.onState(null);}
    else if(msg.type==='ERROR'){if(!this.state)this.reset(msg.message);else this.onStatus('Connected',msg.message);}
  }
  private tick() {
    if(this.stopped||!this.role)return;
    const now=Date.now(),clock=performance.now(),gap=Math.max(0,(clock-this.lastTick)/1000),dt=Math.min(.05,gap);this.lastTick=clock;
    if(!this.subscribed&&!this.state&&now-this.began>15000){this.reset('Could not connect to Supabase Realtime. Check your connection and project configuration.');return;}
    if(this.role==='host'&&this.authority) {
      const room=this.authority.rooms.get(this.code);
      if(this.subscribed&&room) {
        // A background/stalled host must pause, rather than silently run a slow match.
        if(gap>.25&&room.status==='playing')this.authority.pause(room);
        this.authority.tick(dt,now);
        for(const [id,link] of this.links){if(link.session?.connected&&now-link.lastSeen>3500)this.authority.disconnect(link.session,now);if(now-link.lastSeen>30000)this.links.delete(id);}
        if(now-this.lastSnapshot>=(room.status==='playing'?100:1000)){this.lastSnapshot=now;this.authority.broadcast(room,now);}
      }
    } else if(this.role==='guest') {
      const link=this.links.get(this.hostPeer);
      if(!this.connected&&now-this.lastHello>1000)void this.hello();
      if(link&&this.subscribed&&now-this.lastPulse>1000){this.lastPulse=now;void this.sendBox(link,{type:'PING'});}
      const heard=link?.lastSeen??this.began;
      if(now-heard>3500&&this.connected){this.connected=false;this.clearInput();this.onStatus('Waiting for host…','The host is unavailable. Gameplay is paused.');}
      if(now-heard>10000)this.reset(link?'The host closed or restarted the room. Create or join a new room.':'No host answered this code. Check it and ask your friend to keep the room open.');
    }
    if(this.connected&&this.state?.room.status==='playing'&&now-this.lastInput>=(this.role==='guest'?100:40)) {
      this.lastInput=now;
      this.send({type:'INPUT',seq:this.seq++,intent:{...this.input,action:this.input.action||this.pendingAction,secondary:this.input.secondary||this.pendingSecondary}});this.pendingAction=false;this.pendingSecondary=false;
    }
  }
  private lastInput=0;
  setInput(input:PlayerIntent){this.input=input;this.pendingAction ||= input.action;this.pendingSecondary ||= input.secondary;}
  clearInput(){this.input=IDLE_INTENT();this.pendingAction=false;this.pendingSecondary=false;}
  pauseForHiddenTab(){if(this.role==='host'&&this.state?.room.status==='playing')this.send({type:'PAUSE'});this.clearInput();}
  /** A refreshing guest disconnects, retaining their seat. Explicit exit is a forfeit. */
  detach(){
    if(this.role==='host'){this.close();return;}
    if(this.stopped||this.closing)return;this.closing=true;clearInterval(this.timer);
    const link=this.links.get(this.hostPeer);
    void (link?this.sendBox(link,{type:'DETACH'}):Promise.resolve()).finally(()=>{this.stopped=true;this.reset();this.connected=false;});
  }
  private problem(e:unknown){this.onStatus(this.connected?'Connected':'Connecting…',e instanceof Error?e.message:'Connection interrupted.');}
  private async leave() {
    if(this.role==='host'){await Promise.all([...this.links.values()].map(link=>this.sendBox(link,{type:'CLOSED',message:'Host left.'})));}
    else {const link=this.links.get(this.hostPeer);if(link)await this.sendBox(link,{type:'LEAVE'});}
    this.reset();
  }
  private reset(error?:string) {
    this.epoch++;this.subscribed=false;const channel=this.channel;this.channel=null;if(channel)void channel.unsubscribe();
    this.role=null;this.authority=null;this.localSession=null;this.links.clear();this.hostPeer='';this.join=null;this.identity=null;
    this.state=null;this.previous=null;this.clearInput();this.connected=!this.stopped;this.onState(null);this.onStatus('Ready to connect',error);
  }
  /** Interpolate bodies only. Use the newest visibility/phase so old snapshots cannot expose hidden actors. */
  presentation(now=performance.now()):NaturaWorld|null {
    const current=this.state?.world;if(!current)return null;
    if(!this.previous||this.previous.kind!==current.kind||this.state?.room.status!=='playing')return current;
    const world=structuredClone(current),t=Math.min(1,Math.max(0,(now-this.receivedAt)/100));
    const lerp=(a:Record<string,unknown>,b:Record<string,unknown>,max=30)=>{
      if(Math.hypot(Number(a.x)-Number(b.x),Number(a.y)-Number(b.y),Number(a.z??0)-Number(b.z??0))>max)return;
      for(const key of ['x','y','z'])if(typeof a[key]==='number'&&typeof b[key]==='number')a[key]=(b[key] as number)+((a[key] as number)-(b[key] as number))*t;
    };
    if(world.kind==='meadow'&&this.previous.kind==='meadow'){lerp(world.game.falcon,this.previous.game.falcon,120);if(!this.state!.hidden.vole)lerp(world.game.mouse,this.previous.game.mouse,120);}
    else if(world.kind==='archerfish'&&this.previous.kind==='archerfish')world.game.fish.forEach((p,i)=>lerp(p,this.previous!.kind==='archerfish'?this.previous!.game.fish[i]:p,120));
    else if('players' in world&&'players' in this.previous)world.players.forEach((p,i)=>{if(world.kind==='abyssduel'&&i!==this.state!.seat&&this.state!.hidden.duelOpponent)return;lerp(p,'players' in this.previous!?this.previous!.players[i]:p,world.kind==='trapjaw'||world.kind==='cuttlefish'||world.kind==='coconut'||world.kind==='bolas'?120:30);});
    return world;
  }
  close(){if(this.stopped||this.closing)return;this.closing=true;clearInterval(this.timer);void this.leave().finally(()=>{this.stopped=true;this.connected=false;});}
}
