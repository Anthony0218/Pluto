// A small trick-taking engine behind the Watten and Schafkopf demos: follow-suit rules, trump order, a trick winner
// and a modest computer player. Schafkopf uses the real Rufspiel trump order; Watten is deliberately simplified.

export type Suit = "eichel" | "gras" | "herz" | "schellen";
export type Rank = "7" | "8" | "9" | "10" | "unter" | "ober" | "king" | "ace";
export type Card = { suit: Suit; rank: Rank };
export type Play = { seat: number; card: Card };

export const cardId = (card: Card) => `${card.suit}-${card.rank}`;
export const cardImage = (card: Card) => `/images/bavarian/${cardId(card)}.png`;
export const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });

export type TrickRules = {
  /** Trump strength, or null for a plain card. Higher beats lower. */
  trump: (card: Card) => number | null;
  /** Strength of a plain card within its suit. */
  plain: (card: Card) => number;
  /** Card points, for games that count them. */
  points: (card: Card) => number;
};

const SUIT_ORDER: Suit[] = ["eichel", "gras", "herz", "schellen"];
const SCHAFKOPF_PLAIN: Rank[] = ["7", "8", "9", "unter", "ober", "king", "10", "ace"];

/** Rufspiel: Ober, then Unter, then the rest of Herz; plain suits run Ace, 10, King, 9, 8, 7. */
export const schafkopfRules: TrickRules = {
  trump: ({ suit, rank }) => {
    if (rank === "ober") return 300 - SUIT_ORDER.indexOf(suit);
    if (rank === "unter") return 200 - SUIT_ORDER.indexOf(suit);
    return suit === "herz" ? 100 + SCHAFKOPF_PLAIN.indexOf(rank) : null;
  },
  plain: ({ rank }) => SCHAFKOPF_PLAIN.indexOf(rank),
  points: ({ rank }) => ({ ace: 11, "10": 10, king: 4, ober: 3, unter: 2 } as Partial<Record<Rank, number>>)[rank] ?? 0,
};

const WATTEN_ORDER: Rank[] = ["7", "8", "9", "10", "unter", "ober", "king", "ace"];
/** Watten, simplified: the three critical cards beat everything, then the trump suit, then the suit led. */
export const wattenRules = (trumpSuit: Suit): TrickRules => ({
  trump: ({ suit, rank }) => {
    if (suit === "herz" && rank === "king") return 1000;
    if (suit === "schellen" && rank === "7") return 900;
    if (suit === "eichel" && rank === "7") return 800;
    return suit === trumpSuit ? 100 + WATTEN_ORDER.indexOf(rank) : null;
  },
  plain: ({ rank }) => WATTEN_ORDER.indexOf(rank),
  points: () => 0,
});

/** The suit a card counts as when following: "trump" for any trump card. */
const effectiveSuit = (c: Card, rules: TrickRules): Suit | "trump" => (rules.trump(c) !== null ? "trump" : c.suit);

export function legalCards(hand: Card[], plays: Play[], rules: TrickRules): Card[] {
  if (!plays.length) return hand;
  const led = effectiveSuit(plays[0].card, rules);
  const following = hand.filter(c => effectiveSuit(c, rules) === led);
  return following.length ? following : hand;
}

export function trickWinner(plays: Play[], rules: TrickRules): number {
  const led = effectiveSuit(plays[0].card, rules);
  const strength = (play: Play) => {
    const trump = rules.trump(play.card);
    if (trump !== null) return 1000 + trump;
    return effectiveSuit(play.card, rules) === led ? rules.plain(play.card) : -1;
  };
  return plays.reduce((best, play) => (strength(play) > strength(best) ? play : best)).seat;
}

/** Win a valuable trick as cheaply as possible; otherwise give away the least. */
export function chooseAiCard(hand: Card[], plays: Play[], rules: TrickRules): Card {
  const options = legalCards(hand, plays, rules);
  const cost = (c: Card) => (rules.trump(c) ?? 0) + rules.points(c) * 3 + (rules.trump(c) === null ? rules.plain(c) : 0);
  const cheapest = [...options].sort((a, b) => cost(a) - cost(b));
  if (!plays.length) return cheapest[0];
  const seat = -1;
  const wins = cheapest.filter(c => trickWinner([...plays, { seat, card: c }], rules) === seat);
  const prize = plays.reduce((sum, play) => sum + rules.points(play.card), 0);
  return wins.length && (prize >= 10 || rules.points(wins[0]) === 0) ? wins[0] : cheapest[0];
}

export type DemoGame = {
  id: "watten" | "schafkopf";
  seats: number;
  rules: TrickRules;
  hands: Card[][];
};

export const wattenGame: DemoGame = {
  id: "watten", seats: 3, rules: wattenRules("gras"),
  hands: [
    [card("herz", "king"), card("gras", "ace"), card("eichel", "9"), card("schellen", "10"), card("gras", "7")],
    [card("eichel", "ace"), card("schellen", "9"), card("gras", "unter"), card("herz", "8"), card("eichel", "10")],
    [card("eichel", "7"), card("gras", "king"), card("schellen", "ober"), card("herz", "ace"), card("gras", "9")],
  ],
};

export const schafkopfGame: DemoGame = {
  id: "schafkopf", seats: 4, rules: schafkopfRules,
  hands: [
    [card("eichel", "ober"), card("herz", "ace"), card("gras", "ace"), card("schellen", "king"), card("eichel", "9")],
    [card("gras", "unter"), card("herz", "10"), card("eichel", "ace"), card("gras", "9"), card("schellen", "8")],
    [card("schellen", "ober"), card("herz", "king"), card("gras", "10"), card("eichel", "10"), card("schellen", "7")],
    [card("herz", "unter"), card("schellen", "ace"), card("gras", "king"), card("eichel", "8"), card("herz", "9")],
  ],
};
