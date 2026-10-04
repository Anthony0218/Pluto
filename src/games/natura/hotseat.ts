import type { Player, RunPerformance } from './naturaData.ts';
import type { NaturaConfig } from './protocol.ts';
import type { RunOptions } from './world.ts';
export type HotseatTurn={player:Player;role:RunOptions['role'];seed:number;label:string};
export type HotseatRecord={turn:HotseatTurn;performance:RunPerformance};
export function hotseatTurns(config:NaturaConfig):HotseatTurn[] {
  const roles:RunOptions['role'][]=config.scenario==='meadow'?['falcon','mouse']:config.scenario==='spermwhale'&&config.variant==='pursuit'?['whale','squid']:[undefined];
  const first=(config.seed%2) as Player;
  return roles.flatMap((role,index)=>([first,first===0?1:0] as Player[]).map(player=>({player,role,seed:(config.seed+index*7919)>>>0,label:role==='falcon'?'Kestrel':role==='mouse'?'Vole':role==='whale'?'Whale':role==='squid'?'Squid':'Challenge'})));
}
export function compareRuns(a:RunPerformance,b:RunPerformance):Player|null {
  const valuesA=[Number(a.completed),a.progress,a.health,-Math.round(a.elapsed*10)],valuesB=[Number(b.completed),b.progress,b.health,-Math.round(b.elapsed*10)];
  for(let i=0;i<valuesA.length;i++){const difference=valuesA[i]-valuesB[i];if(Math.abs(difference)>1e-6)return difference>0?0:1;}
  return null;
}
export function hotseatStandings(records:HotseatRecord[]) {
  const points:[number,number]=[0,0];
  for(let i=0;i<records.length;i+=2){const pair=records.slice(i,i+2);if(pair.length!==2)continue;const winner=compareRuns(pair[0].performance,pair[1].performance);if(winner!==null)points[pair[winner].turn.player]++;}
  return {points,winner:points[0]===points[1]?null:points[0]>points[1]?0 as Player:1 as Player};
}
