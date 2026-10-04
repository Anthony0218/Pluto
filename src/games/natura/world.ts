import type { BotDifficulty, GameResult, PlayMode, ScenarioId, Player, RunPerformance } from './naturaData.ts';
import { initialGame, update as updateMeadow } from './naturafunctions.ts';
import { createArcherGame, updateArcherGame, type ArcherGame, type ArcherInput } from './archerfish.ts';
import { createWildGame, updateWildGame, type WildGame } from './wildModes.ts';
import { createToolGame, updateToolGame, type ToolGame } from './toolAnimals.ts';
import { createExpedition, updateExpedition, type Expedition, type ExpeditionInput } from './expeditions.ts';
import { createLaneOcean, updateLaneOcean, type LaneOcean } from './laneOcean.ts';
import type { Game } from './naturaData.ts';
import { intentKeys, type PlayerIntent } from './input.ts';
import { createAbyssDuel, updateAbyssDuel, type AbyssDuel } from './abyssDuel.ts';
export type RunOptions = { seed?: number; variant?: 'race'|'pursuit'; role?: 'falcon'|'mouse'|'whale'|'squid' };
export type NaturaWorld = { kind: 'meadow'; game: Game } | { kind: 'archerfish'; game: ArcherGame } | WildGame | ToolGame | Expedition | LaneOcean | AbyssDuel;
export function makeWorld(scenario: ScenarioId, mode: PlayMode, round: number, level: number, botDifficulty: BotDifficulty, options:RunOptions={}): NaturaWorld {
  const seed=options.seed??round*7919;
  if (scenario === 'meadow') return {kind: scenario, game: initialGame(mode === 'ai' ? 'solo' : 'duo', options.role==='mouse'?'mouse':options.role==='falcon'?'falcon':round % 2 ? 'falcon' : 'mouse',seed)};
  if (scenario === 'archerfish') return {kind: scenario, game: createArcherGame()};
  if (scenario === 'flyingfish') return createLaneOcean(seed);
  if (scenario === 'spermwhale'&&options.variant==='pursuit')return createAbyssDuel(options.role==='squid'?1:0);
  if (scenario === 'trapjaw' || scenario === 'cuttlefish') {
    const game = createWildGame(scenario, level, seed);
    if (mode === 'ai') game.aiReadyAt = botDifficulty === 'easy' ? 4 : botDifficulty === 'hard' ? 0.6 : 2.2;
    return game;
  }
  if (scenario === 'bolas' || scenario === 'coconut') return createToolGame(scenario);
  return createExpedition(scenario, level);
}
export const phase = (w: NaturaWorld) => 'game' in w ? w.game.phase : w.phase;
export const ended = (w: NaturaWorld) => ['end','finished'].includes(phase(w));
export function startWorld(w: NaturaWorld) {
  if (w.kind === 'meadow') w.game.phase = 'hunt';
  else if (w.kind === 'archerfish') w.game.phase = 'playing';
  else w.phase = 'playing';
}
export function stepWorld(w: NaturaWorld, inputs: [PlayerIntent, PlayerIntent], dt: number, ai: boolean, difficulty: BotDifficulty) {
  const keys=intentKeys(inputs);
  if(w.kind==='meadow')updateMeadow(w.game,keys,dt,difficulty);
  else if(w.kind==='abyssduel')updateAbyssDuel(w,inputs,dt,ai,difficulty);
  else if(w.kind==='archerfish') {
    const a=inputs.map((v):ArcherInput=>({move:v.x,aim:v.y,shoot:v.action,dash:v.secondary,target:v.target})) as [ArcherInput,ArcherInput];updateArcherGame(w.game,a,dt,ai,difficulty);
  } else if(w.kind==='trapjaw'||w.kind==='cuttlefish')updateWildGame(w,[inputs[0],inputs[1]],dt,ai,difficulty);
  else if(w.kind==='bolas'||w.kind==='coconut')updateToolGame(w,[inputs[0],inputs[1]],dt,ai,difficulty);
  else if(w.kind==='flyingfish')updateLaneOcean(w,[inputs[0].x,inputs[1].x],dt,ai);
  else if(w.kind==='jumpingspider'||w.kind==='spermwhale') {
    const a=inputs.map((v):ExpeditionInput=>({x:v.x,z:v.y,vertical:v.vertical,action:v.action,special:v.secondary})) as [ExpeditionInput,ExpeditionInput];updateExpedition(w,a,dt,ai,difficulty);
  }
}
export function measureRun(w:NaturaWorld,seat:Player=0):RunPerformance {
  if(w.kind==='meadow') {
    const g=w.game,role=g.mode==='solo'?g.role:seat===0?'falcon':'mouse';
    return {completed:g.winner===role,progress:role==='falcon'?g.catches*10+g.bossHits:g.t,health:role==='falcon'?3-g.bossHits:g.lives,elapsed:g.t,label:role==='falcon'?`${g.catches} catches`:`${g.t.toFixed(1)}s survived`};
  }
  if(w.kind==='archerfish') {const p=w.game.fish[seat];return {completed:w.game.winner===seat,progress:p.catches,health:0,elapsed:w.game.elapsed,label:`${p.catches} catches`};}
  if(w.kind==='abyssduel') {const p=w.players[seat];return {completed:w.winner===seat,progress:seat===0?w.bites:w.elapsed,health:p.lives,elapsed:w.elapsed,label:seat===0?`${w.bites} bites`:`${w.elapsed.toFixed(1)}s survived`};}
  const p=w.players[seat];
  const progress=w.kind==='trapjaw'?w.players[seat].checkpoint:w.kind==='jumpingspider'?w.players[seat].progress:w.kind==='flyingfish'?w.players[seat].score:w.players[seat].food;
  return {completed:w.winner===seat,progress,health:w.kind==='jumpingspider'?-w.players[seat].falls:'lives' in p?p.lives:0,elapsed:w.elapsed,label:w.kind==='trapjaw'||w.kind==='jumpingspider'?`Platform ${progress+1}${w.kind==='jumpingspider'?` · ${w.players[seat].falls} falls`:''}`:w.kind==='flyingfish'?`${progress} clean dodges`:`${progress} food`};
}
export function result(w:NaturaWorld, round:number):GameResult {
  if(w.kind==='meadow')return {winner:w.game.winner===(w.game.mode==='solo'?w.game.role:round%2?'falcon':'mouse')?0:1,detail:w.game.reason,performance:measureRun(w)};
  const g=w.kind==='archerfish'?w.game:w;
  return {winner:w.kind==='abyssduel'&&w.controlled===1?(w.winner===null?null:w.winner===1?0:1):g.winner,detail:w.kind==='flyingfish'?`Clean dodges: ${w.players[0].score} – ${w.players[1].score}.`:g.notice,performance:measureRun(w,w.kind==='abyssduel'?w.controlled:0),opponent:w.kind==='flyingfish'||w.kind==='spermwhale'?'ocean':'rival'};
}
