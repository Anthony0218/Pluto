export type Suit = "Eichel" | "Gras" | "Herz" | "Schellen";

export type Rank =
  | "7"
  | "8"
  | "9"
  | "10"
  | "Unter"
  | "Ober"
  | "König"
  | "Ass";

export type PlayerId = "you" | "player2" | "player3";

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export const SUITS: Suit[] = [
  "Eichel",
  "Gras",
  "Herz",
  "Schellen",
];

export const RANKS: Rank[] = [
  "7",
  "8",
  "9",
  "10",
  "Unter",
  "Ober",
  "König",
  "Ass",
];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  Eichel: "♣",
  Gras: "♠",
  Herz: "♥",
  Schellen: "♦",
};

export const RANK_VALUES: Record<Rank, number> = {
  "7": 0,
  "8": 1,
  "9": 2,
  "10": 3,
  Unter: 4,
  Ober: 5,
  König: 6,
  Ass: 7,
};


export type WattenCard = {
  id: string;
  suit: Suit;
  rank: Rank;
};

export const suits: Suit[] = [
  "Eichel",
  "Gras",
  "Herz",
  "Schellen",
];

export const ranks: Rank[] = [
  "7",
  "8",
  "9",
  "10",
  "Unter",
  "Ober",
  "König",
  "Ass",
];



export function createDeck(): WattenCard[] {
  const suits: WattenCard["suit"][] = [
    "Herz",
    "Schellen",
    "Eichel",
    "Gras",
  ];

  const ranks: WattenCard["rank"][] = [
    "7",
    "8",
    "9",
    "10",
    "Unter",
    "Ober",
    "König",
    "Ass",
  ];
  

  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${suit}-${rank}`,
      suit,
      rank,
    })),
  );
}


export function shuffleDeck(
  cards: WattenCard[],
): WattenCard[] {
  const shuffled = [...cards];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
}


export function isTrump(
  card: Card,
  trumpSuit: Suit,
): boolean {
  return card.suit === trumpSuit;
}

/**
 * The "Schlag" is the rank of the face-up trump card.
 */
export function isSchlag(
  card: Card,
  schlag: Rank,
): boolean {
  return card.rank === schlag;
}

/**
 * Determines the strength of a card.
 *
 * Highest:
 *   Schlag
 *   Trump
 *   Normal cards
 *
 * Within the same category, higher rank wins.
 */
export function cardStrength(
  card: Card,
  trumpSuit: Suit,
  schlag: Rank,
  ledSuit?: Suit,
): number {
  let strength = RANK_VALUES[card.rank];

  // Schlag is extremely strong.
  if (isSchlag(card, schlag)) {
    strength += 1000;
  }

  // Trump beats normal cards.
  if (isTrump(card, trumpSuit)) {
    strength += 500;
  }

  // Follow the suit that was led.
  if (ledSuit && card.suit === ledSuit) {
    strength += 100;
  }

  return strength;
}

/**
 * Returns the winner of cards played in a trick.
 */
export function determineTrickWinner(
  cards: { playerId: PlayerId; card: Card }[],
  trumpSuit: Suit,
  schlag: Rank,
): PlayerId {
  if (cards.length === 0) {
    throw new Error("Cannot determine winner of empty trick.");
  }

  const ledSuit = cards[0].card.suit;

  let winner = cards[0];

  for (const played of cards.slice(1)) {
    const currentStrength = cardStrength(
      played.card,
      trumpSuit,
      schlag,
      ledSuit,
    );

    const winnerStrength = cardStrength(
      winner.card,
      trumpSuit,
      schlag,
      ledSuit,
    );

    // Cards from another suit normally cannot win.
    const currentCanWin =
      played.card.suit === ledSuit ||
      isTrump(played.card, trumpSuit) ||
      isSchlag(played.card, schlag);

    const winnerCanWin =
      winner.card.suit === ledSuit ||
      isTrump(winner.card, trumpSuit) ||
      isSchlag(winner.card, schlag);

    if (
      currentCanWin &&
      (!winnerCanWin || currentStrength > winnerStrength)
    ) {
      winner = played;
    }
  }

  return winner.playerId;
}

/**
 * Returns cards that can legally be played.
 *
 * This uses a simple "follow suit if possible" rule.
 */
export function getLegalCards(
  hand: Card[],
  trick: { playerId: PlayerId; card: Card }[],
): Card[] {
  if (trick.length === 0) {
    return hand;
  }

  const ledSuit = trick[0].card.suit;

  const matching = hand.filter(
    (card) => card.suit === ledSuit,
  );

  return matching.length > 0 ? matching : hand;
}

export function formatCard(card: Card): string {
  return `${card.rank} ${SUIT_SYMBOLS[card.suit]}`;
}

export function playerName(player: PlayerId): string {
  switch (player) {
    case "you":
      return "You";
    case "player2":
      return "Player 2";
    case "player3":
      return "Player 3";
  }
}

function getBeginnerCardHint(card: WattenCard): string | undefined {
  if (!helpMode) {
    return undefined;
  }

  // Existing special first-trick hint gets priority.
  if (canActivateTrumpfOderKritisch(card)) {
    return "Hauptschlag — if you lead this card now, Trumpf oder Kritisch becomes active.";
  }

  const criticalValue = getCriticalValue(card);

  if (criticalValue === 3) {
    return "Max — the highest Kritischer and the highest card in Watten.";
  }

  if (criticalValue === 2) {
    return "Belli — the second-highest Kritischer.";
  }

  if (criticalValue === 1) {
    return "Spitz — the third-highest Kritischer.";
  }

  if (isHauptschlag(card)) {
    return "Hauptschlag — the strongest non-Kritisch card.";
  }

  if (card.rank === schlag) {
    return "Schlag — stronger than normal Trumpf cards. If two equal Schläge are played, the earlier one wins.";
  }

  if (card.suit === Farbe) {
    return `Trumpf (${Farbe}) — this card beats ordinary non-Trumpf cards.`;
  }

  return undefined;
}
