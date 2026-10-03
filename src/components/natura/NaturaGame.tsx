import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Info, Pause, Play, RotateCcw } from 'lucide-react';
import type { BotDifficulty, GameResult, PlayMode, ScenarioId, Vec } from '../../games/natura/naturaData';
import { SCENARIOS } from '../../games/natura/naturaData';
import { initialGame, update as updateMeadow } from '../../games/natura/naturafunctions';
import { createArcherGame, updateArcherGame, type ArcherInput } from '../../games/natura/archerfish';
import { createWildGame, updateWildGame, SNAP_LEVELS, PATTERN_NAMES, habitatAt, camouflageMatches, setCuttleSkin, type Pattern } from '../../games/natura/wildModes';
import { createToolGame, updateToolGame } from '../../games/natura/toolAnimals';
import { createExpedition, updateExpedition, SPIDER_COURSES, type ExpeditionInput } from '../../games/natura/expeditions';
import { createLaneOcean, updateLaneOcean } from '../../games/natura/laneOcean';
import { NaturaScene, type NaturaWorld } from '../../games/natura/scene3d';
import DidYouKnow from './DidYouKnow';
import './natura3d.css';

function makeWorld(scenario: ScenarioId, mode: PlayMode, round: number, level: number, botDifficulty: BotDifficulty): NaturaWorld {
  if (scenario === 'meadow') return {kind: scenario, game: initialGame(mode === 'ai' ? 'solo' : 'duo', round % 2 ? 'falcon' : 'mouse')};
  if (scenario === 'archerfish') return {kind: scenario, game: createArcherGame()};
  if (scenario === 'flyingfish') return createLaneOcean();
  if (scenario === 'trapjaw' || scenario === 'cuttlefish') {
    const game = createWildGame(scenario, level, round * 7919);
    if (mode === 'ai') game.aiReadyAt = botDifficulty === 'easy' ? 4 : botDifficulty === 'hard' ? 0.6 : 2.2;
    return game;
  }
  if (scenario === 'bolas' || scenario === 'coconut') return createToolGame(scenario);
  return createExpedition(scenario, level);
}
const phase = (w: NaturaWorld) => 'game' in w ? w.game.phase : w.phase;
const ended = (w: NaturaWorld) => ['end','finished'].includes(phase(w));
function startWorld(w: NaturaWorld) {
  if (w.kind === 'meadow') w.game.phase = 'hunt';
  else if (w.kind === 'archerfish') w.game.phase = 'playing';
  else w.phase = 'playing';
}
function step(w: NaturaWorld, keys: Set<string>, dt: number, ai: boolean, difficulty: BotDifficulty, target?: Vec) {
  const inputs = ([0,1] as const).map(i => ({ x: Number(keys.has(i?'ArrowRight':'KeyD'))-Number(keys.has(i?'ArrowLeft':'KeyA')), y: Number(keys.has(i?'ArrowDown':'KeyS'))-Number(keys.has(i?'ArrowUp':'KeyW')), action: keys.has(i?'Enter':'Space'), secondary: keys.has(i?'ShiftRight':'ShiftLeft') }));
  if(w.kind==='meadow')updateMeadow(w.game,keys,dt,difficulty);
  else if(w.kind==='archerfish') {
    const a=inputs.map((v,i):ArcherInput=>({move:v.x,aim:v.y,shoot:v.action,dash:v.secondary,target:i===0?target:undefined})) as [ArcherInput,ArcherInput];updateArcherGame(w.game,a,dt,ai,difficulty);
  } else if(w.kind==='trapjaw'||w.kind==='cuttlefish')updateWildGame(w,[inputs[0],inputs[1]],dt,ai,difficulty);
  else if(w.kind==='bolas'||w.kind==='coconut')updateToolGame(w,[inputs[0],inputs[1]],dt,ai,difficulty);
  else if(w.kind==='flyingfish')updateLaneOcean(w,[inputs[0].x,inputs[1].x],dt,ai);
  else if(w.kind==='jumpingspider'||w.kind==='spermwhale') {
    const a=inputs.map((v,i):ExpeditionInput=>({x:v.x,z:v.y,vertical:Number(keys.has(i?'PageUp':'KeyQ'))-Number(keys.has(i?'PageDown':'KeyE')),action:v.action,special:v.secondary})) as [ExpeditionInput,ExpeditionInput];updateExpedition(w,a,dt,ai,difficulty);
  }
}
function result(w:NaturaWorld, round:number):GameResult {
  if(w.kind==='meadow')return {winner:w.game.winner===(round%2?'falcon':'mouse')?0:1,detail:w.game.reason};
  const g=w.kind==='archerfish'?w.game:w;
  return {winner:g.winner,detail:w.kind==='flyingfish'?`Clean dodges: ${w.players[0].score} – ${w.players[1].score}.`:g.notice};
}
function stats(w:NaturaWorld):{time:number;players:string[];notice:string} {
  if(w.kind==='meadow'){const g=w.game;return {time:g.phase==='boss'?g.bossTimer:g.timer,players:[`Kestrel · ${g.attacks}/5 dives · ${g.catches}/3 catches`,g.phase==='boss'?`Giant vole · ${g.bossHits}/3 hits`:`Vole · ${g.lives} hearts · ${g.burrowTravel>0?'In tunnel':g.coverTime>0?'Hidden':'Exposed'}`],notice:g.attacks===0?'No dives left. Land on the perch and stay still for 2 seconds.':g.perchFocus>0?`Recharging · ${Math.round(g.perchFocus/2*100)}%`:g.recovering?'Climbing back to hunting height.':g.phase==='boss'?'Fantasy finale: dive on the giant vole; avoid its strike.':'Five dives per charge. Grass and tunnels protect the vole.'};}
  if(w.kind==='archerfish')return {time:w.game.time,players:w.game.fish.map(p=>`${p.catches}/7 food · ${p.shotCooldown>0?'Recharging':'Spit ready'}`),notice:w.game.notice};
  if(w.kind==='flyingfish')return {time:w.time,players:w.players.map(p=>`${p.score} dodges · ${p.lives} hearts · ${['Left','Middle','Right'][p.lane]}`),notice:`${w.zone==='sky'?'AIR · GULLS':'WATER · TUNA'} · switch in ${Math.ceil(w.phaseTime)}s. ${w.notice}`};
  if(w.kind==='trapjaw')return {time:w.time,players:w.players.map(p=>`Ledge ${p.checkpoint+1}/${SNAP_LEVELS[w.level].platforms.length} · ${p.lives} hearts · ${Math.round(p.angle)}°`),notice:w.notice};
  if(w.kind==='cuttlefish')return {time:w.time,players:w.players.map(p=>`${p.food}/6 food · ${p.lives} hearts · Detection ${Math.round(p.exposure)}%`),notice:w.notice};
  if(w.kind==='jumpingspider')return {time:w.time,players:w.players.map(p=>`Leaf ${p.progress+1}/24 · ${p.lives} hearts · Silk ${p.silk}/2`),notice:w.notice};
  if(w.kind==='spermwhale')return {time:w.time,players:w.players.map(p=>`${p.food}/3 hunts · ${p.lives} hearts · Breath ${Math.ceil(p.oxygen)}s · ${Math.round(-p.y)}m`),notice:w.notice};
  if(w.kind!=='bolas'&&w.kind!=='coconut')throw new Error('Unknown habitat');
  return {time:w.time,players:w.players.map(p=>`${p.food}/${w.kind==='bolas'?8:6} food${w.kind==='coconut'?` · ${p.lives} hearts · ${p.hidden?'Covered':p.carrying?'Carrying shell':'Uncovered'}`:` · ${p.lureCooldown>0?'Lure recharging':'Lure ready'}`}`),notice:w.notice};
}
const keyCodes=['KeyA','KeyD','KeyW','KeyS','Space','ShiftLeft','KeyQ','KeyE','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','ShiftRight','PageUp','PageDown'];
export default function NaturaGame({scenario,mode,botDifficulty='normal',round,onComplete,onExit}: {scenario:ScenarioId;mode:PlayMode;botDifficulty?:BotDifficulty;round:number;rulesOpen?:boolean;onComplete:(r:GameResult)=>void;onExit?:()=>void}) {
  const [level,setLevel]=useState(0),[run,setRun]=useState(0);
  return <GameRun key={`${scenario}-${level}-${run}`} scenario={scenario} mode={mode} botDifficulty={botDifficulty} round={round} level={level} setLevel={setLevel} restart={()=>setRun(r=>r+1)} onComplete={onComplete} onExit={onExit}/>;
}
function GameRun({scenario,mode,botDifficulty,round,level,setLevel,restart,onComplete,onExit}:{scenario:ScenarioId;mode:PlayMode;botDifficulty:BotDifficulty;round:number;level:number;setLevel:(n:number)=>void;restart:()=>void;onComplete:(r:GameResult)=>void;onExit?:()=>void}) {
  const [initial]=useState(()=>makeWorld(scenario,mode,round,level,botDifficulty));
  const world=useRef(initial), keys=useRef(new Set<string>()), held=useRef(new Map<number,string>()), pulses=useRef(new Set<string>());
  const canvas=useRef<HTMLCanvasElement>(null),scene=useRef<NaturaScene|null>(null),aim=useRef<Vec|undefined>(undefined);
  const [view,setView]=useState(()=>structuredClone(initial));
  const [paused,setPaused]=useState(false),[panel,setPanel]=useState<'rules'|'facts'|null>(null),[error,setError]=useState('');
  const halted=useRef(false), completed=useRef(false);
  const descriptor=SCENARIOS.find(s=>s.id===scenario)!;
  const ready=phase(view)==='ready', finished=ended(view), active=!ready&&!finished&&!paused&&!panel&&!error;
  const clear=useCallback(()=>{keys.current.clear();held.current.clear();pulses.current.clear();aim.current=undefined;},[]);
  useEffect(()=>{halted.current=paused||panel!==null||!!error;clear();},[paused,panel,error,clear]);
  const pause=useCallback(()=>{clear();halted.current=true;setPaused(true);},[clear]);
  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(event.code==='Escape'){event.preventDefault();pause();return;}
      if(event.target instanceof HTMLElement&&event.target.closest('button,input,select,textarea,a,summary'))return;
      if(!keyCodes.includes(event.code)||halted.current)return;
      event.preventDefault();keys.current.add(event.code);pulses.current.add(event.code);
      if(event.code==='KeyW'||event.code==='KeyS')aim.current=undefined;
    };
    const up=(event:KeyboardEvent)=>keys.current.delete(event.code);
    const visibility=()=>{if(document.hidden)pause();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);clear();};
  },[clear,pause]);
  useEffect(()=>{
    if(!canvas.current)return;
    try { scene.current=new NaturaScene(canvas.current,scenario,()=>{pause();setError('The 3D connection was interrupted. Retry to reopen this habitat.');}); }
    catch { const failure=requestAnimationFrame(()=>setError('This browser could not start WebGL. Enable hardware acceleration, then retry the habitat.'));return()=>cancelAnimationFrame(failure); }
    let frame=0,last=performance.now(),ui=0;
    const tick=(now:number)=>{
      const dt=Math.min((now-last)/1000,0.05);last=now;
      const allKeys=new Set([...keys.current,...held.current.values(),...pulses.current]);
      if(!halted.current)step(world.current,allKeys,dt,mode==='ai',botDifficulty,aim.current);
      pulses.current.clear();
      scene.current?.draw(world.current,mode==='ai');
      if(now-ui>90){setView(structuredClone(world.current));ui=now;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);scene.current?.dispose();scene.current=null;};
  },[scenario,mode,botDifficulty,pause]);
  const start=()=>{clear();if(ready)startWorld(world.current);halted.current=false;setPaused(false);setView(structuredClone(world.current));canvas.current?.focus();};
  const finish=()=>{if(completed.current||!ended(world.current))return;completed.current=true;onComplete(result(world.current,round));};
  const ui=stats(view), courses=scenario==='trapjaw'?SNAP_LEVELS.map(l=>l.name):scenario==='jumpingspider'?SPIDER_COURSES:[];
  const soloOcean=mode==='ai'&&['flyingfish','spermwhale'].includes(scenario);
  const controlLabel=scenario==='trapjaw'?['Aim up','Aim down','Snap','']:scenario==='bolas'?['Aim left','Aim right','Swing','Lure']:scenario==='archerfish'?['Aim left','Aim right','Spit','Dash']:scenario==='cuttlefish'?['Forward','Back','Pattern','Texture']:scenario==='coconut'?['Forward','Back','Pick / drop','Cover']:scenario==='jumpingspider'?['Forward','Back','Jump','Silk']:scenario==='spermwhale'?['Forward','Back','Bite','Sonar']:['Up','Down',mode==='ai'&&round%2===0?'Tunnel':'Dive',''];
  return <section className="n3-game" aria-label={`${descriptor.title} 3D game`}>
    <canvas ref={canvas} tabIndex={0} aria-label={`${descriptor.title}, interactive 3D habitat`} onPointerMove={e=>{if(scenario==='archerfish'&&active)aim.current=scene.current?.aim(e.clientX,e.clientY);}} onPointerDown={e=>{e.currentTarget.focus();if(scenario==='archerfish'&&active){aim.current=scene.current?.aim(e.clientX,e.clientY);held.current.set(e.pointerId,'Space');pulses.current.add('Space');e.currentTarget.setPointerCapture(e.pointerId);}}} onPointerUp={e=>held.current.delete(e.pointerId)} onPointerCancel={e=>held.current.delete(e.pointerId)} onLostPointerCapture={e=>held.current.delete(e.pointerId)} />
    <div className="n3-topbar"><button onClick={onExit} aria-label="Back to habitats"><ArrowLeft size={18}/><span>Habitats</span></button><div><small>NATURA / {scenario==='spermwhale'?'SOUTHERN OCEAN':'FIELD PLAY'}</small><strong>{descriptor.title}</strong></div><nav aria-label="Game tools"><button onClick={()=>{pause();setPanel('facts');}}><Info size={18}/><span>Did you know?</span></button><button onClick={()=>{pause();setPanel('rules');}}><BookOpen size={18}/><span>Rules</span></button><button onClick={paused?start:pause} disabled={ready||finished} aria-label={paused?'Resume':'Pause'}>{paused?<Play size={18}/>:<Pause size={18}/>}</button></nav></div>
    <div className="n3-hud"><div><small>{scenario==='meadow'?mode==='ai'?`${round%2?'YOU':'AI'} · KESTREL${round%2?'':` · ${botDifficulty.toUpperCase()}`}`:'KESTREL':mode==='ai'?'YOU · CORAL':'PLAYER 1 · CORAL'}</small><b>{ui.players[0]}</b></div><strong className="n3-clock">{Math.ceil(ui.time)}<small> SEC</small></strong>{!soloOcean&&<div><small>{scenario==='meadow'?mode==='ai'?`${round%2?'AI':'YOU'} · VOLE${round%2?` · ${botDifficulty.toUpperCase()}`:''}`:'VOLE':mode==='ai'?`AI · GOLD · ${botDifficulty.toUpperCase()}`:'PLAYER 2 · GOLD'}</small><b>{ui.players[1]}</b></div>}</div>
    {view.kind==='spermwhale'&&<div className="n3-depth">{view.players.slice(0,mode==='ai'?1:2).map((p,i)=>{const prey=view.squids.find(s=>s.owner===i&&s.health>0);return <p key={i}><b>{i?'Gold':'Coral'}</b> · {prey?`Squid at ${Math.round(-prey.y)}m · ${prey.x>p.x?'right':'left'} / ${prey.z<p.z?'forward':'back'} · ${Math.round(Math.hypot(prey.x-p.x,prey.y-p.y,prey.z-p.z))}m away`:'Return to the surface'} · Sonar {p.sonarCooldown>0?`${Math.ceil(p.sonarCooldown)}s`:'ready'}</p>;})}</div>}
    <div className="n3-bottom"><p className="n3-notice" role="status">{ui.notice}</p>
      <div className="n3-controls">{([0,1] as const).filter(i=>mode!=='ai'||i===0).map(i=>{
        const controls:[string,string][]=[[i?'ArrowLeft':'KeyA','Left'],[i?'ArrowRight':'KeyD','Right']];
        if(scenario!=='flyingfish')controls.push([i?'ArrowUp':'KeyW',controlLabel[0]],[i?'ArrowDown':'KeyS',controlLabel[1]],[i?'Enter':'Space',scenario==='meadow'&&i===1?'Tunnel':controlLabel[2]]);
        if(controlLabel[3]&&scenario!=='flyingfish')controls.push([i?'ShiftRight':'ShiftLeft',controlLabel[3]]);
        if(scenario==='spermwhale')controls.push([i?'PageUp':'KeyQ','Rise'],[i?'PageDown':'KeyE','Dive']);
        return <div key={i} className={`n3-control-row n3-player-${i}`}><small>{scenario==='meadow'&&mode==='hotseat'&&round%2===0?(i?'P1':'P2'):(i?'P2':'P1')}</small>{controls.map(([code,label])=><button key={code} disabled={!active} aria-label={`${i?'Player 2':'Player 1'} ${label}`} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);held.current.set(e.pointerId,code);pulses.current.add(code);}} onPointerUp={e=>held.current.delete(e.pointerId)} onPointerCancel={e=>held.current.delete(e.pointerId)} onLostPointerCapture={e=>held.current.delete(e.pointerId)} onKeyDown={e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();keys.current.add(code);pulses.current.add(code);}}} onKeyUp={e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();keys.current.delete(code);}}} onBlur={()=>keys.current.delete(code)}>{label}<kbd>{code.replace('Key','').replace('Arrow','').replace('ShiftLeft','Shift').replace('ShiftRight','R Shift')}</kbd></button>)}</div>;
      })}</div>
      {view.kind==='cuttlefish'&&<div className="n3-skins">{([0,1] as const).filter(i=>mode!=='ai'||i===0).map(i=><div key={i}><span>{i?'Gold':'Coral'}: {habitatAt(view.players[i].x,view.players[i].y,view.patches).name} · Need {PATTERN_NAMES[habitatAt(view.players[i].x,view.players[i].y,view.patches).pattern]} + {habitatAt(view.players[i].x,view.players[i].y,view.patches).bumpy?'bumpy':'smooth'} · Skin {view.players[i].bumpy?'bumpy':'smooth'} · {camouflageMatches(view.players[i],view.patches)?'Matched':'Change disguise'}</span>{PATTERN_NAMES.map((p,index)=><button key={p} disabled={!active} aria-pressed={view.players[i].pattern===index} onClick={()=>{if(world.current.kind==='cuttlefish')setCuttleSkin(world.current,i,index as Pattern);canvas.current?.focus();}}>{p}</button>)}</div>)}</div>}
    </div>
    {(ready||paused||finished||!!error)&&!panel&&<div className="n3-overlay"><div className="n3-dialog" role="dialog" aria-label={finished?'Round complete':ready?'Start game':'Game paused'}>
      <small>{finished?'ROUND COMPLETE':ready?'ENTER THE HABITAT':'TAKE A BREATHER'}</small><h2>{error?'3D unavailable':finished?result(view,round).winner===null?'An even match.':`${result(view,round).winner===0?(mode==='ai'?'You win':'Player 1 wins'):(mode==='ai'?soloOcean?'The ocean wins':'AI wins':'Player 2 wins')}.`:paused?'Paused.':descriptor.title}</h2>
      <p>{error|| (finished?result(view,round).detail:descriptor.rules[0])}</p>
      {ready&&!error&&<><p className="n3-key-help">{scenario==='flyingfish'?'Tap A / D to change lane. Release before the next change.':scenario==='spermwhale'?'WASD swim · Q rise · E dive · Space bite · Shift sonar':scenario==='trapjaw'?'A/D walk · W/S angle · Space snap':scenario==='jumpingspider'?'WASD move · Space jump · Shift silk rescue':scenario==='meadow'?mode==='ai'?`You are the ${round%2?'kestrel':'vole'}: WASD + Space.`:'Kestrel: WASD + Space. Vole: arrows + Enter.':'WASD + Space + Shift. Read Rules for animal-specific controls.'}</p>{courses.length>0&&<label className="n3-course">Course<select aria-label="Select course" value={level} onChange={e=>setLevel(Number(e.target.value))}>{courses.map((c,i)=><option key={c} value={i}>{i+1}. {c}</option>)}</select></label>}</>}
      <div className="n3-actions">{error?<button className="n3-primary" onClick={restart}>Retry 3D</button>:finished?<><button className="n3-primary" onClick={finish}>Round results</button>{courses.length>0&&level<courses.length-1&&<button onClick={()=>setLevel(level+1)}>Next course</button>}<button onClick={restart}><RotateCcw size={16}/> Replay</button></>:<><button className="n3-primary" onClick={start}><Play size={17}/>{ready?'Start exploring':'Resume'}</button><button onClick={()=>setPanel('rules')}>Controls & rules</button></>}</div>
    </div></div>}
    {panel&&<div className="n3-overlay"><aside className="n3-dialog n3-guide" role="dialog" aria-label={panel==='facts'?'Did you know?':'Game rules'}><button className="n3-close" onClick={()=>setPanel(null)}>Close</button>{panel==='facts'?<DidYouKnow scenario={scenario}/>:<><small>FIELD GUIDE</small><h2>{descriptor.title}</h2><ol>{descriptor.rules.map(r=><li key={r}>{r}</li>)}</ol><p>{descriptor.abstraction}</p></>}</aside></div>}
  </section>;
}
