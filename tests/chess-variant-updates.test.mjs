import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createInitialPortalState, clonePortalState, resolvePortalAfterMove, finalizePortalPromotionEvent, getRouletteMoves, moveRoulette, applyRouletteCard, isPortalKingAttacked } from '../src/games/chess/variants/chessRoulette.ts';
import { dropHotPotatoAfterBlast, pickUpHotPotato, resolveHotPotatoExplosion } from '../src/games/chess/variants/HotPotato.ts';
const kingPosition = () => new Chess('7k/7p/8/8/4K3/8/P7/8 w - - 0 1');
const portal = (square, effect='destroy') => ({ id:'test', square, effect, revealed:false, triggerCount:0, expiresAfterPly:null, triggeredBy:null });

test('Roulette seeded effects follow 10/60/20/10 distribution and replay deterministically', () => {
  const counts = { destroy:0, promote:0, teleport:0, swap:0 };
  for(let seed=0;seed<10000;seed++) {
    const state=createInitialPortalState(seed);
    assert.deepEqual(state,createInitialPortalState(seed));
    state.portals.forEach(p=>counts[p.effect]++);
  }
  for(const [key,rate] of Object.entries({destroy:.1,promote:.6,teleport:.2,swap:.1})) assert.ok(Math.abs(counts[key]/20000-rate)<.02,`${key}: ${counts[key]}`);
});

test('King landing produces 80% cards / 20% extra turns, regardless of ordinary effect', () => {
  let cards=0, turns=0;
  for(let seed=0;seed<4000;seed++) {
    const game=kingPosition(); game.move({from:'e4',to:'e5'});
    const state={seed,portals:[portal('e5')],events:[]};
    const result=resolvePortalAfterMove(game,state,'e5',{color:'w',piece:'k'},1);
    if(result.pendingPromotion){cards++; assert.equal(game.turn(),'b');}
    else {turns++;assert.equal(result.event.result,'extra-turn');assert.equal(game.turn(),'w');}
    assert.equal(game.get('e5').type,'k');
    assert.equal(state.portals[0].triggerCount,0);
  }
  assert.ok(Math.abs(cards/4000-.8)<.025); assert.equal(cards+turns,4000);
});

function powerState(piece) { return {seed:1,portals:[],events:[],kingPowers:{w:{piece,movesLeft:3}}}; }
test('King retains normal moves, gains card movement and expires after exactly three king moves', () => {
  const game=kingPosition();let state=powerState('n');
  const moves=getRouletteMoves(game,state,'e4').map(m=>m.to);
  assert.ok(moves.includes('e5'));assert.ok(moves.includes('f6'));
  for(const [from,to,remaining] of [['e4','f6',2],['f6','e4',1],['e4','f6',0]]) {
    const move=moveRoulette(game,state,{from,to});
    state=resolvePortalAfterMove(game,state,to,move,1).state;
    assert.equal(state.kingPowers?.w?.movesLeft??0,remaining);
    assert.equal(game.get(to).type,'k');
    const fen=game.fen().split(' ');fen[1]='w';game.load(fen.join(' '));
  }
  assert.ok(!getRouletteMoves(game,state,'f6').some(m=>m.to==='e4'));
});

test('Other piece moves and enemy king moves do not spend the power', () => {
 const game=kingPosition();const state=powerState('q');const move=moveRoulette(game,state,{from:'a2',to:'a3'});
 assert.equal(resolvePortalAfterMove(game,state,'a3',move,1).state.kingPowers.w.movesLeft,3);
 const clone=clonePortalState(state);clone.kingPowers.w.movesLeft=1;assert.equal(state.kingPowers.w.movesLeft,3);
});

test('King cards: pawn does nothing, piece grants power, king loses without removing king from FEN', () => {
  for(const card of ['p','q','k']) {
    const game=kingPosition();const state=powerState('n');
    applyRouletteCard(game,'e4',card);
    const next=finalizePortalPromotionEvent(state,{ply:1,square:'e4',effect:'promote',result:'promotion-card',color:'w',piece:'k',promotionCard:card});
    assert.equal(game.get('e4').type,'k');assert.doesNotThrow(()=>new Chess(game.fen()));
    if(card==='k') {assert.equal(next.loser,'w');assert.deepEqual(getRouletteMoves(game,next),[]);}
    if(card==='p') assert.deepEqual(next.kingPowers.w,state.kingPowers.w);
    if(card==='q') assert.deepEqual(next.kingPowers.w,{piece:'q',movesLeft:3});
  }
});

test('Empowered kings cannot jump into attack; augmented enemy attacks constrain legal moves', () => {
  const game=new Chess('4r2k/7p/8/8/4K3/8/P7/8 w - - 0 1');
  const moves=getRouletteMoves(game,powerState('n'),'e4');assert.ok(!moves.some(m=>m.to==='e5'));
  const enemy=new Chess('7k/7p/8/8/4K3/8/P7/8 w - - 0 1');
  const state={seed:1,portals:[],events:[],kingPowers:{b:{piece:'b',movesLeft:3}}};
  assert.ok(!getRouletteMoves(enemy,state,'e4').some(m=>m.to==='e5'));
  const checked=new Chess('7k/7p/8/8/3K4/8/P7/8 w - - 0 1');
  assert.equal(isPortalKingAttacked(checked,'w',state),true);
});

test('A second bomb survives a blast on the ground and resumes only on pickup', () => {
 const game=new Chess('7k/7p/8/8/3RN3/8/P7/K7 w - - 0 1');
 const bomb={owner:'b',square:'e4',movesUntilExplosion:5,fuseMovesTotal:8,respawnMovesRemaining:0,blastPattern:'ring'};
 const blast=resolveHotPotatoExplosion(game,'d4');dropHotPotatoAfterBlast(game,bomb,blast.explosionSquares);
 assert.equal(bomb.square,'e4');assert.equal(bomb.dropped,true);assert.equal(bomb.movesUntilExplosion,5);
 for(let i=0;i<5;i++)assert.equal(pickUpHotPotato(bomb,{from:'a2',to:'a3',color:'w',flags:'n'}),false);
 assert.equal(bomb.movesUntilExplosion,5);
 assert.equal(pickUpHotPotato(bomb,{from:'d3',to:'e4',color:'w',flags:'n'}),true);
 assert.equal(bomb.dropped,false);
});
