import { useState } from "react";
import { AtlasWorldMap } from "./AtlasWorldMap";
import { ArenaQuestionInput } from "./ArenaQuestionInput";
import { answerTerritory, createTerritoryCampaign, planTerritory, resolveTerritory, territoryBotPlan, territoryKnowledge, territoryView, type TerritorySeat, type TerritoryView } from "../../games/atlas/territoryStrategy";
import { seededRandom } from "../../games/atlas/random";
import type { AtlasDataset, AtlasDifficulty } from "../../games/atlas/types";
import type { SoloSummary } from "../../games/atlas/soloSettings";
import { focusForScope } from "../../games/atlas/scopes";

export function TerritoryBoard({data,view,seat,names,disabled,onPlan,onAnswer}:{data:AtlasDataset;view:TerritoryView;seat:TerritorySeat;names:[string,string];disabled:boolean;onPlan:(id:string)=>void;onAnswer:(answer:string|string[])=>void}) {
  const [target,setTarget]=useState<string|null>(null),entities=data.countries.filter(c=>view.ids.includes(c.id));
  const name=(id:string)=>entities.find(c=>c.id===id)?.shortName??id;
  const legal=target&&view.legal.includes(target), mine=seat==="player_a"?0:1;
  const inAfrica=entities.some(c=>c.iso3==="EGY");
  return <section className="atlas-play-layout atlas-strategy-layout"><aside className="atlas-question-panel"><span className="atlas-eyebrow">Cycle {Math.min(view.cycle+1,view.cycles)} / {view.cycles} · simultaneous orders</span><h1>{view.reviewing?(view.done?"Campaign complete":"Orders resolved"):view.plan?`${view.plan.kind==="attack"?"Capture":"Defend"} ${name(view.plan.target)}`:"Choose your next frontier"}</h1>
    <div className="atlas-scoreboard"><div><span>{names[0]} · blue</span><strong>{view.scores.player_a}</strong></div><div><span>{names[1]} · purple</span><strong>{view.scores.player_b}</strong></div></div>
    <p>Expand from your supplied border or defend a holding. Each country is worth 1; hubs are worth 3. Homes are protected. Both players choose before orders resolve.</p>
    {!view.plan&&!view.done&&!view.reviewing&&<><label className="atlas-label">Legal orders<select value={target??""} disabled={disabled} onChange={e=>setTarget(e.target.value||null)}><option value="">Choose a country…</option>{view.legal.map(id=><option key={id} value={id}>{view.ownership[id]===seat?"Defend":"Attack"} {name(id)}{view.objectives.includes(id)?" · hub ★":""}</option>)}</select></label><button className="atlas-submit" disabled={disabled||!legal} onClick={()=>target&&onPlan(target)}>Lock {target&&view.ownership[target]===seat?"defense":"attack"}</button></>}
    {view.question&&<><p>Knowledge decides whether your order succeeds.</p><h2>{view.question.prompt}</h2><ArenaQuestionInput key={view.question.id} question={view.question} topology={data.topology} disabled={disabled} onAnswer={onAnswer}/></>}
    {view.feedback&&<div className={`atlas-feedback ${view.feedback.correct?"is-correct":"is-wrong"}`} role="status"><p>{view.feedback.correct?"Knowledge challenge solved":"Knowledge challenge missed"} · {view.feedback.answer}</p></div>}
    {view.plan?.answered&&<p role="status">Order saved. Waiting for the other commander.</p>}
    <p className="atlas-setup-note">You command {names[mine]}. A correct defense blocks an attack. If both solve a contested neutral country, it stays neutral. Response speed never decides a capture.</p>
    <p>Protected homes: {names[0]} — {name(view.homes.player_a)} · {names[1]} — {name(view.homes.player_b)}</p>
    <div className="atlas-strategy-hubs"><strong>Strategic hubs</strong>{view.objectives.map(id=><span key={id}>★ {name(id)}</span>)}</div>
    {view.history.length>0&&<details open><summary>Last cycle</summary><ul>{view.history.at(-1)!.events.map((event,i)=><li key={i}>{event.replaceAll("player_a",names[0]).replaceAll("player_b",names[1]).replace(/country:[A-Z]+/g,name)}</li>)}</ul></details>}
  </aside><div className="atlas-strategy-map"><AtlasWorldMap topology={data.topology} entities={entities} ownership={view.ownership} selectedId={target} objectiveIds={view.objectives} legalIds={view.legal} routes={view.seaLanes} focus={focusForScope(inAfrica?"Africa":"Europe")} disabled={disabled||Boolean(view.plan)} onSelect={id=>setTarget(id)} showHoverLabels/><p className="atlas-map-legend">Blue / purple: ownership · Stars: hubs · Outlined: legal orders · Borders define routes. {view.seaLanes.length>0&&"Dashed route: Denmark–Sweden sea lane."} Select a country to inspect an order.</p></div></section>;
}

/** Offline play shares the same campaign rules as multiplayer. Hotseat plans remain hidden behind handoffs. */
export function AtlasTerritoryCampaign({data,difficulty,seed,names=["You","Rival"],hotseat=false,onFinish,onExit}:{data:AtlasDataset;difficulty:AtlasDifficulty;seed:string;names?:[string,string];hotseat?:boolean;onFinish:(result:SoloSummary)=>void;onExit:()=>void}) {
  const [campaign,setCampaign]=useState(()=>createTerritoryCampaign(data.countries,seed));
  const [seat,setSeat]=useState<TerritorySeat>("player_a"),[handoff,setHandoff]=useState(hotseat),[review,setReview]=useState(false),[correct,setCorrect]=useState(0),[wrong,setWrong]=useState(0);
  const [started]=useState(Date.now);
  const view=territoryView(campaign,seat,data.countries,difficulty,"local",review);
  const answer=(value:string|string[])=>{
    const q=territoryKnowledge(campaign,seat,data.countries,difficulty);let next=answerTerritory(campaign,seat,q,value);
    const solved=next.plans[seat]!.correct;setCorrect(n=>n+Number(solved));setWrong(n=>n+Number(!solved));
    if(!hotseat) {
      // The bot chooses without seeing the human plan; its deterministic knowledge roll is difficulty-sensitive.
      const blind={...campaign,plans:{}};const target=territoryBotPlan(blind,"player_b");next=planTerritory(next,"player_b",target);
      next={...next,plans:{...next.plans,player_b:{...next.plans.player_b!,correct:seededRandom(`${seed}:bot-answer:${next.cycle}`)()<({beginner:.55,intermediate:.72,expert:.88}[difficulty])}}};
    }
    if(next.plans.player_a?.correct!==undefined&&next.plans.player_b?.correct!==undefined) {next=resolveTerritory(next);setReview(true);setSeat("player_a");}
    else {setSeat("player_b");setHandoff(true);}
    setCampaign(next);
  };
  const finish=()=>onFinish({score:view.scores.player_a,correct,wrong,bestStreak:0,elapsedMs:Date.now()-started,missed:[],territory:{mine:view.scores.player_a,rival:view.scores.player_b}});
  if(handoff)return <main className="atlas-page atlas-center"><h1>Pass to {seat==="player_a"?names[0]:names[1]}</h1><p>Keep your opponent’s order hidden.</p><button className="atlas-start" onClick={()=>setHandoff(false)}>Ready to command</button><button onClick={onExit}>Leave</button></main>;
  return <main className="atlas-game-page"><header className="atlas-game-header"><button className="atlas-icon-button" aria-label="Exit campaign" onClick={onExit}>×</button><div><span className="atlas-eyebrow">Territory Battle</span><strong>{seat==="player_a"&&names[0]==="You"?"Your command":`${names[seat==="player_a"?0:1]} commands`}</strong></div>{review&&<button className="atlas-submit" onClick={()=>{if(campaign.done)finish();else{setReview(false);if(hotseat)setHandoff(true);}}}>{campaign.done?"See result":"Next cycle"}</button>}</header><TerritoryBoard data={data} view={view} seat={seat} names={names} disabled={review} onPlan={id=>setCampaign(old=>planTerritory(old,seat,id))} onAnswer={answer}/></main>;
}
