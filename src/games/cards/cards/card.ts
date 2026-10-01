/**
 * Card Builder — the deck model. The standard deck has 32 cards (7, 8, 9, 10, J,
 * Q, K, A × four suits); games may add the 6s for a 36-card deck.
 *
 * Rank order is never global: every game definition carries its own order and
 * comparisons always go through `rankIndex(order, rank)`.
 */

export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

/** Every rank a deck may use, weakest first in the default order. */
export const RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export type Rank = (typeof RANKS)[number];

/** The standard 32-card deck's ranks. */
export const STANDARD_RANKS: Rank[] = ["7", "8", "9", "10", "J", "Q", "K", "A"];
export const DEFAULT_RANK_ORDER: Rank[] = [...STANDARD_RANKS];

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export const SUIT_SYMBOLS: Record<Suit, string> = { clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" };
export const SUIT_NAMES: Record<Suit, string> = { clubs: "Clubs", diamonds: "Diamonds", hearts: "Hearts", spades: "Spades" };
export const RANK_NAMES: Record<Rank, string> = { "6": "6", "7": "7", "8": "8", "9": "9", "10": "10", J: "Jack", Q: "Queen", K: "King", A: "Ace" };

export const isSuit = (value: unknown): value is Suit => typeof value === "string" && (SUITS as readonly string[]).includes(value);
export const isRank = (value: unknown): value is Rank => typeof value === "string" && (RANKS as readonly string[]).includes(value);

export interface DeckDefinition {
  /** Ranks included in the deck (subset of 6–A). */
  ranks: Rank[];
  suits: Suit[];
  /** Copies of each rank/suit combination (1 = a single deck). */
  copies: number;
  /** Lowest → highest. Must contain every included rank exactly once. */
  rankOrder: Rank[];
}

export const STANDARD_DECK: DeckDefinition = { ranks: [...STANDARD_RANKS], suits: [...SUITS], copies: 1, rankOrder: [...DEFAULT_RANK_ORDER] };
/** 36 cards: the standard deck plus the 6s (Durak, short-deck poker). */
export const DECK_36: DeckDefinition = { ranks: [...RANKS], suits: [...SUITS], copies: 1, rankOrder: [...RANKS] };

/** Inserts a rank into an order at its natural position (used when a rank is added to a deck). */
export function withRank(order: readonly Rank[], rank: Rank): Rank[] {
  if (order.includes(rank)) return [...order];
  const natural = RANKS.indexOf(rank);
  const before = order.findIndex((entry) => RANKS.indexOf(entry) > natural);
  return before < 0 ? [...order, rank] : [...order.slice(0, before), rank, ...order.slice(before)];
}

/** "7 through Ace" for a run of consecutive ranks, otherwise a list. */
export function describeRankRange(ranks: readonly Rank[]): string {
  const sorted = RANKS.filter((rank) => ranks.includes(rank));
  if (!sorted.length) return "no ranks";
  const first = RANKS.indexOf(sorted[0]);
  const contiguous = sorted.every((rank, index) => RANKS.indexOf(rank) === first + index);
  return contiguous && sorted.length > 2 ? `${RANK_NAMES[sorted[0]]} through ${RANK_NAMES[sorted[sorted.length - 1]]}` : sorted.map((rank) => RANK_NAMES[rank]).join(", ");
}

const SUIT_LETTER: Record<Suit, string> = { clubs: "c", diamonds: "d", hearts: "h", spades: "s" };

/** Stable ids ("7c", "Ah", "10s", and "7c#2" for later copies). Generation order is deterministic. */
export function generateDeck(deck: DeckDefinition): Card[] {
  const cards: Card[] = [];
  const copies = Math.max(0, Math.floor(deck.copies));
  for (let copy = 1; copy <= copies; copy++) {
    for (const suit of SUITS) {
      if (!deck.suits.includes(suit)) continue;
      for (const rank of RANKS) {
        if (!deck.ranks.includes(rank)) continue;
        cards.push({ id: `${rank}${SUIT_LETTER[suit]}${copy > 1 ? `#${copy}` : ""}`, suit, rank });
      }
    }
  }
  return cards;
}

export function deckSize(deck: DeckDefinition): number {
  return deck.ranks.length * deck.suits.length * Math.max(0, Math.floor(deck.copies));
}

/** Position of a rank in the game's order (higher = stronger); -1 when the rank is not ordered. */
export function rankIndex(order: readonly Rank[], rank: Rank): number {
  return order.indexOf(rank);
}

/** Negative when a < b, positive when a > b, 0 when equal (suits are ignored). */
export function compareRanks(order: readonly Rank[], a: Rank, b: Rank): number {
  return rankIndex(order, a) - rankIndex(order, b);
}

export function cardLabel(card: Pick<Card, "rank" | "suit">): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function cardName(card: Pick<Card, "rank" | "suit">): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}
