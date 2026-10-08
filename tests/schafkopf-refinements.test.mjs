import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_RULES, applyAction, canDouble, contractLevel, contractsFor, createDeck, createGame, forcedCallsFor, gameDefinition, migrateGameState, scoreRound, shouldAiKnock, shuffledDeck, viewFor } from '../src/games/schafkopf/schafkopf.ts';
import { evaluateHand, ruleCandidates, shouldSpritz } from '../src/games/schafkopf/bot.ts';
import { botConfig, seededRandom } from '../src/games/schafkopf/botConfig.ts';
import { gameKnowledge, knowledgeForLevel } from '../src/games/schafkopf/knowledge.ts';
const card=id=>createDeck().find(card=>card.id===id);
const cards=ids=>ids.map(card);
const fresh=rules=>createGame(undefined,3,shuffledDeck(seededRandom(6)),undefined,1,{...DEFAULT_GAME_RULES,...rules});
function view(ids,plays=[],extra={}) {
  const game=fresh();
  Object.assign(game,{phase:'play',contract:{kind:'rufspiel',suit:'Eichel'},declarer:0,partner:3,turn:0,...extra,trick:plays.map(([seat,id])=>({seat,card:card(id)}))});
  game.hands[game.turn]=cards(ids);
  return viewFor(game,game.turn);
}
const passing=game=>{for(let i=0;i<4;i++) game=applyAction(game,game.turn,{type:'intent',play:false});return game;};

test('legacy saved bid ranks migrate without losing scores, cards or auction ownership',()=>{
  const game=fresh();delete game.rulesVersion;game.phase='auction';game.bidLevel=4;game.turn=1;game.intents=[0,1];game.incumbent=0;game.totals=[10,20,-10,-20];
  const migrated=migrateGameState(game);
  assert.equal(migrated.bidLevel,7);assert.equal(migrated.turn,1);assert.deepEqual(migrated.totals,game.totals);assert.deepEqual(migrated.hands,game.hands);
  assert.equal(game.bidLevel,4);assert.equal(migrateGameState(migrated),migrated);
  game.phase='intent';assert.equal(migrateGameState(game).bidLevel,0);
});

test('forced Eichel-Ober calls prioritize missing aces of held suits, then missing lower ranks',()=>{
  const held=cards(['Eichel-Ober','Eichel-Ass','Eichel-7','Gras-7','Schellen-Ass','Schellen-10','Herz-Unter','Herz-8']);
  assert.deepEqual(forcedCallsFor(held),[{kind:'rufspiel',suit:'Gras',calledRank:'Ass'}]);
  const allAces=cards(['Eichel-Ober','Eichel-Ass','Eichel-10','Gras-Ass','Gras-10','Schellen-Ass','Schellen-10','Herz-8']);
  assert.ok(forcedCallsFor(allAces).every(c=>c.calledRank==='König'));
  const onlyTrumps=gameDefinition({kind:'rufspiel'}).trumps.slice(0,8);
  assert.ok(forcedCallsFor(onlyTrumps).every(c=>c.kind==='solo'));
});

test('the chronological last knocker has ordinary contracts, including a mandatory individual game with all plain aces',()=>{
  let game=fresh({legen:true}); game.legenDeadline=null;
  for(const [seat,knock] of [[2,true],[1,false],[0,true],[3,false]]) game=applyAction(game,seat,{type:'legen',knock});
  game.hands[0]=cards(['Eichel-Ass','Gras-Ass','Schellen-Ass','Eichel-Ober','Herz-Unter','Herz-7','Herz-8','Herz-9']);
  game=passing(game);
  assert.equal(game.declarer,0); assert.equal(game.forcedCallerReason,'legen'); assert.equal(game.multiplier,4);
  assert.ok(viewFor(game,0).contracts.every(c=>c.kind!=='rufspiel'));
  assert.ok(viewFor(game,0).contracts.some(c=>c.kind==='wenz'));
});

test('disabling the knocker obligation keeps every knock multiplier in Ramsch or the Eichel-Ober fallback',()=>{
  for(const eo of [false,true]) {
    let game=fresh({legen:true,klopferMussSpiel:false,ramsch:true,eichelOberMuss:eo}); game.legenDeadline=null;
    for(let seat=0;seat<4;seat++) game=applyAction(game,seat,{type:'legen',knock:seat<2});
    game=passing(game);
    assert.equal(game.multiplier,4);
    if(eo) {assert.equal(game.forcedCallerReason,'eichel-ober');assert.equal(game.phase,'declare');}
    else {assert.equal(game.contract.kind,'ramsch');assert.equal(game.phase,'play');}
  }
});

test('plain bidding ranks increase in the specified order and all Tout ranks are higher',()=>{
  const kinds=['rufspiel','bettel','farbwenz','wenz','farbgeier','geier','solo'];
  assert.deepEqual(kinds.map(kind=>contractLevel({kind})),[2,3,4,5,6,7,8]);
  assert.deepEqual(kinds.map(kind=>contractLevel({kind,tout:true})),[10,11,12,13,14,15,16]);
  assert.ok(contractsFor(cards(['Eichel-7'])).some(c=>c.kind==='rufspiel'&&c.tout));
  assert.equal(contractLevel({kind:'sie'}),17);
});

test('Ramsch divides the total winner payments among all tied highest scores, including Jungfrau',()=>{
  const game=fresh();game.contract={kind:'ramsch'};game.multiplier=4;
  game.points=[40,40,30,10];game.tricks=[0,1,2,3].map(winner=>({winner,points:0,plays:[]}));
  let result=scoreRound(game);assert.deepEqual(result.ramschLosers,[0,1]);assert.deepEqual(result.deltas,[-40,-40,40,40]);
  game.points=[45,45,30,0];game.tricks=game.tricks.slice(0,3);
  result=scoreRound(game);assert.deepEqual(result.ramschDoubleWinners,[3]);assert.deepEqual(result.deltas,[-60,-60,40,80]);
  game.points=[40,40,40,0];game.tricks=game.tricks.slice(0,3);
  result=scoreRound(game);assert.equal(result.deltas[3],80);assert.ok(Math.abs(result.deltas.reduce((a,b)=>a+b,0))<1e-10);
  game.points=[30,30,30,30];assert.deepEqual(scoreRound(game).deltas,[0,0,0,0]);
});

test('all 14 or 11 missing leading trumps count as Laufende; disabling runs also affects Tout',()=>{
  for(const [kind,max] of [['solo',14],['farbwenz',11],['farbgeier',11]]) {
    const game=fresh();game.contract={kind,suit:'Herz',tout:true};game.declarer=0;game.partner=null;
    const trumps=new Set(gameDefinition(game.contract).trumps.map(c=>c.id));
    game.initialHands[0]=createDeck().filter(c=>!trumps.has(c.id)).slice(0,8);
    game.points=[0,120,0,0];game.tricks=Array.from({length:8},()=>({winner:1,plays:[],points:15}));
    let result=scoreRound(game);assert.equal(result.laufende,max);assert.equal(result.value,(30+max*10)*2);
    game.rules.laufendeAktiv=false;result=scoreRound(game);assert.equal(result.laufende,0);assert.equal(result.value,60);
  }
});

test('Schwarz and Schneider are additive; Tout and Sie use fixed factors and no such bonuses',()=>{
  const game=fresh({laufendeAktiv:false});game.contract={kind:'solo',suit:'Herz'};game.declarer=0;game.partner=null;
  game.points=[120,0,0,0];game.tricks=Array.from({length:8},()=>({winner:0,plays:[],points:15}));
  assert.equal(scoreRound(game).value,50);
  game.contract.tout=true;assert.equal(scoreRound(game).value,60);
  game.contract={kind:'sie'};assert.equal(scoreRound(game).value,120);
});

test('two arbitrary rank trumps are sufficient with three aces or two aces and two void suits',()=>{
  for(const [kind,rank] of [['wenz','Unter'],['geier','Ober']]) {
    const low=[`Herz-${rank}`,`Schellen-${rank}`];
    const three=[...low,'Eichel-Ass','Gras-Ass','Schellen-Ass','Eichel-7','Gras-7','Schellen-7'];
    const two=[...low,'Eichel-Ass','Gras-Ass','Eichel-7','Eichel-8','Gras-7','Gras-8'];
    for(const hand of [three,two]) assert.equal(evaluateHand(cards(hand),{kind},1).eligible,true);
    const held= evaluateHand(cards(two),{kind},1);assert.equal(held.voids,2);assert.equal(held.suitsWithoutAce,0);
    const tooMany=[...gameDefinition({kind}).trumps.map(c=>c.id),'Eichel-Ass','Eichel-10','Eichel-7','Eichel-8'];
    assert.equal(evaluateHand(cards(tooMany),{kind},2).eligible,false);
  }
});

test('first-packet knock strength protects top trumps, while the separate second criteria require three courts',()=>{
  assert.equal(shouldAiKnock(cards(['Herz-Unter','Schellen-Unter','Herz-7','Eichel-7'])),true);
  assert.equal(shouldAiKnock(cards(['Herz-Unter','Schellen-Unter','Eichel-7','Eichel-8'])),true);
  assert.equal(shouldAiKnock(cards(['Schellen-Ober','Herz-7','Herz-8','Eichel-7'])),false);
  assert.equal(shouldAiKnock(cards(['Herz-Ober','Herz-7','Herz-8','Eichel-7'])),true);
  assert.equal(shouldAiKnock(cards(['Gras-Unter','Herz-7','Herz-8','Herz-9'])),true);
  assert.equal(shouldAiKnock(cards(['Herz-Unter','Herz-7','Herz-8','Herz-9'])),false);
  assert.equal(shouldAiKnock(cards(['Eichel-Ober','Gras-Unter','Herz-Unter','Schellen-7']),1),true);
  assert.equal(shouldAiKnock(cards(['Eichel-Ober','Gras-Unter','Herz-7','Herz-8']),1),false);
});

test('local Legen defaults to 20 seconds and uses the configured duration',()=>{
  for(const [duration,expected] of [[undefined,20],[42,42]]) {
    const game=createGame(undefined,3,shuffledDeck(seededRandom(6)),undefined,1,{...DEFAULT_GAME_RULES,legen:true,hotseatKlopfSekunden:duration},[],1000);
    assert.equal(game.legenDeadline,1000+expected*1000);
  }
});

test('Wenz/Geier bots spritz only after their side wins the first trick with more than 30 eyes and enough top trumps',()=>{
  for(const [kind,rank] of [['wenz','Unter'],['geier','Ober']]) {
    const first={winner:2,points:31,plays:[]};
    const ids=[`Eichel-${rank}`,'Eichel-7'];
    const v=view(ids,[],{turn:1,declarer:0,partner:null,contract:{kind},tricks:[first]});
    assert.equal(v.canDouble,true);
    assert.equal(shouldSpritz(v,'pro',()=>.5),true);
    assert.equal(shouldSpritz({...v,tricks:[{...first,points:30}]},'pro',()=>.5),false);
    assert.equal(shouldSpritz({...v,tricks:[{...first,winner:0}]},'pro',()=>.5),false);
    assert.equal(shouldSpritz({...v,tricks:[]},'pro',()=>.5),false);
    assert.equal(shouldSpritz({...v,hand:cards([`Gras-${rank}`,`Schellen-${rank}`])},'pro',()=>.5),true);
    assert.equal(shouldSpritz({...v,hand:cards([`Herz-${rank}`,`Schellen-${rank}`])},'pro',()=>.5),false);
    const game=fresh();Object.assign(game,{phase:'play',turn:1,declarer:0,partner:null,contract:{kind},tricks:[first,first]});
    assert.equal(canDouble(game,1),false);
  }
});

test('T9 search probabilities are 100/75/50/25/0 percent and old saved rates cannot override them',()=>{
  const noTrump={plays:[[3,'Herz-8'],[0,'Gras-7'],[1,'Gras-8'],[2,'Herz-9']].map(([seat,id])=>({seat,card:card(id)})),winner:2,points:0};
  const v=view(['Eichel-10','Gras-10'],[],{declarer:2,partner:3,turn:0,tricks:[noTrump],spritzEvents:[{seat:3,count:2,trick:0,position:1}]});
  for(const [level,searches] of [['beginner',4],['amateur',3],['advanced',2],['pro',1],['legend',0]]) {
    const decisions=[.125,.375,.625,.875].map(value=>ruleCandidates(v,level,()=>value));
    assert.equal(decisions.filter(d=>d.rules.includes('R3')).length,searches,level);
    assert.equal(botConfig({reliability:{[level]:{T9:.123}}}).reliability[level].T9,1-searches/4);
  }
});

test('Advanced point knowledge sums only its own points until teams are known',()=>{
  const hidden=view(['Eichel-7','Herz-Ober'],[],{points:[12,23,34,51]});
  const unknown=gameKnowledge(hidden);assert.equal(unknown.teamsKnown,false);assert.equal(unknown.teamPoints,12);
  const known={...hidden,partner:3,partnerRevealed:true};assert.equal(gameKnowledge(known).teamPoints,63);
  assert.equal(knowledgeForLevel(known,false).teamPoints,0);
});

test('R6 deduced adjacency retains the publicly played partner card as its ordering pivot',()=>{
  const earlier={plays:[[0,'Herz-Ober'],[1,'Schellen-Ober'],[2,'Herz-Unter'],[3,'Gras-Unter']].map(([seat,id])=>({seat,card:card(id)})),winner:0,points:10};
  const v=view(['Eichel-Ober','Eichel-Unter'],[[3,'Gras-Ober']],{partnerRevealed:true,tricks:[earlier]});
  const recognized=ruleCandidates(v,'advanced',()=>.1);
  assert.ok(recognized.rules.includes('R6'));assert.deepEqual(recognized.cards.map(c=>c.id),['Eichel-Ober']);
  assert.ok(!ruleCandidates(v,'advanced',()=>.9).rules.includes('R6'));
  assert.ok(!ruleCandidates(v,'amateur',()=>.1).rules.includes('R6'));
});

test('Advanced takes a low-eye trick when it wins, frees Schneider in the last two tricks or avoids Schwarz',()=>{
  const base=view(['Eichel-Ober','Schellen-7'],[[1,'Gras-7'],[2,'Gras-8'],[3,'Gras-9']],{partnerRevealed:true,points:[60,30,30,0],tricks:[{winner:0,plays:[],points:60}]});
  assert.deepEqual(ruleCandidates(base,'advanced',()=>.99).cards.map(c=>c.id),['Eichel-Ober']);
  const late={...base,points:[30,30,60,0],tricks:Array.from({length:6},()=>({winner:0,plays:[],points:5}))};
  assert.deepEqual(ruleCandidates(late,'advanced',()=>.99).cards.map(c=>c.id),['Eichel-Ober']);
  const early={...late,tricks:late.tricks.slice(0,5)};assert.ok(ruleCandidates(early,'advanced',()=>.99).cards.some(c=>c.id==='Schellen-7'));
  const black={...base,points:[0,60,60,0],tricks:[{winner:1,plays:[],points:60}]};
  assert.deepEqual(ruleCandidates(black,'advanced',()=>.99).cards.map(c=>c.id),['Eichel-Ober']);
});

test('Pro/Legend feed decisive points before freeing a suit, preserving unplayed aces otherwise',()=>{
  const v=view(['Schellen-7','Gras-Ass'],[[2,'Eichel-7'],[3,'Eichel-Ober']],{partnerRevealed:true,points:[50,30,30,0]});
  for(const level of ['pro','legend']) assert.deepEqual(ruleCandidates(v,level,()=>.9).cards.map(c=>c.id),['Gras-Ass']);
  const schneider={...v,points:[79,0,0,0]};
  assert.deepEqual(ruleCandidates(schneider,'pro',()=>.9).cards.map(c=>c.id),['Gras-Ass']);
  const noMilestone={...v,points:[0,0,0,0]};assert.ok(!ruleCandidates(noMilestone,'pro',()=>.9).cards.some(c=>c.id==='Gras-Ass'));
});
