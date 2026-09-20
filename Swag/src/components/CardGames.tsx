import { useMemo, useState } from "react";

type CardValue = "7" | "8" | "9" | "10" | "U" | "O" | "K" | "A";

type CardColor = "Herz" | "Schellen" | "Eichel" | "Gras";

type Card = {
  id: string;
  value: CardValue;
  color: CardColor;
};

type Player = {
  id: number;
  name: string;
  cards: Card[];
};

const CARD_VALUES: CardValue[] = ["7", "8", "9", "10", "U", "O", "K", "A"];

const CARD_COLORS: CardColor[] = ["Herz", "Schellen", "Eichel", "Gras"];

const CARD_ORDER: Record<CardValue, number> = {
  "7": 1,
  "8": 2,
  "9": 3,
  "10": 4,
  U: 5,
  O: 6,
  K: 7,
  A: 8,
};

const COLOR_CLASS: Record<CardColor, string> = {
  Herz: "text-Herz-500 border-Herz-500",
  Schellen: "text-Schellen-500 border-Schellen-500",
  Eichel: "text-Eichel-500 border-Eichel-500",
  Gras: "text-Gras-500 border-Gras-500",
};

function createDeck(): Card[] {
  return CARD_VALUES.flatMap((value) =>
    CARD_COLORS.map((color) => ({
      id: `${value}-${color}`,
      value,
      color,
    })),
  );
}

function shuffleDeck(cards: Card[]): Card[] {
  const shuffled = [...cards];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }

  return shuffled;
}

function startGame(deck: Card[]): any {
  //all the games you can play with a deck of cards
  const gameName = document.getElementById("gameNames")?.innerHTML;

  let deckIndex = 0; //so viele Karten wurden bisher ausgeteilt
  let rules = "";
  const players: Player[] = [
    //max player count
    {
      id: 1,
      name: "Player 1",
      cards: [],
    },
    {
      id: 2,
      name: "Player 2",
      cards: [],
    },
    {
      id: 3,
      name: "Player 3",
      cards: [],
    },
    {
      id: 4,
      name: "Player 4",
      cards: [],
    },
  ];

  switch (gameName) {
    case "Schafkopf": {
    }
  }
  return {
    players,
    rules,
    deckIndex,
    remainingDeck: deck.slice(deckIndex),
  };
}

function createGame() {
  const deck = shuffleDeck(createDeck());
  return startGame(deck);
}

export default function CardDeck() {
  const initialGame = useMemo(() => createGame(), []);
  const [players, setPlayers] = useState<Player[]>(initialGame.players);
  const [remainingDeck, setRemainingDeck] = useState<Card[]>(
    initialGame.remainingDeck,
  );
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [playedCard, setPlayedCard] = useState<Card | null>(null);
  const [message, setMessage] = useState("Player 1 starts the game.");

  const resetGame = () => {
    const game = createGame();

    setPlayers(game.players);
    setRemainingDeck(game.remainingDeck);
    setCurrentPlayer(0);
    setPlayedCard(null);
    setMessage("Player 1 starts the game.");
  };

  const canPlayCard = (card: Card) => {
    // First card can always be played.
    if (!playedCard) {
      return true;
    }
    return CARD_ORDER[card.value] >= CARD_ORDER[playedCard.value];
  };

  const playCard = (card: Card) => {
    const player = players[currentPlayer];

    if (!canPlayCard(card)) {
      setMessage(`${card.value} cannot be played on ${playedCard?.value}.`);

      return;
    }

    const updatedPlayers = players.map((currentPlayerData, index) => {
      if (index !== currentPlayer) {
        return currentPlayerData;
      }

      return {
        ...currentPlayerData,
        cards: currentPlayerData.cards.filter(
          (playerCard) => playerCard.id !== card.id,
        ),
      };
    });

    setPlayers(updatedPlayers);
    setPlayedCard(card);

    const playerHasWon = updatedPlayers[currentPlayer].cards.length === 0;

    if (playerHasWon) {
      setMessage(`${player.name} wins! 🎉`);
      return;
    }

    const nextPlayer = (currentPlayer + 1) % players.length;

    setCurrentPlayer(nextPlayer);

    setMessage(`${players[nextPlayer].name}'s turn.`);
  };

  const drawCard = () => {
    if (remainingDeck.length === 0) {
      setMessage("There are no cards left to draw.");
      return;
    }

    const drawnCard = remainingDeck[0];

    const updatedPlayers = players.map((player, index) => {
      if (index !== currentPlayer) {
        return player;
      }

      return {
        ...player,
        cards: [...player.cards, drawnCard],
      };
    });

    setPlayers(updatedPlayers);
    setRemainingDeck(remainingDeck.slice(1));

    setMessage(`${players[currentPlayer].name} drew a card.`);
  };

  return (
    <main className="min-h-screen bg-Eichel-900 px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <button
            type="button"
            onClick={resetGame}
            className="rounded-lg bg-white px-4 py-2 font-semibold text-Eichel-900 transition hover:bg-gray-100"
          >
            New Game
          </button>
        </div>

        {/* Game status */}
        <div className="mb-8 rounded-xl bg-Eichel-800 p-4 text-center">
          <p className="text-lg font-semibold">{message}</p>

          <p className="mt-1 text-sm text-Eichel-200">
            {remainingDeck.length} cards remaining in deck
          </p>
        </div>

        {/* Played card */}
        <section className="mb-10 flex flex-col items-center">
          <h2 className="mb-4 text-lg font-semibold">Current Card</h2>

          {playedCard ? (
            <CardView card={playedCard} large />
          ) : (
            <div className="flex h-36 w-24 items-center justify-center rounded-xl border-2 border-dashed border-Eichel-400 text-Eichel-300">
              Empty
            </div>
          )}
        </section>

        {/* Players */}
        <div className="grid gap-8 md:grid-cols-2">
          {players.map((player, playerIndex) => {
            const isCurrentPlayer = playerIndex === currentPlayer;

            return (
              <section
                key={player.id}
                className={`rounded-2xl p-5 ${
                  isCurrentPlayer
                    ? "bg-Eichel-700 ring-2 ring-Gras-400"
                    : "bg-Eichel-800"
                }`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{player.name}</h2>

                    {isCurrentPlayer && (
                      <span className="text-sm text-Gras-300">Your turn</span>
                    )}
                  </div>

                  <span className="rounded-full bg-Eichel-900 px-3 py-1 text-sm">
                    {player.cards.length} cards
                  </span>
                </div>

                <div className="flex min-h-40 flex-wrap justify-center gap-3">
                  {player.cards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      disabled={!isCurrentPlayer}
                      onClick={() => playCard(card)}
                      className={`transition ${
                        isCurrentPlayer
                          ? "cursor-pointer hover:-translate-y-2"
                          : "cursor-default opacity-80"
                      }`}
                    >
                      <CardView card={card} />
                    </button>
                  ))}
                </div>

                {isCurrentPlayer && (
                  <button
                    type="button"
                    onClick={drawCard}
                    disabled={remainingDeck.length === 0}
                    className="mt-6 w-full rounded-lg bg-Gras-400 px-4 py-3 font-bold text-Eichel-950 transition hover:bg-Gras-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Draw Card
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function CardView({ card, large = false }: { card: Card; large?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-between rounded-xl border-2 bg-white font-bold shadow-lg ${
        large ? "h-36 w-24 p-3" : "h-28 w-20 p-2"
      } ${COLOR_CLASS[card.color]}`}
    >
      <span className="self-start text-xs uppercase">{card.color}</span>

      <span className={large ? "text-4xl" : "text-3xl"}>{card.value}</span>

      <span className="self-end text-xs">{card.value}</span>
    </div>
  );
}
