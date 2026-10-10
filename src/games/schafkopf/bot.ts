import { baseGameValue } from './tariffs.ts';
import { POINTS, SUITS, applyAction, cardStrength, contractLevel, createDeck, gameDefinition, isTrump, shouldAiKnock, trickWinner, viewFor, type Action, type AiDifficulty, type Card, type Contract, type GameState, type GameView, type GameRules } from './schafkopf.ts';
import { botConfig, botLevel, type BotConfig, type BotLevel, type TipCode } from './botConfig.ts';
import { category, gameKnowledge, knowledgeForLevel, publicPoints, sameParty, type GameKnowledge } from './knowledge.ts';
export type ReasonCode = 'ENGINE' | 'A1' | 'A4' | 'A5' | 'R1' | 'R2' | 'R3' | 'R4' | 'R4a' | 'R5' | 'R6' | 'R6b' | TipCode | 'RANDOM' | 'SIMULATION' | 'EXISTING';
export type CardDecision = { card: Card; reasonCode: ReasonCode; level: BotLevel; debugInfo: { candidates: string[]; rules: ReasonCode[]; tips: TipCode[]; simulations?: number } };
export const pick = <T,>(items: T[], random: () => number): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
const full = (card: Card) => card.rank === 'Ass' || card.rank === '10';
const court = (card: Card) => card.rank === 'Ober' || card.rank === 'Unter';
const remembers = (level: BotLevel) => level === 'advanced' || level === 'pro' || level === 'legend';
const exact = (level: BotLevel) => level === 'pro' || level === 'legend';
const strongest = (cards: Card[], contract: Contract) => [...cards].sort((a,b) => cardStrength(b,contract)-cardStrength(a,contract))[0];
const leastPoints = (cards: Card[]) => [...cards].sort((a,b) => POINTS[a.rank]-POINTS[b.rank])[0];
type Context = { view: GameView; level: BotLevel; config: BotConfig; knowledge: GameKnowledge; contract: Contract; legal: Card[]; trumps: Card[]; plain: Card[]; behind: number[]; winner: number | null; winningCard: Card | undefined; allyWinning: boolean; safePartner: boolean; wins: (card: Card) => boolean; safe: (card: Card) => boolean; free: boolean; eyes: number; playing: boolean; trumpOrder: Card[] };
function context(view: GameView, level: BotLevel, config: BotConfig): Context {
  const contract = view.contract!;
  const knowledge = knowledgeForLevel(view,remembers(level));
  const legal = view.hand.filter(card => view.legalCards.includes(card.id));
  const behind = view.trick.length ? Array.from({ length: 3-view.trick.length },(_,index) => (view.seat+1+index)%4) : [1,2,3].map(offset => (view.seat+offset)%4);
  const winner = view.trick.length ? trickWinner(view.trick,contract) : null;
  const winningCard = view.trick.find(play => play.seat === winner)?.card;
  const allyWinning = winner !== null && sameParty(knowledge,winner);
  const trumpOrder = gameDefinition(contract).trumps;
  const lead = view.trick[0]?.card;
  const wins = (card: Card) => !!view.trick.length && trickWinner([...view.trick,{seat:view.seat,card}],contract) === view.seat;
  const canBeat = (other: Card, card: Card) => trickWinner([{seat:0,card: lead ?? card},{seat:1,card},{seat:2,card:other}],contract) === 2;
  const safe = (card: Card) => {
    if (isTrump(card,contract) && card.id === trumpOrder[0]?.id) return true;
    const enemies = behind.filter(seat => !sameParty(knowledge,seat));
    if (!enemies.length) return true;
    if (!remembers(level)) return false;
    return enemies.every(seat => [...knowledge.constraints[seat]].every(id => !canBeat(createDeck().find(other => other.id === id)!,card)));
  };
  return { view,level,config,knowledge,contract,legal,trumps: legal.filter(card => isTrump(card,contract)),plain: legal.filter(card => !isTrump(card,contract)),behind,winner,winningCard,allyWinning,safePartner: allyWinning && !!winningCard && safe(winningCard),wins,safe,free: !!lead && !isTrump(lead,contract) && !view.hand.some(card => category(card,view) === category(lead,view)),eyes:publicPoints(view.trick),playing:knowledge.ownRole === 'SICHER_SPIELERPARTEI',trumpOrder };
}
function singletonDiscards(c: Context): Card[] {
  if (!remembers(c.level)) return [];
  return c.plain.filter(card => !full(card) && !c.knowledge.playedSuits.has(card.suit) && c.view.hand.filter(other => !isTrump(other,c.contract) && other.suit === card.suit).length === 1);
}
function decisiveWin(c: Context, card: Card): boolean {
  if (!remembers(c.level) || !c.wins(card) || !c.safe(card)) return false;
  const points = c.knowledge.teamPoints + c.eyes + POINTS[card.rank];
  const win = c.knowledge.teamPoints < c.knowledge.targetThresholds.win && points >= c.knowledge.targetThresholds.win;
  const schneiderFree = c.view.tricks.length >= 6 && c.knowledge.teamPoints < c.knowledge.targetThresholds.schneiderFree && points >= c.knowledge.targetThresholds.schneiderFree;
  const avoidsBlack = c.knowledge.teamsKnown && !c.view.tricks.some(trick => sameParty(c.knowledge,trick.winner));
  return win || schneiderFree || avoidsBlack;
}
function decisiveFeed(c: Context, card: Card): boolean {
  if (!exact(c.level) || !c.safePartner) return false;
  const points = c.knowledge.teamPoints+c.eyes+POINTS[card.rank];
  return [c.knowledge.targetThresholds.win,121-c.knowledge.targetThresholds.opponentSchneiderFree].some(target => c.knowledge.teamPoints < target && points >= target);
}
function t11Options(c: Context): Card[] {
  if (!c.free || !remembers(c.level)) return [];
  const singles = singletonDiscards(c);
  if (!singles.length) return [];
  const winners = c.trumps.filter(c.wins);
  const safeWin = winners.some(c.safe);
  const winningEyes = Math.max(0,...winners.map(card => c.eyes+POINTS[card.rank]));
  if (safeWin && (c.eyes >= 10 || c.knowledge.teamPoints+winningEyes >= c.knowledge.targetThresholds.win || winners.some(card => decisiveWin(c,card)))) return [];
  if (c.safePartner) return singles;
  const enemySafe = !c.allyWinning && !!c.winningCard && c.safe(c.winningCard) && !winners.length;
  if (enemySafe || c.view.hand.filter(full).length < 3) return [];
  const lastHigh = c.trumps.length === 1 && c.knowledge.remainingTrumps.slice(0,4).some(card => card.id === c.trumps[0].id);
  return c.eyes < 5 || c.eyes < 15 && lastHigh || c.allyWinning ? singles : [];
}
/** Hard restrictions are applied before every random/error/simulation choice. */
export function ruleCandidates(view: GameView, difficulty: AiDifficulty, random: () => number = Math.random, overrides?: Partial<BotConfig>): { cards: Card[]; rules: ReasonCode[] } {
  const level = botLevel(difficulty), config = botConfig(overrides ?? view.rules.bot);
  const c = context(view,level,config);
  let cards = [...c.legal]; const rules: ReasonCode[] = [];
  const restrict = (options: Card[], code: ReasonCode) => { if (options.length) { cards = options; rules.push(code); } };
  if (!cards.length) throw new Error('Keine gültige Karte für den Bot.');
  if (['ramsch','bettel','sie'].includes(c.contract.kind)) return {cards,rules:['EXISTING']};
  if (view.trick.length) {
    const partnerTrump = c.allyWinning && c.winningCard && isTrump(c.winningCard,c.contract);
    if (partnerTrump) {
      const directlyBefore = c.winner === (view.seat+3)%4 && view.trick.at(-1)?.seat === c.winner;
      const order = c.trumpOrder;
      let index = order.findIndex(card => card.id === c.winningCard!.id);
      let higher = order[index-1], lower = order[index+1];
      let neighbors = higher && lower && cards.some(card => card.id === higher.id) && cards.some(card => card.id === lower.id);
      if (!neighbors && remembers(level) && random() < config.deducedR6[level]) {
        // The partner's card is already public and therefore absent from
        // remainingTrumps; retain it as the pivot for deduced adjacency.
        const remaining = [...c.knowledge.remainingTrumps,c.winningCard!].sort((a,b) => cardStrength(b,c.contract)-cardStrength(a,c.contract));
        index = remaining.findIndex(card => card.id === c.winningCard!.id);
        higher = remaining[index-1]; lower = remaining[index+1];
        neighbors = higher && lower && cards.some(card => card.id === higher.id) && cards.some(card => card.id === lower.id);
      }
      // The two-card hand is valid under every proposed interpretation of "all cards".
      // Do not extend R6 to hands with additional plain cards before clarification.
      if (level !== 'beginner' && directlyBefore && neighbors && view.hand.every(card => card.id === higher.id || card.id === lower.id)) {
        restrict(cards.filter(card => card.id === higher.id),'R6'); return {cards,rules};
      }
      const ownTrumps = view.hand.filter(card => isTrump(card,c.contract));
      const highSix = remembers(level) ? c.knowledge.remainingTrumps.slice(0,6) : order.slice(0,6);
      const ownHigh = ownTrumps.filter(card => highSix.some(high => high.id === card.id));
      const overtake = cards.filter(card => isTrump(card,c.contract) && c.wins(card) && order.findIndex(other => other.id === c.winningCard!.id)-order.findIndex(other => other.id === card.id) > 1);
      const r4a = directlyBefore && ownTrumps.length >= config.r4aMinTrumps && ownHigh.length >= (view.seat === view.declarer ? 2 : 1) ? overtake.filter(card => ownTrumps.length-1 >= config.r4aRemainingTrumps && ownHigh.filter(high => high.id !== card.id).length >= config.r4aRemainingHigh) : [];
      const nonOvertake = cards.filter(card => !isTrump(card,c.contract) || !c.wins(card));
      restrict([...nonOvertake,...r4a],r4a.length ? 'R4a' : 'R4');
    }
    // R6b: sacrifice Schmier only if both retained high trumps guarantee future tricks.
    if (!c.allyWinning && c.winningCard && c.safe(c.winningCard) && !cards.some(c.wins) && remembers(level) && random() < config.r6b[level]) {
      const trumps = cards.filter(card => isTrump(card,c.contract));
      const high = trumps.filter(card => court(card)); const smear = trumps.filter(full);
      if (high.length >= 2 && smear.length) {
        const unseenHigher = c.knowledge.remainingTrumps.filter(card => card.id !== c.winningCard!.id && !view.hand.some(own => own.id === card.id));
        const bothSafe = high.every(card => !unseenHigher.some(other => cardStrength(other,c.contract) > cardStrength(card,c.contract)));
        restrict(bothSafe ? smear : high,'R6b');
      }
    }
    if (c.safePartner) {
      // Preserve an unplayed plain ace unless its ten replaces it or it closes the game (R5 extension).
      const gifts = cards.filter(card => !(remembers(level) && card.rank === 'Ass' && !isTrump(card,c.contract) && !c.knowledge.playedSuits.has(card.suit) && !view.hand.some(other => other.suit === card.suit && other.rank === '10') && c.knowledge.teamPoints+c.eyes+11 < c.knowledge.targetThresholds.win && !decisiveFeed(c,card)));
      const options = gifts.length ? gifts : cards;
      const smear = options.filter(full);
      const highPoints = Math.max(...options.map(card => POINTS[card.rank]));
      const t11 = t11Options(c).filter(card => cards.some(other => other.id === card.id));
      // R4a allows a control play before R2; otherwise feed available points.
      const permittedOvertakes = rules.includes('R4a') ? cards.filter(c.wins) : [];
      const decisive = options.filter(card => decisiveFeed(c,card));
      restrict(decisive.length ? decisive : [... (smear.length ? smear : options.filter(card => POINTS[card.rank] === highPoints)),...t11,...permittedOvertakes],'R2');
    } else if (c.free) {
      const winners = cards.filter(card => isTrump(card,c.contract) && c.wins(card));
      const onlyValuable = winners.length === 1 && (remembers(level) ? c.knowledge.remainingTrumps : c.trumpOrder).slice(0,4).some(card => card.id === winners[0].id);
      const zeroException = c.eyes < 5 && onlyValuable ? cards.filter(card => !isTrump(card,c.contract)) : [];
      const t11 = t11Options(c).filter(card => cards.some(other => other.id === card.id));
      restrict([...winners,...zeroException,...t11],'R5');
    }
    const decisive = cards.filter(card => decisiveWin(c,card));
    if (decisive.length && !c.safePartner) restrict(decisive,'R5');
  } else {
    // T9 is the explicitly authorized memory exception for Amateur.
    const searchKnowledge = gameKnowledge(view);
    const opponents = [0,1,2,3].filter(seat => searchKnowledge.roles[seat] === 'SICHER_GEGENSPIELER');
    const bothVoid = !c.playing && opponents.length === 2 && opponents.every(seat => seat === view.seat ? !view.hand.some(card => isTrump(card,c.contract)) : searchKnowledge.voids[seat].has('Trumpf'));
    const noSearch = bothVoid && level !== 'beginner' && random() < config.reliability[level].T9;
    const search = !c.playing && c.contract.kind === 'rufspiel' && !view.partnerRevealed && !view.escaped && !noSearch ? c.plain.filter(card => card.suit === c.contract.suit) : [];
    if (search.length) restrict(search,'R3');
    else {
      const outsiders = [0,1,2,3].filter(seat => seat !== view.seat && !sameParty(c.knowledge,seat));
      const noEnemyTrump = remembers(level) && outsiders.every(seat => c.knowledge.voids[seat].has('Trumpf') || [...c.knowledge.constraints[seat]].every(id => !c.trumpOrder.some(card => card.id === id)));
      const probableFreePartner = exact(level) && c.playing && c.contract.kind === 'rufspiel' && c.knowledge.teamPoints < c.knowledge.targetThresholds.win ? c.plain.filter(card => {
        const possiblePartners = [0,1,2,3].filter(seat => seat !== view.seat && seat !== view.declarer && c.knowledge.voids[seat].has(card.suit) && !c.knowledge.voids[seat].has('Trumpf') && [...c.knowledge.constraints[seat]].some(id => c.trumpOrder.some(trump => trump.id === id)));
        return possiblePartners.reduce((sum,seat) => sum + (sameParty(c.knowledge,seat) ? 1 : c.knowledge.probabilities[seat].get(`${c.contract.suit}-${c.contract.calledRank ?? 'Ass'}`) ?? 0),0) >= .6;
      }) : [];
      if (c.playing && c.trumps.length && !noEnemyTrump) restrict([...c.trumps,...probableFreePartner],'R1');
      else if ((!c.playing || noEnemyTrump) && c.plain.length) {
        const alternatives = noSearch ? c.plain.filter(card => card.suit !== c.contract.suit) : [];
        restrict(alternatives.length ? alternatives : c.plain,noSearch ? 'T9' : 'R1');
      }
    }
  }
  return {cards,rules};
}

type TipMatch = { code: TipCode; cards: Card[]; weight: number; deduced?: boolean };
/** Situation-specific tips score only the hard-rule candidate set. */
function tipMatches(c: Context, cards: Card[]): TipMatch[] {
  const matches: TipMatch[] = [];
  const add = (code: TipCode, options: Card[], weight: number, deduced = false) => { const allowed = options.filter(card => cards.some(candidate => candidate.id === card.id)); if (allowed.length && allowed.length < cards.length) matches.push({code,cards:allowed,weight,deduced}); };
  const trumpCards = cards.filter(card => isTrump(card,c.contract));
  const enemiesBehind = c.behind.filter(seat => !sameParty(c.knowledge,seat));
  const highOrder = remembers(c.level) ? c.knowledge.remainingTrumps : c.trumpOrder;
  const canWin = cards.filter(c.wins);
  if (c.view.trick.length) {
    if (c.free && enemiesBehind.some(seat => !remembers(c.level) || !c.knowledge.voids[seat].has('Trumpf'))) add('T1',trumpCards.filter(card => card.rank === 'Unter' && c.wins(card)),90);
    if (exact(c.level) && c.knowledge.teamsKnown && canWin.some(c.safe)) {
      const meaningful = canWin.filter(card => c.safe(card) && [c.knowledge.targetThresholds.win,c.knowledge.targetThresholds.schneiderFree,121-c.knowledge.targetThresholds.opponentSchneiderFree].some(target => c.knowledge.teamPoints < target && c.knowledge.teamPoints+c.eyes+POINTS[card.rank] >= target));
      add('T1',meaningful,1000);
    }
    if (!c.playing && isTrump(c.view.trick[0].card,c.contract) && c.behind.some(seat => sameParty(c.knowledge,seat) || c.knowledge.roles[seat] === 'UNBEKANNT')) add('T3b',cards.filter(card => !c.wins(card)),85);
    if (remembers(c.level) && c.view.seat === c.view.declarer && category(c.view.trick[0].card,c.view) === c.contract.suit && c.view.hand.filter(card => category(card,c.view) === c.contract.suit).length > 1 && c.knowledge.presumablyVoidInCalledSuit.some((flag,seat) => flag && c.knowledge.roles[seat] === 'SICHER_GEGENSPIELER')) add('T3c',[leastPoints(cards)],94);
    const ledSuit = c.view.trick[0].card.suit;
    const suitCards = c.view.hand.filter(card => !isTrump(card,c.contract) && card.suit === ledSuit);
    if (!isTrump(c.view.trick[0].card,c.contract) && suitCards.length >= 3 && enemiesBehind.some(seat => !remembers(c.level) || !c.knowledge.voids[seat].has('Trumpf'))) add('T4',cards.filter(card => POINTS[card.rank] === Math.min(...cards.map(other => POINTS[other.rank]))),70);
    const loneFull = c.view.hand.filter(full).length === 1;
    if (c.allyWinning) {
      const safeFeed = cards.filter(card => full(card) && (c.safePartner || !loneFull && !c.knowledge.voids.some((voids,seat) => enemiesBehind.includes(seat) && voids.has(ledSuit))) && (card.rank !== 'Ass' || isTrump(card,c.contract) || !remembers(c.level) || c.knowledge.playedSuits.has(card.suit) || c.view.hand.some(other => other.suit === card.suit && other.rank === '10') || c.knowledge.teamPoints+c.eyes+11 >= c.knowledge.targetThresholds.win || c.contract.kind !== 'rufspiel' && c.view.hand.filter(other => other.suit === card.suit).length >= 3));
      add('T5',safeFeed,78);
    } else if (loneFull) add('T5',cards.filter(card => !full(card)),50);
    // Equivalent adjacent ranks: owned intervening cards cannot be played by an opponent.
    for (const group of ['Trumpf',...SUITS]) {
      const ordered = group === 'Trumpf' ? c.trumpOrder : createDeck().filter(card => card.suit === group && !isTrump(card,c.contract)).sort((a,b) => cardStrength(b,c.contract)-cardStrength(a,c.contract));
      const eligible = cards.filter(card => category(card,c.view) === group);
      for (let a=0;a<eligible.length;a++) for (let b=a+1;b<eligible.length;b++) {
        const first = ordered.findIndex(card => card.id === eligible[a].id), second = ordered.findIndex(card => card.id === eligible[b].id);
        const between = ordered.slice(Math.min(first,second)+1,Math.max(first,second));
        const direct = !between.length;
        if (!direct && (!remembers(c.level) || !between.every(card => c.knowledge.playedCards.some(other => other.id === card.id) || c.view.hand.some(other => other.id === card.id)))) continue;
        if (c.wins(eligible[a]) !== c.wins(eligible[b])) continue;
        const pair = [eligible[a],eligible[b]];
        const chosen = [...pair].sort((x,y) => (c.allyWinning ? -1 : 1)*(POINTS[x.rank]-POINTS[y.rank]))[0];
        add('T6',[chosen],80,!direct);
      }
    }
    if (!canWin.length && trumpCards.length >= 2) {
      const others = highOrder.filter(card => !c.view.hand.some(own => own.id === card.id) && card.id !== c.winningCard?.id);
      const futureSafe = trumpCards.filter(card => !others.some(other => cardStrength(other,c.contract) > cardStrength(card,c.contract)));
      if (futureSafe.length) add('T7',trumpCards.filter(card => !futureSafe.some(safe => safe.id === card.id)),130);
      else if (trumpCards.length === 2 && trumpCards.some(full) && trumpCards.some(court)) add('T7',trumpCards.filter(court),120);
      else if (trumpCards.length >= 3) {
        const high = strongest(trumpCards,c.contract);
        const others = trumpCards.filter(card => card.id !== high.id);
        add('T7',others.filter(card => POINTS[card.rank] === (c.allyWinning ? Math.max : Math.min)(...others.map(other => POINTS[other.rank]))),110);
      }
    }
    if (c.allyWinning && c.winningCard && isTrump(c.winningCard,c.contract) && !c.safePartner && !canWin.length && trumpCards.length >= 2) add('T7',[...trumpCards].sort((a,b) => cardStrength(a,c.contract)-cardStrength(b,c.contract)).slice(0,1),100);
    if (exact(c.level) && c.safePartner) add('T7',cards.filter(card => POINTS[card.rank] === Math.max(...cards.map(other => POINTS[other.rank]))),125);
    if (canWin.length && !c.allyWinning) {
      const safe = canWin.filter(c.safe);
      if (c.eyes >= 10 && safe.length) add('T7',[...safe].sort((a,b) => cardStrength(a,c.contract)-cardStrength(b,c.contract)).slice(0,1),140);
    }
    const frees = t11Options(c); add('T11',frees, c.safePartner ? 150 : 105);
    if (canWin.length && !c.safePartner) add('T10',canWin, c.playing ? 65 : 45);
    const usefulPoints = c.view.hand.filter(card => POINTS[card.rank] >= 4).length;
    const decisive = exact(c.level) && c.knowledge.teamsKnown && canWin.some(card => c.knowledge.teamPoints+c.eyes+POINTS[card.rank] >= c.knowledge.targetThresholds.win);
    if (usefulPoints > 3 || c.safePartner || decisive) add('T8',cards.filter(card => c.eyes+POINTS[card.rank] >= 5 && c.eyes+POINTS[card.rank] <= 12),20);
  } else {
    const search = c.contract.kind === 'rufspiel' && !c.playing && !c.view.partnerRevealed && cards.some(card => category(card,c.view) === c.contract.suit);
    if (search) {
      const suitCards = cards.filter(card => category(card,c.view) === c.contract.suit);
      const discarded = c.knowledge.discards.some(discard => discard.seat === c.view.declarer && discard.suit === c.contract.suit);
      const saveOnlyFull = c.view.hand.filter(full).length === 1 && suitCards.some(full);
      const high = [...suitCards].sort((a,b) => POINTS[b.rank]-POINTS[a.rank])[0];
      add('T4',suitCards.length >= 4 && !discarded || !saveOnlyFull ? [high] : suitCards.filter(card => !full(card)),95);
    }
    if (!c.playing && c.contract.kind === 'rufspiel' && !c.view.hand.some(card => category(card,c.view) === c.contract.suit) && c.trumps.length) add('T3a',cards.filter(card => !isTrump(card,c.contract)),60);
    const ownPartner = c.playing && c.view.seat !== c.view.declarer;
    if (ownPartner) {
      const declarerLast = (c.view.declarer-c.view.seat+4)%4 === 3;
      const high = trumpCards.filter(card => highOrder.slice(0,declarerLast ? 6 : 4).some(other => other.id === card.id));
      if (high.length) add('T2',[strongest(high,c.contract)],50);
      if (remembers(c.level)) {
        const ownLeads = c.view.tricks.filter(trick => trick.plays[0]?.seat === c.view.seat && isTrump(trick.plays[0].card,c.contract));
        const last = ownLeads.at(-1)?.plays[0].card;
        const highest = highOrder.find(card => c.view.hand.some(own => own.id === card.id));
        if (ownLeads.length%2 === 1 && last && (c.trumps.length === 2 || c.trumps.length === 3) && highest?.id !== highOrder[0]?.id) add('T2',trumpCards.filter(card => !court(card)),75);
      }
      const lowUnter = trumpCards.filter(card => card.rank === 'Unter' && !highOrder.slice(0,6).some(high => high.id === card.id));
      if (lowUnter.length === 1 && trumpCards.some(card => !court(card))) add('T2',trumpCards.filter(card => !court(card)),72);
    }
    if (trumpCards.length >= 2 && highOrder.slice(0,2).every(card => trumpCards.some(own => own.id === card.id))) {
      const allies = c.behind.filter(seat => sameParty(c.knowledge,seat));
      const solo = c.contract.kind !== 'rufspiel' && c.playing;
      const useSecond = solo || allies.length === 1 && allies[0] === (c.view.seat+3)%4;
      add('T12',[highOrder[useSecond ? 1 : 0]],100);
    } else if (trumpCards.length) {
      const initialTrumpCount = c.trumps.length + (remembers(c.level) ? c.view.tricks.flatMap(trick => trick.plays).filter(play => play.seat === c.view.seat && isTrump(play.card,c.contract)).length : 0);
      const high = c.trumps.filter(card => card.rank === 'Ober').length;
      const courts = c.trumps.filter(court).length;
      const ownLeads = remembers(c.level) ? c.view.tricks.filter(trick => trick.plays[0]?.seat === c.view.seat && isTrump(trick.plays[0].card,c.contract)).length : 0;
      if (initialTrumpCount >= c.config.manyTrumps) add('T12',[(high >= c.config.manyHigh && courts >= c.config.manyCourt && ownLeads%2 === 0 ? strongest(trumpCards,c.contract) : [...trumpCards].sort((a,b) => cardStrength(a,c.contract)-cardStrength(b,c.contract))[0])],35);
    }
  }
  return matches;
}

export function chooseCard(view: GameView, difficulty: AiDifficulty = 'advanced', random: () => number = Math.random, overrides?: Partial<BotConfig>): CardDecision {
  const level = botLevel(difficulty), config = botConfig(overrides ?? view.rules.bot);
  const {cards,rules} = ruleCandidates(view,level,random,config);
  const c = context(view,level,config);
  const matches = tipMatches(c,cards);
  const debugInfo: CardDecision['debugInfo'] = {candidates:cards.map(card => card.id),rules,tips:matches.map(match => match.code)};
  let selected = pick(cards,random), reasonCode: ReasonCode = rules.at(-1) ?? 'RANDOM';
  if (['ramsch','bettel'].includes(c.contract.kind)) {
    const losing = c.view.trick.length ? cards.filter(card => !c.wins(card)) : cards.filter(card => !isTrump(card,c.contract));
    selected = leastPoints(losing.length ? losing : cards); reasonCode = 'EXISTING';
  } else if (level === 'legend' && cards.length > 1) {
    const simulated = simulateCard(c,cards,matches,random); selected = simulated.card; debugInfo.simulations = simulated.iterations; reasonCode = 'SIMULATION';
  } else if (level !== 'beginner' && matches.length) {
    if (level === 'pro') {
      // One global error roll; guaranteed T7 remains enabled even on an error.
      const errorRoll = random();
      const active = matches.filter(match => match.code === 'T7' || errorRoll >= Math.max(config.proError, 1-config.reliability.pro[match.code]));
      if (active.length) {
        selected = [...cards].sort((a,b) => active.reduce((sum,match) => sum + match.weight*(Number(match.cards.some(card => card.id === b.id))-Number(match.cards.some(card => card.id === a.id))),0))[0];
        reasonCode = [...active].sort((a,b) => b.weight-a.weight).find(match => match.cards.some(card => card.id === selected.id))?.code ?? reasonCode;
      } else reasonCode = 'RANDOM';
    } else {
      const match = [...matches].sort((a,b) => b.weight-a.weight)[0];
      const chance = match.code === 'T6' && match.deduced ? level === 'advanced' ? .6 : 0 : config.reliability[level][match.code];
      if (random() < chance) { selected = pick(match.cards,random); reasonCode = match.code; }
      else reasonCode = 'RANDOM';
    }
  }
  return {card:selected,reasonCode,level,debugInfo};
}

/** Draw a complete feasible information set with capacity + void + called-card constraints. */
export function sampleHands(view: GameView, random: () => number): Card[][] | null {
  const k = gameKnowledge(view);
  const seen = new Set([...k.playedCards,...view.hand].map(card => card.id));
  const unseen = createDeck().filter(card => !seen.has(card.id));
  const hands: Card[][] = [[],[],[],[]]; hands[view.seat] = [...view.hand];
  const seats = [0,1,2,3].filter(seat => seat !== view.seat);
  if (unseen.length !== seats.reduce((sum,seat) => sum+view.counts[seat],0)) return null;
  const ordered = unseen.map(card => ({card,tie:random(),owners:seats.filter(seat => k.constraints[seat].has(card.id))})).sort((a,b) => a.owners.length-b.owners.length || a.tie-b.tie);
  let nodes = 0;
  const respectsCall = (): boolean => {
    if (view.contract?.kind !== 'rufspiel') return true;
    const publicHistory = view.tricks.flatMap(trick => trick.plays);
    const declarerCards = [...hands[view.declarer],...publicHistory.filter(play => play.seat === view.declarer).map(play => play.card),...view.trick.filter(play => play.seat === view.declarer).map(play => play.card)];
    if (!declarerCards.some(card => card.suit === view.contract!.suit && !isTrump(card,view.contract!))) return false;
    if (view.escaped && k.partner !== null) {
      const escapeIndex = view.tricks.findIndex(trick => trick.plays[0]?.seat === k.partner && category(trick.plays[0].card,view) === view.contract!.suit && trick.plays[0].card.rank !== (view.contract!.calledRank ?? 'Ass'));
      if (escapeIndex >= 0) {
        const laterCards = view.tricks.slice(escapeIndex).flatMap(trick => trick.plays).filter(play => play.seat === k.partner).map(play => play.card);
        const cardsAtEscape = [...hands[k.partner],...laterCards,...view.trick.filter(play => play.seat === k.partner && !laterCards.some(card => card.id === play.card.id)).map(play => play.card)];
        if (cardsAtEscape.filter(card => category(card,view) === view.contract!.suit).length < 4) return false;
      }
    }
    return true;
  };
  const assign = (index: number): boolean => {
    if (++nodes > 4000) return false;
    if (index === ordered.length) return respectsCall();
    const {card,owners} = ordered[index];
    const options = owners.filter(seat => hands[seat].length < view.counts[seat]).map(seat => ({seat,tie:random()})).sort((a,b) => a.tie-b.tie);
    for (const {seat} of options) {
      hands[seat].push(card);
      const feasible = seats.every(other => ordered.slice(index+1).filter(entry => entry.owners.includes(other)).length >= view.counts[other]-hands[other].length);
      if (feasible && assign(index+1)) return true;
      hands[seat].pop();
    }
    return false;
  };
  return assign(0) ? hands : null;
}
function sampledState(view: GameView, hands: Card[][]): GameState {
  const k = gameKnowledge(view);
  const histories = [...view.tricks.flatMap(trick => trick.plays)];
  if (view.trick.length && !view.tricks.some(trick => trick.plays[0]?.card.id === view.trick[0]?.card.id)) histories.push(...view.trick);
  const initialHands = hands.map((hand,seat) => [...hand,...histories.filter(play => play.seat === seat).map(play => play.card)]);
  const partner = view.contract?.kind === 'rufspiel' ? k.partner ?? initialHands.findIndex(hand => hand.some(card => card.suit === view.contract!.suit && card.rank === (view.contract!.calledRank ?? 'Ass'))) : null;
  return { ...view,hands,pendingHands:[[],[],[],[]],initialHands,partner:partner === -1 ? null : partner,announcements:[],history:[],result:null };
}
/** Rollout policies receive only their own cards and the public history. */
function rolloutToEnd(initial: GameState, config: BotConfig, random: () => number): GameState {
  let state = initial, steps = 0;
  const contract = state.contract!;
  while (state.phase !== 'finished' && steps++ < 64) {
    if (state.phase === 'trick') { state = applyAction(state,state.turn,{type:'collect'},random); continue; }
    const ownView = viewFor(state,state.turn);
    const allowed = ruleCandidates(ownView,'advanced',random,config).cards;
    const k = gameKnowledge(ownView);
    const winner = ownView.trick.length ? trickWinner(ownView.trick,contract) : null;
    const winning = allowed.filter(card => ownView.trick.length && trickWinner([...ownView.trick,{seat:ownView.seat,card}],contract) === ownView.seat);
    const feed = winner !== null && sameParty(k,winner);
    const candidates = !feed && publicPoints(ownView.trick) >= 10 && winning.length ? winning : allowed;
    const chosen = [...candidates].sort((a,b) => feed ? POINTS[b.rank]-POINTS[a.rank] : POINTS[a.rank]-POINTS[b.rank] || cardStrength(a,contract)-cardStrength(b,contract))[0];
    state = applyAction(state,state.turn,{type:'play',cardId:chosen.id},random);
  }
  return state;
}
/** Root information-set MCTS: UCB exploration, constrained determinizations, complete-round rollouts. */
function simulateCard(c: Context, cards: Card[], priors: TipMatch[], random: () => number): {card:Card;iterations:number} {
  const visits = cards.map(() => 0), scores = cards.map(() => 0);
  const start = Date.now(); let iterations = 0;
  for (; iterations < c.config.legendIterations; iterations++) {
    if (iterations >= cards.length && Date.now()-start >= c.config.legendTimeMs) break;
    const hands = sampleHands(c.view,random); if (!hands) break;
    const index = visits.findIndex(count => count === 0);
    const selected = index >= 0 ? index : cards.map((card,i) => ({i,value:scores[i]/visits[i] + Math.sqrt(2*Math.log(iterations+1)/visits[i]) + priors.reduce((sum,match) => sum+(match.cards.some(other => other.id === card.id) ? match.weight/1000 : 0),0)/(visits[i]+1)})).sort((a,b) => b.value-a.value)[0].i;
    let state = sampledState(c.view,hands);
    try {
      state = applyAction(state,state.turn,{type:'play',cardId:cards[selected].id},random);
      state = rolloutToEnd(state,c.config,random);
      if (!state.result) break;
      const ownPlaying = state.result.team.includes(c.view.seat);
      const win = ownPlaying === state.result.declarerWon;
      const teamEyes = ownPlaying ? state.result.declarerPoints : state.result.opponentPoints;
      const outcome = Number(win)*2-1 + (teamEyes-60)/180 + (state.result.schneider ? (win ? .15 : -.15) : 0) + (state.result.schwarz ? (win ? .2 : -.2) : 0);
      scores[selected] += outcome; visits[selected]++;
    } catch { break; /* Inconsistent historical saves must not cause an illegal real move. */ }
  }
  const ranked = cards.map((card,index) => ({card,score:visits[index] ? scores[index]/visits[index] : -Infinity})).sort((a,b) => b.score-a.score);
  const priorScores = cards.map(card => ({card,score:priors.reduce((sum,match) => sum+(match.cards.some(other => other.id === card.id) ? match.weight : 0),0)}));
  const bestPrior = Math.max(...priorScores.map(entry => entry.score));
  const priorChoice = pick(priorScores.filter(entry => entry.score === bestPrior),random).card;
  return {card:visits.some(count => count === 0) ? priorChoice : ranked[0].score > -Infinity ? ranked[0].card : pick(cards,random),iterations};
}

export type HandEvaluation = { trumpCount:number; highTrumps:number; bremser:boolean; trumpSchmier:number; suitsWithoutAce:number; topTrumpRun:number; aces:number; voids:number; lonelyTens:number; exclusions:number; eligible:boolean; expectedGain:number };
/** A1: shortest callable suit, then the highest point card in that suit. */
export function preferredCall(hand: Card[], contracts: Contract[]): Contract | undefined {
  return contracts.filter(contract => contract.kind === 'rufspiel').sort((a,b) => {
    const suitCards = (contract: Contract) => hand.filter(card => !isTrump(card,contract) && card.suit === contract.suit);
    const first = suitCards(a), second = suitCards(b);
    return first.length-second.length || Math.max(...second.map(card => POINTS[card.rank]))-Math.max(...first.map(card => POINTS[card.rank]));
  })[0];
}
export function sureTout(hand: Card[], contract: Contract, position: number): boolean {
  const order = gameDefinition(contract).trumps;
  const trumps = hand.filter(card => isTrump(card,contract));
  const plain = hand.filter(card => !isTrump(card,contract));
  // Guarantee all trump rounds regardless of any feasible opposing allocation.
  const control = trumps.length > 0 && order.slice(0,trumps.length).every(card => trumps.some(own => own.id === card.id));
  return control && (plain.length === 0 || position === 1 && plain.length === 1 && plain[0].rank === 'Ass');
}
export function evaluateHand(hand: Card[], contract: Contract, position = 1, config: BotConfig = botConfig(), tariffs?: GameRules): HandEvaluation {
  const definition = gameDefinition(contract);
  const trumps = hand.filter(card => isTrump(card,contract)), plain = hand.filter(card => !isTrump(card,contract));
  const trumpCount = trumps.length;
  const highTrumps = trumps.filter(card => contract.kind === 'wenz' || contract.kind === 'farbwenz' ? card.rank === 'Unter' : card.rank === 'Ober').length;
  const bremser = hand.some(card => card.rank === 'Ober' && ['Eichel','Gras','Herz'].includes(card.suit));
  const trumpSchmier = trumps.filter(full).length;
  const plainSuits = SUITS.filter(suit => createDeck().some(card => card.suit === suit && !isTrump(card,contract)));
  const suitsWithoutAce = plainSuits.filter(suit => plain.some(card => card.suit === suit) && !plain.some(card => card.suit === suit && card.rank === 'Ass')).length;
  const missingAces = suitsWithoutAce;
  const aces = plain.filter(card => card.rank === 'Ass' && !(contract.kind === 'rufspiel' && card.suit === contract.suit)).length;
  const voids = plainSuits.filter(suit => !plain.some(card => card.suit === suit)).length;
  const lonelyTens = plain.filter(card => card.rank === '10' && !plain.some(other => other.suit === card.suit && other.rank === 'Ass')).length;
  let topTrumpRun = 0;
  const withTop = trumps.some(card => card.id === definition.trumps[0]?.id);
  for (const card of definition.trumps) { if (trumps.some(own => own.id === card.id) !== withTop) break; topTrumpRun += withTop ? 1 : -1; }
  const rankTrump = contract.kind === 'geier' || contract.kind === 'farbgeier' ? 'Ober' : 'Unter';
  const twoRankTrumps = hand.filter(card => card.rank === rankTrump).length === 2 && hand.some(card => card.rank === rankTrump && card.suit !== 'Schellen');
  const exclusions = Number(missingAces >= 2) + Number(contract.kind === 'farbwenz' && trumpSchmier === 0) + Number(twoRankTrumps) + Number(position === 1 || position === 4);
  let eligible = false;
  if (contract.kind === 'rufspiel') eligible = bremser ? trumpCount >= config.sauspielWithBremserMin && trumps.filter(court).length >= 2 : trumpCount >= config.sauspielWithoutBremserMin || trumpCount === 5 && trumps.some(card => card.id === 'Schellen-Ober' || card.id === 'Eichel-Unter');
  else if (contract.kind === 'solo') eligible = trumpCount === 8 || trumpCount >= config.soloMinTrumps && highTrumps >= config.soloMinOber && suitsWithoutAce <= 1;
  else if (contract.kind === 'farbwenz') eligible = trumpCount >= config.farbwenzMinTrumps && highTrumps >= config.farbwenzMinUnter && trumpSchmier >= 1 && (trumpCount >= 7 || definition.trumps.slice(0,trumpCount === 5 ? 2 : 3).some(card => trumps.some(own => own.id === card.id))) && exclusions < 2;
  else if (contract.kind === 'wenz' || contract.kind === 'geier') {
    const twoWithAces = trumpCount >= 2 && (aces >= 3 || aces >= 2 && voids >= 2);
    eligible = voids <= 2 && (twoWithAces || exclusions < 2 && (trumpCount === 4 || definition.trumps.slice(0,3).every(card => trumps.some(own => own.id === card.id)) && aces >= 1));
  }
  else if (contract.kind === 'sie') eligible = hand.length === 8 && hand.every(court);
  else if (contract.kind === 'bettel') eligible = hand.filter(card => POINTS[card.rank] === 0).length >= 5;
  else if (contract.kind === 'farbgeier') {
    const topCount = (limit: number) => definition.trumps.slice(0,limit).filter(card => trumps.some(own => own.id === card.id)).length;
    const schmieren = trumps.filter(full).reduce((sum,card) => sum+POINTS[card.rank],0);
    eligible = topCount(6) >= 4 && aces >= 1 && schmieren >= 11 || topCount(8) >= 5 && trumpCount >= 6 && schmieren >= 10;
  } // Existing variant is outside the supplied A4 rules.
  if (contract.tout) eligible = eligible && sureTout(hand,contract,position);
  const power = trumpCount*1.3 + highTrumps*1.5 + Math.max(0,topTrumpRun)*.7 - Math.max(0,-topTrumpRun)*.35 + aces*1.5 + voids*.4 - lonelyTens*.5 - suitsWithoutAce*.6 + (position === 1 ? Math.max(0,topTrumpRun)*.15 : position === 4 ? aces*.2 : 0);
  const probability = Math.max(.05,Math.min(.99,1/(1+Math.exp(-(power-(contract.kind === 'rufspiel' ? 8 : 12))/2))));
  const minimum = contract.kind === 'wenz' || contract.kind === 'geier' ? tariffs?.laufendeAbWenzGeier ?? definition.laufendeMin : tariffs?.laufendeAbFarbspiel ?? definition.laufendeMin;
  const countedRun = tariffs?.laufendeAktiv === false ? 0 : Math.abs(topTrumpRun);
  const value = (baseGameValue(contract, tariffs) + (countedRun >= minimum ? countedRun*(tariffs?.laufendeValue ?? 10) : 0))*(contract.kind === 'sie' ? 4 : contract.tout ? 2 : 1);
  return {trumpCount,highTrumps,bremser,trumpSchmier,suitsWithoutAce,topTrumpRun,aces,voids,lonelyTens,exclusions,eligible,expectedGain:probability*value};
}
function contractChoices(view: GameView, level: BotLevel, config: BotConfig): Contract[] {
  const position = (view.seat-(view.dealer+1)+4)%4+1;
  const call = preferredCall(view.hand,view.contracts);
  return view.contracts.filter(contract => contract.kind !== 'rufspiel' || contract.suit === call?.suit && (contract.calledRank ?? 'Ass') === (call?.calledRank ?? 'Ass')).filter(contract => {
    const e = evaluateHand(view.hand,contract,position,config,view.rules);
    if (!e.eligible) return false;
    if (level === 'beginner' && contract.kind !== 'rufspiel' && contract.kind !== 'sie' && !(e.trumpCount === 8 || e.topTrumpRun >= 4 && e.aces >= 2)) return false;
    if (level === 'amateur' && !['rufspiel','solo','sie'].includes(contract.kind)) return false;
    return true;
  }).sort((a,b) => evaluateHand(view.hand,b,position,config,view.rules).expectedGain-evaluateHand(view.hand,a,position,config,view.rules).expectedGain || contractLevel(b)-contractLevel(a));
}
export function shouldSpritz(view: GameView, level: BotLevel, random: () => number, config = botConfig(view.rules.bot)): boolean {
  if (!view.canDouble || !view.contract || level === 'beginner') return false;
  const contract = view.contract;
  const trumps = view.hand.filter(card => isTrump(card,contract));
  const courts = trumps.filter(court).length, ober = trumps.filter(card => card.rank === 'Ober').length;
  const high = gameDefinition(contract).trumps.slice(0,3).some(card => trumps.some(own => own.id === card.id));
  const voids = SUITS.filter(suit => createDeck().some(card => card.suit === suit && !isTrump(card,contract)) && !view.hand.some(card => card.suit === suit && !isTrump(card,contract))).length;
  const aces = view.hand.filter(card => card.rank === 'Ass' && !isTrump(card,contract)).length;
  const re = (view.spritzCount ?? 0)%2 === 1;
  if (contract.kind === 'wenz' || contract.kind === 'geier') {
    const first = view.tricks[0];
    const knowledge = gameKnowledge(view);
    const top = gameDefinition(contract).trumps;
    const strength = trumps.some(card => card.id === top[0].id) || trumps.length >= 2 && trumps.some(card => top.slice(0,2).some(high => high.id === card.id));
    return !!first && first.points > 30 && sameParty(knowledge,first.winner) && strength && (level !== 'amateur' || random() < config.amateurSpritzChance);
  }
  const eligible = re ? (trumps.length >= 5 && (ober >= 3 || ober >= 2 && (voids > 0 || aces > 0)) || trumps.length >= 6 && ober >= 1 && courts >= 2) : contract.kind === 'rufspiel' ? trumps.length >= 5 && ober >= 1 && courts >= 3 && voids >= 1 : trumps.length >= 5 && high && courts >= 3;
  if (!eligible) return false;
  if (level === 'amateur') return trumps.length >= 6 && ober >= 3 && random() < config.amateurSpritzChance;
  const exposesPartner = re && contract.kind === 'rufspiel' && !view.partnerRevealed && view.seat !== view.declarer;
  if (level === 'pro') return (trumps.length >= 6 || high && aces+voids >= 1) && (!exposesPartner || trumps.length >= 6 || gameDefinition(contract).trumps.slice(0,2).every(card => trumps.some(own => own.id === card.id)));
  if (level === 'legend') return simulateContract(view,contract,random,config,false).winChance > (re ? exposesPartner ? .77 : .72 : .7);
  return true;
}
/** A6: simulate compatible distributions through scoring, including actual tariffs. */
export function simulateContract(view: GameView, contract: Contract, random: () => number, config = botConfig(view.rules.bot), playing = true): { winChance: number; expectedGain: number; samples: number } {
  const provisional: GameView = playing
    ? { ...view,phase:'play',contract,declarer:view.seat,turn:(view.dealer+1)%4,partner:null,partnerRevealed:false,escaped:false,trick:[],tricks:[],points:[0,0,0,0],counts:[8,8,8,8] }
    : { ...view,phase:'play',contract };
  let wins = 0, gain = 0, samples = 0;
  const start = Date.now();
  for (let iteration=0;iteration<config.announcementSamples;iteration++) {
    if (iteration >= 1 && Date.now()-start >= config.legendTimeMs) break;
    const hands = sampleHands(provisional,random); if (!hands) break;
    try {
      const state = rolloutToEnd(sampledState(provisional,hands),config,random);
      if (!state.result) break;
      const won = state.result.team.includes(view.seat) === state.result.declarerWon;
      wins += Number(won); gain += won ? state.result.value : 0; samples++;
    } catch { break; }
  }
  return { winChance:samples ? wins/samples : .5,expectedGain:samples ? gain/samples : 0,samples };
}
function chooseBotAction(view: GameView, difficulty: AiDifficulty, random: () => number): Action {
  const level = botLevel(difficulty), config = botConfig(view.rules.bot);
  // First-packet criteria are settled; activating the separate second-Legen
  // criteria awaits clarification of whether "second" means player or deal stage.
  if (view.phase === 'legen') return {type:'legen',knock:shouldAiKnock(view.hand)};
  if (view.phase === 'trick') return {type:'collect'};
  if (view.phase === 'finished' || view.phase === 'redeal') return {type:'next'};
  if (view.phase === 'kontra' || view.phase === 're') return {type:'double',accept:shouldSpritz(view,level,random,config)};
  const choices = contractChoices(view,level,config);
  if (view.phase === 'intent') {
    const error = random() < config.announcementError[level];
    const hasPlainDeclaration = view.contracts.some(contract => !contract.tout);
    return {type:'intent',play:view.canIntent && hasPlainDeclaration && (error ? !choices.length : !!choices.length)};
  }
  if (view.phase === 'auction') {
    const levelChoice = view.bidLevels.find(bid => choices.some(contract => contractLevel(contract) >= bid));
    return {type:'bid',level:levelChoice ?? (view.canPassBid ? null : view.bidLevels[0])};
  }
  if (view.phase === 'declare') {
    let contract = choices[0];
    if (level === 'legend' && choices.length > 1) {
      contract = choices.map(choice => ({choice,gain:simulateContract(view,choice,random,config).expectedGain})).sort((a,b) => b.gain-a.gain || contractLevel(b.choice)-contractLevel(a.choice))[0].choice;
    }
    if (!contract || view.forcedCaller) {
      const call = preferredCall(view.hand,view.contracts);
      contract = (view.forcedCallerReason === 'legen' ? choices.find(choice => choice.kind !== 'rufspiel') : call) ?? call ?? view.contracts.find(choice => !choice.tout) ?? view.contracts[0];
    }
    if (!contract) throw new Error('Keine erlaubte Ansage.');
    // A1 remains binding even for weak or forced hands.
    if (contract.kind === 'rufspiel') contract = preferredCall(view.hand,view.contracts) ?? contract;
    return {type:'declare',contract};
  }
  const decision = chooseCard(view,level,random,config);
  return {type:'play',cardId:decision.card.id,reasonCode:decision.reasonCode,botLevel:decision.level,debugInfo:decision.debugInfo,...(shouldSpritz(view,level,random,config) ? {spritz:true} : {})};
}
/** Deterministic inspection for review/scenario tests; no hidden information. */
export function tipRecommendations(view: GameView, difficulty: AiDifficulty = 'advanced'): {code:TipCode;cards:string[]}[] {
  const level = botLevel(difficulty), config = botConfig(view.rules.bot);
  const {cards} = ruleCandidates(view,level,() => .4,config);
  return tipMatches(context(view,level,config),cards).map(match => ({code:match.code,cards:match.cards.map(card => card.id)}));
}

export function chooseDocumentAiAction(view: GameView, difficulty: AiDifficulty, random: () => number): Action {
  const action = chooseBotAction(view,difficulty,random);
  return { ...action,botLevel:botLevel(difficulty),reasonCode:action.reasonCode ?? (action.type === 'declare' && action.contract.kind === 'rufspiel' ? 'A1' : action.type === 'legen' ? 'EXISTING' : action.type === 'double' ? 'A5' : action.type === 'intent' || action.type === 'bid' || action.type === 'declare' ? 'A4' : 'ENGINE') };
}
