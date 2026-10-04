import type { BotDifficulty, Player } from './naturaData.ts';
import type { PlayerIntent } from './input.ts';
import { IDLE_INTENT } from './input.ts';
import { distance3, type Point3, type SonarEcho } from './expeditions.ts';

export type AbyssActor = Point3 & {
  velocity: Point3; heading: number; lives: number; oxygen: number; flash: number;
  cooldown: number; specialCooldown: number; actionHeld: boolean; specialHeld: boolean;
  burst: number; sonar: number; echoes: SonarEcho[];
};
export type InkCloud = Point3 & { life: number; radius: number };
export type AbyssDuel = {
  kind: 'abyssduel'; phase: 'ready'|'playing'|'finished'; time: number; elapsed: number;
  players: [AbyssActor, AbyssActor]; ink: InkCloud[]; winner: Player|null; notice: string;
  controlled: Player; lastSeen: Point3; aiThink: number; aiInput: PlayerIntent; bites: number;
};
export const ABYSS_DUEL_RULES = [
  'Whale vs squid is a separate 90-second hunt. The whale wins by landing three bites; the squid wins by surviving the clock or exhausting the whale.',
  'Both creatures swim with WASD and rise/dive with Q/E. The whale uses Space to bite and Shift for a fading sonar snapshot. The squid uses Space for a short burst and Shift to drop an ink cloud.',
  'Burst lasts 0.7 seconds with a 6-second recharge. Ink lasts 5 seconds with a 10-second recharge. Ink blocks nearby sight and disrupts echoes; it does not make the squid invulnerable.',
  'The whale must surface to breathe. At long range, sonar reports coarse direction, depth and range rather than exact coordinates. Online players receive separate private views. Local simultaneous play shares both creatures on screen.',
  'Hotseat includes one whale run and one squid run for each player, with identical starting conditions for each role. Combat, ink disruption and cooldowns are fictional game rules.',
];
const clamp = (v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function createAbyssDuel(controlled:Player=0):AbyssDuel {
  const actor=(i:number):AbyssActor=>({x:i?12:-12,y:i?-28:-2,z:i?-12:8,velocity:{x:0,y:0,z:0},heading:0,lives:3,oxygen:70,flash:0,cooldown:0,specialCooldown:0,actionHeld:false,specialHeld:false,burst:0,sonar:0,echoes:[]});
  return {kind:'abyssduel',phase:'ready',time:90,elapsed:0,players:[actor(0),actor(1)],ink:[],winner:null,controlled,lastSeen:{x:0,y:-25,z:-12},aiThink:0,aiInput:IDLE_INTENT(),bites:0,notice:'Whale: hunt with echoes and save breath. Squid: time burst and ink to escape.'};
}
export function inkObscures(g:AbyssDuel):boolean {
  return g.ink.some(c=>c.life>0&&(distance3(c,g.players[0])<c.radius||distance3(c,g.players[1])<c.radius));
}
export function duelOpponentVisible(g:AbyssDuel,viewer:Player):boolean {
  return distance3(g.players[0],g.players[1])<(viewer===0?13:22)&&!inkObscures(g);
}
export function duelEcho(g:AbyssDuel):SonarEcho[] {
  const [whale,squid]=g.players;
  if(inkObscures(g))return [];
  const d=distance3(whale,squid);
  return [{bearing:Math.round(Math.atan2(squid.x-whale.x,-(squid.z-whale.z))/(Math.PI/4))*45,range:d<16?'near':d<32?'mid':'far',depth:Math.abs(squid.y-whale.y)<5?'level':squid.y>whale.y?'above':'below'}];
}
export function abyssAI(g:AbyssDuel,seat:Player,difficulty:BotDifficulty):PlayerIntent {
  const self=g.players[seat],other=g.players[seat===0?1:0],input=IDLE_INTENT();
  if(seat===0) {
    if(self.oxygen<16)return {...input,vertical:1};
    input.secondary=self.specialCooldown===0;
    const seen=duelOpponentVisible(g,0);
    if(seen)g.lastSeen={x:other.x,y:other.y,z:other.z};
    if(!seen&&self.sonar>0&&self.echoes.length) {
      const echo=self.echoes[0],rad=echo.bearing*Math.PI/180;
      return {...input,x:Math.sin(rad),y:-Math.cos(rad),vertical:echo.depth==='above'?0.7:echo.depth==='below'?-0.7:0};
    }
    const dx=g.lastSeen.x-self.x,dy=g.lastSeen.y-self.y,dz=g.lastSeen.z-self.z,n=Math.max(1,Math.hypot(dx,dy,dz));
    return {...input,x:dx/n,y:dz/n,vertical:dy/n,action:seen&&distance3(self,other)<6.5&&self.cooldown===0};
  }
  const threatened=duelOpponentVisible(g,1),d=distance3(self,other);
  if(threatened) {
    const dx=self.x-other.x,dz=self.z-other.z,n=Math.max(1,Math.hypot(dx,dz));
    input.x=dx/n;input.y=dz/n;input.vertical=self.y< -56?0.5:-0.35;
    input.action=d<(difficulty==='hard'?15:10)&&self.cooldown===0;
    input.secondary=d<10&&self.specialCooldown===0;
  } else { input.x=Math.cos(g.elapsed*0.19)*0.5;input.y=Math.sin(g.elapsed*0.19)*0.5;input.vertical=Math.sin(g.elapsed*0.1)*0.2; }
  // Steer away from arena walls instead of repeatedly bursting into them.
  if(Math.abs(self.x)>27)input.x=-Math.sign(self.x);if(Math.abs(self.z)>27)input.y=-Math.sign(self.z);if(self.y<-57)input.vertical=0.6;
  return input;
}
export function updateAbyssDuel(g:AbyssDuel,inputs:[PlayerIntent,PlayerIntent],seconds:number,ai:boolean,difficulty:BotDifficulty='normal') {
  if(g.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return;
  let remaining=Math.min(seconds,0.1);
  while(remaining>0.000001&&g.phase==='playing') {
    const dt=Math.min(remaining,1/120);remaining-=dt;g.elapsed+=dt;g.time=Math.max(0,g.time-dt);
    if(ai) {g.aiThink-=dt;if(g.aiThink<=0){g.aiInput=abyssAI(g,g.controlled===0?1:0,difficulty);g.aiThink=difficulty==='easy'?0.45:difficulty==='hard'?0.08:0.3;}}
    const actual=inputs.map((input,i)=>ai&&i!==g.controlled?g.aiInput:input);
    g.ink=g.ink.filter(c=>{c.life-=dt;return c.life>0;});
    g.players.forEach((p,i)=>{
      const input=actual[i],norm=Math.max(1,Math.hypot(input.x,input.y,input.vertical));
      p.flash=Math.max(0,p.flash-dt);p.cooldown=Math.max(0,p.cooldown-dt);p.specialCooldown=Math.max(0,p.specialCooldown-dt);p.burst=Math.max(0,p.burst-dt);p.sonar=Math.max(0,p.sonar-dt);if(p.sonar===0)p.echoes=[];
      if(i===1&&input.action&&!p.actionHeld&&p.cooldown===0){p.burst=0.7;p.cooldown=6;g.notice='Squid burst! Read the direction before pursuing.';}
      if(input.secondary&&!p.specialHeld&&p.specialCooldown===0) {
        if(i===0){p.echoes=duelEcho(g);p.sonar=4;p.specialCooldown=6;g.notice=p.echoes.length?'A directional echo. It will fade; it does not track.':'Ink disrupted the pulse. Try another angle.';}
        else {g.ink.push({x:p.x,y:p.y,z:p.z,life:5,radius:8});p.specialCooldown=10;g.notice='Ink clouds the hunt. Keep moving.';}
      }
      const speed=i===0?10:p.burst>0?19:8.5;
      (['x','y','z'] as const).forEach(axis=>{
        const v=axis==='x'?input.x:axis==='y'?input.vertical:input.y;
        p.velocity[axis]+=(v/norm*speed-p.velocity[axis])*(1-Math.exp(-(v===0?9:6)*dt));p[axis]+=p.velocity[axis]*dt;
      });
      p.x=clamp(p.x,-32,32);p.z=clamp(p.z,-32,32);p.y=clamp(p.y,i===0?-62:-60,i===0?-1:-8);
      if(Math.hypot(input.x,input.y)>0.01)p.heading=Math.atan2(-input.y,input.x);
      if(i===0) {
        p.oxygen=p.y>-3?Math.min(70,p.oxygen+25*dt):Math.max(0,p.oxygen-dt);
        if(p.oxygen===0&&p.flash===0){p.lives--;p.flash=3;g.notice='Whale out of breath. Surface now!';}
      }
      p.actionHeld=input.action;p.specialHeld=input.secondary;
    });
    // Resolve the bite after both bodies moved: neither seat gets an update-order advantage.
    const [whale,squid]=g.players;
    if(actual[0].action&&whale.cooldown===0) {
      whale.cooldown=0.8;
      if(distance3(whale,squid)<7&&squid.flash===0){squid.lives--;squid.flash=1.5;g.bites++;g.notice='Bite landed. Squid: burst out before the next opening.';}
    }
    if(squid.lives<=0||whale.lives<=0||g.time===0){g.phase='finished';g.winner=squid.lives<=0?0:1;g.notice=g.winner===0?'The whale completes the hunt.':'The squid escapes the hunt.';}
  }
}
