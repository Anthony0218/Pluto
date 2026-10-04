import {
  canPlayWattenCard,
  wouldCardWin,
  type PlayedCard,
  type Suit,
  type WattenCard,
} from "../../utils/watten.ts";

/** Only the viewer's hand and public trick state are needed for a help comparison. */
export function getWattenHelpComparison({
  card, hand, trick, tricksWon, trump, schlag, playerId, active,
}: {
  card: WattenCard;
  hand: WattenCard[];
  trick: PlayedCard[];
  tricksWon: Record<string, number>;
  trump: Suit | null;
  schlag: string | null;
  playerId: string;
  active: boolean;
}): boolean | null {
  if (!active || !trump || !schlag || trick.length === 0 ||
      !hand.some(item => item.id === card.id) ||
      !canPlayWattenCard(card, hand, trick, tricksWon, trump, schlag)) return null;
  return wouldCardWin(card, playerId, trick, trump, schlag);
}
