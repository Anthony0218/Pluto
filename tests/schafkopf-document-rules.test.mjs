import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_GAME_RULES, applyAction, cardLock, chooseAiAction, contractsFor, createGame, gameDefinition, partyThresholds, scoreRound, shuffledDeck, viewFor } from '../src/games/schafkopf/schafkopf.ts';
import { chooseCard, evaluateHand, preferredCall, ruleCandidates, sampleHands, simulateContract, sureTout, tipRecommendations } from '../src/games/schafkopf/bot.ts';
import { botConfig, seededRandom } from '../src/games/schafkopf/botConfig.ts';
import { gameKnowledge, knowledgeForLevel } from '../src/games/schafkopf/knowledge.ts';
import { analyzeSchafkopfTrick, reviewViewForTrick } from '../src/games/schafkopf/coach.ts';
import { lessonKinds, randomSchafkopfLesson } from '../src/games/schafkopf/lessons.ts';
const card = (id) => { const [suit,rank] = id.split('-'); return {id,suit,rank}; };
function view(hand, plays = [], extra = {}) {
  const game = createGame(undefined,3,shuffledDeck(seededRandom(4)));
  Object.assign(game,{phase:'play',contract:{kind:'rufspiel',suit:'Eichel'},declarer:0,partner:3,partnerRevealed:false,turn:0,trick:plays.map(([seat,id]) => ({seat,card:card(id)})),...extra});
  game.hands[game.turn] = hand.map(card);
  return {...viewFor(game,game.turn),partner:game.partner};
}
const options = (v,level='advanced') => ruleCandidates(v,level,() => .4).cards.map(card => card.id);
const tips = v => tipRecommendations(v,'advanced');
const tip = (v,code) => tips(v).find(match => match.code === code)?.cards;
const allLevels = ['beginner','amateur','advanced','pro','legend'];

test('Legend announcements play sampled rounds through scoring; spritz sampling preserves earlier tricks', () => {
  const random=seededRandom(73), contract={kind:'solo',suit:'Herz',tout:true};
  let game=createGame(undefined,3,shuffledDeck(random));
  const hand=gameDefinition(contract).trumps.slice(0,8);
  const other=shuffledDeck(random).filter(card => !hand.some(own => own.id===card.id));
  game={...game,phase:'play',contract,declarer:0,partner:null,turn:0,hands:[hand,other.slice(0,8),other.slice(8,16),other.slice(16)],initialHands:[hand,other.slice(0,8),other.slice(8,16),other.slice(16)]};
  const config=botConfig({announcementSamples:4,legendTimeMs:1000});
  const original=JSON.stringify(game);
  const prediction=simulateContract(viewFor(game,0),contract,random,config);
  assert.equal(prediction.samples,4);
  assert.equal(prediction.winChance,1);
  assert.equal(prediction.expectedGain,220);
  assert.equal(JSON.stringify(game),original);
  while(game.tricks.length===0 || game.phase==='trick') {
    game=applyAction(game,game.turn,chooseAiAction(viewFor(game,game.turn),'advanced',random),random);
  }
  const later=simulateContract(viewFor(game,0),contract,random,config,false);
  assert.equal(later.samples,4);
  assert.equal(later.winChance,1);
  assert.equal(later.expectedGain,220);
  const configured={...game,rules:{...game.rules,toutMultiplier:3,toutSchneiderSchwarz:true},points:[120,0,0,0],tricks:Array.from({length:8},()=>({winner:0,points:15,plays:[]}))};
  assert.equal(scoreRound(configured).value,220,'obsolete saved multipliers and Tout bonuses cannot change the fixed rules');
  assert.equal(evaluateHand(hand,contract,1,config,configured.rules).expectedGain,evaluateHand(hand,contract,1,config,game.rules).expectedGain);
});

test('data-driven game definitions contain the specified ordered trumps and plain ranks', () => {
  for (const kind of ['rufspiel','solo']) assert.equal(gameDefinition({kind,suit:'Herz'}).trumps.length,14);
  assert.deepEqual(gameDefinition({kind:'wenz'}).trumps.map(card => card.id),['Eichel-Unter','Gras-Unter','Herz-Unter','Schellen-Unter']);
  assert.deepEqual(gameDefinition({kind:'geier'}).plainRanks,['Ass','10','König','Unter','9','8','7']);
  assert.equal(gameDefinition({kind:'farbwenz',suit:'Herz'}).trumps.length,11);
});
test('A1 chooses shortest callable suit, with the higher point card as tie break on every level', () => {
  const hand = ['Gras-7','Eichel-10','Schellen-7','Schellen-8','Herz-Ober','Eichel-Ober','Gras-Unter','Herz-7'].map(card);
  const calls = contractsFor(hand).filter(contract => contract.kind === 'rufspiel');
  assert.equal(preferredCall(hand,calls).suit,'Eichel');
  for (const level of allLevels) {
    const v={...view(hand.map(card => card.id)),phase:'declare',hand,contracts:calls,canDouble:false};
    assert.equal(chooseAiAction(v,level,() => .5).contract.suit,'Eichel');
  }
});
test('A4 Sauspiel bremser and five-trump exception, without the obsolete ace exclusion', () => {
  const c={kind:'rufspiel',suit:'Gras'};
  const evaluate=ids=>evaluateHand(ids.map(card),c,2);
  assert.equal(evaluate(['Herz-Ober','Herz-Unter','Herz-7','Herz-8','Gras-7','Eichel-7','Schellen-7','Gras-8']).eligible,true);
  assert.equal(evaluate(['Schellen-Ober','Schellen-Unter','Herz-7','Herz-8','Herz-9','Gras-7','Eichel-7','Schellen-7']).eligible,true);
  assert.equal(evaluate(['Schellen-Unter','Herz-7','Herz-8','Herz-9','Herz-König','Gras-7','Eichel-7','Schellen-7']).eligible,false);
});
test('A4 Farbsolo needs six trumps and two Ober except eight trumps', () => {
  const contract={kind:'solo',suit:'Herz'};
  assert.equal(evaluateHand(['Eichel-Ober','Gras-Ober','Herz-7','Herz-8','Herz-9','Herz-König','Eichel-7','Eichel-8'].map(card),contract,2).eligible,true);
  assert.equal(evaluateHand(['Eichel-Unter','Gras-Unter','Herz-7','Herz-8','Herz-9','Herz-König','Eichel-7','Eichel-8'].map(card),contract,2).eligible,false);
  assert.equal(evaluateHand(['Eichel-Unter','Gras-Unter','Herz-7','Herz-8','Herz-9','Herz-König','Herz-Ass','Herz-10'].map(card),contract,2).eligible,true);
});
test('A4 two exclusion criteria reject Wenz/Geier/Farbwenz and Tout is strictly controlled', () => {
  const hand=['Eichel-Unter','Gras-Unter','Herz-7','Herz-8','Eichel-Ass','Gras-Ass','Schellen-7','Schellen-8'].map(card);
  assert.ok(evaluateHand(hand,{kind:'wenz'},1).exclusions>=2);
  assert.equal(evaluateHand(hand,{kind:'wenz'},1).eligible,false);
  const top=gameDefinition({kind:'solo',suit:'Herz'}).trumps.slice(0,7);
  assert.equal(sureTout([...top,card('Eichel-Ass')],{kind:'solo',suit:'Herz'},1),true);
  assert.equal(sureTout([...top,card('Eichel-Ass')],{kind:'solo',suit:'Herz'},4),false);
  assert.equal(sureTout([...top.slice(0,6),card('Eichel-Ass'),card('Eichel-7')],{kind:'solo',suit:'Herz'},1),false);
});
test('R1/R3 apply before random errors and simulations at every level', () => {
  for (const level of allLevels) {
    const lead=view(['Eichel-Ober','Gras-Ass']);
    assert.deepEqual(options(lead,level),['Eichel-Ober']);
    const search=view(['Eichel-10','Gras-Ass','Herz-7'],[],{declarer:3,partner:2,turn:0});
    assert.deepEqual(options(search,level),['Eichel-10']);
    assert.equal(chooseAiAction(search,level,() => .99).cardId,'Eichel-10');
  }
});
test('R2 feeds a safe partner, R4 blocks overtaking, R5 forces an available winning trump', () => {
  for (const level of allLevels) {
    assert.deepEqual(options(view(['Gras-Ass','Gras-7'],[[3,'Eichel-Ober']]),level),['beginner','amateur'].includes(level) ? ['Gras-Ass'] : ['Gras-7']);
    assert.deepEqual(options(view(['Gras-Ober','Herz-7'],[[3,'Herz-Ober']]),level),['Herz-7']);
    assert.deepEqual(options(view(['Herz-Unter','Gras-7'],[[1,'Schellen-Ass']]),level),['Herz-Unter']);
  }
});
test('R6 direct neighbors are mandatory from Amateur only when every held card is adjacent', () => {
  const neighbors=view(['Herz-Ober','Eichel-Unter'],[[3,'Schellen-Ober']]);
  assert.deepEqual(options(neighbors,'beginner'),['Eichel-Unter']);
  for (const level of allLevels.slice(1)) assert.deepEqual(options(neighbors,level),['Herz-Ober']);
  const additional=view(['Herz-Ober','Eichel-Unter','Herz-10'],[[3,'Schellen-Ober']]);
  assert.ok(!ruleCandidates(additional,'amateur',() => .4).rules.includes('R6'));
  assert.ok(!options(additional,'amateur').includes('Herz-Ober'));
});
test('R4a has conservative configurable reserves and never spends the sole high trump', () => {
  const strong=view(['Eichel-Ober','Gras-Ober','Herz-Unter','Herz-7','Herz-8'],[[3,'Eichel-Unter']]);
  assert.ok(options(strong).includes('Eichel-Ober'));
  assert.ok(!options(view(['Eichel-Ober','Herz-7'],[[3,'Eichel-Unter']])).includes('Eichel-Ober'));
});
test('R5 protects unplayed plain ace unless ten replaces it or it closes the game', () => {
  const v=view(['Gras-Ass','Schellen-10'],[[3,'Eichel-Ober']]);
  assert.deepEqual(options(v),['Schellen-10']);
  assert.ok(options({...v,points:[50,0,0,0]}).includes('Gras-Ass'));
});
test('T1 favors Unter over Trumpfschmier with a potential enemy behind', () => {
  const v=view(['Herz-Unter','Herz-Ass'],[[3,'Schellen-7']]);
  assert.deepEqual(tip(v,'T1'),['Herz-Unter']);
  assert.equal(chooseCard(v,'advanced',() => .4).card.id,'Herz-Unter');
});
test('T2 high partner lead and low-Unter reserve', () => {
  const v=view(['Eichel-Ober','Gras-Ober','Herz-7'],[],{declarer:3,partner:0,turn:0});
  assert.deepEqual(tip(v,'T2'),['Eichel-Ober']);
  const reserve=view(['Schellen-Unter','Herz-7'],[],{declarer:3,partner:0,turn:0});
  assert.deepEqual(tip(reserve,'T2'),['Herz-7']);
});
test('T3b lets a potential partner take trump; T3c tracks an earlier non-search lead', () => {
  const v=view(['Gras-Ober','Herz-7'],[[3,'Herz-Ober']],{declarer:3,partner:2,turn:0});
  assert.deepEqual(tip(v,'T3b'),['Herz-7']);
  const history={plays:[{seat:1,card:card('Gras-7')},{seat:2,card:card('Gras-8')},{seat:3,card:card('Gras-Ass')},{seat:0,card:card('Gras-9')}],winner:3,points:11};
  const searched=view(['Eichel-10','Eichel-7'],[[1,'Eichel-8']],{tricks:[history]});
  assert.equal(gameKnowledge(searched).presumablyVoidInCalledSuit[1],true);
  assert.deepEqual(tip(searched,'T3c'),['Eichel-7']);
});
test('T4 searches with points but preserves a sole full Schmier, unless holding four called cards', () => {
  const v=view(['Eichel-10','Eichel-7','Gras-Ass'],[],{declarer:3,partner:2,turn:0});
  assert.deepEqual(tip(v,'T4'),['Eichel-10']);
  assert.deepEqual(tip(view(['Eichel-10','Eichel-7','Gras-7'],[],{declarer:3,partner:2,turn:0}),'T4'),['Eichel-7']);
  assert.deepEqual(tip(view(['Eichel-10','Eichel-7','Eichel-8','Eichel-9'],[],{declarer:3,partner:2,turn:0}),'T4'),['Eichel-10']);
});
test('T5 reserves lone Schmier in an uncertain enemy trick, T6 uses points among direct neighbors', () => {
  const v=view(['Herz-Ass','Herz-7'],[[1,'Gras-Ober']]);
  assert.deepEqual(tip(v,'T5'),['Herz-7']);
  const pair=view(['Schellen-Unter','Herz-Ass'],[[1,'Gras-Ober']]);
  assert.deepEqual(tip(pair,'T6'),['Schellen-Unter']);
});
test('T7 retains safe Gras-Ober, sacrifices unsafe Herz-Ober, and Profi uses the one-point difference', () => {
  assert.equal(chooseCard(view(['Gras-Ober','Herz-Ass'],[[1,'Eichel-Ober']]),'advanced',() => .4).card.id,'Herz-Ass');
  assert.equal(chooseCard(view(['Herz-Ober','Herz-10'],[[1,'Eichel-Ober']]),'advanced',() => .4).card.id,'Herz-Ober');
  assert.equal(chooseCard(view(['Schellen-Ober','Eichel-Unter'],[[3,'Eichel-Ober']]),'pro',() => .4).card.id,'Schellen-Ober');
});
test('T8 spreads 5–12 eyes with sufficient valuable cards; T10 can claim a trump lead', () => {
  const v=view(['Eichel-Ober','Gras-Ass','Gras-10','Schellen-Ass','Schellen-10','Gras-König'],[[3,'Eichel-7']],{tricks:[{plays:[],winner:0,points:11}]});
  assert.ok(tip(v,'T8').includes('Gras-Ass'));
  assert.ok(!tip(v,'T8').includes('Gras-König'));
  assert.deepEqual(tip(view(['Gras-Ober','Herz-7'],[[1,'Herz-Ober']]),'T10'),['Gras-Ober']);
});
test('T9 skips searching when both opponents are demonstrably trump-free', () => {
  const history={plays:[{seat:1,card:card('Eichel-7')},{seat:2,card:card('Eichel-8')},{seat:3,card:card('Herz-7')},{seat:0,card:card('Eichel-9')}],winner:3,points:0};
  // Seat 1/0 didn't follow trump in the next publicly visible trick.
  const noTrump={plays:[{seat:3,card:card('Herz-8')},{seat:0,card:card('Gras-7')},{seat:1,card:card('Gras-8')},{seat:2,card:card('Herz-9')}],winner:2,points:0};
  const v=view(['Eichel-10','Gras-10'],[],{declarer:2,partner:3,turn:0,tricks:[history,noTrump]});
  assert.ok(ruleCandidates(v,'advanced',() => .4).rules.includes('T9'));
  assert.ok(ruleCandidates(v,'amateur',() => .4).rules.includes('R3'));
});
test('T11 discards a non-full singleton at a partner trick, never feeds a full solely to become void', () => {
  const v=view(['Herz-Ober','Schellen-7','Gras-Ass'],[[2,'Eichel-7'],[3,'Eichel-Ober']]);
  assert.deepEqual(tip(v,'T11'),['Schellen-7']);
  assert.equal(chooseCard(v,'advanced',() => .4).card.id,'Schellen-7');
  assert.equal(tip(view(['Herz-Ober','Schellen-Ass'],[[1,'Eichel-Ober']]),'T11'),undefined);
});
test('T12 top two lead changes with partner position or solo', () => {
  const rear=view(['Eichel-Ober','Gras-Ober','Herz-7']);
  assert.deepEqual(tip(rear,'T12'),['Gras-Ober']);
  const middle={...rear,partner:1}; assert.deepEqual(tip(middle,'T12'),['Eichel-Ober']);
  assert.deepEqual(tip({...rear,contract:{kind:'solo',suit:'Herz'},partner:null},'T12'),['Gras-Ober']);
});
test('GameKnowledge tracks proven voids and discards; low levels cannot use round memory or points', () => {
  const history={plays:[{seat:1,card:card('Eichel-7')},{seat:2,card:card('Herz-7')},{seat:3,card:card('Gras-7')},{seat:0,card:card('Eichel-8')}],winner:2,points:0};
  const v=view(['Gras-Ober'],[],{tricks:[history],points:[51,10,12,20]});
  const k=gameKnowledge(v);
  assert.ok(k.voids[2].has('Eichel')); assert.equal(k.discards[0].seat,3);
  assert.equal(knowledgeForLevel(v,false).playedTrumps.length,0);
  assert.equal(knowledgeForLevel(v,false).teamPoints,0);
});
test('sampled information sets obey own hand, public void constraints and complete capacities', () => {
  const random=seededRandom(19); let game=createGame(undefined,3,shuffledDeck(random));
  game=applyAction(game,0,{type:'intent',play:true},random);
  for (let i=0;i<3;i++) game=applyAction(game,game.turn,{type:'intent',play:false},random);
  const contract=viewFor(game,0).contracts.find(c=>c.kind==='rufspiel');
  assert.ok(contract, 'fixture must have a callable ace');
  game=applyAction(game,0,{type:'declare',contract},random);
  for (let step=0;step<16;step++) game=applyAction(game,game.turn,game.phase==='trick'?{type:'collect'}:chooseAiAction(viewFor(game,game.turn),'advanced',random),random);
  const v=viewFor(game,game.turn), k=gameKnowledge(v);
  for (let i=0;i<20;i++) {
    const hands=sampleHands(v,random); assert.ok(hands);
    assert.deepEqual(hands.map(hand=>hand.length),v.counts);
    assert.deepEqual(hands[v.seat],v.hand);
    assert.equal(new Set(hands.flat().map(card=>card.id)).size,hands.flat().length);
    for (let seat=0;seat<4;seat++) for (const c of hands[seat]) assert.ok(k.constraints[seat].has(c.id));
  }
});
test('bots accept only redacted views, with no access to foreign hand properties', () => {
  const v=view(['Herz-Unter','Herz-Ass'],[[3,'Schellen-7']]);
  const protectedView=new Proxy(v,{get(target,key){if (['hands','pendingHands','initialHands'].includes(key)) throw new Error('Private foreign hands read');return Reflect.get(target,key);}});
  for (const level of allLevels) assert.ok(v.legalCards.includes(chooseAiAction(protectedView,level,seededRandom(44)).cardId));
});
test('review rebuilds only the own hand and conceals a partner revealed by a later trick', () => {
  const first={plays:[[1,'Gras-7'],[2,'Gras-8'],[3,'Gras-9'],[0,'Gras-Ass']].map(([seat,id])=>({seat,card:card(id)})),winner:0,points:11};
  const second={plays:[[0,'Eichel-7'],[1,'Eichel-8'],[2,'Eichel-Ass'],[3,'Eichel-9']].map(([seat,id])=>({seat,card:card(id)})),winner:2,points:11};
  const final={...view([],[],{declarer:0,partner:2}),phase:'finished',tricks:[first,second],hand:[],partnerRevealed:true};
  const past=reviewViewForTrick(final,first);
  assert.equal(past.partner,null); assert.equal(past.partnerRevealed,false);
  assert.deepEqual(past.hand.map(card=>card.id).sort(),['Eichel-7','Gras-Ass']);
  assert.deepEqual(past.points,[0,0,0,0]);
  assert.equal(analyzeSchafkopfTrick(final,first).actual.id,'Gras-Ass');
});
test('random lessons follow exact learning mode pools and seeded selection', () => {
  assert.deepEqual(lessonKinds('beginner'),['rule']); assert.deepEqual(lessonKinds('amateur'),['rule','tip']); assert.deepEqual(lessonKinds('advanced'),['tip']);
  for (let i=0;i<100;i++) {
    assert.equal(randomSchafkopfLesson('beginner',seededRandom(i)).kind,'rule');
    assert.equal(randomSchafkopfLesson('advanced',seededRandom(i)).kind,'tip');
    assert.deepEqual(randomSchafkopfLesson('amateur',seededRandom(i)),randomSchafkopfLesson('amateur',seededRandom(i)));
  }
});
test('config normalizes malformed values and decision metadata identifies legal candidate sets', () => {
  const config=botConfig({legendIterations:Infinity,legendTimeMs:-20,proError:NaN});
  assert.equal(config.legendIterations,200); assert.equal(config.legendTimeMs,1); assert.equal(config.proError,.02);
  const v=view(['Herz-Unter','Herz-Ass'],[[3,'Schellen-7']]);
  const action=chooseAiAction(v,'advanced',seededRandom(13));
  assert.equal(action.botLevel,'advanced'); assert.ok(action.reasonCode); assert.ok(action.debugInfo.candidates.includes(action.cardId));
});

test('R6b keeps both high trumps only when both will win after the current top falls', () => {
  assert.deepEqual(options(view(['Gras-Ober','Herz-Ober','Herz-Ass'],[[1,'Eichel-Ober']])),['Herz-Ass']);
  assert.deepEqual(options(view(['Herz-Ober','Schellen-Ober','Herz-Ass'],[[1,'Eichel-Ober']])),['Herz-Ober','Schellen-Ober']);
});
test('T3a leads another plain suit when unable to seek', () => {
  const v=view(['Gras-7','Schellen-7','Herz-7'],[],{declarer:3,partner:2});
  assert.deepEqual(options(v),['Gras-7','Schellen-7']);
});

test('fixed last-Spritz thresholds share asymmetric 61/31 between scoring and bots', () => {
  const game=createGame();
  Object.assign(game,{contract:{kind:'solo',suit:'Herz'},declarer:0,partner:null,spritzCount:1,spritzSeats:[1],points:[60,20,20,20],tricks:Array.from({length:8},(_,i)=>({plays:[],winner:i%2,points:0})),rules:{...DEFAULT_GAME_RULES,spritzSchwellen:'letzter-spritzer'}});
  assert.equal(scoreRound(game).declarerWon,true,'last Kontra party loses 60:60');
  assert.deepEqual(partyThresholds(game.rules,1),{playerWin:60,playerFree:30,opponentWin:61,opponentFree:31});
  game.points=[30,30,30,30]; assert.equal(scoreRound(game).schneider,false,'playing team is free at 30 after Kontra');
  game.points=[29,31,30,30]; assert.equal(scoreRound(game).schneider,true);
  game.points=[60,20,20,20]; game.spritzCount=2; assert.equal(scoreRound(game).declarerWon,false,'last Re party loses 60:60');
  game.spritzCount=1; game.rules.spritzSchwellen='klassisch'; assert.equal(scoreRound(game).declarerWon,true,'old saved house-rule choices cannot change the fixed rule');
  const v={...view(['Herz-7']),rules:{...DEFAULT_GAME_RULES,spritzSchwellen:'letzter-spritzer'},spritzCount:1,spritzSeats:[1]};
  assert.equal(gameKnowledge(v).targetThresholds.win,60);
  assert.equal(gameKnowledge({...v,seat:1,declarer:0,partner:3}).targetThresholds.win,61);
});
test('optional Davonlaufen switch and called-ace discard start are enforced by the engine', () => {
  const game=createGame(); Object.assign(game,{phase:'play',turn:1,contract:{kind:'rufspiel',suit:'Eichel'},declarer:0,partner:1,rules:{...DEFAULT_GAME_RULES,davonlaufen:false}});
  game.hands[1]=['Eichel-Ass','Eichel-7','Eichel-8','Eichel-9'].map(card);
  assert.match(cardLock(game,1,card('Eichel-7')),/ausgeschaltet/);
  game.rules.davonlaufen=true; assert.equal(cardLock(game,1,card('Eichel-7')),null);
  game.trick=[{seat:0,card:card('Schellen-7')}];
  game.tricks=Array.from({length:5},()=>({plays:[],winner:0,points:0}));
  assert.notEqual(cardLock(game,1,card('Eichel-Ass')),null);
  game.rules.rufsauAbwerfenAbStich=6; assert.equal(cardLock(game,1,card('Eichel-Ass')),null);
});
test('optional immediate Tout loss stops after collection and reports only points actually played', () => {
  const game=createGame(); Object.assign(game,{phase:'trick',turn:1,contract:{kind:'solo',suit:'Herz',tout:true},declarer:0,partner:null,rules:{...DEFAULT_GAME_RULES,toutAbbrechen:true},tricks:[{plays:[{seat:0,card:card('Eichel-7')},{seat:1,card:card('Eichel-Ass')},{seat:2,card:card('Eichel-8')},{seat:3,card:card('Eichel-9')}],winner:1,points:11}],points:[0,11,0,0]});
  const ended=applyAction(game,1,{type:'collect'});
  assert.equal(ended.phase,'finished'); assert.equal(ended.result.declarerWon,false); assert.equal(ended.result.opponentPoints,11);
  const continuing=applyAction({...game,rules:{...DEFAULT_GAME_RULES,toutAbbrechen:false}},1,{type:'collect'});
  assert.equal(continuing.phase,'play');
});
