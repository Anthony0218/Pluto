import { toPublicQuestion } from "./publicQuestion.ts";
import { makeChoiceQuestion } from "./engine.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasDifficulty, AtlasQuestion, GeographicEntity } from "./types.ts";
import { validateAnswer } from "./engine.ts";
export type TerritorySeat="player_a"|"player_b";
export type TerritoryPlan={target:string;kind:"attack"|"defend";correct?:boolean;reveal?:string};
export type TerritoryCampaign={seed:string;ids:string[];edges:Record<string,string[]>;homes:Record<TerritorySeat,string>;ownership:Record<string,TerritorySeat>;seaLanes:[string,string][];objectives:string[];cycle:number;plans:Partial<Record<TerritorySeat,TerritoryPlan>>;history:{cycle:number;events:string[];feedback?:Partial<Record<TerritorySeat,{correct:boolean;answer:string}>>}[];done:boolean};
const BOARDS = [
  ["ESP","FRA","BEL","NLD","LUX","DEU","DNK","SWE","NOR","FIN","POL","CZE","AUT","SVK","HUN","SVN","HRV","SRB","ROU","BGR","GRC","ITA","CHE"],
  ["MAR","DZA","TUN","LBY","EGY","MRT","MLI","NER","TCD","SDN","SSD","ETH","ERI","DJI","SOM","KEN","UGA","COD","CAF","CMR","NGA","BEN","BFA","SEN"],
];
export const TERRITORY_CYCLES=6;
const seats:TerritorySeat[]=["player_a","player_b"];
export function createTerritoryCampaign(entities:GeographicEntity[],seed:string):TerritoryCampaign {
  const random=seededRandom(`${seed}:board`), iso=BOARDS[Math.floor(random()*BOARDS.length)], board=entities.filter(c=>iso.includes(c.iso3)&&c.status==="un195"), ids=board.map(c=>c.id);
  const edges=Object.fromEntries(board.map(c=>[c.id,board.filter(other=>other.id!==c.id&&(c.neighbors.includes(other.id)||other.neighbors.includes(c.id))).map(other=>other.id)]));
  const seaLanes:[string,string][] = ids.includes("country:DNK") ? [["country:DNK","country:SWE"]] : [];
  for(const [a,b] of seaLanes){edges[a].push(b);edges[b].push(a);}
  const distances=(start:string)=>{ const map=new Map([[start,0]]),queue=[start];for(const id of queue) for(const next of edges[id]) if(!map.has(next)){map.set(next,map.get(id)!+1);queue.push(next);}return map; };
  const candidates=shuffled(ids.filter(id=>edges[id].length>=2),random);
  let pair=[candidates[0],candidates[1]], best=-Infinity;
  for(const a of candidates)for(const b of candidates) {
    if(a===b||Math.abs(edges[a].length-edges[b].length)>1)continue;
    const da=distances(a),db=distances(b);if(da.size!==ids.length||db.size!==ids.length)continue;
    const imbalance=ids.reduce((sum,id)=>sum+Math.sign(da.get(id)!-db.get(id)!),0);
    const score=(da.get(b)??0)*3-Math.abs(imbalance);
    if(score>best){best=score;pair=[a,b];}
  }
  if(!Number.isFinite(best))throw new Error("Territory board must be connected.");
  const [a,b]=pair, objectives=shuffled(ids.filter(id=>id!==a&&id!==b&&edges[id].length>=4),random).slice(0,3);
  return {seed,ids,edges,seaLanes,homes:{player_a:a,player_b:b},ownership:{[a]:"player_a",[b]:"player_b"},objectives,cycle:0,plans:{},history:[],done:false};
}
/** Frontier stays supplied from the home; disconnected holdings cannot launch another attack. */
export function suppliedCountries(state:TerritoryCampaign,seat:TerritorySeat):string[] {
  const queue=state.ownership[state.homes[seat]]===seat?[state.homes[seat]]:[];
  for(const id of queue)for(const next of state.edges[id])if(state.ownership[next]===seat&&!queue.includes(next))queue.push(next);
  return queue;
}
export function legalTerritoryTargets(state:TerritoryCampaign,seat:TerritorySeat):string[] {
  const supply=suppliedCountries(state,seat);
  return [...new Set([...Object.keys(state.ownership).filter(id=>state.ownership[id]===seat),...supply.flatMap(id=>state.edges[id]).filter(id=>!Object.values(state.homes).includes(id))])];
}
export function planTerritory(state:TerritoryCampaign,seat:TerritorySeat,target:string):TerritoryCampaign {
  if(state.done||state.plans[seat]||!legalTerritoryTargets(state,seat).includes(target))throw new Error("Choose an owned country to defend or a supplied adjacent country to attack.");
  return {...state,plans:{...state.plans,[seat]:{target,kind:state.ownership[target]===seat?"defend":"attack"}}};
}
export function territoryKnowledge(state:TerritoryCampaign,seat:TerritorySeat,entities:GeographicEntity[],difficulty:AtlasDifficulty):AtlasQuestion {
  const plan=state.plans[seat];if(!plan)throw new Error("Lock a plan first.");
  const target=entities.find(c=>c.id===plan.target)!;
  const category=state.cycle%3===0?"capitals":state.cycle%3===1&&target.neighbors.length?"borders":"currency";
  return makeChoiceQuestion(target,category,entities.filter(c=>c.status==="un195"),difficulty,"un195",`${state.seed}:strategy:${state.cycle}:${seat}`,0);
}
const entitiesLabel=(q:AtlasQuestion,id:string)=>"choices"in q?q.choices.find(c=>c.id===id)?.label??id:id;
export function answerTerritory(state:TerritoryCampaign,seat:TerritorySeat,question:AtlasQuestion,answer:string|string[]):TerritoryCampaign {
  const plan=state.plans[seat];if(!plan||plan.correct!==undefined)throw new Error("Order already resolved.");
  if(question.interaction==="multi_select"&&(!Array.isArray(answer)||answer.some(id=>!question.choices.some(c=>c.id===id))))throw new Error("Invalid options.");
  if(question.interaction==="single_choice"&&(typeof answer!=="string"||!question.choices.some(c=>c.id===answer)))throw new Error("Choose one of the offered options.");
  const reveal=Array.isArray(question.answer)?question.answer.map(id=>entitiesLabel(question,String(id))).join(", "):entitiesLabel(question,String(question.answer));
  return {...state,plans:{...state.plans,[seat]:{...plan,correct:validateAnswer(question,answer),reveal}}};
}
export function resolveTerritory(state:TerritoryCampaign):TerritoryCampaign {
  const plans=seats.map(seat=>state.plans[seat]);if(plans.some(p=>p?.correct===undefined))throw new Error("Both orders need an answer.");
  const ownership={...state.ownership},events:string[]=[];
  for(const seat of seats) {
    const p=state.plans[seat]!,other=state.plans[seat==="player_a"?"player_b":"player_a"]!;
    if(!p.correct){events.push(`${seat}: knowledge challenge missed`);continue;}
    if(p.kind==="defend"){events.push(`${seat}: defended ${p.target}`);continue;}
    if(other.target===p.target&&other.correct){events.push(`${p.target}: contested; ownership held`);continue;}
    ownership[p.target]=seat;events.push(`${seat}: captured ${p.target}`);
  }
  const cycle=state.cycle+1;
  const feedback=Object.fromEntries(seats.map(seat=>[seat,{correct:Boolean(state.plans[seat]?.correct),answer:state.plans[seat]?.reveal??""}]));
  return {...state,ownership,cycle,plans:{},history:[...state.history,{cycle,events,feedback}],done:cycle>=TERRITORY_CYCLES};
}
export function territoryStrategyScores(state:TerritoryCampaign):Record<TerritorySeat,number> {
  return Object.fromEntries(seats.map(seat=>[seat,Object.keys(state.ownership).filter(id=>state.ownership[id]===seat).reduce((sum,id)=>sum+(state.objectives.includes(id)?3:1),0)])) as Record<TerritorySeat,number>;
}
export function territoryBotPlan(state:TerritoryCampaign,seat:TerritorySeat):string {
  const random=seededRandom(`${state.seed}:bot:${state.cycle}:${seat}`);
  return shuffled(legalTerritoryTargets(state,seat),random).sort((a,b)=>Number(state.objectives.includes(b))-Number(state.objectives.includes(a))||Number(state.ownership[a]===seat)-Number(state.ownership[b]===seat))[0];
}

export function territoryView(state:TerritoryCampaign,seat:TerritorySeat,entities:GeographicEntity[],difficulty:AtlasDifficulty,generation:string,resolved=false) {
  const plan=state.plans[seat],other=state.plans[seat==="player_a"?"player_b":"player_a"];
  const question=plan&&plan.correct===undefined?territoryKnowledge(state,seat,entities,difficulty):null;
  return {reviewing:resolved,ids:state.ids,edges:state.edges,seaLanes:state.seaLanes,homes:state.homes,ownership:state.ownership,objectives:state.objectives,cycle:resolved?Math.max(0,state.cycle-1):state.cycle,cycles:TERRITORY_CYCLES,done:state.done,legal:legalTerritoryTargets(state,seat),plan:plan?{target:plan.target,kind:plan.kind,answered:plan.correct!==undefined}:null,opponentPlanned:Boolean(other),feedback:plan?.correct!==undefined?{correct:plan.correct,answer:plan.reveal??""}:resolved?state.history.at(-1)?.feedback?.[seat]??null:null,question:question?toPublicQuestion(question,`${generation}:strategy:${state.cycle}:${seat}`):null,scores:territoryStrategyScores(state),history:state.history.map(({cycle,events})=>({cycle,events}))};
}
export type TerritoryView=ReturnType<typeof territoryView>;
