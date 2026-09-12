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
function playCardSound() {
  const audio = new Audio("/sounds/card-play.mp3");
  audio.volume = 0.5;
  void audio.play();
}
export function playHoverSound() {
  const audio = new Audio("/sounds/card-hover.mp3");
  audio.volume = 0.1;
  void audio.play();
}
function MiniWattenCard({ card }: { card: WattenCard }) {
  const isRed = card.suit === "Herz" || card.suit === "Schellen";

  const suitSymbol =
    card.suit === "Herz"
      ? "♥"
      : card.suit === "Schellen"
        ? "🔔"
        : card.suit === "Eichel"
          ? "♣"
          : "🍃";

  return (
    <div className="relative flex h-20 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-zinc-300 bg-white shadow">
      <span
        className={`text-lg font-bold ${
          isRed ? "text-red-600" : "text-zinc-900"
        }`}
      >
        {suitSymbol}
      </span>

      <span
        className={`mt-1 text-[11px] font-bold ${
          isRed ? "text-red-600" : "text-zinc-900"
        }`}
      >
        {card.rank}
      </span>

      <span className="absolute bottom-1 text-[7px] text-zinc-400">
        {card.suit}
      </span>
    </div>
  );
}

export default function WattenGame() {
  const location = useLocation();
  const [phase, setPhase] = useState<
    | "setup"
    | "reveal"
    | "abheben"
    | "trump"
    | "schlag"
    | "playing"
    | "trickReview"
  >("setup");

  const [Farbe, setFarbe] = useState<
    "Herz" | "Schellen" | "Eichel" | "Gras" | null
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
  const [showPassScreen, setShowPassScreen] = useState(false);
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
  const [helpMode, setHelpMode] = useState(false);
  type WattenSide = "solo" | "team";

  const [targetScore, setTargetScore] = useState(15);

  const [scores, setScores] = useState<Record<string, number>>(() => ({
    [playerInfo[0].id]: 0,
    [playerInfo[1].id]: 0,
    [playerInfo[2].id]: 0,
  }));

  const [gameWinner, setGameWinner] = useState<string | null>(null);

  // Every round starts at 2 points.
  const [roundValue, setRoundValue] = useState(2);

  // A proposed raise that the other side still has to answer.
  const [pendingBid, setPendingBid] = useState<{
    side: WattenSide;
    value: number;
  } | null>(null);

  // Prevent one side from raising twice in succession.
  const [lastBidSide, setLastBidSide] = useState<WattenSide | null>(null);

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
  const [showRankingHelp, setShowRankingHelp] = useState(false);
  const [showRules, setShowRules] = useState(false);

  function startGame() {
    setScores({
      [playerInfo[0].id]: 0,
      [playerInfo[1].id]: 0,
      [playerInfo[2].id]: 0,
    });

    setGameWinner(null);

    setRoundValue(2);
    setPendingBid(null);
    setLastBidSide(null);

    // First player who has to perform Abheben.
    setCurrentPlayer(abhebenPlayer);

    setPhase("reveal");
    setShowPassScreen(true);
  }

  function playCard(card: WattenCard) {
    if (winner || cardPlayedThisTurn) {
      return;
    }
    if (!canCurrentPlayerPlayCard(card)) {
      setNotification(
        "Trumpf oder Kritisch!Du musst eine kritische Karte oder einen Trumpf spielen.",
      );

      setTimeout(() => {
        setNotification(null);
      }, 2500);

      return;
    }
    if (!Farbe) {
      setNotification("YWähle zuerst den Trumpf & Schlag.");

      setTimeout(() => {
        setNotification(null);
      }, 2500);

      return;
    }
    playCardSound();

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

  const normalRankValue: Record<string, number> = {
    "7": 1,
    "8": 2,
    "9": 3,
    "10": 4,
    Unter: 5,
    Ober: 6,
    König: 7,
    Ass: 8,
  };

  function getCriticalValue(card: WattenCard): number {
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

  function getWattenStrength(card: WattenCard, leadSuit: string) {
    const criticalValue = getCriticalValue(card);

    // Kritische
    if (criticalValue > 0) {
      return {
        category: 5,
        value: criticalValue,
      };
    }

    // Hauptschlag: Schlag + Trumpffarbe
    if (card.rank === schlag && card.suit === Farbe) {
      return {
        category: 4,
        value: 1,
      };
    }

    // Other Schläge.
    // All are equal, so play order decides between them.
    if (card.rank === schlag) {
      return {
        category: 3,
        value: 1,
      };
    }

    // Normal Trumpf
    if (card.suit === Farbe) {
      return {
        category: 2,
        value: normalRankValue[card.rank] ?? 0,
      };
    }

    // No trump in the trick:
    // only the suit of the first played card matters.
    if (card.suit === leadSuit) {
      return {
        category: 1,
        value: normalRankValue[card.rank] ?? 0,
      };
    }

    // Off-suit normal cards cannot win.
    return {
      category: 0,
      value: 0,
    };
  }
  function determineTrickWinner(cards: PlayedCard[]) {
    const leadSuit = cards[0].card.suit;

    let winningCard = cards[0];
    let winningStrength = getWattenStrength(winningCard.card, leadSuit);

    for (let i = 1; i < cards.length; i++) {
      const played = cards[i];

      const strength = getWattenStrength(played.card, leadSuit);

      const strongerCategory = strength.category > winningStrength.category;

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

  function finishTrick(cards: PlayedCard[]) {
    if (!Farbe || !schlag) {
      return;
    }

    const winningCard = determineTrickWinner(cards);

    setTrickWinner(winningCard);

    // Do NOT remove the cards yet.
    // We want to show them during trickReview.
    setPhase("trickReview");

    setCardPlayedThisTurn(false);
  }

  function finishTrickReview() {
    if (!trickWinner) {
      return;
    }

    const winnerId = trickWinner.playerId;

    const newTricks = {
      ...tricksWon,
      [winnerId]: (tricksWon[winnerId] ?? 0) + 1,
    };

    setTricksWon(newTricks);

    const solo = players[trumpCaller];

    const opponents = players.filter((_, index) => index !== trumpCaller);

    const newSoloTricks = newTricks[solo.id] ?? 0;

    const newTeamTricks = opponents.reduce(
      (sum, player) => sum + (newTricks[player.id] ?? 0),
      0,
    );

    // SOLO wins the round.
    if (newSoloTricks >= 3) {
      awardGamePoints("solo", roundValue);

      setWinner(solo.name);

      setPlayedCards([]);
      setTrickWinner(null);
      setPendingBid(null);
      setPhase("playing");

      return;
    }

    // TEAM wins the round.
    if (newTeamTricks >= 3) {
      awardGamePoints("team", roundValue);

      setWinner(`${opponents[0].name} & ${opponents[1].name}`);

      setPlayedCards([]);
      setTrickWinner(null);
      setPendingBid(null);
      setPhase("playing");

      return;
    }

    // Otherwise winner leads next trick.
    const winnerIndex = players.findIndex((player) => player.id === winnerId);

    setPlayedCards([]);
    setTrickWinner(null);

    setCurrentPlayer(winnerIndex);
    setPhase("playing");

    setCardPlayedThisTurn(false);
    setShowPassScreen(true);
  }
  function getPlayerSide(playerIndex: number): WattenSide {
    return playerIndex === trumpCaller ? "solo" : "team";
  }

  function getSideLabel(side: WattenSide) {
    if (side === "solo") {
      return players[trumpCaller].name;
    }

    const opponents = players.filter((_, index) => index !== trumpCaller);

    return `${opponents[0].name} & ${opponents[1].name}`;
  }
  const currentSide = getPlayerSide(currentPlayer);

  const canRaise =
    phase === "playing" &&
    !winner &&
    !gameWinner &&
    !showPassScreen &&
    !cardPlayedThisTurn &&
    !pendingBid &&
    roundValue < 4 &&
    (lastBidSide === null || currentSide !== lastBidSide);
  function raiseRoundValue() {
    if (!canRaise) {
      return;
    }

    setPendingBid({
      side: currentSide,
      value: roundValue + 1,
    });
  }
  function holdBid() {
    if (!pendingBid) {
      return;
    }

    setRoundValue(pendingBid.value);
    setLastBidSide(pendingBid.side);
    setPendingBid(null);
  }
  function declineBid() {
    if (!pendingBid) {
      return;
    }

    // Bidder wins the previously accepted value.
    awardGamePoints(pendingBid.side, roundValue);

    setWinner(getSideLabel(pendingBid.side));

    setPlayedCards([]);
    setTrickWinner(null);

    setPendingBid(null);
  }

  function getWattenCardRole(card: WattenCard, leadSuit: string): string {
    if (card.suit === "Herz" && card.rank === "König") {
      return "Max · Höchste Kritische";
    }

    if (card.suit === "Schellen" && card.rank === "7") {
      return "Belli · Zweithöchste Kritische";
    }

    if (card.suit === "Eichel" && card.rank === "7") {
      return "Spitz · dritthöchste Kritische";
    }

    if (card.rank === schlag && card.suit === Farbe) {
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
    setRoundValue(2);
    setPendingBid(null);
    setLastBidSide(null);

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
  function isCritical(card: WattenCard) {
    return (
      (card.suit === "Herz" && card.rank === "König") ||
      (card.suit === "Schellen" && card.rank === "7") ||
      (card.suit === "Eichel" && card.rank === "7")
    );
  }

  function isHauptschlag(card: WattenCard) {
    if (!Farbe || !schlag) {
      return false;
    }

    // A Kritischer is always treated as Kritisch, not as Hauptschlag.
    // Example: Herz-König when König + Herz were chosen.
    return !isCritical(card) && card.suit === Farbe && card.rank === schlag;
  }

  function isFirstTrick() {
    return Object.values(tricksWon).every((count) => count === 0);
  }

  function isTrumpfOderKritischActive() {
    if (!Farbe || !schlag) {
      return false;
    }

    if (!isFirstTrick()) {
      return false;
    }

    // The Hauptschlag has to be the very first card of the first trick.
    const firstPlayedCard = playedCards[0]?.card;

    if (!firstPlayedCard || !isHauptschlag(firstPlayedCard)) {
      return false;
    }

    // Once somebody has beaten it with a Kritischer,
    // the remaining players are free again.
    const criticalAlreadyPlayed = playedCards
      .slice(1)
      .some((played) => isCritical(played.card));

    return !criticalAlreadyPlayed;
  }

  function isTrumpfOderKritischCard(card: WattenCard) {
    if (!Farbe) {
      return false;
    }

    return isCritical(card) || card.suit === Farbe;
  }

  function currentPlayerMustFollowTrumpfOderKritisch() {
    if (!isTrumpfOderKritischActive()) {
      return false;
    }

    // The player is only forced if they actually have
    // at least one legal Trumpf/Kritisch response.
    return currentPlayerData.cards.some((card) =>
      isTrumpfOderKritischCard(card),
    );
  }

  function canCurrentPlayerPlayCard(card: WattenCard) {
    if (!currentPlayerMustFollowTrumpfOderKritisch()) {
      return true;
    }

    return isTrumpfOderKritischCard(card);
  }

  function startNextRound() {
    const nextTrumpCaller = (trumpCaller + 1) % 3;

    startNewRound(nextTrumpCaller);
  }

  function canActivateTrumpfOderKritisch(card: WattenCard) {
    return isFirstTrick() && playedCards.length === 0 && isHauptschlag(card);
  }
  function getBeginnerCardHint(card: WattenCard): string | undefined {
    if (!helpMode) {
      return undefined;
    }

    // Existing special first-trick hint gets priority.
    if (canActivateTrumpfOderKritisch(card)) {
      return "Hauptschlag — Wenn du diese Karte jetzt ausspielst, wird „Trumpf oder Kritisch“ aktiv.";
    }

    const criticalValue = getCriticalValue(card);

    if (criticalValue === 3) {
      return "Max — die höchste Kritische und die höchste Karte beim Watten.";
    }

    if (criticalValue === 2) {
      return "Belli — die zweithöchste Kritische.";
    }

    if (criticalValue === 1) {
      return "Spitz — die dritthöchste Kritische.";
    }

    if (isHauptschlag(card)) {
      return "Hauptschlag — die stärkste nicht-kritische Karte.";
    }

    if (card.rank === schlag) {
      return `Schlag (${schlag}) — stärker als normale Trumpfkarten. Werden zwei gleichwertige Schläge gespielt, gewinnt der zuerst gespielte.`;
    }

    if (card.suit === Farbe) {
      return `Trumpf (${Farbe}) — Diese Karte schlägt gewöhnliche Karten, die keine Trümpfe sind.`;
    }

    return undefined;
  }

  function getCardPriorityGroups() {
    if (!Farbe || !schlag) {
      return [];
    }

    const fullDeck = createDeck();

    const sortByRankDescending = (a: WattenCard, b: WattenCard) =>
      (normalRankValue[b.rank] ?? 0) - (normalRankValue[a.rank] ?? 0);

    // 1. Kritische
    const kritische = fullDeck
      .filter((card) => isCritical(card))
      .sort((a, b) => getCriticalValue(b) - getCriticalValue(a));

    // 2. Hauptschlag
    const hauptschlag = fullDeck.filter((card) => isHauptschlag(card));

    // 3. Other Schläge
    const schlaege = fullDeck.filter(
      (card) =>
        card.rank === schlag && !isCritical(card) && !isHauptschlag(card),
    );

    // 4. Remaining Trumpf / Farbe cards
    const trumpfCards = fullDeck
      .filter(
        (card) =>
          card.suit === Farbe && card.rank !== schlag && !isCritical(card),
      )
      .sort(sortByRankDescending);

    // Cards already belonging to one of the special categories
    const specialIds = new Set(
      [...kritische, ...hauptschlag, ...schlaege, ...trumpfCards].map(
        (card) => card.id,
      ),
    );

    // 5. Ordinary cards
    const normalCards = fullDeck
      .filter((card) => !specialIds.has(card.id))
      .sort((a, b) => {
        if (a.suit !== b.suit) {
          return a.suit.localeCompare(b.suit);
        }

        return sortByRankDescending(a, b);
      });

    return [
      {
        title: "Kritische",
        description: "Die drei höchsten Karten: Max → Belli → Spitz.",
        cards: kritische,
      },
      {
        title: "Hauptschlag",
        description: "Schlag + Farbe. Höchste Karte unterhalb der Kritischen.",
        cards: hauptschlag,
      },
      {
        title: "Schläge",
        description: `Alle anderen ${schlag}. Sie sind gleich stark; der zuerst gespielte gewinnt.`,
        cards: schlaege,
      },
      {
        title: `Trumpf / Farbe (${Farbe})`,
        description: "Danach folgen die übrigen Karten der Trumpffarbe.",
        cards: trumpfCards,
      },
      {
        title: "Normale Karten",
        description:
          "Keine feste Reihenfolge zwischen verschiedenen Farben. Es zählt die angespielte Farbe; innerhalb dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
        cards: normalCards,
      },
    ];
  }

  function wouldCardCurrentlyWin(card: WattenCard): boolean | null {
    // No comparison is possible when leading a trick.
    if (playedCards.length === 0) {
      return null;
    }

    const simulatedPlay: PlayedCard = {
      playerId: currentPlayerData.id,
      card,
    };

    const simulatedCards = [...playedCards, simulatedPlay];

    const simulatedWinner = determineTrickWinner(simulatedCards);

    return (
      simulatedWinner.playerId === currentPlayerData.id &&
      simulatedWinner.card.id === card.id
    );
  }
  function awardGamePoints(winningSide: WattenSide, points: number) {
    const updatedScores = { ...scores };

    if (winningSide === "solo") {
      const solo = players[trumpCaller];

      updatedScores[solo.id] = (updatedScores[solo.id] ?? 0) + points;
    } else {
      players.forEach((player, index) => {
        if (index !== trumpCaller) {
          updatedScores[player.id] = (updatedScores[player.id] ?? 0) + points;
        }
      });
    }

    setScores(updatedScores);

    const overallWinners = players.filter(
      (player) => (updatedScores[player.id] ?? 0) >= targetScore,
    );

    if (overallWinners.length > 0) {
      setGameWinner(overallWinners.map((player) => player.name).join(" & "));
    }
  }
  const currentPlayerData = players[currentPlayer];

  const soloPlayer = players[trumpCaller];

  const teamPlayers = players.filter((_, index) => index !== trumpCaller);

  const soloTricks = tricksWon[soloPlayer.id] ?? 0;

  const teamTricks = teamPlayers.reduce(
    (sum, player) => sum + (tricksWon[player.id] ?? 0),
    0,
  );

  // Rotate the seating perspective around the current player.
  const leftOpponentIndex = (currentPlayer + 1) % players.length;
  const rightOpponentIndex = (currentPlayer + 2) % players.length;

  const leftOpponent = players[leftOpponentIndex];
  const rightOpponent = players[rightOpponentIndex];

  return (
    <main className="min-h-screen bg-emerald-950 px-4 py-6 text-white md:px-8">
      <div className="mx-auto w-full max-w-[1800px]">
        {/* Header */}
        <div className="relative z-30 flex items-center justify-end gap-3 pr-2">
          <button
            type="button"
            onClick={() => setHelpMode((current) => !current)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              helpMode
                ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {helpMode ? "💡 Help On" : "💡 Help"}
          </button>
          <button
            type="button"
            onClick={() => setShowRules((current) => !current)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              showRules
                ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            📖 Spielregeln
          </button>
          <Link
            to="/watten"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
          >
            Exit
          </Link>
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
        {/* GEHEN DECISION */}
        {pendingBid && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Gehen
              </p>

              <h2 className="mt-2 text-2xl font-bold text-white">
                {getSideLabel(pendingBid.side)} geht auf {pendingBid.value}
              </h2>

              <p className="mt-4 text-sm leading-6 text-zinc-400">
                Die Gegenseite muss entscheiden, ob sie den neuen Rundenwert
                hält.
              </p>

              <button
                type="button"
                onClick={holdBid}
                className="mt-6 w-full rounded-xl bg-emerald-500 px-5 py-3 font-black text-emerald-950 transition hover:bg-emerald-400"
              >
                {pendingBid.value} halten
              </button>

              <button
                type="button"
                onClick={declineBid}
                className="mt-3 w-full rounded-xl bg-red-500/20 px-5 py-3 font-bold text-red-200 transition hover:bg-red-500/30"
              >
                Nicht halten
              </button>

              <p className="mt-4 text-xs text-zinc-500">
                Bei „Nicht halten“ erhält {getSideLabel(pendingBid.side)}{" "}
                {roundValue} Punkte.
              </p>
            </div>
          </div>
        )}
        {/* OVERALL GAME WINNER */}
        {gameWinner && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 px-6 backdrop-blur-md">
            <div className="w-full max-w-lg rounded-3xl border border-amber-400/30 bg-zinc-950 p-10 text-center shadow-2xl">
              <div className="text-5xl">🏆</div>

              <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-amber-400">
                Gesamtsieger
              </p>

              <h2 className="mt-2 text-4xl font-black text-white">
                {gameWinner}
              </h2>

              <p className="mt-3 text-zinc-400">
                {targetScore} Punkte erreicht
              </p>
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
                  ["Schellen", "♦", "Schellen"],
                  ["Eichel", "♣", "Eichel"],
                  ["Gras", "♠", "Gras"],
                ].map(([value, symbol, name]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setFarbe(
                        value as "Herz" | "Schellen" | "Eichel" | "Gras",
                      );

                      setPhase("schlag");
                    }}
                    className="rounded-2xl border border-zinc-700 bg-zinc-800 p-6 transition hover:border-emerald-400 hover:bg-emerald-500/10"
                  >
                    <span
                      className={`text-4xl ${
                        value === "Herz" || value === "Schellen"
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
        {phase === "trickReview" && trickWinner && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-emerald-950 p-8 shadow-2xl">
              <div className="text-center">
                <p className="text-sm font-semibold uppercase tracking-widest text-amber-400">
                  Stich Review
                </p>

                <h2 className="mt-2 text-3xl font-bold">
                  {
                    players.find((player) => player.id === trickWinner.playerId)
                      ?.name
                  }{" "}
                  gewinnt den Stich!
                </h2>

                <p className="mt-2 text-sm text-emerald-300">
                  Zuerst gespielte Farbe: {playedCards[0]?.card.suit}
                </p>
              </div>

              <div className="mt-8 flex items-start justify-center gap-6">
                {playedCards.map((played, index) => {
                  const isWinner =
                    played.playerId === trickWinner.playerId &&
                    played.card.id === trickWinner.card.id;

                  const player = players.find(
                    (player) => player.id === played.playerId,
                  );

                  const leadSuit = playedCards[0].card.suit;

                  return (
                    <div
                      key={`${played.playerId}-${played.card.id}`}
                      className={`relative flex flex-col items-center rounded-2xl p-4 ${
                        isWinner
                          ? "bg-amber-400/20 ring-2 ring-amber-400"
                          : "bg-white/5"
                      }`}
                    >
                      {/* Play order */}
                      <div className="mb-3 rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                        {player?.name}
                      </div>
                      <WattenCardComponent card={played.card} disabled />

                      <p className="mt-3 font-semibold">{player?.name}</p>

                      <p className="mt-1 text-xs text-emerald-300">
                        {getWattenCardRole(played.card, leadSuit)}
                      </p>

                      {isWinner && (
                        <div className="mt-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
                          Stich-Sieger
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={finishTrickReview}
                className="mx-auto mt-8 block rounded-xl bg-amber-400 px-8 py-3 font-bold text-amber-950 transition hover:bg-amber-300"
              >
                Weiter
              </button>
            </div>
          </div>
        )}
        {showRules && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-8 text-white shadow-2xl">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                    Spielregeln
                  </p>

                  <h2 className="mt-1 text-3xl font-bold">
                    Bayerisches Watten · 3 Spieler
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    Regelvariante, die in diesem Spiel verwendet wird.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRules(false)}
                  className="rounded-xl bg-white/10 px-4 py-2 font-bold transition hover:bg-white/20"
                >
                  ✕
                </button>
              </div>

              <div className="mt-8 space-y-6">
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    1 · Spieler und Ziel
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Ein Spieler spielt allein. Die beiden anderen Spieler bilden
                    gemeinsam das gegnerische Team. Wer zuerst drei der fünf
                    Stiche gewinnt, gewinnt die Runde.
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    2 · Kartenrangfolge
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Die höchsten Karten sind die drei Kritischen: Herz-König
                    (Max), Schellen-7 (Belli) und Eichel-7 (Spitz). Danach folgt
                    der Hauptschlag, dann die übrigen Schläge, danach die Karten
                    der Trumpffarbe.
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    3 · Schlag und Farbe
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Schlag bezeichnet einen Kartenrang, zum Beispiel Ober. Farbe
                    bezeichnet die Trumpffarbe. Die Karte, die gleichzeitig
                    Schlag und Trumpffarbe ist, ist der Hauptschlag.
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    4 · Einen Stich gewinnen
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Der höchste Trumpf gewinnt den Stich. Liegt kein Trumpf im
                    Stich, gewinnt die höchste Karte der zuerst ausgespielten
                    Farbe. Gleichwertige Schläge werden durch ihre
                    Spielreihenfolge entschieden: der zuerst gespielte gewinnt.
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    5 · Trumpf oder Kritisch
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Wird der Hauptschlag als erste Karte des ersten Stiches
                    ausgespielt, gilt „Trumpf oder Kritisch“. Die folgenden
                    Spieler müssen eine Karte der Trumpffarbe oder einen
                    Kritischen spielen, sofern sie eine solche Karte besitzen.
                    Wird der Hauptschlag durch einen Kritischen geschlagen,
                    endet diese Verpflichtung für die noch folgenden Spieler.
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    6 · Nächster Stich
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    Der Gewinner eines Stiches spielt die erste Karte des
                    nächsten Stiches aus.
                  </p>
                </section>
              </div>

              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="mt-8 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-amber-950 transition hover:bg-amber-300"
              >
                Regeln schließen
              </button>
            </div>
          </div>
        )}

        {/* Table + round score */}
        <div className="grid w-full grid-cols-[16rem_minmax(0,1fr)_16rem] items-start gap-5">
          {/* LEFT SIDEBAR: PUNKTESTAND */}
          <aside className="relative w-64 pt-15">
            {/* CARD PRIORITY HELP */}
            {helpMode && Farbe && schlag && (
              <div className="absolute left-0 top-5 z-50 w-full">
                <button
                  type="button"
                  onClick={() => setShowRankingHelp((current) => !current)}
                  className={`w-full rounded-xl border px-4 py-2 text-xs font-bold shadow-lg transition ${
                    showRankingHelp
                      ? "border-amber-400/40 bg-amber-400 text-amber-950 hover:bg-amber-300"
                      : "border-white/10 bg-zinc-950/95 text-white hover:bg-zinc-900"
                  }`}
                >
                  {showRankingHelp
                    ? "📚 Kartenrangfolge ausblenden"
                    : "📚 Kartenrangfolge einblenden"}
                </button>

                {showRankingHelp && (
                  <div className="absolute left-0 top-full mt-2 h-[650px] w-full overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur">
                    <div className="mb-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                        Anfängerhilfe
                      </p>

                      <h2 className="mt-1 text-xl font-bold text-white">
                        Kartenrangfolge
                      </h2>

                      <p className="mt-1 text-xs text-zinc-400">
                        Von oben nach unten: höchste Priorität zuerst.
                      </p>

                      <div className="mt-3 flex gap-4 text-xs">
                        <span className="text-emerald-300">
                          Farbe: <strong>{Farbe}</strong>
                        </span>

                        <span className="text-amber-300">
                          Schlag: <strong>{schlag}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {getCardPriorityGroups().map((group, groupIndex) => (
                        <section
                          key={group.title}
                          className="rounded-xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                              {groupIndex + 1}
                            </div>

                            <div>
                              <h3 className="font-bold text-white">
                                {group.title}
                              </h3>

                              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                                {group.description}
                              </p>
                            </div>
                          </div>

                          {group.cards.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.cards.map((card) => (
                                <MiniWattenCard key={card.id} card={card} />
                              ))}
                            </div>
                          ) : (
                            <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-zinc-500">
                              Keine Karte in dieser Kategorie.
                            </p>
                          )}
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="h-[650px] rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Punktestand
              </p>

              <h3 className="mt-1 text-lg font-bold text-white">
                Ziel: {targetScore} Punkte
              </h3>

              <div className="mt-5 space-y-4">
                {players.map((player, index) => {
                  const points = scores[player.id] ?? 0;

                  return (
                    <div
                      key={player.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block truncate font-semibold text-white">
                            {player.name}
                          </span>

                          {index === trumpCaller && phase !== "setup" && (
                            <span className="mt-1 inline-block rounded-full bg-amber-400/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-300">
                              Alleinspieler
                            </span>
                          )}
                        </div>

                        <strong className="shrink-0 text-white">
                          {points} / {targetScore}
                        </strong>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-amber-400 transition-all duration-300"
                          style={{
                            width: `${Math.min(
                              100,
                              (points / targetScore) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* CENTER: PLAYING TABLE */}
          <div className="relative min-h-[640px] min-w-0 overflow-visible rounded-[100px] border-[8px] border-emerald-900 bg-emerald-700 shadow-2xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_55%)]" />
            {/* GAME STATUS - BETWEEN OPPONENTS */}
            <div className="absolute left-1/2 top-8 z-20 -translate-x-1/2">
              <div className="flex min-w-72 flex-col items-center rounded-2xl border border-white/10 bg-emerald-950/80 px-5 py-3 shadow-lg backdrop-blur">
                {/* Farbe + Schlag */}
                <div className="flex items-center justify-center gap-10">
                  <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
                      Farbe
                    </p>

                    {Farbe ? (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={`text-xl font-bold ${
                            Farbe === "Herz" || Farbe === "Schellen"
                              ? "text-red-400"
                              : "text-white"
                          }`}
                        >
                          {Farbe === "Herz"
                            ? "♥"
                            : Farbe === "Schellen"
                              ? "♦"
                              : Farbe === "Eichel"
                                ? "♣"
                                : "♠"}
                        </span>

                        <span className="text-sm font-bold text-white">
                          {Farbe}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-zinc-500">–</span>
                    )}
                  </div>

                  <div className="h-7 w-px bg-white/10" />

                  <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-300">
                      Schlag
                    </p>

                    <p className="mt-0.5 text-base font-bold text-white">
                      {schlag ?? "–"}
                    </p>
                  </div>
                </div>

                {/* exact Hauptschlag */}
                {Farbe && schlag && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
                      Hauptschlag
                    </span>

                    <div className="flex h-8 min-w-12 items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-white px-2.5">
                      <span
                        className={`text-lg font-black ${
                          Farbe === "Herz" || Farbe === "Schellen"
                            ? "text-red-600"
                            : "text-zinc-900"
                        }`}
                      >
                        {Farbe === "Herz"
                          ? "♥"
                          : Farbe === "Schellen"
                            ? "♦"
                            : Farbe === "Eichel"
                              ? "♣"
                              : "♠"}
                      </span>

                      <span className="text-xl font-black text-zinc-900">
                        {schlag}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* PRE-GAME SETUP */}
            {phase === "setup" && (
              <div className="absolute inset-0 z-40 flex items-center justify-center rounded-[110px] bg-emerald-950/20 backdrop-blur-sm">
                <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950/95 p-8 text-center shadow-2xl backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                    Neues Spiel
                  </p>

                  <h2 className="mt-2 text-3xl font-bold text-white">Watten</h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    Wählt zuerst, wie viele Punkte zum Gesamtsieg benötigt
                    werden.
                  </p>

                  {/* Players */}
                  <div className="mt-6 flex justify-center gap-2">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white"
                      >
                        {player.name}
                      </div>
                    ))}
                  </div>

                  {/* Target score */}
                  <div className="mt-8">
                    <label className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
                      Punkte zum Sieg
                    </label>

                    <div className="mt-3 flex items-center justify-center gap-3">
                      {[11, 15, 18].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setTargetScore(score)}
                          className={`h-12 w-16 rounded-xl font-black transition ${
                            targetScore === score
                              ? "bg-amber-400 text-amber-950 ring-2 ring-amber-200"
                              : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4">
                      <label className="text-xs text-zinc-500">
                        Oder eigener Wert:
                      </label>

                      <input
                        type="number"
                        min={4}
                        max={50}
                        value={targetScore}
                        onChange={(e) => {
                          const value = Number(e.target.value);

                          if (Number.isFinite(value)) {
                            setTargetScore(Math.max(4, Math.min(50, value)));
                          }
                        }}
                        className="mx-auto mt-2 block w-24 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-center font-bold text-white outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Basic scoring explanation */}
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-left text-sm text-zinc-300">
                    <div className="flex justify-between">
                      <span>Normaler Rundensieg</span>
                      <strong className="text-amber-300">2 Punkte</strong>
                    </div>

                    <div className="mt-2 flex justify-between">
                      <span>Gehen möglich bis</span>
                      <strong className="text-amber-300">4 Punkte</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startGame}
                    className="mt-8 w-full rounded-2xl bg-amber-400 px-6 py-4 text-lg font-black text-amber-950 shadow-xl transition hover:scale-[1.02] hover:bg-amber-300"
                  >
                    Spiel starten
                  </button>
                </div>
              </div>
            )}

            {/* LEFT OPPONENT */}
            <div className="absolute left-10 top-8 z-20 w-48 rounded-2xl border border-white/10 bg-emerald-950/55 p-3 text-center shadow-lg transition-all duration-300">
              {/* NEXT PLAYER */}
              <div className="absolute -top-2 right-2 rounded-full border border-emerald-400/30 bg-emerald-950 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-300 shadow">
                Nächster
              </div>

              <div className="text-lg font-bold text-white">
                {leftOpponent.name}
              </div>

              <p className="mt-0.5 text-[11px] text-emerald-300">
                {leftOpponent.cards.length} Karten ·{" "}
                {tricksWon[leftOpponent.id] ?? 0} Stiche
              </p>

              {/* Hidden cards */}
              <div className="mt-2 flex justify-center">
                {leftOpponent.cards.map((card, index) => (
                  <div
                    onMouseEnter={playHoverSound}
                    key={card.id}
                    className={`relative h-14 w-9 rounded-md border border-white/20 bg-zinc-900 shadow-md
  transition-all duration-200 ease-out
  hover:z-20 hover:-translate-y-2 hover:scale-110 hover:border-amber-300/50 hover:shadow-xl
  ${index !== 0 ? "-ml-3" : ""}
`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => requestToSeeCards(leftOpponentIndex)}
                className="mt-2 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-white/20"
              >
                👁 Karten ansehen
              </button>
            </div>

            {/* RIGHT OPPONENT */}
            <div className="absolute right-10 top-8 z-20 w-48 rounded-2xl border border-white/10 bg-emerald-950/55 p-3 text-center shadow-lg transition-all duration-300">
              <div className="text-lg font-bold text-white">
                {rightOpponent.name}
              </div>

              <p className="mt-0.5 text-[11px] text-emerald-300">
                {rightOpponent.cards.length} Karten ·{" "}
                {tricksWon[rightOpponent.id] ?? 0} Stiche
              </p>

              {/* Hidden cards */}
              <div className="mt-2 flex justify-center">
                {rightOpponent.cards.map((card, index) => (
                  <div
                    onMouseEnter={playHoverSound}
                    key={card.id}
                    className={`relative h-14 w-9 rounded-md border border-white/20 bg-zinc-900 shadow-md
  transition-all duration-200 ease-out
  hover:z-20 hover:-translate-y-2 hover:scale-110 hover:border-amber-300/50 hover:shadow-xl
  ${index !== 0 ? "-ml-3" : ""}
`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => requestToSeeCards(rightOpponentIndex)}
                className="mt-2 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white transition hover:bg-white/20"
              >
                👁 Karten ansehen
              </button>
            </div>

            {/* PLAYED CARDS */}
            <div className="absolute left-1/2 top-[46%] z-10 flex h-44 w-[380px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-3 rounded-3xl border border-white/10 bg-emerald-950/30 p-4 shadow-inner">
              {playedCards.length === 0 ? (
                <div className="text-center">
                  <div className="text-3xl opacity-30">🃏</div>
                  <p className="mt-2 text-sm text-emerald-300/50">
                    Play a card
                  </p>
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
                    onMouseEnter={playHoverSound}
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
            <div className="absolute bottom-60 left-50">
              {isTrumpfOderKritischActive() && (
                <div
                  className={`mx-auto mb-3 w-fit rounded-xl border px-4 py-2 text-center text-sm font-bold ${
                    currentPlayerMustFollowTrumpfOderKritisch()
                      ? "border-red-400/50 bg-red-500/20 text-red-100"
                      : "border-amber-400/50 bg-amber-400/20 text-amber-100"
                  }`}
                >
                  {currentPlayerMustFollowTrumpfOderKritisch()
                    ? "Trumpf oder Kritisch! You must play one of the highlighted cards."
                    : "Trumpf oder Kritisch — you have neither, so you may play any card."}
                </div>
              )}
            </div>

            {!showPassScreen && phase === "playing" && (
              <>
                {/* CURRENT PLAYER HAND */}
                <div className="absolute bottom-3 left-1/2 z-30 w-full -translate-x-1/2 px-10">
                  <div className="relative mx-auto min-h-40 max-w-3xl rounded-2xl border border-white/10 bg-zinc-950/95 p-2.5 shadow-2xl backdrop-blur-md">
                    {/* Active player label */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-5 py-1.5 text-sm font-black text-amber-950 shadow-lg">
                      ▼ {currentPlayerData.name} · AM ZUG ·{" "}
                      {tricksWon[currentPlayerData.id] ?? 0}{" "}
                      {(tricksWon[currentPlayerData.id] ?? 0) === 1
                        ? "Stich"
                        : "Stiche"}
                    </div>
                    {/* Current player */}
                    <div className="mb-1 text-center">
                      <div className="mb-1 text-center">
                        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                          Handkarten
                        </span>

                        <span className="ml-2 text-sm font-bold text-white">
                          {currentPlayerData.name}
                        </span>
                      </div>
                    </div>

                    {/* Help + Cards + Finish Turn */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                      {/* LEFT: Help legend */}
                      <div className="flex justify-end">
                        {helpMode &&
                          playedCards.length > 0 &&
                          !cardPlayedThisTurn && (
                            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold">
                              <span className="flex items-center gap-2 text-green-300">
                                <span className="h-3 w-3 rounded-full bg-green-500" />
                                Schlägt den aktuellen Gewinner
                              </span>

                              <span className="flex items-center gap-2 text-red-300">
                                <span className="h-3 w-3 rounded-full bg-red-500" />
                                Schlägt den aktuellen Gewinner nicht
                              </span>
                            </div>
                          )}
                      </div>

                      {/* CENTER: Cards */}
                      <div className="flex justify-center gap-2">
                        {currentPlayerData.cards.map((card) => {
                          const mustFollow =
                            currentPlayerMustFollowTrumpfOderKritisch();

                          const legalUnderForcedRule =
                            canCurrentPlayerPlayCard(card);

                          const comparison =
                            helpMode &&
                            playedCards.length > 0 &&
                            !cardPlayedThisTurn
                              ? wouldCardCurrentlyWin(card)
                              : null;

                          return (
                            <WattenCardComponent
                              key={card.id}
                              card={card}
                              disabled={!!winner || cardPlayedThisTurn}
                              invalid={
                                mustFollow &&
                                !legalUnderForcedRule &&
                                !cardPlayedThisTurn
                              }
                              requiredChoice={
                                mustFollow &&
                                legalUnderForcedRule &&
                                !cardPlayedThisTurn
                              }
                              helpStatus={
                                helpMode &&
                                !cardPlayedThisTurn &&
                                legalUnderForcedRule &&
                                comparison !== null
                                  ? comparison
                                    ? "winning"
                                    : "losing"
                                  : undefined
                              }
                              hint={getBeginnerCardHint(card)}
                              onClick={() => playCard(card)}
                            />
                          );
                        })}
                      </div>

                      {/* RIGHT: Finish Turn */}
                      <div className="flex justify-start">
                        {phase === "playing" &&
                          playedCards.length < 3 &&
                          cardPlayedThisTurn && (
                            <div className="flex flex-col items-center gap-2">
                              <p className="text-center text-xs font-medium text-emerald-200">
                                Card played.
                              </p>

                              <button
                                type="button"
                                onClick={finishPlayerTurn}
                                className="animate-pulse whitespace-nowrap rounded-xl bg-amber-400 px-5 py-3 font-bold text-amber-950 shadow-xl shadow-amber-400/30 transition hover:scale-105 hover:bg-amber-300"
                              >
                                Finish Turn
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            {/* WINNER */}
            {winner && (
              <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="rounded-3xl border border-white/10 bg-zinc-900 p-10 text-center shadow-2xl">
                  <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                    Round Winner
                  </p>

                  <h2 className="mt-2 text-4xl font-bold text-white">
                    {winner}
                  </h2>

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
          {/* RIGHT SIDEBAR: STICHSTAND */}
          <aside className="w-64 pt-10">
            <div className="h-[650px] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Aktueller Stichstand
              </p>

              <h3 className="mt-1 text-lg font-bold text-white">1 gegen 2</h3>

              {/* SOLO */}
              <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                  Alleinspieler
                </p>

                <p className="mt-1 font-bold text-white">{soloPlayer.name}</p>

                <p className="mt-2 text-2xl font-black text-amber-400">
                  {soloTricks}
                </p>

                <p className="text-xs text-zinc-400">
                  {soloTricks === 1 ? "Stich" : "Stiche"}
                </p>
              </div>

              {/* VS */}
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />

                <span className="text-xs font-bold text-zinc-500">VS</span>

                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* TEAM */}
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  Gegenspieler
                </p>

                <p className="mt-1 font-bold text-white">
                  {teamPlayers[0].name}
                  <span className="text-zinc-500"> & </span>
                  {teamPlayers[1].name}
                </p>

                <p className="mt-2 text-2xl font-black text-emerald-400">
                  {teamTricks}
                </p>

                <p className="text-xs text-zinc-400">
                  {teamTricks === 1 ? "Stich" : "Stiche"}
                </p>
              </div>

              {/* STICH PROGRESS */}
              <div className="mt-5">
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  3 Stiche zum Sieg
                </p>

                {/* Solo */}
                <div className="grid grid-cols-3 gap-1">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full ${
                        index < soloTricks ? "bg-amber-400" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>

                {/* Team */}
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className={`h-2 rounded-full ${
                        index < teamTricks ? "bg-emerald-400" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* RUNDENWERT / GEHEN */}
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Rundenwert
                </p>

                <p className="mt-1 text-2xl font-black text-amber-400">
                  {roundValue} Punkte
                </p>

                {canRaise && (
                  <button
                    type="button"
                    onClick={raiseRoundValue}
                    className="mt-3 w-full rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-amber-950 transition hover:bg-amber-300"
                  >
                    Gehen auf {roundValue + 1}
                  </button>
                )}

                {roundValue === 4 && (
                  <p className="mt-2 text-xs font-semibold text-zinc-500">
                    Maximum erreicht
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
