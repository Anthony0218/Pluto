import fs from 'node:fs';
import assert from 'node:assert/strict';
import { AI_DIFFICULTY_OPTIONS, DEFAULT_GAME_RULES, applyAction, chooseAiAction, createGame, shuffledDeck, viewFor } from '../src/games/schafkopf/schafkopf.ts';
import { seededRandom } from '../src/games/schafkopf/botConfig.ts';
const args=process.argv.slice(2);
const argument=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1]};
const games=Number(argument('--games','10000'));
const seed=Number(argument('--seed','20261003'));
const profile=argument('--profile','standard');
assert.ok(Number.isInteger(games) && games>0 && games<=100000);
assert.ok(['standard','quick'].includes(profile));
const random=seededRandom(seed);
const levels=AI_DIFFICULTY_OPTIONS.map(option=>option.id);
const stats=Object.fromEntries(levels.map(level=>[level,{games:0,wins:0,eyes:0,declarations:0,declarerWins:0,delta:0}]));
let completed=0,redeals=0,moves=0,simulations=0;
const start=Date.now();
while(completed<games) {
  const seatLevels=[...levels];
  for(let i=seatLevels.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[seatLevels[i],seatLevels[j]]=[seatLevels[j],seatLevels[i]];}
  seatLevels.pop();
  const rules={...DEFAULT_GAME_RULES,...(profile==='quick'?{bot:{legendIterations:1,legendTimeMs:1,announcementSamples:4}}:{})};
  let game=createGame(undefined,(completed+redeals)%4,shuffledDeck(random),undefined,1,rules);
  let actions=0;
  while(!['finished','redeal'].includes(game.phase) && actions++<160) {
    const view=viewFor(game,game.turn), action=chooseAiAction(view,seatLevels[game.turn],random);
    if(action.type==='play') {
      assert.ok(view.legalCards.includes(action.cardId),`illegal engine move in game ${completed}`);
      assert.ok(action.debugInfo.candidates.includes(action.cardId),`R-rule violation in game ${completed}`);
      simulations+=action.debugInfo.simulations??0;
      moves++;
    }
    game=applyAction(game,game.turn,action,random);
  }
  assert.ok(actions<160,'auction or play must terminate');
  if(game.phase==='redeal'){redeals++;continue;}
  assert.equal(game.tricks.length,8);
  assert.equal(game.points.reduce((a,b)=>a+b,0),120);
  assert.equal(game.result.deltas.reduce((a,b)=>a+b,0),0);
  assert.equal(new Set(game.tricks.flatMap(trick=>trick.plays).map(play=>play.card.id)).size,32);
  for(let seat=0;seat<4;seat++){
    const stat=stats[seatLevels[seat]];
    stat.games++; stat.eyes+=game.points[seat]; stat.delta+=game.result.deltas[seat];
    stat.wins+=Number(game.result.team.includes(seat)===game.result.declarerWon);
    if(seat===game.declarer){stat.declarations++;stat.declarerWins+=Number(game.result.declarerWon);}
  }
  completed++;
  if(completed%1000===0) console.log(`${completed}/${games} games; ${moves} moves; ${Math.round((Date.now()-start)/1000)} s`);
}
const report={seed,profile,games:completed,redeals,moves,simulations,illegalMoves:0,ruleCandidateViolations:0,elapsedSeconds:(Date.now()-start)/1000,levels:Object.fromEntries(Object.entries(stats).map(([level,s])=>[level,{...s,winRate:s.wins/s.games,averageEyes:s.eyes/s.games,announcementRate:s.declarations/s.games,declarerWinRate:s.declarations?s.declarerWins/s.declarations:null,averageDelta:s.delta/s.games}]))};
const output=argument('--output',`/tmp/schafkopf-simulation-${profile}.json`);
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
