import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Info, Pause, Play, RotateCcw } from 'lucide-react';
import type { BotDifficulty, GameResult, PlayMode, ScenarioId, Vec } from '../../games/natura/naturaData';
import { SCENARIOS } from '../../games/natura/naturaData';
import { SNAP_LEVELS, PATTERN_NAMES, habitatAt, camouflageMatches, setCuttleSkin, type Pattern } from '../../games/natura/wildModes';
import { SPIDER_COURSES, SPIDER_STUDIES, describeEcho } from '../../games/natura/expeditions';
import { NaturaScene } from '../../games/natura/scene3d';
import { makeWorld, phase, ended, startWorld, stepWorld, result, type NaturaWorld, type RunOptions } from '../../games/natura/world';
import { KEY_CODES, readIntents, IDLE_INTENT } from '../../games/natura/input';
import type { NaturaConnection } from '../../games/natura/network';
import { ABYSS_DUEL_RULES } from '../../games/natura/abyssDuel';
import DidYouKnow from './DidYouKnow';
import FieldDialog from './FieldDialog';
import HabitatIcon from './HabitatIcon';
import { STUDIES, difficultyLabel } from '../../games/natura/studies';
import './fieldStation.css';
import './natura3d.css';

function stats(w:NaturaWorld):{time:number;players:string[];notice:string} {
  if(w.kind==='meadow'){const g=w.game;return {time:g.phase==='boss'?g.bossTimer:g.timer,players:[`Kestrel · ${g.attacks}/5 dives · ${g.catches}/3 catches`,g.phase==='boss'?`Giant vole · ${g.bossHits}/3 hits`:`Vole · ${g.lives} hearts · ${g.burrowTravel>0?'In tunnel':g.coverTime>0?'Hidden':'Exposed'}`],notice:g.attacks===0?'No dives left. Land on the perch and stay still for 2 seconds.':g.perchFocus>0?`Recharging · ${Math.round(g.perchFocus/2*100)}%`:g.recovering?'Climbing back to hunting height.':g.phase==='boss'?'Fantasy finale: dive on the giant vole; avoid its strike.':'Five dives per charge. Grass and tunnels protect the vole.'};}
  if(w.kind==='archerfish')return {time:w.game.time,players:w.game.fish.map(p=>`${p.catches}/7 food · ${p.shotCooldown>0?'Recharging':'Spit ready'}`),notice:w.game.notice};
  if(w.kind==='flyingfish')return {time:w.time,players:w.players.map(p=>`${p.score} dodges · ${p.lives} hearts · ${['Left','Middle','Right'][p.lane]}`),notice:`${w.zone==='sky'?'AIR · GULLS':'WATER · TUNA'} · switch in ${Math.ceil(w.phaseTime)}s. ${w.notice}`};
  if(w.kind==='trapjaw')return {time:w.time,players:w.players.map(p=>`Ledge ${p.checkpoint+1}/${SNAP_LEVELS[w.level].platforms.length} · ${p.lives} hearts · ${Math.round(p.angle)}°`),notice:w.notice};
  if(w.kind==='cuttlefish')return {time:w.time,players:w.players.map(p=>`${p.food}/6 food · ${p.lives} hearts · Detection ${Math.round(p.exposure)}%`),notice:w.notice};
  if(w.kind==='jumpingspider')return {time:w.time,players:w.players.map(p=>`Leaf ${p.progress+1}/24 · ${p.lives} hearts · Silk ${p.silk}/2`),notice:w.notice};
  if(w.kind==='spermwhale')return {time:w.time,players:w.players.map(p=>`${p.food}/3 hunts · ${p.lives} hearts · Breath ${Math.ceil(p.oxygen)}s · ${Math.round(-p.y)}m`),notice:w.notice};
  if(w.kind==='abyssduel')return {time:w.time,players:[`Whale · ${w.bites}/3 bites · ${w.players[0].lives} hearts · Breath ${Math.ceil(w.players[0].oxygen)}s`,`Squid · ${w.players[1].lives} hearts · Burst ${w.players[1].cooldown>0?Math.ceil(w.players[1].cooldown)+'s':'ready'} · Ink ${w.players[1].specialCooldown>0?Math.ceil(w.players[1].specialCooldown)+'s':'ready'}`],notice:w.notice};
  if(w.kind!=='bolas'&&w.kind!=='coconut')throw new Error('Unknown habitat');
  return {time:w.time,players:w.players.map(p=>`${p.food}/${w.kind==='bolas'?8:6} food${w.kind==='coconut'?` · ${p.lives} hearts · ${p.hidden?'Covered':p.carrying?'Carrying shell':'Uncovered'}`:` · ${p.lureCooldown>0?'Lure recharging':'Lure ready'}`}`),notice:w.notice};
}

type NaturaGameProps={scenario:ScenarioId;mode:PlayMode;botDifficulty?:BotDifficulty;round:number;rulesOpen?:boolean;onComplete:(r:GameResult)=>void;onExit?:()=>void;options?:RunOptions;initialLevel?:number;lockedCourse?:boolean;remote?:NaturaConnection;turnLabel?:string};
export default function NaturaGame({scenario,mode,botDifficulty='normal',round,onComplete,onExit,options,initialLevel=0,lockedCourse=false,remote,turnLabel}: NaturaGameProps) {
  const [level,setLevel]=useState(initialLevel),[run,setRun]=useState(0),[runOptions,setRunOptions]=useState<RunOptions>(options??{});
  return <GameRun key={`${scenario}-${level}-${run}-${runOptions.variant}-${runOptions.role}`} scenario={scenario} mode={mode} botDifficulty={botDifficulty} round={round} level={level} setLevel={setLevel} restart={()=>setRun(r=>r+1)} onComplete={onComplete} onExit={onExit} options={runOptions} chooseOptions={setRunOptions} lockedCourse={lockedCourse} remote={remote} turnLabel={turnLabel}/>;
}
function GameRun({scenario,mode,botDifficulty,round,level,setLevel,restart,onComplete,onExit,options,chooseOptions,lockedCourse,remote,turnLabel}:NaturaGameProps&{botDifficulty:BotDifficulty;level:number;setLevel:(n:number)=>void;restart:()=>void;chooseOptions:(options:RunOptions)=>void}) {
  useGameLanguage();
  const [initial]=useState(()=>remote?.state?.world??makeWorld(scenario,mode,round,level,botDifficulty,options));
  const world=useRef(initial), keys=useRef(new Set<string>()), held=useRef(new Map<number,string>()), pulses=useRef(new Set<string>());
  const canvas=useRef<HTMLCanvasElement>(null),scene=useRef<NaturaScene|null>(null),aim=useRef<Vec|undefined>(undefined);
  const [view,setView]=useState(()=>structuredClone(initial));
  const [paused,setPaused]=useState(false),[panel,setPanel]=useState<'rules'|'facts'|null>(null),[error,setError]=useState('');
  const halted=useRef(false), completed=useRef(false);
  const skin=useRef<{pattern?:Pattern}>({});
  const descriptor=SCENARIOS.find(s=>s.id===scenario)!;
  const study=STUDIES[scenario];
  const networkPaused=!!remote&&(remote.state?.room.status==='paused'||!remote.connected), countdown=remote?.state?.room.countdown??0;
  const ready=phase(view)==='ready', finished=ended(view), isPaused=remote?networkPaused:paused, active=!ready&&!finished&&!isPaused&&!panel&&!error&&countdown===0;
  const clear=useCallback(()=>{keys.current.clear();held.current.clear();pulses.current.clear();aim.current=undefined;remote?.clearInput();},[remote]);
  useEffect(()=>{halted.current=isPaused||panel!==null||!!error||countdown>0;clear();},[isPaused,panel,error,countdown,clear]);
  const pause=useCallback(()=>{clear();halted.current=true;if(remote)remote.send({type:'PAUSE'});else setPaused(true);},[clear,remote]);
  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(event.target instanceof HTMLElement && event.target.closest('dialog')) return;
      if(event.code==='Escape'){event.preventDefault();pause();return;}
      if(event.target instanceof HTMLElement&&event.target.closest('button,input,select,textarea,a,summary'))return;
      if(!KEY_CODES.includes(event.code)||halted.current)return;
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
      if(remote){const incoming=remote.state?.world;if(incoming)world.current=incoming;if(!halted.current){const input=readIntents(allKeys,aim.current)[0];if(input.action)skin.current.pattern=undefined;remote.setInput({...input,...skin.current});}}
      else if(!halted.current){let inputs=readIntents(allKeys,aim.current);if(world.current.kind==='abyssduel'&&mode==='ai'&&world.current.controlled===1)inputs=[IDLE_INTENT(),inputs[0]];stepWorld(world.current,inputs,dt,mode==='ai',botDifficulty);}
      pulses.current.clear();
      const rendered=remote?.presentation(now)??world.current;
      scene.current?.draw(rendered,mode==='ai',{viewer:remote?.state?.seat??(world.current.kind==='abyssduel'&&mode==='ai'?world.current.controlled:world.current.kind==='meadow'&&mode==='ai'&&world.current.game.role==='mouse'?1:undefined),hidden:remote?.state?.hidden});
      if(now-ui>90){setView(structuredClone(world.current));ui=now;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>{cancelAnimationFrame(frame);scene.current?.dispose();scene.current=null;};
  },[scenario,mode,botDifficulty,pause,remote]);
  const start=()=>{clear();if(remote){remote.send({type:'READY',ready:true});canvas.current?.focus();return;}if(ready)startWorld(world.current);halted.current=false;setPaused(false);setView(structuredClone(world.current));canvas.current?.focus();};
  const finish=()=>{if(completed.current||!ended(world.current))return;completed.current=true;onComplete(result(world.current,round));};
  const ui=stats(view), courses=scenario==='trapjaw'?SNAP_LEVELS.map(l=>l.name):scenario==='jumpingspider'?SPIDER_COURSES:[];
  const soloOcean=mode==='ai'&&['flyingfish','spermwhale'].includes(scenario)&&view.kind!=='abyssduel';
  const humanVole=view.kind==='meadow'&&mode==='ai'&&view.game.role==='mouse';
  const rules=view.kind==='abyssduel'?ABYSS_DUEL_RULES:descriptor.rules;
  const heading=(i:number)=>view.kind==='abyssduel'?`${i===0?'WHALE':'SQUID'} · ${remote?remote.state?.seat===i?'YOU':'RIVAL':mode==='ai'?view.controlled===i?'YOU':'AI':`PLAYER ${i+1}`}`:remote?`${remote.state?.seat===i?'YOU':'RIVAL'} · ${scenario==='meadow'?i===0?'KESTREL':'VOLE':i===0?'CORAL':'GOLD'}`:scenario==='meadow'?`${mode==='ai'?((i===0)!==humanVole?'YOU':'AI')+' · ':''}${i===0?'KESTREL':'VOLE'}`:mode==='ai'?i===0?'YOU · CORAL':`AI · GOLD · ${difficultyLabel(botDifficulty).toUpperCase()}`:`PLAYER ${i+1} · ${i===0?'CORAL':'GOLD'}`;
  const controlLabel=scenario==='trapjaw'?['','','Time snap','']:scenario==='bolas'?['Aim left','Aim right','Swing','Lure']:scenario==='archerfish'?['Aim left','Aim right','Spit','Dash']:scenario==='cuttlefish'?['Forward','Back','Pattern','Texture']:scenario==='coconut'?['Forward','Back','Pick / drop','Cover']:scenario==='jumpingspider'?['Forward','Back','Jump','Silk']:scenario==='spermwhale'?['Forward','Back','Bite','Sonar']:['Up','Down',humanVole?(view.kind==='meadow'&&view.game.phase==='boss'?'Strike':'Tunnel'):'Dive',''];
  return <section className="n3-game" aria-label={gameUi(`${descriptor.title} 3D game`)}>
    <canvas ref={canvas} tabIndex={0} aria-label={gameUi(`${descriptor.title}, interactive 3D habitat`)} onPointerMove={e=>{if(scenario==='archerfish'&&active)aim.current=scene.current?.aim(e.clientX,e.clientY);}} onPointerDown={e=>{e.currentTarget.focus();if(scenario==='archerfish'&&active){aim.current=scene.current?.aim(e.clientX,e.clientY);held.current.set(e.pointerId,'Space');pulses.current.add('Space');e.currentTarget.setPointerCapture(e.pointerId);}}} onPointerUp={e=>held.current.delete(e.pointerId)} onPointerCancel={e=>held.current.delete(e.pointerId)} onLostPointerCapture={e=>held.current.delete(e.pointerId)} />
    <div className="n3-topbar"><button onClick={onExit} aria-label={gameUi("Back to habitats")}><ArrowLeft size={18}/><span>{gameUi("Habitats")}</span></button><div><small>{gameUi(turnLabel??`NATURA / ${study.habitat.toUpperCase()}`)}</small><strong>{gameUi(descriptor.title)}{gameUi(view.kind==='abyssduel'?' · Whale vs squid':'')}</strong></div><nav aria-label={gameUi("Game tools")}><button aria-label={gameUi("Field notes")} onClick={()=>{pause();setPanel('facts');}}><Info size={18}/><span>{gameUi("Did you know?")}</span></button><button aria-label={gameUi("Controls & rules")} onClick={()=>{pause();setPanel('rules');}}><BookOpen size={18}/><span>{gameUi("Rules")}</span></button><button onClick={isPaused?start:pause} disabled={ready||finished} aria-label={gameUi(isPaused?'Resume':'Pause')}>{isPaused?<Play size={18}/>:<Pause size={18}/>}</button></nav></div>
    <div className="n3-hud"><div><small>{gameUi(heading(0))}</small><b>{gameUi(ui.players[0])}</b>{view.kind==='meadow'&&view.game.perchFocus>0&&<div className="n3-reload" role="progressbar" aria-label={gameUi("Dive charge refill")} aria-valuenow={Math.round(view.game.perchFocus/2*100)} aria-valuemin={0} aria-valuemax={100}><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14"/><circle cx="18" cy="18" r="14" strokeDashoffset={88*(1-view.game.perchFocus/2)}/></svg><span>{gameUi("Refill ")}{gameUi(Math.round(view.game.perchFocus/2*100))}%</span></div>}</div><strong className="n3-clock">{gameUi(Math.ceil(ui.time))}<small>{gameUi(" SEC")}</small></strong>{!soloOcean&&<div><small>{gameUi(heading(1))}</small><b>{gameUi(ui.players[1])}</b></div>}</div>
    {countdown>0&&<div className="n3-network-countdown" role="status">{gameUi("Get ready · ")}{gameUi(Math.ceil(countdown))}</div>}
    {view.kind==='abyssduel'&&(remote?.state?.seat??view.controlled)===0&&<div className="n3-depth"><p><b>{gameUi("Sonar")}</b> · {gameUi(view.players[0].sonar>0?view.players[0].echoes.length?view.players[0].echoes.map(describeEcho).join(' / '):'Echo disrupted by ink':'Send a pulse for a direction')} · {gameUi(Math.ceil(view.players[0].specialCooldown))}{gameUi("s recharge")}</p></div>}
    {view.kind==='spermwhale'&&<div className="n3-depth">{view.players.slice(0,mode==='ai'?1:2).map((p,i)=><p key={i}><b>{gameUi(i?'Gold':'Coral')}</b> · {gameUi(p.food>=3?'Return to the surface':p.sonar>0&&p.echoes.length?`Echo snapshot: ${p.echoes.map(describeEcho).join(' / ')} · fading ${Math.ceil(p.sonar)}s`:'Send sonar to observe a direction')}{gameUi(" · Sonar ")}{gameUi(p.sonarCooldown>0?`${Math.ceil(p.sonarCooldown)}s`:'ready')}</p>)}</div>}

    <div className="n3-bottom"><p className="n3-notice" role="status">{gameUi(ui.notice)}</p>
      <div className="n3-controls">{([0,1] as const).filter(i=>!remote&&mode!=='ai'||i===0).map(i=>{
        const actor=remote?.state?.seat??(view.kind==='abyssduel'&&mode==='ai'?view.controlled:i);
        const isSquid=view.kind==='abyssduel'&&actor===1;
        const controls:[string,string][]=[[i?'ArrowLeft':'KeyA','Left'],[i?'ArrowRight':'KeyD','Right']];
        if(scenario!=='flyingfish') {
          if(scenario!=='trapjaw')controls.push([i?'ArrowUp':'KeyW',controlLabel[0]],[i?'ArrowDown':'KeyS',controlLabel[1]]);
          controls.push([i?'Enter':'Space',isSquid?'Burst':scenario==='meadow'&&(actor===1||humanVole)?(view.kind==='meadow'&&view.game.phase==='boss'?'Strike':'Tunnel'):controlLabel[2]]);
        }
        if(controlLabel[3]&&scenario!=='flyingfish')controls.push([i?'ShiftRight':'ShiftLeft',isSquid?'Ink':controlLabel[3]]);
        if(scenario==='spermwhale')controls.push([i?'PageUp':'KeyQ','Rise'],[i?'PageDown':'KeyE','Dive']);
        return <div key={i} className={`n3-control-row n3-player-${i}`}><small>{gameUi(remote?'YOU':scenario==='meadow'&&mode==='hotseat'&&round%2===0?(i?'P1':'P2'):(i?'P2':'P1'))}</small>{controls.map(([code,label])=><button key={code} disabled={!active} aria-label={gameUi(`${remote?'Your':i?'Player 2':'Player 1'} ${label}`)} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);held.current.set(e.pointerId,code);pulses.current.add(code);}} onPointerUp={e=>held.current.delete(e.pointerId)} onPointerCancel={e=>held.current.delete(e.pointerId)} onLostPointerCapture={e=>held.current.delete(e.pointerId)} onKeyDown={e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();keys.current.add(code);pulses.current.add(code);}}} onKeyUp={e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();keys.current.delete(code);}}} onBlur={()=>keys.current.delete(code)}>{gameUi(label)}<kbd>{gameUi(code.replace('Key','').replace('Arrow','').replace('ShiftLeft','Shift').replace('ShiftRight','R Shift'))}</kbd></button>)}</div>;
      })}</div>
      {view.kind==='cuttlefish'&&<div className="n3-skins">{([0,1] as const).filter(i=>!remote&&mode!=='ai'||i===0).map(i=>{const actor=remote?.state?.seat??i,p=view.players[actor],habitat=habitatAt(p.x,p.y,view.patches);return <div key={i}><span>{gameUi(remote?'You':actor?'Gold':'Coral')}: {gameUi(habitat.name)}{gameUi(" · Need ")}{gameUi(PATTERN_NAMES[habitat.pattern])} + {gameUi(habitat.bumpy?'bumpy':'smooth')}{gameUi(" · Skin ")}{gameUi(p.bumpy?'bumpy':'smooth')} · {gameUi(camouflageMatches(p,view.patches)?'Matched':'Change disguise')}</span>{PATTERN_NAMES.map((pattern,index)=><button key={pattern} disabled={!active} aria-pressed={p.pattern===index} onClick={()=>{if(remote)skin.current.pattern=index as Pattern;else if(world.current.kind==='cuttlefish')setCuttleSkin(world.current,actor,index as Pattern);canvas.current?.focus();}}>{gameUi(pattern)}</button>)}</div>;})}</div>}
    </div>
    {(ready||isPaused||finished||!!error)&&!panel&&<FieldDialog restoreFocus={false} afterClose={()=>canvas.current?.focus()} title={gameUi(finished?'Round complete':ready?'Start game':'Game paused')} close={()=>{if(ready||finished||error)onExit?.();else start();}} className="n3-dialog">
      <small>{gameUi(finished?'STUDY COMPLETE':ready?study.category.toUpperCase()+' / '+study.habitat.toUpperCase():'TAKE A BREATHER')}</small><h2>{gameUi(error?'3D unavailable':finished?result(view,round).winner===null?'An even match.':`${result(view,round).winner===0?(mode==='ai'?'You win':'Player 1 wins'):(mode==='ai'?soloOcean?'The ocean wins':'AI wins':'Player 2 wins')}.`:isPaused?'Paused.':descriptor.title)}</h2>
      <p>{gameUi(error|| (finished?result(view,round).detail:isPaused?remote?remote.connected?'The round is paused for both players. Both must be ready to resume.':'Connection interrupted. Waiting to reconnect.':'The habitat is paused. Resume whenever you are ready.':rules[0]))}</p>
      {ready&&!error&&<><div className="nm-specimen"><HabitatIcon id={scenario}/><div><small>{gameUi("STUDY SUBJECT")}</small><strong>{gameUi(study.subjects)}</strong><span>{gameUi("Biological inspiration · simplified game rules")}</span></div></div>{scenario==='spermwhale'&&!lockedCourse&&<div className="nf-form-grid"><label className="n3-course">{gameUi("Challenge")}<select aria-label={gameUi("Abyss challenge")} value={options?.variant??'race'} onChange={e=>chooseOptions({...options,variant:e.target.value as RunOptions['variant'],role:'whale'})}><option value="race">{gameUi("Whale hunt / race")}</option><option value="pursuit">{gameUi("Whale vs squid")}</option></select></label>{options?.variant==='pursuit'&&mode==='ai'&&<label className="n3-course">{gameUi("Your animal")}<select aria-label={gameUi("Your abyss animal")} value={options?.role??'whale'} onChange={e=>chooseOptions({...options,role:e.target.value as RunOptions['role']})}><option value="whale">{gameUi("Whale")}</option><option value="squid">{gameUi("Squid")}</option></select></label>}</div>}<p className="n3-key-help">{gameUi(view.kind==='abyssduel'?`WASD swim · Q/E depth · Space ${mode==='ai'&&view.controlled===1?'burst':'bite'} · Shift ${mode==='ai'&&view.controlled===1?'ink':'sonar'}`:scenario==='flyingfish'?'Tap A / D to change lane. Release before the next change.':scenario==='spermwhale'?'WASD swim · Q rise · E dive · Space bite · Shift sonar':scenario==='trapjaw'?'A/D walk · the arc cycles automatically · Space locks the angle and snaps':scenario==='jumpingspider'?'WASD move · Space jump · Shift silk rescue':scenario==='meadow'?mode==='ai'?`You are the ${humanVole?'vole':'kestrel'}: WASD + Space.`:'Kestrel: WASD + Space. Vole: arrows + Enter.':'WASD + Space + Shift. Read Rules for animal-specific controls.')}</p>{scenario==='trapjaw'&&<p>{gameUi(SNAP_LEVELS[level].hint)} · {gameUi(SNAP_LEVELS[level].difficulty)}</p>}{scenario==='jumpingspider'&&<p>{gameUi(SPIDER_STUDIES[level].hint)}</p>}{courses.length>0&&<label className="n3-course">{gameUi("Course")}<select aria-label={gameUi("Select course")} value={level} disabled={lockedCourse} onChange={e=>setLevel(Number(e.target.value))}>{courses.map((c,i)=><option key={c} value={i}>{gameUi(i+1)}. {gameUi(c)}</option>)}</select></label>}</>}
      <div className="n3-actions">{gameUi(error?<button className="n3-primary" onClick={restart}>{gameUi("Retry 3D")}</button>:finished?<><button className="n3-primary" onClick={finish}>{gameUi(lockedCourse?'Finish turn':'Round results')}</button>{!lockedCourse&&courses.length>0&&level<courses.length-1&&<button onClick={()=>setLevel(level+1)}>{gameUi("Next course")}</button>}{!lockedCourse&&<button onClick={restart}><RotateCcw size={16}/>{gameUi(" Replay")}</button>}</>:<><button className="n3-primary" onClick={start} disabled={!!remote&&!remote.connected}><Play size={17}/>{gameUi(ready?'Start exploring':remote&&remote.state?.room.members[remote.state.seat]?.ready?'Waiting for the other player…':'Resume')}</button><button onClick={()=>setPanel('rules')}>{gameUi("Controls & rules")}</button></>)}</div>
    </FieldDialog>}
    {panel&&<FieldDialog restoreFocus={false} afterClose={()=>canvas.current?.focus()} title={gameUi(panel==='facts'?'Did you know?':'Game rules')} close={()=>setPanel(null)} className="n3-dialog n3-guide"><button className="n3-close" onClick={()=>setPanel(null)}>{gameUi("Close")}</button>{panel==='facts'?<DidYouKnow scenario={scenario}/>:<><small>{gameUi("FIELD GUIDE")}</small><h2>{gameUi(descriptor.title)}</h2><ol>{rules.map(r=><li key={r}>{gameUi(r)}</li>)}</ol><p>{gameUi(descriptor.abstraction)}</p></>}</FieldDialog>}
  </section>;
}
