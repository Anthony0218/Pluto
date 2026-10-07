import { generateQuestions, validateAnswer } from "./engine.ts";
import { generateAdvancedQuestions, generateDensityQuestion, type ChallengeTier } from "./advancedQuestions.ts";
import { entitiesInFillScope, type FillScope } from "./scopes.ts";
import { seededRandom, shuffled } from "./random.ts";
import { toPublicQuestion } from "./publicQuestion.ts";
import { buildTrialCountries, getCountryStat, STATS } from "./trials/countryStats.ts";
import { generateRankingRound, scoreRanking } from "./trials/statRanking.ts";
import { generateDetectiveRound } from "./trials/statDetective.ts";
import { generateGuesserRound, guesserPoints } from "./trials/countryGuesser.ts";
import { generateRegionRound, regionById } from "./trials/regionBuilder.ts";
import { categoryById, generateExtremeRound } from "./trials/extremeGeography.ts";
import { languageRound } from "./trials/languageGuesser.ts";
import { historyDeck, historyExplanation } from "./trials/historyBattle.ts";
import type { AtlasCategory, AtlasDataset, AtlasDifficulty, AtlasQuestion, ChoiceQuestion } from "./types.ts";
import type { AtlasRaceMode } from "./multiplayer.ts";

type OrderedTask = { interaction:"ordering"; prompt:string; choices:{id:string;label:string}[]; answer:string[] };
type ClueTask = { interaction:"clues"; prompt:string; choices:{id:string;label:string}[]; answer:string; clues:string[] };
export type RaceQuestion = AtlasQuestion | OrderedTask | ClueTask;
export type RaceRun = { index:number; score:number; done:boolean; updatedAt:number; finishedAt?:number; revealed:number; wrong:string[]; feedback?:{correct:boolean; points:number; answer:string; explanation:string}; ledger:{index:number;correct:boolean;points:number;elapsedMs:number;concept:string}[]; startedAt:number };
export const createRaceRun = (now:number): RaceRun => ({ index:0,score:0,done:false,updatedAt:now,revealed:1,wrong:[],ledger:[],startedAt:now });
export const raceDuration = (mode:AtlasRaceMode) => mode === "speed_run" ? 90_000 : 180_000;
export const raceCount = (mode:AtlasRaceMode) => mode === "speed_run" ? 120 : mode === "region_builder" ? 6 : mode === "stat_ranking" ? 8 : 12;

/** Questions and answers remain server-owned. All participants use an identical calibrated deck. */
export function raceQuestions(data:AtlasDataset, mode:AtlasRaceMode, seed:string, difficulty:AtlasDifficulty, scope:FillScope="Europe", categories:AtlasCategory[]=["capitals","countries","languages","continents"], tier:ChallengeTier="standard"): RaceQuestion[] {
  const count=raceCount(mode), pool=buildTrialCountries(data.countries,data.extras,difficulty), full=buildTrialCountries(data.countries,data.extras,"expert"), byId=new Map(full.map(c=>[c.id,c]));
  const base=(index:number,prompt:string,answer:string,choices:{id:string;label:string}[]):ChoiceQuestion=>({id:`task:${index}`,seed,entityId:answer,entityType:"country",category:"clues",scope:"un195",difficulty,prompt,answer,interaction:"single_choice",choices,sourceMetadata:[]});
  if(mode==="map_fill") {
    const targets=shuffled(entitiesInFillScope(data.countries,scope),seededRandom(seed)).slice(0,count);
    return targets.map((c,i)=>({...base(i,`Find ${c.shortName}`,c.id,[]),interaction:"map_click",targetGeometryId:c.geometryId,targetCoordinates:c.centroid}));
  }
  if(mode==="speed_run") {
    if(tier!=="standard") return Array.from({length:count},(_,i)=>i%2 ? generateDensityQuestion(data.countries,seed,i,tier) : generateAdvancedQuestions(data.countries,`${seed}:${Math.floor(i/12)}`,6,tier)[Math.floor(i/2)%6]);
    return generateQuestions({entities:data.countries,datasetVersion:data.version.atlasDataVersion,seed,difficulty,categories,interaction:"choice",count});
  }
  // Master and Grandmaster rooms get the expert history deck: every country, dates only a few years apart.
  if(mode==="history_battle") return historyDeck(data.history,tier==="standard"?pool:full,seed,tier==="standard"?difficulty:"expert",count).map((r,i)=>({...base(i,r.prompt,r.answerId,r.options.map(({id,label})=>({id,label}))),entityId:r.countryId,property:r.kind,explanation:historyExplanation(r,id=>byId.get(id)?.name??id),sourceMetadata:[{source:data.history.source.name}]}));
  const used:string[]=[];
  return Array.from({length:count},(_,i):RaceQuestion=>{
    if(mode==="language_guesser") { const r=languageRound(seed,i,difficulty);return base(i,`Which language is this? “${r.sentence}”`,r.language,r.options.map(label=>({id:label,label}))); }
    if(mode==="stat_ranking") { const r=generateRankingRound(pool,seed,i,difficulty); return {interaction:"ordering",prompt:`Order from highest to lowest: ${STATS[r.statId].label}`,choices:r.countryIds.map(id=>({id,label:byId.get(id)!.name})),answer:r.correctOrder}; }
    if(mode==="region_builder") { const r=generateRegionRound(full,seed,i,used); used.push(r.regionId); const region=regionById(r.regionId);return {...base(i,`Select every member of ${region.name} shown here.`,r.regionId,[]),interaction:"multi_select",answer:r.targetIds,choices:r.optionIds.map(id=>({id,label:byId.get(id)!.name}))}; }
    if(mode==="country_guesser") { const r=generateGuesserRound(pool,seed,i,used); used.push(r.answerId);return {interaction:"clues",prompt:"Identify the country. Extra clues reduce the award.",choices:r.optionIds.map(id=>({id,label:byId.get(id)!.name})),answer:r.answerId,clues:r.clues.map(c=>c.text)}; }
    if(tier!=="standard" && i%2===0) return generateDensityQuestion(data.countries,seed,i,tier);
    if(mode==="stat_detective") { const r=generateDetectiveRound(pool,seed,i,difficulty,used);used.push(r.answerId);const answer=byId.get(r.answerId)!;const facts=r.statIds.map(id=>`${STATS[id].label}: ${STATS[id].format(getCountryStat(answer,id)!)}`).join(" · ");return base(i,`Which country fits? ${r.showRegion ? answer.continent+" · " : ""}${facts}`,r.answerId,r.optionIds.map(id=>({id,label:byId.get(id)!.name}))); }
    const r=generateExtremeRound(pool,seed,i,difficulty), cat=categoryById(r.categoryId); return base(i,cat.question,r.answerId,r.countryIds.map(id=>({id,label:byId.get(id)!.name})));
  });
}

export function raceView(run:RaceRun, questions:RaceQuestion[], generation:string) {
  const q=questions[run.index], id=`${generation}:${run.index}:${run.revealed}`;
  const question=run.done||!q ? null : q.interaction==="ordering" ? {id,interaction:q.interaction,prompt:q.prompt,choices:q.choices} : q.interaction==="clues" ? {id,interaction:q.interaction,prompt:q.prompt,choices:q.choices,clues:q.clues.slice(0,run.revealed)} : toPublicQuestion(q,id);
  return {index:run.index,count:questions.length,score:run.score,done:run.done,revealed:run.revealed,wrong:run.wrong,feedback:run.feedback??null,question};
}
export type RaceView=ReturnType<typeof raceView>;

export function applyRaceAction(run:RaceRun, questions:RaceQuestion[], generation:string, mode:AtlasRaceMode, action:unknown, questionId:unknown, answer:unknown, now:number):RaceRun {
  if(run.done) throw new Error("Your run is already finished.");
  const q=questions[run.index];
  if(!q || questionId!==`${generation}:${run.index}:${run.revealed}`) throw new Error("This question changed. Latest progress restored.");
  if(action==="next") {
    if(!run.feedback) throw new Error("Answer this question first.");
    const done=run.index+1>=questions.length;
    return {...run,index:run.index+1,done,updatedAt:now,...(done?{finishedAt:now}:{}),revealed:1,wrong:[],feedback:undefined,startedAt:now};
  }
  if(run.feedback) throw new Error("This answer is already saved.");
  if(action==="clue" && q.interaction==="clues") return {...run,revealed:Math.min(q.clues.length,run.revealed+1),updatedAt:now};
  if(action!=="answer") throw new Error("Unknown race action.");
  const multi=q.interaction==="multi_select"||q.interaction==="ordering";
  if(multi) {
    if(!Array.isArray(answer)||!answer.every(id=>typeof id==="string")||new Set(answer).size!==answer.length||answer.some(id=>!q.choices.some(c=>c.id===id))||(q.interaction==="ordering"&&answer.length!==q.choices.length)) throw new Error("Choose the round's own options once each.");
  } else if(typeof answer!=="string"||answer.length>100||(q.interaction==="single_choice"||q.interaction==="clues")&&!q.choices.some(c=>c.id===answer)) throw new Error("Invalid answer.");
  if(run.wrong.includes(String(answer))) throw new Error("That guess is already recorded.");
  const correct=q.interaction==="ordering" ? (answer as string[]).join("|")===q.answer.join("|") : q.interaction==="clues" ? answer===q.answer : validateAnswer(q,answer as string|string[]);
  const points=q.interaction==="ordering" ? scoreRanking(answer as string[],q.answer).total : correct ? q.interaction==="clues" ? guesserPoints(run.revealed) : mode==="speed_run" ? 150 : 1000 : mode==="speed_run" ? -150 : mode==="map_fill" ? -25 : 0;
  const answerText=Array.isArray(q.answer) ? q.answer.map(id=>"choices"in q?q.choices.find(c=>c.id===id)?.label??id:id).join(" → ") : "choices"in q ? q.choices.find(c=>c.id===q.answer)?.label??String(q.answer) : String(q.answer);
  const retry=(mode==="map_fill"&&!correct)||(q.interaction==="clues"&&!correct&&run.wrong.length<2);
  return {...run,score:run.score+points,updatedAt:now,wrong:correct?run.wrong:[...run.wrong,String(answer)],feedback:retry?undefined:{correct,points,answer:answerText,explanation:q.interaction==="ordering"?"Partial credit for nearby positions; a perfect order earns a bonus.":"explanation"in q&&q.explanation?q.explanation:correct?"Correct":"Review this answer before continuing."},ledger:[...run.ledger,{index:run.index,correct,points,elapsedMs:Math.max(0,now-run.startedAt),concept:`${mode}:${"category"in q?q.category:q.interaction}:${"property"in q?q.property??"":""}`} ]};
}
