/**
 * Declarative card combinations ("hand rankings"). A game lists combinations
 * from weakest to strongest; each is a set of generic requirements:
 *
 *   groups      same-rank groups, e.g. [2] pair, [2, 2] two pair, [3, 2] full house
 *   sameSuit    at least N cards of one suit (flush)
 *   run         N consecutive ranks in the game's rank order (straight)
 *   runSameSuit the run must be in one suit (straight flush)
 *   highCanBeLow the strongest rank may also sit below the weakest (A-6-7-8-9)
 *
 * Reordering the list changes which combination beats which (short-deck poker
 * puts the flush above the full house). Nothing here is poker-specific.
 */
import { rankIndex, type Card, type Rank } from "../cards/card.ts";

export interface CombinationDefinition {
  id: string;
  name: string;
  groups?: number[];
  sameSuit?: number;
  run?: number;
  runSameSuit?: boolean;
  highCanBeLow?: boolean;
}

export interface CombinationResult {
  index: number;
  name: string;
  /** Category first, then tie-breakers (higher is better), compared left to right. */
  score: number[];
  cards: string[];
}

function runTop(values: number[], length: number, highCanBeLow: boolean, top: number): number | null {
  const set = new Set(values);
  if (highCanBeLow && set.has(top)) set.add(-1);
  let best: number | null = null;
  for (const high of set) {
    let ok = true;
    for (let step = 1; step < length && ok; step++) ok = set.has(high - step);
    if (ok && (best === null || high > best)) best = high;
  }
  return best;
}

function matches(definition: CombinationDefinition, cards: Card[], order: readonly Rank[]): number[] | null {
  const value = (card: Card) => rankIndex(order, card.rank);
  const top = order.length - 1;
  const counts = new Map<number, number>();
  for (const card of cards) counts.set(value(card), (counts.get(value(card)) ?? 0) + 1);
  const bySize = [...counts.values()].sort((a, b) => b - a);
  if (definition.groups?.length) {
    const required = [...definition.groups].sort((a, b) => b - a);
    if (required.some((size, index) => (bySize[index] ?? 0) < size)) return null;
  }
  if (definition.sameSuit) {
    const suits = new Map<string, number>();
    for (const card of cards) suits.set(card.suit, (suits.get(card.suit) ?? 0) + 1);
    if (Math.max(0, ...suits.values()) < definition.sameSuit) return null;
  }
  if (definition.run) {
    const pools = definition.runSameSuit ? [...new Set(cards.map((card) => card.suit))].map((suit) => cards.filter((card) => card.suit === suit)) : [cards];
    let best: number | null = null;
    for (const pool of pools) {
      const high = runTop(pool.map(value), definition.run, Boolean(definition.highCanBeLow), top);
      if (high !== null && (best === null || high > best)) best = high;
    }
    if (best === null) return null;
    return [best];
  }
  // Tie-breakers: ranks ordered by group size, then strength (pairs before kickers).
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]).map(([rank]) => rank);
}

function subsets<T>(items: T[], size: number): T[][] {
  if (size >= items.length) return [items];
  const out: T[][] = [];
  const pick = (start: number, chosen: T[]) => {
    if (chosen.length === size) return void out.push(chosen);
    for (let index = start; index <= items.length - (size - chosen.length); index++) pick(index + 1, [...chosen, items[index]]);
  };
  pick(0, []);
  return out;
}

export function compareScores(a: number[], b: number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const diff = (a[index] ?? -1) - (b[index] ?? -1);
    if (diff) return diff;
  }
  return 0;
}

/** The strongest combination among all `size`-card subsets of `cards`. */
export function bestCombination(cards: Card[], combinations: CombinationDefinition[], order: readonly Rank[], size: number): CombinationResult | null {
  if (!cards.length || !combinations.length) return null;
  let best: CombinationResult | null = null;
  // A huge pool would explode combinatorially; games evaluate hands, not decks.
  for (const subset of subsets(cards.slice(0, 12), Math.max(1, size))) {
    for (let index = combinations.length - 1; index >= 0; index--) {
      const tiebreak = matches(combinations[index], subset, order);
      if (!tiebreak) continue;
      const score = [index, ...tiebreak];
      if (!best || compareScores(score, best.score) > 0) {
        const strongestFirst = [...subset].sort((a, b) => rankIndex(order, b.rank) - rankIndex(order, a.rank));
        best = { index, name: combinations[index].name, score, cards: strongestFirst.map((card) => card.id) };
      }
      break;
    }
  }
  return best;
}

/** The standard high-to-low poker ladder; games copy and reorder it. */
export const POKER_COMBINATIONS: CombinationDefinition[] = [
  { id: "high-card", name: "High card" },
  { id: "pair", name: "Pair", groups: [2] },
  { id: "two-pair", name: "Two pair", groups: [2, 2] },
  { id: "three-of-a-kind", name: "Three of a kind", groups: [3] },
  { id: "straight", name: "Straight", run: 5, highCanBeLow: true },
  { id: "flush", name: "Flush", sameSuit: 5 },
  { id: "full-house", name: "Full house", groups: [3, 2] },
  { id: "four-of-a-kind", name: "Four of a kind", groups: [4] },
  { id: "straight-flush", name: "Straight flush", run: 5, runSameSuit: true, highCanBeLow: true },
];
