import { generateQuestions } from "./engine.ts";
import { generateComparisonQuestions } from "./comparisons.ts";
import { generateFlagQuestions } from "./flags.ts";
import { generateGuessCountryQuestions } from "./guessCountry.ts";
import { raceQuestions } from "./serverRace.ts";
import { isRaceMode, type AtlasMultiplayerMode } from "./multiplayer.ts";
import type { AtlasDataset, AtlasQuestion } from "./types.ts";
import type { SoloSettings } from "./soloSettings.ts";

/** Match category, interaction, subject type, numeric gap and country-size distributions across different decks.
 * This is a transparent content blueprint, not a claim of empirical player difficulty calibration. */
export function calibratedHotseatSeeds(data:AtlasDataset,mode:AtlasMultiplayerMode,settings:SoloSettings,seed:string,players:number):string[] {
  const byId=new Map(data.countries.map(c=>[c.id,c]));
  const deck=(candidate:string)=>{
    const common={entities:data.countries,extras:data.extras,datasetVersion:data.version.atlasDataVersion,seed:candidate,difficulty:settings.difficulty,count:mode==="guess_country"?8:mode==="flag_battle"?12:10};
    if(mode==="map_fill")return [];
    if(mode==="flag_battle")return generateFlagQuestions(common);
    if(mode==="higher_lower")return generateComparisonQuestions({...common,stats:settings.stats,chain:true});
    if(mode==="guess_country")return generateGuessCountryQuestions(common);
    if(isRaceMode(mode))return raceQuestions(data,mode,candidate,settings.difficulty,settings.scope,settings.categories);
    return generateQuestions({...common,categories:settings.categories,interaction:"map_click"});
  };
  const profile=(candidate:string)=>{const values:Record<string,number>={};const add=(key:string)=>values[key]=(values[key]??0)+1;const questions=deck(candidate);for(const question of questions){add(`interaction:${question.interaction}`);if("category"in question)add(`category:${question.category}`);if("entityId"in question){const q=question as AtlasQuestion,c=byId.get(q.entityId);if(c){add(`region:${c.subregion}`);add(`size:${Math.floor(Math.log10(Math.max(1,c.population?.value??1)))}`);}if(q.interaction==="higher_lower"){add(`kind:${q.first?.kind}`);add(`gap:${Math.min(4,Math.floor(Math.abs(q.stat.firstValue-q.stat.secondValue)/Math.max(1,Math.abs(q.stat.firstValue),Math.abs(q.stat.secondValue))*5))}`);add(`stat:${q.stat.key}`);}}}for(const key of Object.keys(values))values[key]/=Math.max(1,questions.length);return values;};
  const seeds=[`${seed}:p0:0`],blueprint=profile(seeds[0]);
  for(let player=1;player<players;player++) {let selected=`${seed}:p${player}:0`,best=Infinity;for(let trial=0;trial<24;trial++){const candidate=`${seed}:p${player}:${trial}`,p=profile(candidate),keys=new Set([...Object.keys(blueprint),...Object.keys(p)]);const distance=[...keys].reduce((sum,key)=>sum+Math.abs((blueprint[key]??0)-(p[key]??0)),0);if(distance<best){best=distance;selected=candidate;}if(best===0)break;}seeds.push(selected);}
  return seeds;
}
