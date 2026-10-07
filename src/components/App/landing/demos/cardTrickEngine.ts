// A small trick-taking engine behind the Watten and Schafkopf demos: which cards may be played, trump order, a trick
// winner and a modest computer player. Schafkopf uses the real Rufspiel trump order; Watten uses the real ranking
// (critical cards, Hauptschlag, the other Schläge, Trumpf, the suit led) and its free choice of card.

export type Suit = "eichel" | "gras" | "herz" | "schellen";
export type Rank = "7" | "8" | "9" | "10" | "unter" | "ober" | "king" | "ace";
export type Card = { suit: Suit; rank: Rank };
export type Play = { seat: number; card: Card };

export const cardId = (card: Card) => `${card.suit}-${card.rank}`;
export const card = (suit: Suit, rank: Rank): Card => ({ suit, rank });

export type TrickRules = {
  /** Trump strength, or null for a plain card. Higher beats lower. */
  trump: (card: Card) => number | null;
  /** Strength of a plain card within its suit. */
  plain: (card: Card) => number;
  /** Card points, for games that count them. */
  points: (card: Card) => number;
  /** Cards that may be played, for games that do not simply follow suit. `trick` counts finished tricks. */
  legal?: (hand: Card[], plays: Play[], trick: number) => Card[];
};

export const SUIT_NAMES: Record<Suit, string> = { eichel: "Eichel", gras: "Gras", herz: "Herz", schellen: "Schellen" };
export const SUIT_SYMBOLS: Record<Suit, string> = { eichel: "♣", gras: "♠", herz: "♥", schellen: "♦" };
export const RANK_NAMES: Record<Rank, string> = { "7": "7", "8": "8", "9": "9", "10": "10", unter: "Unter", ober: "Ober", king: "König", ace: "Ass" };

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
const isCritical = ({ suit, rank }: Card) => (suit === "herz" && rank === "king") || (suit === "schellen" && rank === "7") || (suit === "eichel" && rank === "7");
/**
 * Watten: the three critical cards (Max, Belli, Spitz) beat everything, then the Hauptschlag (the Schlag in the trump
 * suit), then the other Schläge (the first one played wins), then the trump suit, then the suit led. Any card may be
 * played, except that a Hauptschlag led to the very first trick must be answered with trump or a critical card.
 */
export const wattenRules = (trumpSuit: Suit, schlag: Rank): TrickRules => {
  const trump = (c: Card) => {
    if (c.suit === "herz" && c.rank === "king") return 1000;
    if (c.suit === "schellen" && c.rank === "7") return 900;
    if (c.suit === "eichel" && c.rank === "7") return 800;
    if (c.rank === schlag) return c.suit === trumpSuit ? 700 : 600;
    return c.suit === trumpSuit ? 100 + WATTEN_ORDER.indexOf(c.rank) : null;
  };
  return {
    trump,
    plain: ({ rank }) => WATTEN_ORDER.indexOf(rank),
    points: () => 0,
    legal: (hand, plays, trick) => {
      const led = plays[0]?.card;
      if (trick !== 0 || !led || trump(led) !== 700 || plays.slice(1).some(play => isCritical(play.card))) return hand;
      const answers = hand.filter(c => isCritical(c) || c.suit === trumpSuit);
      return answers.length ? answers : hand;
    },
  };
};

/** The suit a card counts as when following: "trump" for any trump card. */
const effectiveSuit = (c: Card, rules: TrickRules): Suit | "trump" => (rules.trump(c) !== null ? "trump" : c.suit);

export function legalCards(hand: Card[], plays: Play[], rules: TrickRules, trick = 0): Card[] {
  if (rules.legal) return rules.legal(hand, plays, trick);
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
export function chooseAiCard(hand: Card[], plays: Play[], rules: TrickRules, trick = 0): Card {
  const options = legalCards(hand, plays, rules, trick);
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
  /** The trump suit of this deal. */
  trump: Suit;
  /** Watten: the announced Schlag. */
  schlag?: Rank;
  /** Schafkopf: the suit of the called ace. */
  called?: Suit;
  /** Tricks one side needs to end the round early (Watten: three). */
  tricksToWin?: number;
};

// You against two opponents. The Hauptschlag (Gras-Ober) and the Spitz sit with one opponent, a Schlag with the other.
export const wattenGame: DemoGame = {
  id: "watten", seats: 3, rules: wattenRules("gras", "ober"), trump: "gras", schlag: "ober", tricksToWin: 3,
  hands: [
    [card("herz", "king"), card("gras", "ace"), card("eichel", "ober"), card("schellen", "10"), card("gras", "7")],
    [card("eichel", "ace"), card("schellen", "9"), card("gras", "unter"), card("herz", "8"), card("schellen", "ober")],
    [card("eichel", "7"), card("gras", "king"), card("gras", "ober"), card("herz", "ace"), card("gras", "9")],
  ],
};

// You play a Sauspiel on the Eichel-Sau, which your partner across the table holds.
export const schafkopfGame: DemoGame = {
  id: "schafkopf", seats: 4, rules: schafkopfRules, trump: "herz", called: "eichel",
  hands: [
    [card("eichel", "ober"), card("herz", "ace"), card("gras", "ace"), card("schellen", "king"), card("eichel", "9")],
    [card("gras", "unter"), card("herz", "10"), card("eichel", "10"), card("gras", "9"), card("schellen", "8")],
    [card("schellen", "ober"), card("herz", "king"), card("gras", "10"), card("eichel", "ace"), card("schellen", "7")],
    [card("herz", "unter"), card("schellen", "ace"), card("gras", "king"), card("eichel", "8"), card("herz", "9")],
  ],
};
