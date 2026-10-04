import { generateQuestions, makeChoiceQuestion, entitiesForScope } from "./engine.ts";
import { generateDensityQuestion } from "./advancedQuestions.ts";
import { entitiesInFillScope, type FillScope } from "./scopes.ts";
import { seededRandom, shuffled } from "./random.ts";
import type { AtlasDataset, AtlasQuestion } from "./types.ts";
export const MASTERY_STAGES=["Locate","Connect","Reason"] as const;
export type RegionMastery={stage:number;successes:number[];concepts:string[][];runs:string[];review:string[]};
export type MasteryProgress=Partial<Record<FillScope,RegionMastery>>;
const KEY="atlas-mastery:v1";
export const emptyMastery=():RegionMastery=>({stage:0,successes:[0,0,0],concepts:[[],[],[]],runs:[],review:[]});
export function loadMastery():MasteryProgress {
  try {const raw=JSON.parse(window.localStorage.getItem(KEY)??"{}");const safe:MasteryProgress={};for(const [region,value] of Object.entries(raw)){const v=value as RegionMastery;if(v&&Number.isInteger(v.stage)&&v.stage>=0&&v.stage<=3&&Array.isArray(v.successes)&&v.successes.length===3&&v.successes.every(n=>Number.isInteger(n)&&n>=0)&&Array.isArray(v.concepts)&&v.concepts.length===3&&v.concepts.every(a=>Array.isArray(a)&&a.every(s=>typeof s==="string"))&&Array.isArray(v.runs)&&v.runs.every(s=>typeof s==="string")&&Array.isArray(v.review)&&v.review.every(s=>typeof s==="string"))safe[region as FillScope]=v;}return safe;}catch{return {};}
}
export function saveMastery(progress:MasteryProgress){try{window.localStorage.setItem(KEY,JSON.stringify(progress));}catch{/* local practice remains available */}}
export function masteryQuestions(data:AtlasDataset,region:FillScope,stage:number,seed:string):AtlasQuestion[] {
  const pool=entitiesInFillScope(data.countries,region);
  if(stage===0)return generateQuestions({entities:pool,datasetVersion:data.version.atlasDataVersion,seed,difficulty:"expert",count:10,categories:["locations"],interaction:"map_click"});
  if(stage===1)return generateQuestions({entities:pool,datasetVersion:data.version.atlasDataVersion,seed,difficulty:"expert",count:10,categories:["capitals","borders","currency"],interaction:"choice"});
  const targets=shuffled(pool,seededRandom(seed));
  return Array.from({length:10},(_,i)=>i%2===0?generateDensityQuestion(pool,seed,i,"grandmaster"):makeChoiceQuestion(targets[i%targets.length],targets[i%targets.length].neighbors.length?"borders":"capitals",entitiesForScope(data.countries,"un195"),"expert","un195",seed,i));
}
export function recordMastery(progress:MasteryProgress,region:FillScope,seed:string,stage:number,answers:{question:AtlasQuestion;correct:boolean}[],regionSize:number):MasteryProgress {
  const old=progress[region]??emptyMastery();if(old.runs.includes(seed)||stage!==Math.min(old.stage,2)||answers.length!==10)return progress;
  const score=answers.filter(a=>a.correct).length,concepts=old.concepts.map(a=>[...a]),successes=[...old.successes];
  for(const a of answers)if(a.correct){const key=`${a.question.entityId}:${a.question.property??a.question.category}`;if(!concepts[stage].includes(key))concepts[stage].push(key);}
  successes[stage]+=Number(score>=8);
  const promoted=successes[stage]>=2&&concepts[stage].length>=Math.min(12,regionSize);
  const solved=new Set(answers.filter(a=>a.correct).map(a=>a.question.entityId));
  const review=[...new Set([...old.review.filter(id=>!solved.has(id)),...answers.filter(a=>!a.correct).map(a=>a.question.entityId)])].slice(-30);
  return {...progress,[region]:{stage:promoted?Math.min(3,old.stage+1):old.stage,successes,concepts,runs:[...old.runs,seed].slice(-100),review}};
}
