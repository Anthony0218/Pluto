import GameXpReward from "@/components/games/GameXpReward";
import { useState } from 'react';
import { ArrowLeft, ArrowRight, Users } from 'lucide-react';
import type { BotDifficulty, GameResult, ScenarioId } from '../../games/natura/naturaData';
import { SCENARIOS } from '../../games/natura/naturaData';
import { SNAP_LEVELS } from '../../games/natura/wildModes';
import { SPIDER_COURSES } from '../../games/natura/expeditions';
import { hotseatTurns, hotseatStandings, type HotseatRecord } from '../../games/natura/hotseat';
import { difficultyLabel } from '../../games/natura/studies';
import type { NaturaConfig } from '../../games/natura/protocol';
import NaturaGame from './NaturaGame';
export default function NaturaHotseat({scenario,difficulty,onExit,onComplete}:{scenario:ScenarioId;difficulty:BotDifficulty;onExit:()=>void;onComplete:(r:GameResult)=>void}) {
  const [config,setConfig]=useState<NaturaConfig>({scenario,level:0,difficulty,variant:'race',seed:crypto.getRandomValues(new Uint32Array(1))[0]});
  const [names,setNames]=useState<[string,string]>(['Player 1','Player 2']),[stage,setStage]=useState<'setup'|'handover'|'game'|'turn'|'results'>('setup');
  const [index,setIndex]=useState(0),[records,setRecords]=useState<HotseatRecord[]>([]);
  const turns=hotseatTurns(config),turn=turns[index],descriptor=SCENARIOS.find(s=>s.id===scenario)!,courses=scenario==='trapjaw'?SNAP_LEVELS.map(c=>c.name):scenario==='jumpingspider'?SPIDER_COURSES:[];
  const standings=hotseatStandings(records),environment=scenario==='flyingfish'||scenario==='spermwhale'&&config.variant==='race';
  if(stage==='game')return <NaturaGame key={index} scenario={scenario} mode="ai" round={1} botDifficulty={config.difficulty} initialLevel={config.level} lockedCourse options={{seed:turn.seed,variant:config.variant,role:turn.role}} turnLabel={`HOTSEAT / ${names[turn.player]} / ${turn.label}`} onExit={onExit} onComplete={r=>{if(!r.performance)return;setRecords(previous=>[...previous,{turn,performance:r.performance!}]);setStage('turn');}}/>;
  return <main className="nm-page"><section className="nf-session nf-session-hotseat">
    <button className="nf-button" onClick={onExit}><ArrowLeft size={17}/> Habitats</button><p className="nm-eyebrow">NATURA / ALTERNATING HOTSEAT</p><Users size={36}/><h1>{descriptor.title}</h1>
    {stage==='setup'?<><p>Share one device. Each player gets the same seed, course, difficulty and role. The handover screen clears the previous habitat.</p><div className="nf-form-grid">{names.map((name,i)=><label key={i}>Player {i+1}<input maxLength={24} value={name} onChange={e=>setNames(previous=>{const next:[string,string]=[...previous];next[i]=e.target.value;return next;})}/></label>)}
      {courses.length>0&&<label>Course<select value={config.level} onChange={e=>setConfig(c=>({...c,level:Number(e.target.value)}))}>{courses.map((course,i)=><option key={course} value={i}>{i+1}. {course}</option>)}</select></label>}
      {scenario==='spermwhale'&&<label>Challenge<select value={config.variant} onChange={e=>setConfig(c=>({...c,variant:e.target.value as NaturaConfig['variant']}))}><option value="race">Whale hunt</option><option value="pursuit">Whale vs squid · both roles</option></select></label>}
      {!environment&&<label>AI rival<select value={config.difficulty} onChange={e=>setConfig(c=>({...c,difficulty:e.target.value as BotDifficulty}))}>{(['easy','normal','hard'] as const).map(d=><option value={d} key={d}>{difficultyLabel(d)}</option>)}</select></label>}</div>
      <p className="nf-session-note">{turns.length===4?'Four turns: both players play each role.':'Two turns: the same challenge for both players.'} Compare success, then progress, health/falls and completion time. Survival roles reward time survived.</p><button className="nf-primary" disabled={names.some(n=>!n.trim())} onClick={()=>{setNames([names[0].trim(),names[1].trim()]);setStage('handover');}}>Begin hotseat <ArrowRight size={18}/></button></>
      :stage==='handover'?<><p className="nm-eyebrow">TURN {index+1} / {turns.length}</p><h2>Pass the device to {names[turn.player]}.</h2><p>{turn.label} · {courses[config.level]??descriptor.setting}<br/>Seed {turn.seed} · {environment?'Environment challenge':difficultyLabel(config.difficulty)}</p><p>Use WASD and Space, or the touch controls. No previous world is visible.</p><button className="nf-primary" onClick={()=>setStage('game')}>I’m {names[turn.player]} · start my turn</button></>
      :stage==='turn'?<><h2>{names[turn.player]}’s turn is recorded.</h2><p>{records.at(-1)?.performance.label} · {records.at(-1)?.performance.elapsed.toFixed(1)}s · {records.at(-1)?.performance.completed?'Challenge won':'Challenge ended'}</p><button className="nf-primary" onClick={()=>{if(index+1<turns.length){setIndex(i=>i+1);setStage('handover');}else setStage('results');}}>{index+1<turns.length?'Next handover':'Compare results'} <ArrowRight size={17}/></button></>
      :<><GameXpReward /><h2>{standings.winner===null?'An even match.':`${names[standings.winner]} wins.`}</h2><p>{standings.points[0]} : {standings.points[1]} role challenges won</p><div className="nf-records">{records.map((r,i)=><article key={i}><strong>{names[r.turn.player]} · {r.turn.label}</strong><span>{r.performance.label} · {r.performance.elapsed.toFixed(1)}s</span><small>{r.performance.completed?'Won':'Ended'} · seed {r.turn.seed}</small></article>)}</div><p>Each role was compared separately so unlike objectives do not compete on raw points. Time ties are rounded to a tenth of a second.</p><button className="nf-primary" onClick={()=>onComplete({winner:standings.winner,detail:`Alternating hotseat: ${names[0]} ${standings.points[0]} – ${standings.points[1]} ${names[1]}. Identical seeds and roles.`})}>Match results</button></>}
  </section></main>;
}
