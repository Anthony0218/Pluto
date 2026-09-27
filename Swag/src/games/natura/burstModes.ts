import type { Player, Vec } from './naturaData';
export type BurstKind = 'pistolshrimp' | 'electriceel' | 'bombardier';
export type BurstInput = { x: number; y: number; action: boolean; secondary: boolean };
export const idleBurstInput = (): BurstInput => ({ x: 0, y: 0, action: false, secondary: false });
export type BurstPlayer = Vec & { angle: number; food: number; lives: number; energy: number; cooldown: number; scan: number; flash: number; effect: number };
export type Prey = Vec & { id: number; home: Vec; stun: number; respawn: number; revealed: [number, number] };
export type Pursuer = Vec & { owner: Player; retreat: number };
export type Bubble = Vec & { owner: Player; delay: number; life: number; burst: boolean };
export type BurstGame = { kind: BurstKind; phase: 'ready' | 'playing' | 'paused' | 'finished'; time: number; elapsed: number; players: [BurstPlayer, BurstPlayer]; prey: Prey[]; pursuers: Pursuer[]; bubbles: Bubble[]; winner: Player | null; notice: string; actionHeld: [boolean, boolean]; secondaryHeld: [boolean, boolean]; aiThink: number; aiInput: BurstInput };
export const BURST_W = 960, BURST_H = 540, BURST_GOAL = 6;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const inSpray = (p: BurstPlayer, target: Vec) => distance(p, target) <= 155 && Math.cos(Math.atan2(target.y - p.y, target.x - p.x) - p.angle) >= Math.cos(.55);
export const preyVisible = (game: BurstGame, prey: Prey, index: Player) => prey.respawn <= 0 && (game.kind !== 'electriceel' || prey.revealed[index] > 0 || distance(game.players[index], prey) <= 70);
export function beetleFood(index: Player, food: number): Vec | null {
  const points = [{x:230,y:150},{x:440,y:95},{x:760,y:190},{x:825,y:380},{x:500,y:420},{x:190,y:350}];
  const point = points[food]; return point ? {x:point.x,y:index === 0 ? point.y : 540-point.y} : null;
}
export function createBurstGame(kind: BurstKind): BurstGame {
  const player = (y: number): BurstPlayer => ({x:90,y,angle:0,food:0,lives:3,energy:100,cooldown:0,scan:0,flash:0,effect:0});
  return {kind,phase:'ready',time:60,elapsed:0,players:[player(170),player(370)],winner:null,
    notice:kind === 'bombardier' ? 'Forage along your numbered route. Turn toward approaching ants and spray.' : kind === 'electriceel' ? 'Sense the murky water, stun nearby prey, then swim over it to collect.' : 'Face your prey. Snap a bubble, wait for its collapse, then collect stunned prey.',
    actionHeld:[false,false],secondaryHeld:[false,false],aiThink:.6,aiInput:idleBurstInput(),bubbles:[],
    prey:Array.from({length:12},(_,id)=>{const home={x:235+(id%6)*125,y:id<6?165:375};return {...home,home,id,stun:0,respawn:0,revealed:[0,0]};}),
    pursuers:([{x:480,y:65,owner:0},{x:480,y:475,owner:1}] as const).map(p=>({...p,retreat:1.5}))};
}
export function chooseBurstInput(game: BurstGame, index: Player): BurstInput {
  const p=game.players[index], input=idleBurstInput(); let target: Vec | null;
  if(game.kind === 'bombardier') {
    const enemy=game.pursuers.find(e=>e.owner===index && e.retreat<=0);
    if(enemy && distance(p,enemy)<150 && p.energy>=35) {
      const dx=enemy.x-p.x,dy=enemy.y-p.y;
      return {...input,x:dx,y:dy,action:!game.actionHeld[index] && p.cooldown<=0};
    }
    target=beetleFood(index,p.food);
  } else {
    const visible=game.prey.filter(prey=>preyVisible(game,prey,index));
    const prey=visible.sort((a,b)=>distance(p,a)-distance(p,b))[0];
    if(!prey) {target={x:480+Math.cos(game.elapsed*.35)*270,y:270+Math.sin(game.elapsed*.35)*170};input.secondary=game.kind==='electriceel' && p.scan<=0 && !game.secondaryHeld[index];}
    else {
      target=prey;
      input.secondary=game.kind==='electriceel' && p.scan<=0 && !game.secondaryHeld[index];
      input.action=prey.stun<=0 && distance(p,prey)<(game.kind==='pistolshrimp'?160:125) && p.cooldown<=0 && p.energy>=40 && !game.actionHeld[index];
    }
  }
  if(target){input.x=target.x-p.x;input.y=target.y-p.y;}
  return input;
}
function finish(game: BurstGame) {
  const [a,b]=game.players;
  const delta=game.kind==='bombardier' && (a.lives===0)!==(b.lives===0) ? a.lives-b.lives : a.food-b.food || (game.kind==='bombardier'?a.lives-b.lives:0);
  game.winner=delta===0?null:delta>0?0:1;game.phase='finished';
}
export function updateBurstGame(game: BurstGame, inputs: [BurstInput,BurstInput], seconds: number, ai: boolean) {
  if(game.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return;
  let left=Math.min(seconds,.1);
  while(left>1e-6 && game.phase==='playing') {
    const dt=Math.min(left,1/120,game.time);game.time=Math.max(0,game.time-dt);game.elapsed+=dt;
    if(ai){game.aiThink-=dt;if(game.aiThink<=0){game.aiInput=chooseBurstInput(game,1);game.aiThink=.15;}}
    const actual:[BurstInput,BurstInput]=[inputs[0],ai?game.aiInput:inputs[1]];
    game.players.forEach((p,i)=>{
      const input=actual[i],length=Math.hypot(input.x,input.y),moving=length>0;
      p.cooldown=Math.max(0,p.cooldown-dt);p.scan=Math.max(0,p.scan-dt);p.flash=Math.max(0,p.flash-dt);p.effect=Math.max(0,p.effect-dt);p.energy=Math.min(100,p.energy+18*dt);
      if(moving){p.angle=Math.atan2(input.y,input.x);if(!input.secondary || game.kind==='electriceel'){p.x=clamp(p.x+input.x/Math.max(1,length)*155*dt,30,930);p.y=clamp(p.y+input.y/Math.max(1,length)*155*dt,45,495);}}
      if(game.kind==='electriceel' && input.secondary && !game.secondaryHeld[i] && p.scan<=0){
        p.scan=1.5;p.effect=.6;game.prey.forEach(prey=>{if(distance(p,prey)<=300)prey.revealed[i]=3;});game.notice='Sensing pulse: nearby prey revealed for three seconds.';
      }
      if(input.action && !game.actionHeld[i] && p.cooldown<=0 && p.energy>=(game.kind==='bombardier'?35:40)) {
        p.energy-=game.kind==='bombardier'?35:40;p.cooldown=game.kind==='pistolshrimp'?1.1:.8;p.effect=.35;
        if(game.kind==='pistolshrimp')game.bubbles.push({x:p.x+Math.cos(p.angle)*110,y:p.y+Math.sin(p.angle)*110,owner:i as Player,delay:.2,life:.6,burst:false});
        if(game.kind==='electriceel')game.prey.forEach(prey=>{if(prey.respawn<=0 && distance(p,prey)<=135){prey.stun=2;prey.revealed[i]=3;}});
        if(game.kind==='bombardier')game.pursuers.forEach(enemy=>{if(enemy.retreat<=0 && inSpray(p,enemy)){enemy.retreat=2.5;game.notice='Defensive spray repels an ant. Keep foraging!';}});
      }
    });
    game.bubbles.forEach(b=>{b.delay-=dt;b.life-=dt;if(!b.burst && b.delay<=0){b.burst=true;game.prey.forEach(prey=>{if(prey.respawn<=0 && distance(b,prey)<=65)prey.stun=2.4;});}});
    game.bubbles=game.bubbles.filter(b=>b.life>0);
    game.prey.forEach(prey=>{
      prey.revealed=prey.revealed.map(t=>Math.max(0,t-dt)) as [number,number];
      if(prey.respawn>0){prey.respawn=Math.max(0,prey.respawn-dt);return;}
      if(prey.stun>0){
        prey.stun=Math.max(0,prey.stun-dt);
        if(game.kind!=='bombardier'){
          const distances=game.players.map(p=>distance(p,prey));const best=Math.min(...distances);
          if(best<25){const tie=Math.abs(distances[0]-distances[1])<.5;game.players.forEach((p,i)=>{if(tie||distances[i]===best)p.food+=tie?.5:1;});prey.respawn=3;prey.stun=0;game.notice=tie?'A simultaneous catch: half a point each.':'Stunned prey collected!';}
        }
      } else {prey.x=prey.home.x+Math.sin(game.elapsed*.9+prey.id)*27;prey.y=prey.home.y+Math.sin(game.elapsed*1.2+prey.id)*40;}
    });
    if(game.kind==='bombardier') {
      game.pursuers.forEach(enemy=>{
        const p=game.players[enemy.owner],dx=p.x-enemy.x,dy=p.y-enemy.y,len=Math.max(1,Math.hypot(dx,dy));
        const retreating=enemy.retreat>0;enemy.retreat=Math.max(0,enemy.retreat-dt);
        enemy.x=clamp(enemy.x+dx/len*(retreating?-155:110)*dt,15,945);enemy.y=clamp(enemy.y+dy/len*(retreating?-155:110)*dt,20,520);
        if(!retreating && len<27 && p.flash<=0){p.lives=Math.max(0,p.lives-1);p.flash=1.8;enemy.retreat=1.5;game.notice='Caught by an ant. One heart lost.';}
      });
      game.players.forEach((p,i)=>{const food=beetleFood(i as Player,p.food);if(p.lives>0 && food && distance(p,food)<25){p.food++;game.notice='Food collected. Follow your next numbered marker.';}});
    }
    actual.forEach((input,i)=>{game.actionHeld[i]=input.action;game.secondaryHeld[i]=input.secondary;});
    if(game.time<=0 || game.players.some(p=>p.food>=BURST_GOAL || (game.kind==='bombardier'&&p.lives<=0)))finish(game);
    left-=dt;
  }
}
