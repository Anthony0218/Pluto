import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const LEVELS = ['beginner', 'amateur', 'pro', 'legend'];
export const LABELS = ['Anfänger', 'Amateur', 'Profi', 'Legende'];
export const ids = cards => cards.map(card => card.id);
export const sum = numbers => numbers.reduce((a, b) => a + b, 0);
export const digest = value => createHash('sha256').update(value).digest('hex');
export function mixSeed(seed, game, stream = 0) {
  let value = (seed ^ Math.imul(game + 1, 0x9e3779b1) ^ Math.imul(stream + 1, 0x85ebca6b)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}
function permutations(items) {
  if (!items.length) return [[]];
  return items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index)).map(rest => [item, ...rest]));
}
const SEAT_ORDERS = permutations(LEVELS);
export const seatLevelsFor = game => SEAT_ORDERS[game % 24];

// Separate implementation of the standard scoring, rather than checking the
// engine against its own scoreRound function. No Ramsch or optional variants.
export function independentResult(state) {
  const { contract: c, rules: r } = state;
  assert.ok(['rufspiel', 'solo', 'wenz', 'farbwenz', 'sie'].includes(c.kind));
  const team = c.kind === 'rufspiel' ? [state.declarer, state.partner] : [state.declarer];
  const eyes = sum(team.map(seat => state.points[seat]));
  const tricks = state.tricks.filter(trick => team.includes(trick.winner)).length;
  const opponentLast = state.spritzCount % 2 === 1;
  const playerWin = opponentLast ? 60 : 61;
  const playerFree = opponentLast ? 30 : 31;
  const opponentFree = opponentLast ? 31 : 30;
  const declarerWon = c.kind === 'sie' || (c.tout ? tricks === 8 : eyes >= playerWin);
  const schwarz = c.kind !== 'sie' && (tricks === 0 || tricks === 8);
  const schneider = c.kind !== 'sie' && (declarerWon ? 120 - eyes < opponentFree : eyes < playerFree);
  const suits = ['Eichel', 'Gras', 'Herz', 'Schellen'];
  const ranks = ['Ass', '10', 'König', 'Ober', 'Unter', '9', '8', '7'];
  const courts = ['wenz', 'farbwenz'].includes(c.kind) ? ['Unter'] : ['Ober', 'Unter'];
  const color = ['wenz', 'sie'].includes(c.kind) ? null : c.kind === 'rufspiel' ? 'Herz' : c.suit;
  const trumps = [...courts.flatMap(rank => suits.map(suit => `${suit}-${rank}`)), ...(color ? ranks.filter(rank => !courts.includes(rank)).map(rank => `${color}-${rank}`) : [])];
  const owned = new Set(team.flatMap(seat => ids(state.initialHands[seat])));
  const withTop = owned.has(trumps[0]);
  let laufende = 0;
  for (const id of trumps) { if (owned.has(id) !== withTop) break; laufende++; }
  if (laufende < (c.kind === 'wenz' ? r.laufendeAbWenzGeier ?? 2 : r.laufendeAbFarbspiel ?? 3) || r.laufendeAktiv === false) laufende = 0;
  const base = c.kind === 'rufspiel' ? r.rufspielValue : c.kind === 'wenz' ? r.wenzValue : r.soloValue;
  const bonuses = laufende * r.laufendeValue + (c.tout || c.kind === 'sie' ? 0 : Number(schneider) * r.schneiderValue + Number(schwarz) * r.schwarzValue);
  const value = (base + bonuses) * (c.kind === 'sie' ? 4 : c.tout ? 2 : 1) * state.multiplier;
  const deltas = [0, 1, 2, 3].map(seat => (team.includes(seat) === declarerWon ? 1 : -1) * value * (team.length === 1 && seat === state.declarer ? 3 : 1));
  return { declarerPoints: eyes, declarerWon, schneider, schwarz, laufende, value, deltas, team };
}

export function checkFinished(state, engine) {
  const played = state.tricks.flatMap(trick => trick.plays).map(play => play.card);
  const remaining = state.hands.flat();
  const all = [...played, ...remaining];
  assert.equal(all.length, 32, 'card conservation');
  assert.equal(new Set(ids(all)).size, 32, 'unique cards');
  if (state.contract.kind !== 'sie') {
    assert.equal(sum(state.points) + sum(remaining.map(card => engine.POINTS[card.rank])), 120, 'eye conservation');
    for (const trick of state.tricks) {
      assert.equal(trick.plays.length, 4);
      assert.equal(trick.points, sum(trick.plays.map(play => engine.POINTS[play.card.rank])));
      assert.equal(trick.winner, independentWinner(trick.plays, state.contract), 'independent trick winner');
    }
    const totals = [0, 0, 0, 0];
    state.tricks.forEach(trick => { totals[trick.winner] += trick.points; });
    assert.deepEqual(state.points, totals);
    const early = state.contract.tout && !state.result.declarerWon && state.rules.toutAbbrechen !== false;
    assert.ok(state.tricks.length === 8 || early, 'complete game or lost Tout');
  }
  const expected = independentResult(state);
  for (const key of Object.keys(expected)) assert.deepEqual(state.result[key], expected[key], `independent settlement: ${key}`);
  assert.equal(sum(state.result.deltas), 0, 'zero sum settlement');
  assert.equal(state.multiplier, 2 ** ((state.knockSeats?.length ?? 0) + state.spritzCount));
  assert.deepEqual(state.totals, state.result.deltas, 'per-game ledger');
}

export function independentWinner(plays, c) {
  const suits = ['Eichel', 'Gras', 'Herz', 'Schellen'];
  const ranks = ['Ass', '10', 'König', 'Ober', 'Unter', '9', '8', '7'];
  const courts = ['wenz', 'farbwenz'].includes(c.kind) ? ['Unter'] : ['Ober', 'Unter'];
  const color = ['wenz', 'sie'].includes(c.kind) ? null : c.kind === 'rufspiel' ? 'Herz' : c.suit;
  const strength = card => {
    const court = courts.indexOf(card.rank);
    if (court >= 0) return 200 - court * 4 - suits.indexOf(card.suit);
    if (card.suit === color) return 150 - ranks.indexOf(card.rank);
    return card.suit === plays[0].card.suit ? 50 - ranks.indexOf(card.rank) : -1;
  };
  return plays.reduce((best, play) => strength(play.card) > strength(best.card) ? play : best).seat;
}

// Exact last-two-trick, full-information team minimax. Its results are hindsight
// evidence only: the playing bot never receives foreign hands. Spritz windows
// have closed by this point. Objective is the acting seat's final tariff delta.
export function endgameAlternatives(initial, seat, engine) {
  if (sum(initial.hands.map(hand => hand.length)) > 8 || initial.contract.kind === 'sie') return null;
  const team = initial.contract.kind === 'rufspiel' ? [initial.declarer, initial.partner] : [initial.declarer];
  const sameSide = other => team.includes(other) === team.includes(seat);
  let nodes = 0;
  const step = (state, card) => {
    const actor = state.turn;
    const hands = state.hands.map((hand, i) => i === actor ? hand.filter(other => other.id !== card.id) : hand);
    const trick = [...state.trick, { seat: actor, card }];
    let next = { ...state, hands, trick, turn: (actor + 1) % 4 };
    if (trick.length === 4) {
      const winner = independentWinner(trick, state.contract);
      const points = sum(trick.map(play => engine.POINTS[play.card.rank]));
      const totals = [...state.points]; totals[winner] += points;
      next = { ...next, trick: [], tricks: [...state.tricks, { plays: trick, winner, points }], turn: winner, points: totals };
      if (next.tricks.length === 8 || next.contract.tout && next.rules.toutAbbrechen !== false && !team.includes(winner)) next.phase = 'finished';
    }
    return next;
  };
  const solve = state => {
    nodes++;
    if (state.phase === 'finished') return independentResult(state).deltas[seat];
    const legal = engine.legalCards(state, state.turn);
    assert.ok(legal.length, 'nonterminal endgame has a legal card');
    const scores = legal.map(card => solve(step(state, card)));
    return sameSide(state.turn) ? Math.max(...scores) : Math.min(...scores);
  };
  const alternatives = engine.legalCards(initial, seat).map(card => ({ card: card.id, delta: solve(step(initial, card)) }));
  return { method: 'exact-full-information-team-minimax-last-two-tricks', objective: 'final-seat-delta-cent', futureSpritz: false, alternatives, nodes };
}

export function compactView(view) {
  return {
    seat: view.seat, phase: view.phase, turn: view.turn, hand: ids(view.hand), counts: view.counts,
    trick: view.trick.map(play => ({ seat: play.seat, card: play.card.id })), trickIndex: view.tricks.length,
    points: view.points, contract: view.contract, declarer: view.declarer, partner: view.partner,
    partnerRevealed: view.partnerRevealed, escaped: view.escaped, legalCards: view.legalCards, locks: view.locks,
    bidLevel: view.bidLevel, bidLevels: view.bidLevels, canPassBid: view.canPassBid, canDouble: view.canDouble,
    forcedCaller: view.forcedCaller, forcedCallerReason: view.forcedCallerReason,
    spritzCount: view.spritzCount, spritzSeats: view.spritzSeats, lastSpritzTrick: view.lastSpritzTrick,
    multiplier: view.multiplier,
  };
}

// Applied only to the archived runtime, not to the application's bot.ts.
// Hooks neither consume randomness nor change strategy/search budgets.
export function instrumentBot(original) {
  let source = original;
  const replace = (before, after) => {
    assert.equal(source.split(before).length, 2, `unique telemetry anchor: ${before.slice(0, 70)}`);
    source = source.replace(before, after);
  };
  source = "const auditEmit = (event: unknown) => (globalThis as unknown as { __schafkopfAudit?: (event: unknown) => void }).__schafkopfAudit?.(event);\n" + source;
  replace('return {card:selected,reasonCode,level,debugInfo};', "auditEmit({type:'cardDecision', matches:matches.map(match => ({code:match.code,cards:match.cards.map(card => card.id),weight:match.weight,deduced:match.deduced})),selected:selected.id,reasonCode,debugInfo});\n  return {card:selected,reasonCode,level,debugInfo};");
  replace('const hands = sampleHands(c.view,random); if (!hands) break;', "const hands = sampleHands(c.view,random); if (!hands) { auditEmit({type:'searchFailure',stage:'card',reason:'no-compatible-hands',iterations,view:c.view}); break; }");
  replace('if (!state.result) break;\n      const ownPlaying', "if (!state.result) { auditEmit({type:'searchFailure',stage:'card',reason:'unfinished-rollout',iterations}); break; }\n      const ownPlaying");
  replace('} catch { break; /* Inconsistent historical saves must not cause an illegal real move. */ }', "} catch (error) { auditEmit({type:'searchFailure',stage:'card',reason:'rollout-exception',error:String(error),stack:(error as Error).stack,iterations,sampledHands:hands,rolloutStart:state}); break; }");
  replace('return {card:visits.some(count => count === 0) ? priorChoice : ranked[0].score > -Infinity ? ranked[0].card : pick(cards,random),iterations};', "const auditResult = {card:visits.some(count => count === 0) ? priorChoice : ranked[0].score > -Infinity ? ranked[0].card : pick(cards,random),iterations};\n  auditEmit({type:'cardSearch',iterations,elapsedMs:Date.now()-start,selected:auditResult.card.id,fallback:visits.some(count => count === 0),alternatives:cards.map((card,index)=>({card:card.id,visits:visits[index],mean:visits[index]?scores[index]/visits[index]:null,prior:priorScores[index].score}))});\n  return auditResult;");
  replace('const hands = sampleHands(provisional,random); if (!hands) break;', "const hands = sampleHands(provisional,random); if (!hands) { auditEmit({type:'searchFailure',stage:'contract',contract,reason:'no-compatible-hands',iteration,view:provisional}); break; }");
  replace('if (!state.result) break;\n      const won', "if (!state.result) { auditEmit({type:'searchFailure',stage:'contract',contract,reason:'unfinished-rollout',iteration}); break; }\n      const won");
  replace('} catch { break; }\n  }\n  return { winChance:', "} catch (error) { auditEmit({type:'searchFailure',stage:'contract',contract,reason:'rollout-exception',error:String(error),stack:(error as Error).stack,iteration,sampledHands:hands,view:provisional}); break; }\n  }\n  auditEmit({type:'contractEstimate',contract,playing,wins,samples,winChance:samples?wins/samples:.5,positiveOnlyExpectedGain:samples?gain/samples:0,elapsedMs:Date.now()-start});\n  return { winChance:");
  replace("if (view.phase === 'declare') {\n    let contract", "if (view.phase === 'declare') {\n    auditEmit({type:'declarationChoices',choices});\n    let contract");
  return source;
}
