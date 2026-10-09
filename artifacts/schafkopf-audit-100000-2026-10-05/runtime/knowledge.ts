import { POINTS, partyThresholds, createDeck, gameDefinition, isTrump, type Card, type GameView, type Play, type Suit } from './schafkopf.ts';
export type Category = Suit | 'Trumpf';
export type Role = 'SICHER_SPIELERPARTEI' | 'SICHER_GEGENSPIELER' | 'UNBEKANNT';
export type GameKnowledge = {
  roles: Role[]; ownRole: Role; partner: number | null;
  playedCards: Card[]; playedTrumps: Card[]; remainingTrumps: Card[];
  voids: Set<Category>[]; playedSuits: Set<Suit>;
  discards: { seat: number; suit: Suit; trick: number }[];
  presumablyVoidInCalledSuit: boolean[];
  constraints: Set<string>[]; probabilities: Map<string, number>[]; remainingPoints: number;
  teamPoints: number; opponentPoints: number; teamsKnown: boolean;
  targetThresholds: { win: number; schneiderFree: number; opponentWin: number; opponentSchneiderFree: number };
};
export function category(card: Card, view: GameView): Category { return isTrump(card, view.contract!) ? 'Trumpf' : card.suit; }
/** Rebuild from public history; never receives a GameState or another hand. */
export function gameKnowledge(view: GameView): GameKnowledge {
  const contract = view.contract!;
  const ownPlaying = view.seat === view.declarer || view.partner === view.seat || contract.kind === 'rufspiel' && view.hand.some(card => card.suit === contract.suit && card.rank === (contract.calledRank ?? 'Ass'));
  const roles: Role[] = [0,1,2,3].map(seat => seat === view.declarer || seat === view.partner ? 'SICHER_SPIELERPARTEI' : contract.kind !== 'rufspiel' || view.partner !== null ? 'SICHER_GEGENSPIELER' : 'UNBEKANNT');
  roles[view.seat] = ownPlaying ? 'SICHER_SPIELERPARTEI' : 'SICHER_GEGENSPIELER';
  const voids = [0,1,2,3].map(() => new Set<Category>());
  const playedSuits = new Set<Suit>();
  const discards: GameKnowledge['discards'] = [];
  const presumablyVoidInCalledSuit = [false,false,false,false];
  const played = new Map<string, Card>();
  const histories = [...view.tricks.map(trick => trick.plays)];
  // A collected trick is sometimes still on the table. Don't count it twice.
  if (view.trick.length && !view.tricks.some(trick => trick.plays[0]?.card.id === view.trick[0]?.card.id)) histories.push(view.trick);
  let calledFell = false;
  for (const [index, plays] of histories.entries()) {
    if (!plays.length) continue;
    const led = category(plays[0].card, view);
    if (led !== 'Trumpf') playedSuits.add(led);
    if (contract.kind === 'rufspiel' && !calledFell && led !== 'Trumpf' && led !== contract.suit && roles[plays[0].seat] !== 'SICHER_SPIELERPARTEI') presumablyVoidInCalledSuit[plays[0].seat] = true;
    for (const play of plays) {
      played.set(play.card.id, play.card);
      if (category(play.card, view) !== led) {
        voids[play.seat].add(led);
        if (!isTrump(play.card, contract)) discards.push({ seat: play.seat, suit: play.card.suit, trick: index });
      }
      if (contract.kind === 'rufspiel' && play.card.suit === contract.suit && play.card.rank === (contract.calledRank ?? 'Ass')) {
        roles[play.seat] = 'SICHER_SPIELERPARTEI'; calledFell = true;
      }
    }
  }
  const holder = roles.findIndex((role, seat) => role === 'SICHER_SPIELERPARTEI' && seat !== view.declarer);
  if (contract.kind === 'rufspiel' && holder >= 0) roles.forEach((_, seat) => { if (seat !== view.declarer && seat !== holder) roles[seat] = 'SICHER_GEGENSPIELER'; });
  // Re publicly identifies a member of the playing party. Sub identifies an opponent.
  const spritzes = view.spritzEvents?.length ? view.spritzEvents : (view.spritzSeats ?? []).map((seat,index) => ({seat,count:index+1}));
  spritzes.forEach(({seat,count}) => { roles[seat] = count % 2 === 1 ? 'SICHER_GEGENSPIELER' : 'SICHER_SPIELERPARTEI'; });
  let partner = holder >= 0 ? holder : view.partner;
  if (contract.kind === 'rufspiel' && partner === null) {
    const possible = [0,1,2,3].filter(seat => seat !== view.declarer && roles[seat] !== 'SICHER_GEGENSPIELER' && !voids[seat].has(contract.suit!));
    if (possible.length === 1) partner = possible[0];
    const reHolder = roles.findIndex((role, seat) => role === 'SICHER_SPIELERPARTEI' && seat !== view.declarer);
    if (reHolder >= 0) partner = reHolder;
    if (partner !== null) roles.forEach((_,seat) => { roles[seat] = seat === partner || seat === view.declarer ? 'SICHER_SPIELERPARTEI' : 'SICHER_GEGENSPIELER'; });
  }
  const seen = new Set([...played.keys(), ...view.hand.map(card => card.id)]);
  const unseen = createDeck().filter(card => !seen.has(card.id));
  const constraints = [0,1,2,3].map(seat => new Set((seat === view.seat ? view.hand : unseen.filter(card => !voids[seat].has(category(card,view)) && !(contract.kind === 'rufspiel' && card.suit === contract.suit && card.rank === (contract.calledRank ?? 'Ass') && (seat === view.declarer || partner !== null && seat !== partner)))).map(card => card.id)));
  const probabilities = [0,1,2,3].map(() => new Map<string,number>());
  for (const card of unseen) {
    const eligible = [0,1,2,3].filter(seat => seat !== view.seat && constraints[seat].has(card.id));
    const weights = eligible.map(seat => ({ seat, weight: (view.counts[seat] || 1) * (card.suit === contract.suit && presumablyVoidInCalledSuit[seat] ? .35 : 1) }));
    const total = weights.reduce((sum,entry) => sum+entry.weight,0);
    weights.forEach(entry => probabilities[entry.seat].set(card.id,entry.weight/total));
  }
  view.hand.forEach(card => probabilities[view.seat].set(card.id,1));
  const teamsKnown = roles.every(role => role !== 'UNBEKANNT');
  const ownRole = roles[view.seat];
  const teamPoints = teamsKnown ? view.points.reduce((sum, points, seat) => sum + (roles[seat] === ownRole ? points : 0),0) : view.points[view.seat];
  const opponentPoints = view.points.reduce((sum, points, seat) => sum + (roles[seat] !== ownRole && roles[seat] !== 'UNBEKANNT' ? points : 0),0);
  const playedCards = [...played.values()];
  const targets = partyThresholds(view.rules,view.spritzCount ?? 0);
  return { roles, ownRole, partner, playedCards, playedTrumps: playedCards.filter(card => isTrump(card,contract)), remainingTrumps: gameDefinition(contract).trumps.filter(card => !played.has(card.id)), voids, playedSuits, discards, presumablyVoidInCalledSuit, constraints, probabilities, remainingPoints: 120 - view.points.reduce((a,b) => a+b,0), teamPoints, opponentPoints, teamsKnown,
    // The last Spritz party always needs 61/31.
    targetThresholds: { win: ownPlaying ? targets.playerWin : targets.opponentWin, schneiderFree: ownPlaying ? targets.playerFree : targets.opponentFree, opponentWin: ownPlaying ? targets.opponentWin : targets.playerWin, opponentSchneiderFree: ownPlaying ? targets.opponentFree : targets.playerFree } };
}
export function sameParty(knowledge: GameKnowledge, seat: number): boolean {
  return knowledge.roles[seat] !== 'UNBEKANNT' && knowledge.roles[seat] === knowledge.ownRole;
}
export function publicPoints(plays: Play[]): number { return plays.reduce((sum,play) => sum + POINTS[play.card.rank],0); }
/** Enforce H/G/P boundaries even when the view contains the full public history. */
export function knowledgeForLevel(view: GameView, memory: boolean): GameKnowledge {
  if (memory) return gameKnowledge(view);
  const restricted = { ...view, tricks: [], points: [0,0,0,0] };
  const knowledge = gameKnowledge(restricted);
  knowledge.probabilities = [0,1,2,3].map(() => new Map<string,number>());
  knowledge.voids = [0,1,2,3].map(() => new Set<Category>());
  knowledge.playedSuits.clear(); knowledge.discards = [];
  knowledge.presumablyVoidInCalledSuit = [false,false,false,false];
  return knowledge;
}
