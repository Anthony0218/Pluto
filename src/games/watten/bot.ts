import { canPlayWattenCard, determineTrickWinner, getCriticalValue, getWattenStrength, type PlayedCard, type WattenCard, type WattenSuit } from "../../utils/watten.ts";

export type BotKnowledge = {
  seat: number;
  playerCount: 3 | 4;
  trick: PlayedCard[];
  playedCardIds: ReadonlySet<string>;
  tricksWon: Record<string, number>;
  trump: WattenSuit;
  schlag: string;
  teamOf: (playerId: string) => string;
};
export function getLegalBotMoves(hand: WattenCard[], knowledge: BotKnowledge): WattenCard[] {
  return hand.filter(card => canPlayWattenCard(card, hand, knowledge.trick, knowledge.tricksWon, knowledge.trump, knowledge.schlag));
}
export function scoreBotMove(card: WattenCard, knowledge: BotKnowledge): number {
  const leadSuit = knowledge.trick[0]?.card.suit ?? card.suit;
  const strength = getWattenStrength(card, leadSuit, knowledge.trump, knowledge.schlag);
  const cost = strength.category * 12 + strength.value;
  const critical = getCriticalValue(card) > 0;
  if (!knowledge.trick.length) {
    const unseenHigher = ["Herz-König", "Schellen-7", "Eichel-7"].filter(id => !knowledge.playedCardIds.has(id) && id !== card.id).length;
    return strength.category >= 2 ? 12 - cost * 0.25 + (unseenHigher === 0 ? 4 : 0) : 6 + strength.value * 0.6;
  }
  const leading = determineTrickWinner(knowledge.trick, knowledge.trump, knowledge.schlag);
  const allyLeading = knowledge.teamOf(leading.playerId) === knowledge.teamOf(String(knowledge.seat));
  const winsNow = determineTrickWinner([...knowledge.trick, { playerId: String(knowledge.seat), card }], knowledge.trump, knowledge.schlag).playerId === String(knowledge.seat);
  if (allyLeading) return -cost - (critical ? 25 : 0);
  if (winsNow) return 100 - cost * 0.4 + (knowledge.trick.length === knowledge.playerCount - 1 ? 12 : 0);
  return -cost - (critical ? 25 : 0);
}
/** Receives only the bot's hand and publicly visible table state. */
export function chooseBotCard(hand: WattenCard[], knowledge: BotKnowledge): WattenCard {
  const legal = getLegalBotMoves(hand, knowledge);
  if (!legal.length) throw new Error("Bot has no legal card.");
  return [...legal].sort((a, b) => scoreBotMove(b, knowledge) - scoreBotMove(a, knowledge) || a.id.localeCompare(b.id))[0];
}

/** Bid choices use the bot's hand and public declarations/trick counts only. */
export function botHandConfidence(hand: WattenCard[], trump: WattenSuit, schlag: string): number {
  return hand.reduce((score, card) => {
    const strength = getWattenStrength(card, card.suit, trump, schlag);
    return score + (strength.category >= 5 ? 4 : strength.category === 4 ? 3 : strength.category === 3 ? 2 : strength.category === 2 ? 1 : 0);
  }, 0);
}
export function botShouldRaise(hand: WattenCard[], trump: WattenSuit, schlag: string, roundValue: number, ownTricks: number, opposingTricks: number): boolean {
  return botHandConfidence(hand, trump, schlag) + ownTricks * 2 - opposingTricks * 2 >= (roundValue === 2 ? 5 : 7);
}
export function botShouldHold(hand: WattenCard[], trump: WattenSuit, schlag: string, ownTricks: number, opposingTricks: number): boolean {
  return botHandConfidence(hand, trump, schlag) + ownTricks * 3 - opposingTricks * 2 >= 2;
}
