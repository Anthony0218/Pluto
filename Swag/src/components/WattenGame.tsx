import { useState } from "react";
import { Link, useLocation } from "react-router";
import type { WattenCard } from "../utils/watten";
import { createDeck, shuffleDeck } from "../utils/watten";
import WattenCardComponent from "./WattenCard";

type Player = {
  id: string;
  name: string;
  cards: WattenCard[];
};

type PlayerInfo = {
  id: string;
  name: string;
};

type PlayedCard = {
  playerId: string;
  card: WattenCard;
};

type WattenGameProps = {
  Farbe: string;
  schlag: string;
};

export default function WattenGame() {
  const location = useLocation();
  const [phase, setPhase] = useState<
    "reveal" | "abheben" | "trump" | "schlag" | "playing" | "trickReview"
  >("reveal");

  const [Farbe, setFarbe] = useState<
    "Herz" | "Schelle" | "Eichel" | "Gras" | null
  >(null);
  const specialCards = [
    { suit: "Herz", rank: "König" },
    { suit: "Schellen", rank: "7" },
    { suit: "Eichel", rank: "7" },
  ];

  const [schlag, setSchlag] = useState<string | null>(null);

  const playerInfo: PlayerInfo[] = location.state?.players ?? [
    { id: "1", name: "Player 1" },
    { id: "2", name: "Player 2" },
    { id: "3", name: "Player 3" },
  ];

  const [players, setPlayers] = useState<Player[]>(() =>
    playerInfo.map((player) => ({
      id: player.id,
      name: player.name,
      cards: [],
    })),
  );
  const [deck, setDeck] = useState<WattenCard[]>(() => createNewRoundDeck());

  const [trumpCaller, setTrumpCaller] = useState(0);

  const abhebenPlayer = (trumpCaller + 2) % 3;

  const [currentPlayer, setCurrentPlayer] = useState(2);
  const [showPassScreen, setShowPassScreen] = useState(true);
  const [cardsSeen, setCardsSeen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(playerInfo.map((player) => [player.id, false])),
  );
  const [cardPlayedThisTurn, setCardPlayedThisTurn] = useState(false);
  const [cardsReviewed, setCardsReviewed] = useState<Record<string, boolean>>(
    () => Object.fromEntries(playerInfo.map((player) => [player.id, false])),
  );

  const [playedCards, setPlayedCards] = useState<PlayedCard[]>([]);
  const [abgehobenCard, setAbgehobenCard] = useState<WattenCard | null>(null);
  const [abhebenFinished, setAbhebenFinished] = useState(false);

  const [trickWinner, setTrickWinner] = useState<PlayedCard | null>(null);

  const [tricksWon, setTricksWon] = useState<Record<string, number>>(() => ({
    [playerInfo[0].id]: 0,
    [playerInfo[1].id]: 0,
    [playerInfo[2].id]: 0,
  }));

  const [winner, setWinner] = useState<string | null>(null);
  const [viewingPlayer, setViewingPlayer] = useState<number | null>(null);
  const [showCardViewer, setShowCardViewer] = useState(false);
  const [showCardViewerPass, setShowCardViewerPass] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  function playCard(card: WattenCard) {
    if (winner || cardPlayedThisTurn) {
      return;
    }
    if (!Farbe) {
      setNotification("You must choose Trumpf before playing a card.");

      setTimeout(() => {
        setNotification(null);
      }, 2500);

      return;
    }

    const player = players[currentPlayer];

    setPlayers((current) =>
      current.map((p, index) => {
        if (index !== currentPlayer) {
          return p;
        }

        return {
          ...p,
          cards: p.cards.filter((playerCard) => playerCard.id !== card.id),
        };
      }),
    );

    const newPlayedCards = [
      ...playedCards,
      {
        playerId: player.id,
        card,
      },
    ];

    setPlayedCards(newPlayedCards);

    // The current player has now played a card.
    setCardPlayedThisTurn(true);

    if (newPlayedCards.length === 3) {
      finishTrick(newPlayedCards);
    }
  }

  function finishPlayerTurn() {
    if (!cardPlayedThisTurn) {
      return;
    }

    const nextPlayer = (currentPlayer + 1) % 3;

    setCardPlayedThisTurn(false);
    setCurrentPlayer(nextPlayer);
    setShowPassScreen(true);
  }

  function drawAbhebenCard() {
    const drawnCard = deck[0];

    if (!drawnCard) {
      return;
    }

    // Remove the card from the deck.
    setDeck((current) => current.slice(1));

    // Only the Abheben player gets to see the actual card.
    setAbgehobenCard(drawnCard);

    if (isAbhebenCard(drawnCard)) {
      // Abheben player gets the special card.
      setPlayers((current) =>
        current.map((player, index) =>
          index === abhebenPlayer
            ? {
                ...player,
                cards: [...player.cards, drawnCard],
              }
            : player,
        ),
      );

      setAbhebenFinished(false);
      return;
    }

    // Not a special card.
    setAbhebenFinished(false);
  }

  function continueHotseat() {
    setShowPassScreen(false);

    if (phase === "reveal") {
      setCurrentPlayer(abhebenPlayer);
      setPhase("abheben");
      return;
    }
  }
  function requestToSeeCards(playerIndex: number) {
    setViewingPlayer(playerIndex);
    setShowCardViewerPass(true);
  }

  function createNewRoundDeck() {
    return shuffleDeck(createDeck());
  }

  function finishTrick(cards: PlayedCard[]) {
    /*
     * Temporary winner logic:
     * For now the highest rank wins.
     *
     * We'll replace this with proper Watten rules
     * once trump + Schlag are implemented.
     */

    const rankValues: Record<string, number> = {
      "7": 1,
      "8": 2,
      "9": 3,
      "10": 4,
      Unter: 5,
      Ober: 6,
      König: 7,
      Ass: 8,
    };

    let winningCard = cards[0];

    for (const played of cards) {
      if (rankValues[played.card.rank] > rankValues[winningCard.card.rank]) {
        winningCard = played;
      }
    }

    const winnerId = winningCard.playerId;

    const newTricks = {
      ...tricksWon,
      [winnerId]: (tricksWon[winnerId] ?? 0) + 1,
    };

    setTricksWon(newTricks);

    const roundWinner = players.find((player) => player.id === winnerId);

    if (newTricks[winnerId] >= 3) {
      setWinner(roundWinner?.name ?? "Player");
      setPlayedCards([]);
      return;
    }

    setPlayedCards([]);

    const winnerIndex = players.findIndex((player) => player.id === winnerId);

    setCurrentPlayer(winnerIndex);
    setShowPassScreen(true);
    setCardPlayedThisTurn(false);
  }
  function finishViewingCards() {
    if (viewingPlayer === null) {
      return;
    }

    const playerId = players[viewingPlayer].id;

    setCardsSeen((current) => ({
      ...current,
      [playerId]: true,
    }));

    setShowCardViewer(false);
    setViewingPlayer(null);
  }

  function restartGame() {
    const nextTrumpCaller = (trumpCaller + 1) % 3;

    startNewRound(nextTrumpCaller);
  }

  function isAbhebenCard(card: WattenCard) {
    return (
      (card.suit === "Herz" && card.rank === "König") ||
      (card.suit === "Schellen" && card.rank === "7") ||
      (card.suit === "Eichel" && card.rank === "7")
    );
  }
  function startNewRound(nextTrumpCaller: number) {
    const newDeck = shuffleDeck(createDeck());

    const nextAbhebenPlayer = (nextTrumpCaller + 2) % 3;

    setTrumpCaller(nextTrumpCaller);
    setDeck(newDeck);

    // Everyone starts with an empty hand.
    setPlayers(
      playerInfo.map((player) => ({
        ...player,
        cards: [],
      })),
    );

    setFarbe(null);
    setSchlag(null);
    setPlayedCards([]);

    setTricksWon({
      [playerInfo[0].id]: 0,
      [playerInfo[1].id]: 0,
      [playerInfo[2].id]: 0,
    });
    setAbgehobenCard(null);
    setAbhebenFinished(false);
    // First pass the device to the Abheben player.
    setCurrentPlayer(nextAbhebenPlayer);
    setPhase("reveal");
    setShowPassScreen(true);
    setCardsSeen(
      Object.fromEntries(playerInfo.map((player) => [player.id, false])),
    );
    setCardPlayedThisTurn(false);

    setWinner(null);
  }
  function finishAbheben() {
    if (!abgehobenCard) {
      return;
    }

    const gotSpecialCard = isAbhebenCard(abgehobenCard);
    const remainingDeck = deck;

    if (gotSpecialCard) {
      // Abheben player already has the special card.
      // Give Abheben player 4 additional cards.
      // Give the other players 5 cards each.
      setPlayers((current) =>
        current.map((player, index) => {
          const cardsToDraw = index === abhebenPlayer ? 4 : 5;

          return {
            ...player,
            cards: [...player.cards, ...remainingDeck.slice(0, cardsToDraw)],
          };
        }),
      );

      setDeck(remainingDeck.slice(13));
    } else {
      // Nobody got a special card.
      // Everyone gets 5 cards.
      setPlayers((current) =>
        current.map((player, index) => ({
          ...player,
          cards: remainingDeck.slice(index * 5, index * 5 + 5),
        })),
      );

      setDeck(remainingDeck.slice(15));
    }
    setCardsSeen(
      Object.fromEntries(playerInfo.map((player) => [player.id, false])),
    );

    // Abheben is finished.
    // Players can look at their cards whenever they want.
    // The Trumpf player gets a button on the board.
    setCurrentPlayer(trumpCaller);
    setPhase("playing");
    setShowPassScreen(true);
  }

  function startNextRound() {
    const nextTrumpCaller = (trumpCaller + 1) % 3;

    startNewRound(nextTrumpCaller);
  }

  const currentPlayerData = players[currentPlayer];

  const leftPlayer = players[0]; // Player 1
  const topPlayer = players[1]; // Player 2
  const rightPlayer = players[2]; // Player 3

  return (
    <main className="min-h-screen bg-emerald-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Watten</h1>

            <p className="mt-1 text-sm text-emerald-300">
              Hotseat · 3 Players · Trumpf: {Farbe} · Schlag: {schlag}
            </p>
          </div>

          <Link
            to="/watten"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
          >
            Exit
          </Link>
        </div>
        {/* GAME STATUS */}
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <div className="rounded-2xl border border-white/10 bg-emerald-950/80 px-6 py-3 text-center shadow-xl backdrop-blur">
            <div className="flex items-center justify-center gap-8">
              {/* Farbe */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  Farbe
                </p>

                {Farbe ? (
                  <div className="mt-1 flex items-center justify-center gap-2">
                    <span
                      className={`text-2xl ${
                        Farbe === "Herz" || Farbe === "Schelle"
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {Farbe === "Herz"
                        ? "♥"
                        : Farbe === "Schelle"
                          ? "♦"
                          : Farbe === "Eichel"
                            ? "♣"
                            : "♠"}
                    </span>

                    <span className="font-bold text-white">{Farbe}</span>
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-medium text-zinc-500">
                    Not chosen
                  </p>
                )}
              </div>

              {/* Divider */}
              <div className="h-10 w-px bg-white/10" />

              {/* Schlag */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                  Schlag
                </p>

                {schlag ? (
                  <p className="mt-1 text-xl font-bold text-white">{schlag}</p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-zinc-500">
                    Not chosen
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {players.map((player, index) => {
            const isCurrentPlayer = index === currentPlayer;

            return (
              <div
                key={player.id}
                className={`rounded-2xl border p-4 ${
                  isCurrentPlayer
                    ? "border-indigo-400 bg-indigo-500/20"
                    : "border-emerald-700 bg-emerald-900/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">
                    {player.name}
                  </span>

                  {isCurrentPlayer && (
                    <span className="rounded-full bg-indigo-500 px-2.5 py-1 text-xs font-semibold text-white">
                      Your turn
                    </span>
                  )}
                </div>

                <p className="mt-1 text-sm text-emerald-300">
                  {player.cards.length} cards · {tricksWon[player.id] ?? 0}{" "}
                  tricks
                </p>
              </div>
            );
          })}
        </div>
        {notification && (
          <div className="absolute left-1/2 top-8 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-950/90 px-5 py-3 text-sm font-semibold text-red-200 shadow-2xl backdrop-blur">
              <span className="text-xl">⚠️</span>
              <span>{notification}</span>
            </div>
          </div>
        )}

        {showCardViewerPass && viewingPlayer !== null && !winner && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-8 text-center text-white shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-3xl">
                🃏
              </div>

              <h2 className="mt-6 text-2xl font-bold">
                Player wants to see their cards
              </h2>

              <p className="mt-3 text-zinc-400">Pass the device to</p>

              <p className="mt-1 text-xl font-bold text-emerald-400">
                {players[viewingPlayer].name}
              </p>

              <p className="mt-3 text-sm text-zinc-500">
                Make sure nobody else can see the cards.
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowCardViewerPass(false);
                  setShowCardViewer(true);
                }}
                className="mt-8 w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-emerald-950 transition hover:bg-emerald-400"
              >
                I'm ready
              </button>
            </div>
          </div>
        )}
        {showCardViewer && viewingPlayer !== null && !winner && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 p-8 text-white shadow-2xl">
              <p className="text-center text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {players[viewingPlayer].name}
              </p>

              <h2 className="mt-2 text-center text-3xl font-bold">
                Your Cards
              </h2>

              <p className="mt-2 text-center text-sm text-zinc-400">
                These cards are only visible to you.
              </p>

              <div className="mt-8 flex justify-center gap-2">
                {players[viewingPlayer].cards.map((card) => (
                  <WattenCardComponent key={card.id} card={card} disabled />
                ))}
              </div>

              <button
                type="button"
                onClick={finishViewingCards}
                className="mt-8 w-full rounded-xl bg-emerald-500 px-5 py-4 font-bold text-emerald-950 transition hover:bg-emerald-400"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {showPassScreen && !winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-8 text-center text-white shadow-2xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-3xl">
                🃏
              </div>

              <h2 className="mt-6 text-2xl font-bold">Pass the device</h2>

              <p className="mt-3 text-zinc-400">Give the device to</p>

              <p className="mt-1 text-xl font-bold text-emerald-400">
                {players[currentPlayer].name}
              </p>

              <p className="mt-3 text-sm text-zinc-500">
                Make sure nobody else can see your cards.
              </p>

              <button
                type="button"
                onClick={continueHotseat}
                className="mt-8 w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-emerald-950 transition hover:bg-emerald-400"
              >
                I'm ready
              </button>
            </div>
          </div>
        )}
        {phase === "abheben" && !winner && !showPassScreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl bg-zinc-900 p-8 text-center text-white shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {players[abhebenPlayer].name}
              </p>

              <h2 className="mt-2 text-3xl font-bold">Abheben</h2>

              <p className="mt-3 text-zinc-400">
                One of these three special cards can be drawn:
              </p>

              {/* Special cards explanation */}
              <div className="mt-6">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Special cards
                </div>

                <div className="flex justify-center gap-3">
                  {specialCards.map((specialCard) => (
                    <div
                      key={`${specialCard.suit}-${specialCard.rank}`}
                      className="flex h-24 w-16 flex-col items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 shadow-lg"
                    >
                      <span className="text-2xl">
                        {specialCard.suit === "Herz"
                          ? "♥"
                          : specialCard.suit === "Schellen"
                            ? "🔔"
                            : "🌿"}
                      </span>

                      <span className="mt-1 text-xs font-bold">
                        {specialCard.rank}
                      </span>

                      <span className="text-[9px] text-amber-300">
                        {specialCard.suit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawn card */}
              {abgehobenCard ? (
                <div className="mt-8">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Your card
                  </p>

                  <div className="flex justify-center">
                    <div
                      className={
                        isAbhebenCard(abgehobenCard)
                          ? "rounded-2xl border-2 border-amber-400 bg-amber-400/10 p-2 shadow-[0_0_30px_rgba(251,191,36,0.35)]"
                          : "rounded-2xl border border-zinc-700 bg-zinc-800 p-2"
                      }
                    >
                      <WattenCardComponent card={abgehobenCard} disabled />
                    </div>
                  </div>

                  <p
                    className={`mt-4 text-sm font-semibold ${
                      isAbhebenCard(abgehobenCard)
                        ? "text-amber-400"
                        : "text-zinc-400"
                    }`}
                  >
                    {isAbhebenCard(abgehobenCard)
                      ? "🎉 You got a special card!"
                      : "This is not a special card."}
                  </p>

                  <button
                    type="button"
                    onClick={finishAbheben}
                    className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-4 font-bold text-emerald-950 transition hover:bg-emerald-400"
                  >
                    Finish Turn
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={drawAbhebenCard}
                  className="mt-8 w-full rounded-xl bg-emerald-500 px-5 py-4 font-bold text-emerald-950 transition hover:bg-emerald-400"
                >
                  Karte abheben
                </button>
              )}
            </div>
          </div>
        )}
        {phase === "reveal" && (
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/80 px-8 py-6 text-center shadow-xl backdrop-blur">
              <p className="text-lg font-bold text-white">Look at your cards</p>

              <p className="mt-2 text-sm text-emerald-300">
                Select your player and pass the device to them.
              </p>
            </div>
          </div>
        )}

        {phase === "trump" && !winner && !showPassScreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl bg-zinc-900 p-8 text-white shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {players[trumpCaller].name}
              </p>

              <h2 className="mt-2 text-3xl font-bold">Choose Trumpf</h2>

              <p className="mt-2 text-zinc-400">
                Choose the suit that will be trump.
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  ["Herz", "♥", "Herz"],
                  ["Schelle", "♦", "Schelle"],
                  ["Eichel", "♣", "Eichel"],
                  ["Gras", "♠", "Gras"],
                ].map(([value, symbol, name]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFarbe(value as "Herz" | "Schelle" | "Eichel" | "Gras");

                      setPhase("schlag");
                    }}
                    className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6 transition hover:border-emerald-400 hover:bg-emerald-500/10"
                  >
                    <span
                      className={`text-4xl ${
                        value === "Herz" || value === "Schelle"
                          ? "text-red-400"
                          : "text-white"
                      }`}
                    >
                      {symbol}
                    </span>

                    <span className="mt-2 block font-semibold">{name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {phase === "schlag" && !winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 p-8 text-white shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {players[currentPlayer].name}
              </p>

              <h2 className="mt-2 text-3xl font-bold">Choose Schlag</h2>

              <p className="mt-2 text-zinc-400">
                Choose the rank that will be Schlag.
              </p>

              <div className="mt-6 grid grid-cols-4 gap-3 md:grid-cols-8">
                {["7", "8", "9", "10", "Unter", "Ober", "König", "Ass"].map(
                  (rank) => (
                    <button
                      key={rank}
                      type="button"
                      onClick={() => {
                        setSchlag(rank);
                        setCurrentPlayer(trumpCaller);
                        setPhase("playing");
                        setShowPassScreen(false);
                      }}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-4 text-sm font-semibold transition hover:border-emerald-400 hover:bg-emerald-500/10"
                    >
                      {rank}
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}

        {/* Table */}

        <div className="relative min-h-[720px] overflow-hidden rounded-[40px] border-8 border-emerald-900 bg-emerald-700 shadow-2xl">
          {/* Subtle table pattern */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_55%)]" />

          {/* TOP PLAYER */}

          <div
            className={`absolute left-1/2 top-6 w-56 -translate-x-1/2 rounded-2xl border p-4 text-center transition-all ${
              currentPlayerData.id === topPlayer.id
                ? "border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/20 ring-2 ring-amber-400"
                : "border-white/10 bg-emerald-950/40"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="font-bold text-white">{topPlayer.name}</span>

              {currentPlayerData.id === topPlayer.id && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                  Turn
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-emerald-300">
              {topPlayer.cards.length} cards · {tricksWon[topPlayer.id] ?? 0}{" "}
              tricks
            </p>

            <div className="mt-3 flex justify-center">
              {topPlayer.cards.map((card, index) => (
                <div
                  key={card.id}
                  className={`h-16 w-10 rounded-md border border-white/20 bg-zinc-900 shadow-md ${
                    index !== 0 ? "-ml-3" : ""
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => requestToSeeCards(1)}
              className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              👁 See {topPlayer.name}'s cards
            </button>
          </div>

          {/* RIGHT PLAYER */}
          <div
            className={`absolute right-5 top-1/2 w-48 -translate-y-1/2 rounded-2xl border p-4 text-center transition-all ${
              currentPlayerData.id === rightPlayer.id
                ? "border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/20 ring-2 ring-amber-400"
                : "border-white/10 bg-emerald-950/40"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="font-bold text-white">{rightPlayer.name}</span>

              {currentPlayerData.id === rightPlayer.id && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">
                  Turn
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-emerald-300">
              {rightPlayer.cards.length} cards ·{" "}
              {tricksWon[rightPlayer.id] ?? 0} tricks
            </p>

            <div className="mt-3 flex flex-col items-center">
              {rightPlayer.cards.map((card, index) => (
                <div
                  key={card.id}
                  className={`h-10 w-16 rounded-md border border-white/20 bg-zinc-900 shadow-md ${
                    index !== 0 ? "-mt-5" : ""
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => requestToSeeCards(2)}
              className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              👁 See {rightPlayer.name}'s cards
            </button>
          </div>

          {/* LEFT PLAYER */}
          <div
            className={`absolute left-5 top-1/2 w-48 -translate-y-1/2 rounded-2xl border p-4 text-center transition-all ${
              currentPlayerData.id === leftPlayer.id
                ? "border-amber-400 bg-amber-400/20 shadow-lg shadow-amber-400/20 ring-2 ring-amber-400"
                : "border-white/10 bg-emerald-950/40"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="font-bold text-white">{leftPlayer.name}</span>
            </div>

            <p className="mt-1 text-xs text-emerald-300">
              {leftPlayer.cards.length} cards · {tricksWon[leftPlayer.id] ?? 0}{" "}
              tricks
            </p>

            <div className="mt-3 flex flex-col items-center">
              {leftPlayer.cards.map((card, index) => (
                <div
                  key={card.id}
                  className={`h-10 w-16 rounded-md border border-white/20 bg-zinc-900 shadow-md ${
                    index !== 0 ? "-mt-5" : ""
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => requestToSeeCards(0)}
              className="mt-3 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
            >
              👁 See {leftPlayer.name}'s cards
            </button>
          </div>

          {/* PLAYED CARDS */}
          <div className="absolute left-1/2 top-[45%] flex min-h-44 min-w-[360px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-4 rounded-3xl border border-white/10 bg-emerald-950/30 p-6 shadow-inner">
            {playedCards.length === 0 ? (
              <div className="text-center">
                <div className="text-3xl opacity-30">🃏</div>
                <p className="mt-2 text-sm text-emerald-300/50">Play a card</p>
                {/* TRUMPF BUTTON */}
                {phase === "playing" &&
                  !winner &&
                  currentPlayer === trumpCaller &&
                  Farbe === null &&
                  playedCards.length === 0 && (
                    <div className="absolute left-1/2 top-[28%] z-20 -translate-x-1/2">
                      <button
                        type="button"
                        onClick={() => {
                          setPhase("trump");
                        }}
                        className="animate-pulse rounded-2xl bg-amber-400 px-8 py-4 font-bold text-amber-950 shadow-xl shadow-amber-400/30 transition hover:scale-105 hover:bg-amber-300"
                      >
                        Choose Trumpf
                      </button>
                    </div>
                  )}
              </div>
            ) : (
              playedCards.map((played) => (
                <div
                  key={`${played.playerId}-${played.card.id}`}
                  className="flex flex-col items-center gap-2"
                >
                  <WattenCardComponent card={played.card} disabled />

                  <span className="text-xs font-medium text-emerald-200">
                    {
                      players.find((player) => player.id === played.playerId)
                        ?.name
                    }
                  </span>
                </div>
              ))
            )}
          </div>

          {/* CURRENT PLAYER HAND */}
          <div className="absolute bottom-5 left-1/2 w-full -translate-x-1/2 px-6">
            <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-emerald-950/70 p-5 shadow-2xl backdrop-blur">
              {/* Current player */}
              <div className="mb-4 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-1.5 text-sm font-bold text-amber-950 shadow-lg">
                  {currentPlayerData.name}
                  <span>•</span>
                  Your turn
                </div>
              </div>

              {/* Cards */}
              <div className="flex justify-center gap-2">
                {currentPlayerData.cards.map((card) => (
                  <WattenCardComponent
                    key={card.id}
                    card={card}
                    disabled={!!winner || cardPlayedThisTurn}
                    onClick={() => playCard(card)}
                  />
                ))}
              </div>
              {phase === "playing" &&
                playedCards.length < 3 &&
                cardPlayedThisTurn && (
                  <div className="mt-5 flex flex-col items-center gap-2">
                    <p className="text-xs text-emerald-300">
                      Card played. Finish your turn to continue.
                    </p>

                    <button
                      type="button"
                      onClick={finishPlayerTurn}
                      className="animate-pulse rounded-xl bg-amber-400 px-8 py-3 font-bold text-amber-950 shadow-lg shadow-amber-400/20 transition hover:scale-105 hover:bg-amber-300"
                    >
                      Finish Turn
                    </button>
                  </div>
                )}
            </div>
          </div>

          {/* WINNER */}
          {winner && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="rounded-3xl border border-white/10 bg-zinc-900 p-10 text-center shadow-2xl">
                <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                  Round Winner
                </p>

                <h2 className="mt-2 text-4xl font-bold text-white">{winner}</h2>

                <button
                  type="button"
                  onClick={restartGame}
                  className="mt-8 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500"
                >
                  Play Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
