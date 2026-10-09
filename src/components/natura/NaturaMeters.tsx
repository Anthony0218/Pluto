import { Heart } from 'lucide-react';
import type { NaturaWorld } from '../../games/natura/world';
import { observe } from '../../games/natura/observations';

function Meter({label,value,max,warning=false}:{label:string;value:number;max:number;warning?:boolean}) {
  const percent=Math.max(0,Math.min(100,value/max*100));
  return <div className={`n3-meter ${warning?'is-warning':''}`}><span>{label}<b>{Math.ceil(value)}{label==='Breath'?'s':'%'}</b></span><meter min={0} max={max} value={value} aria-label={label}/><i style={{width:`${percent}%`}} aria-hidden="true"/></div>;
}
function Cooldown({label,remaining,max}:{label:string;remaining:number;max:number}) {
  return <span className="n3-cooldown"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14"/><circle cx="18" cy="18" r="14" strokeDasharray="88" strokeDashoffset={88*(1-Math.max(0,1-remaining/max))}/></svg><span>{label}<b>{remaining>0?`${remaining.toFixed(1)}s`:'Ready'}</b></span></span>;
}
export default function NaturaMeters({world,seat}:{world:NaturaWorld;seat:number}) {
  const p=observe(world,seat),hasHearts=world.kind!=='archerfish'&&world.kind!=='bolas'&&!(world.kind==='meadow'&&seat===0);
  const progress=world.kind==='meadow'?seat===0?`${world.game.catches}/3 catches · ${world.game.attacks}/5 dives`:'Vole · '+(p.hidden?'Hidden':'Exposed'):world.kind==='jumpingspider'?`Leaf ${world.players[seat].progress+1}/24 · Silk ${world.players[seat].silk}/2`:world.kind==='trapjaw'?`Ledge ${p.progress+1} · ${Math.round(world.players[seat].angle)}°`:world.kind==='flyingfish'?`${p.progress} clean dodges`:world.kind==='spermwhale'?`${p.progress}/3 hunts · ${Math.round(-p.y)}m deep`:world.kind==='coconut'?`${p.progress}/6 food · ${world.players[seat].hidden?'Covered':world.players[seat].carrying?'Carrying':'Uncovered'}`:world.kind==='abyssduel'?seat===0?`${world.bites}/3 bites`:'Escape the whale':`${p.progress}/${world.kind==='bolas'?8:world.kind==='archerfish'?7:6} food`;
  return <><strong className="n3-progress-label">{progress}</strong>{hasHearts&&<span className="n3-hearts" aria-label={`${p.health} hearts remaining`}>{[0,1,2].map(i=><Heart key={i} size={17} fill={i<p.health?'currentColor':'none'} opacity={i<p.health?1:0.3} aria-hidden="true"/>)}</span>}
    {p.oxygen!==undefined&&<Meter label="Breath" value={p.oxygen} max={90} warning={p.oxygen<20}/>}
    {p.exposure!==undefined&&<Meter label="Detection" value={p.exposure} max={100} warning={p.exposure>65}/>}
    {world.kind==='flyingfish'&&world.manual&&<Meter label="Glide energy" value={(world.glide??0)/9*100} max={100} warning={(world.glide??0)<2}/>}
    {world.kind==='archerfish'&&<Cooldown label="Spit" remaining={p.cooldown} max={0.85}/>}
    {world.kind==='bolas'&&<Cooldown label="Lure" remaining={p.special} max={5}/>}
    {(world.kind==='spermwhale'||world.kind==='abyssduel')&&<Cooldown label={world.kind==='abyssduel'&&seat===1?'Ink':'Sonar'} remaining={p.special} max={world.kind==='abyssduel'?10:6}/>}
  </>;
}
