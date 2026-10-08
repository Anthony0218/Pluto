import fs from 'node:fs';
import assert from 'node:assert/strict';
import { AI_DIFFICULTY_OPTIONS, DEFAULT_GAME_RULES, POINTS, applyAction, chooseAiAction, createGame, shuffledDeck, viewFor } from '../src/games/schafkopf/schafkopf.ts';
import { seededRandom } from '../src/games/schafkopf/botConfig.ts';
const args=process.argv.slice(2);
const argument=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1]};
const games=Number(argument('--games','10000'));
const seed=Number(argument('--seed','20261003'));
const profile=argument('--profile','standard');
const rulesProfile=argument('--rules','default');
assert.ok(Number.isInteger(games) && games>0 && games<=100000);
assert.ok(['standard','quick'].includes(profile));
assert.ok(['default','mixed'].includes(rulesProfile));
const random=seededRandom(seed);
const levels=AI_DIFFICULTY_OPTIONS.map(option=>option.id);
const stats=Object.fromEntries(levels.map(level=>[level,{games:0,wins:0,eyes:0,declarations:0,declarerWins:0,delta:0}]));
let completed=0,redeals=0,moves=0,simulations=0,earlyTouts=0;
const start=Date.now();
while(completed<games) {
  const seatLevels=[...levels];
  for(let i=seatLevels.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[seatLevels[i],seatLevels[j]]=[seatLevels[j],seatLevels[i]];}
  seatLevels.pop();
  const variations=[{}, {legen:true,ramsch:true}, {legen:true,eichelOberMuss:true,klopferMussSpiel:false}, {ramsch:true}, {laufendeAktiv:false}, {toutAbbrechen:false}, {legen:true,ramsch:true,klopferMussSpiel:false}, {eichelOberMuss:true}];
  const rules={...DEFAULT_GAME_RULES,...(rulesProfile==='mixed'?{geier:true,farbgeier:true,bettel:true,...variations[completed%variations.length]}:{}),...(profile==='quick'?{bot:{legendIterations:1,legendTimeMs:1,announcementSamples:4}}:{})};
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
  const earlyTout=!!game.contract.tout && game.rules.toutAbbrechen!==false && !game.result.declarerWon && game.tricks.length<8;
  assert.ok(game.tricks.length===8 || earlyTout);
  earlyTouts+=Number(earlyTout);
  const remaining=game.hands.flat();
  assert.equal(game.points.reduce((a,b)=>a+b,0)+remaining.reduce((sum,card)=>sum+POINTS[card.rank],0),120);
  assert.ok(Math.abs(game.result.deltas.reduce((a,b)=>a+b,0))<1e-8);
  const played=game.tricks.flatMap(trick=>trick.plays).map(play=>play.card);
  assert.equal(played.length+remaining.length,32);
  assert.equal(new Set([...played,...remaining].map(card=>card.id)).size,32);
  for(let seat=0;seat<4;seat++){
    const stat=stats[seatLevels[seat]];
    stat.games++; stat.eyes+=game.points[seat]; stat.delta+=game.result.deltas[seat];
    stat.wins+=Number(game.result.team.includes(seat)===game.result.declarerWon);
    if(seat===game.declarer){stat.declarations++;stat.declarerWins+=Number(game.result.declarerWon);}
  }
  completed++;
  if(completed%1000===0) console.log(`${completed}/${games} games; ${moves} moves; ${Math.round((Date.now()-start)/1000)} s`);
}
const report={seed,profile,rulesProfile,games:completed,redeals,earlyTouts,moves,simulations,illegalMoves:0,ruleCandidateViolations:0,elapsedSeconds:(Date.now()-start)/1000,levels:Object.fromEntries(Object.entries(stats).map(([level,s])=>[level,{...s,winRate:s.wins/s.games,averageEyes:s.eyes/s.games,announcementRate:s.declarations/s.games,declarerWinRate:s.declarations?s.declarerWins/s.declarations:null,averageDelta:s.delta/s.games}]))};
const output=argument('--output',`/tmp/schafkopf-simulation-${profile}.json`);
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
