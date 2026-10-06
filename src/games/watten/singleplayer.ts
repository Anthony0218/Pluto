import { canPlayWattenCard, createDeck, determineTrickWinner, getNextPlayer, getPreviousPlayer, isAbhebenCard, RANKS, shuffleDeck, type PlayedCard, type Rank, type Suit, type WattenCard } from "../../utils/watten.ts";

export type SingleWattenState = {
  count: 3 | 4; dealer: number; caller: number; hands: WattenCard[][];
  targetScore: number;
  phase: "cut" | "declare" | "playing" | "trickPause" | "roundOver" | "matchOver";
  deck: WattenCard[]; cutCards: WattenCard[];
  trump: Suit | null; schlag: Rank | null; turn: number; trick: PlayedCard[];
  lastTrick: PlayedCard[]; lastTrickWinner: number | null; playedCardIds: string[];
  tricksWon: Record<string, number>; scores: number[]; round: number;
  roundValue: number; pendingBid: { side: string; value: number } | null;
  lastBidSide: string | null; winnerSide: string | null;
};
export function teamOf(playerId: string, count: 3 | 4, caller: number): string {
  const seat = Number(playerId);
  return count === 3 ? seat === caller ? "solo" : "team" : seat % 2 === 0 ? "team-a" : "team-b";
}
function botDeclaration(hand: WattenCard[]): { trump: Suit; schlag: Rank } {
  const suits: Suit[] = ["Eichel", "Gras", "Herz", "Schellen"];
  const trump = [...suits].sort((a, b) => hand.filter(card => card.suit === b).length - hand.filter(card => card.suit === a).length)[0];
  const schlag = [...RANKS].sort((a, b) => {
    const value = (rank: Rank) => hand.filter(card => card.rank === rank).length * 2 + hand.filter(card => card.rank === rank && card.suit === trump).length * 2;
    return value(b) - value(a);
  })[0];
  return { trump, schlag };
}
function dealAfterCut(state: SingleWattenState, cutIndex: number): SingleWattenState {
  if (state.phase !== "cut" || cutIndex < 1 || cutIndex >= state.deck.length) throw new Error("Invalid cut.");
  const cutter = getPreviousPlayer(state.dealer, state.count);
  const pile = state.deck.slice(0, cutIndex);
  const rest = state.deck.slice(cutIndex);
  const hands = Array.from({ length: state.count }, () => [] as WattenCard[]);
  const cutCards: WattenCard[] = [];
  while (pile.length && cutCards.length < 3 && isAbhebenCard(pile[pile.length - 1])) {
    const card = pile.pop()!;
    hands[cutCards.length % 2 === 0 ? cutter : state.dealer].push(card);
    cutCards.push(card);
  }
  const deck = [...rest, ...pile];
  // Match the existing hotseat packets: three cards, then two, beginning at Vorhand.
  for (const targetSize of [3, 5]) {
    for (let offset = 0; offset < state.count; offset++) {
      const seat = (state.caller + offset) % state.count;
      while (hands[seat].length < targetSize) hands[seat].push(deck.shift()!);
    }
  }
  const declaration = state.caller === 0 ? null : botDeclaration(hands[state.caller]);
  return { ...state, deck: [], cutCards, hands, phase: declaration ? "playing" : "declare",
    trump: declaration?.trump ?? null, schlag: declaration?.schlag ?? null, turn: state.caller };
}
export function createSingleWattenRound(count: 3 | 4, dealer = count - 1, scores = Array(count).fill(0) as number[], round = 1, targetScore = 15): SingleWattenState {
  const caller = getNextPlayer(dealer, count);
  const state: SingleWattenState = { count, dealer, caller, hands: Array.from({ length: count }, () => []), deck: shuffleDeck(createDeck()), cutCards: [], phase: "cut", targetScore: Math.max(4, Math.min(50, Math.trunc(targetScore))),
    trump: null, schlag: null, turn: caller, trick: [], lastTrick: [], lastTrickWinner: null, playedCardIds: [],
    tricksWon: Object.fromEntries(Array.from({ length: count }, (_, i) => [String(i), 0])), scores, round,
    roundValue: 2, pendingBid: null, lastBidSide: null, winnerSide: null };
  return state;
}
export function cutSingleWatten(state: SingleWattenState, cutIndex: number, seat = 0): SingleWattenState {
  if (getPreviousPlayer(state.dealer, state.count) !== seat) throw new Error("It is not your cut.");
  return dealAfterCut(state, cutIndex);
}
export function declareSingleWatten(state: SingleWattenState, trump: Suit, schlag: Rank): SingleWattenState {
  if (state.phase !== "declare" || state.caller !== 0) throw new Error("It is not your declaration.");
  return { ...state, trump, schlag, phase: "playing" };
}
export function canRaiseSingleWatten(state: SingleWattenState, seat: number): boolean {
  const side = teamOf(String(seat), state.count, state.caller);
  return state.phase === "playing" && state.turn === seat && !state.pendingBid && state.roundValue < 4
    && state.lastBidSide !== side && !state.scores.some((score, player) => teamOf(String(player), state.count, state.caller) === side && score >= state.targetScore - 2);
}
export function raiseSingleWatten(state: SingleWattenState, seat: number): SingleWattenState {
  if (!canRaiseSingleWatten(state, seat)) throw new Error("Cannot raise now.");
  return { ...state, pendingBid: { side: teamOf(String(seat), state.count, state.caller), value: state.roundValue + 1 } };
}
export function respondSingleWattenBid(state: SingleWattenState, seat: number, hold: boolean): SingleWattenState {
  const bid = state.pendingBid;
  if (state.phase !== "playing" || !bid || !Number.isInteger(seat) || seat < 0 || seat >= state.count ||
      teamOf(String(seat), state.count, state.caller) === bid.side) throw new Error("No bid for your side.");
  if (hold) return { ...state, roundValue: bid.value, lastBidSide: bid.side, pendingBid: null };
  return awardRound(state, bid.side, state.roundValue);
}
function awardRound(state: SingleWattenState, side: string, points: number): SingleWattenState {
  const scores = state.scores.map((score, seat) => score + (teamOf(String(seat), state.count, state.caller) === side ? points : 0));
  return { ...state, scores, winnerSide: side, pendingBid: null, trick: [], phase: scores.some(score => score >= state.targetScore) ? "matchOver" : "roundOver" };
}
export function playSingleWattenCard(state: SingleWattenState, cardId: string): SingleWattenState {
  if (state.phase !== "playing" || !state.trump || !state.schlag || state.pendingBid) throw new Error("The round is not ready.");
  const hand = state.hands[state.turn];
  const card = hand.find(item => item.id === cardId);
  if (!card || !canPlayWattenCard(card, hand, state.trick, state.tricksWon, state.trump, state.schlag)) throw new Error("Illegal card.");
  const hands = state.hands.map((cards, seat) => seat === state.turn ? cards.filter(item => item.id !== cardId) : cards);
  const trick = [...state.trick, { playerId: String(state.turn), card }];
  const playedCardIds = [...state.playedCardIds, cardId];
  if (trick.length < state.count) return { ...state, hands, trick, playedCardIds, turn: getNextPlayer(state.turn, state.count) };
  const winner = Number(determineTrickWinner(trick, state.trump, state.schlag).playerId);
  const tricksWon = { ...state.tricksWon, [String(winner)]: state.tricksWon[String(winner)] + 1 };
  const winningTeam = teamOf(String(winner), state.count, state.caller);
  const teamTricks = Object.entries(tricksWon).reduce((sum, [id, amount]) => sum + (teamOf(id, state.count, state.caller) === winningTeam ? amount : 0), 0);
  const next = { ...state, hands, trick: [], lastTrick: trick, lastTrickWinner: winner, playedCardIds, tricksWon, turn: winner,
    phase: "trickPause" as const };
  return teamTricks >= 3 ? awardRound(next, winningTeam, state.roundValue) : next;
}
export function advanceSingleWatten(state: SingleWattenState): SingleWattenState {
  if (state.phase === "trickPause") return { ...state, phase: "playing" };
  if (state.phase === "roundOver") return createSingleWattenRound(state.count, getNextPlayer(state.dealer, state.count), state.scores, state.round + 1, state.targetScore);
  throw new Error("No round to advance.");
}
