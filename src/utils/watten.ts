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
export type PlayedCard = {
  playerId: string;
  card: WattenCard;
};

export type WattenSuit =
  | "Herz"
  | "Schellen"
  | "Eichel"
  | "Gras";

export const normalRankValue: Record<string, number> = {
  "7": 1,
  "8": 2,
  "9": 3,
  "10": 4,
  Unter: 5,
  Ober: 6,
  König: 7,
  Ass: 8,
} as const;



export function getPreviousPlayer(
  currentPlayer: number,
  playerCount: number,
) {
  return (
    currentPlayer - 1 + playerCount
  ) % playerCount;
}

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
  cards: PlayedCard[],
  Farbe: WattenSuit | null,
  schlag: string | null,
): PlayedCard {
  if (cards.length === 0) {
    throw new Error("Cannot determine winner of an empty trick.");
  }

  const leadSuit = cards[0].card.suit;

  let winningCard = cards[0];

  let winningStrength = getWattenStrength(
    winningCard.card,
    leadSuit,
    Farbe,
    schlag,
  );

  for (let i = 1; i < cards.length; i++) {
    const played = cards[i];

    const strength = getWattenStrength(
      played.card,
      leadSuit,
      Farbe,
      schlag,
    );

    const strongerCategory =
      strength.category > winningStrength.category;

    const sameCategoryButHigher =
      strength.category === winningStrength.category &&
      strength.value > winningStrength.value;

    if (strongerCategory || sameCategoryButHigher) {
      winningCard = played;
      winningStrength = strength;
    }
  }

  return winningCard;
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

export function getNextPlayer(
  currentPlayer: number,
  playerCount: number,
) {
  return (currentPlayer + 1) % playerCount;
}



export function getCriticalValue(card: WattenCard): number {
    // Highest card in the whole game
    if (card.suit === "Herz" && card.rank === "König") {
      return 3;
    }

    // Second highest
    if (card.suit === "Schellen" && card.rank === "7") {
      return 2;
    }

    // Third highest
    if (card.suit === "Eichel" && card.rank === "7") {
      return 1;
    }

    return 0;
  }

  export function isCritical(card: WattenCard) {
    return (
      (card.suit === "Herz" && card.rank === "König") ||
      (card.suit === "Schellen" && card.rank === "7") ||
      (card.suit === "Eichel" && card.rank === "7")
    );
  }
export function isAbhebenCard(card: WattenCard) {
    return (
      (card.suit === "Herz" && card.rank === "König") ||
      (card.suit === "Schellen" && card.rank === "7") ||
      (card.suit === "Eichel" && card.rank === "7")
    );
  }
export function isHauptschlag(
  card: WattenCard,
  Farbe: WattenSuit | null,
  schlag: string | null,
): boolean {
  if (!Farbe || !schlag) {
    return false;
  }

  return (
    !isCritical(card) &&
    card.suit === Farbe &&
    card.rank === schlag
  );
}
export function getWattenStrength(
  card: WattenCard,
  leadSuit: string,
  Farbe: WattenSuit | null,
  schlag: string | null,
) {
  const criticalValue = getCriticalValue(card);

  // Kritische
  if (criticalValue > 0) {
    return {
      category: 5,
      value: criticalValue,
    };
  }

  // Hauptschlag
  if (card.rank === schlag && card.suit === Farbe) {
    return {
      category: 4,
      value: 1,
    };
  }

  // Other Schläge
  if (card.rank === schlag) {
    return {
      category: 3,
      value: 1,
    };
  }

  // Trumpf
  if (card.suit === Farbe) {
    return {
      category: 2,
      value: normalRankValue[card.rank] ?? 0,
    };
  }

  // Angespielte Farbe
  if (card.suit === leadSuit) {
    return {
      category: 1,
      value: normalRankValue[card.rank] ?? 0,
    };
  }

  return {
    category: 0,
    value: 0,
  };
}
export function isFirstTrick(
  tricksWon: Record<string, number>,
): boolean {
  return Object.values(tricksWon).every(
    (count) => count === 0,
  );
}

export function isTrumpfOderKritischCard(
  card: WattenCard,
  Farbe: WattenSuit | null,
): boolean {
  if (!Farbe) {
    return false;
  }

  return isCritical(card) || card.suit === Farbe;
}
export function isTrumpfOderKritischActive(
  playedCards: PlayedCard[],
  tricksWon: Record<string, number>,
  Farbe: WattenSuit | null,
  schlag: string | null,
): boolean {
  if (!Farbe || !schlag) {
    return false;
  }

  if (!isFirstTrick(tricksWon)) {
    return false;
  }

  const firstPlayedCard = playedCards[0]?.card;

  if (
    !firstPlayedCard ||
    !isHauptschlag(firstPlayedCard, Farbe, schlag)
  ) {
    return false;
  }

  const criticalAlreadyPlayed = playedCards
    .slice(1)
    .some((played) => isCritical(played.card));

  return !criticalAlreadyPlayed;
}

export function mustFollowTrumpfOderKritisch(
  hand: WattenCard[],
  playedCards: PlayedCard[],
  tricksWon: Record<string, number>,
  Farbe: WattenSuit | null,
  schlag: string | null,
): boolean {
  if (
    !isTrumpfOderKritischActive(
      playedCards,
      tricksWon,
      Farbe,
      schlag,
    )
  ) {
    return false;
  }

  return hand.some((card) =>
    isTrumpfOderKritischCard(card, Farbe),
  );
}

export function canPlayWattenCard(
  card: WattenCard,
  hand: WattenCard[],
  playedCards: PlayedCard[],
  tricksWon: Record<string, number>,
  Farbe: WattenSuit | null,
  schlag: string | null,
): boolean {
  const mustFollow = mustFollowTrumpfOderKritisch(
    hand,
    playedCards,
    tricksWon,
    Farbe,
    schlag,
  );

  if (!mustFollow) {
    return true;
  }

  return isTrumpfOderKritischCard(card, Farbe);
}

export function getWattenCardRole(
  card: WattenCard,
  leadSuit: string,
  Farbe: WattenSuit | null,
  schlag: string | null,
): string {
  if (card.suit === "Herz" && card.rank === "König") {
    return "Max · Höchste Kritische";
  }

  if (card.suit === "Schellen" && card.rank === "7") {
    return "Belli · Zweithöchste Kritische";
  }

  if (card.suit === "Eichel" && card.rank === "7") {
    return "Spitz · dritthöchste Kritische";
  }

  if (isHauptschlag(card, Farbe, schlag)) {
    return "Hauptschlag";
  }

  if (card.rank === schlag) {
    return "Schlag";
  }

  if (card.suit === Farbe) {
    return "Trumpf";
  }

  if (card.suit === leadSuit) {
    return "angespielte Farbe";
  }

  return "Fehlfarbe";
}

export function wouldCardWin(
  card: WattenCard,
  playerId: string,
  playedCards: PlayedCard[],
  Farbe: WattenSuit | null,
  schlag: string | null,
): boolean | null {
  if (playedCards.length === 0) {
    return null;
  }

  const simulatedPlay: PlayedCard = {
    playerId,
    card,
  };

  const simulatedWinner = determineTrickWinner(
    [...playedCards, simulatedPlay],
    Farbe,
    schlag,
  );

  return (
    simulatedWinner.playerId === playerId &&
    simulatedWinner.card.id === card.id
  );
}


export const WATTEN_CARD_CLIP =
  "inset(1px_2px_1px_2px_round_6px)";
 