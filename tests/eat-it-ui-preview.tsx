import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import EatItArena from '/src/pages/games/EatIt/EatItArena';
import EatItResults from '/src/pages/games/EatIt/EatItResults';
import { createGame, collectPower, eliminate, stepGame } from '/src/games/eat-it/engine';
import { startHell, stepEruptions, blackHoles, cellCenter } from '/src/games/eat-it/hell';
import '/src/pages/games/EatIt/eat-it.css';
export default function App() {
 const [game,setGame]=useState(null),[result,setResult]=useState(null);
 function start(kind) {
  const s=createGame('city',[{id:'a',name:'You'},{id:'b',name:'Bot',bot:true},{id:'c',name:'Bot 2',bot:true}],55,crypto.randomUUID(),{mode:'solo'});
  s.players.forEach((p,i)=>Object.assign(p,{x:1200+i*400,y:1200}));s.food=[];s.powerups=[];s.nextFood=s.nextPower=s.nextPluto=1e6;
  if(['growth','feeding','cat feeding','hostile pigeon','hostile cat','review'].includes(kind)) {
   const p=s.players[0];p.mass=200;p.storedGrowth=true;
   s.powerups=['speed','shield','magnet','multiplier','divider'].map((kind,i)=>({id:s.nextId++,kind,x:p.x+(i-2)*90,y:p.y-180}));
   if(kind==='growth'){for(const name of ['speed','shield','magnet']){const power={id:s.nextId++,kind:name,x:p.x,y:p.y};s.powerups.push(power);collectPower(s,p,power);}}
   if(kind.includes('feeding')||kind.startsWith('hostile')) {const n=s.encounter.npc;Object.assign(n,{kind:kind.includes('cat')?'cat':'pigeon',phase:kind.startsWith('hostile')?'hostile':'friendly',targetId:'a',until:kind.startsWith('hostile')?20:60,since:0,nextAction:kind.startsWith('hostile')?5:1,x:p.x+100,y:p.y});s.encounter.completedBy='a';}
   if(kind==='review'){s.status='finished';s.result='winner';s.winnerId='a';p.placement=1;p.stats.collected={apple:12,car:2,tree:3,plutoTiny:1,magnet:2,multiplier:1,divider:1};p.stats.growthActivations=1;p.stats.totalGrowth=164;setResult(s);return;}
  }
  if(kind==='abilities') {
   startHell(s);s.time=s.hell.readyAt;s.phase='hell';s.nextPower=s.hell.nextEruption=1e9;blackHoles(s).forEach(b=>b.warnUntil=1e9);
   s.players.forEach((p,i)=>{p.bot=false;Object.assign(p,cellCenter(8*36+8+i*10));});
   const p=s.players[0];p.facing=0;p.storedJump=p.storedStrike=true;
   for(let row=5;row<=11;row++)for(let col=9;col<=11;col++)s.hell.cells[row*36+col]=-1;
   s.powerups=[{id:s.nextId++,kind:'jump',x:p.x-120,y:p.y-120},{id:s.nextId++,kind:'strike',x:p.x-120,y:p.y+120}];
  }
  if(kind==='respawn')eliminate(s,s.players[0]);
  if(kind==='hell'||kind==='tie'||kind==='winner'||kind==='friend'||kind==='eruption'||kind==='curve'||kind==='extreme') {
   if(kind==='friend'){s.encounter.completedBy='a';Object.assign(s.encounter.npc,{targetId:'a',phase:'friendly',until:30});s.players[0].stats.pigeonQuest=true;}
   startHell(s);
   if(['eruption','curve','extreme'].includes(kind)){s.time=s.hell.readyAt;s.phase='hell';const b=s.hell.blackHole;b.warnUntil=s.time+8;b.speedCategory=kind==='extreme'?'extreme':'fast';b.speed=kind==='extreme'?900:400;if(kind==='curve')b.control={x:2000,y:600};if(kind==='eruption'){s.hell.nextEruption=s.time;stepEruptions(s);}s.nextPower=s.time;}

   if(kind==='tie'||kind==='winner'){s.time=s.hell.readyAt; s.players.forEach((p,i)=>{if(kind==='tie'||i!==0)p.x=0});for(let i=0;i<30;i++)stepGame(s);setResult(s);return;}
  }
  setResult(null);setGame(s);
 }
 if(game)return <EatItArena initial={game} localId="a" onExit={()=>setGame(null)} onFinished={s=>{setGame(null);setResult(s)}}/>;
 if(result)return <EatItResults result={result} localId="a" online={false} isHost={false} busy={false} error="" onReplay={()=>start('respawn')} onLobby={()=>setResult(null)}/>;
 return <main style={{padding:24,fontFamily:'system-ui'}}><h1>Eat It HUD and review checks</h1>{['abilities','growth','feeding','cat feeding','hostile pigeon','hostile cat','eruption','curve','extreme','review','respawn','hell','friend','winner','tie'].map(kind=><button key={kind} onClick={()=>start(kind)} style={{padding:16,margin:8}}>{kind}</button>)}</main>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
