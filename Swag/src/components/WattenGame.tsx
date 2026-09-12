import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import type { WattenCard } from "../utils/watten";
import {
  createDeck,
  determineTrickWinner,
  getCriticalValue,
  getNextPlayer,
  getPreviousPlayer,
  getWattenCardRole,
  isAbhebenCard,
  isCritical,
  isFirstTrick,
  isHauptschlag,
  isTrumpfOderKritischActive,
  isTrumpfOderKritischCard,
  mustFollowTrumpfOderKritisch,
  normalRankValue,
  shuffleDeck,
  wouldCardWin,
} from "../utils/watten";
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
    | "dealReady"
    | "trump"
    | "schlag"
    | "playing"
    | "trickPause"
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

  const initialDealer = playerInfo.length - 1;

  const [dealer, setDealer] = useState(initialDealer);

  // Vorhand is the player to the left of the dealer.
  // In the 3-player version, Vorhand is also the solo player.
  const [trumpCaller, setTrumpCaller] = useState(() =>
    getNextPlayer(initialDealer, playerInfo.length),
  );

  // The player to the right of the dealer cuts.
  const abhebenPlayer = getPreviousPlayer(dealer, players.length);

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
  type AbhebenAnimation =
    | "idle"
    | "revealing"
    | "returning"
    | "taking"
    | "finished";

  const [abhebenAnimation, setAbhebenAnimation] =
    useState<AbhebenAnimation>("idle");

  const [selectedAbhebenIndex, setSelectedAbhebenIndex] = useState<
    number | null
  >(null);
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

    if (newPlayedCards.length === players.length) {
      finishTrick(newPlayedCards);
    }
  }

  function finishPlayerTurn() {
    if (!cardPlayedThisTurn) {
      return;
    }

    const nextPlayer = getNextPlayer(currentPlayer, players.length);

    setCardPlayedThisTurn(false);
    setCurrentPlayer(nextPlayer);
    setShowPassScreen(true);
  }

  function chooseAbhebenCard(cardIndex: number) {
    if (
      abhebenAnimation !== "idle" ||
      abhebenFinished ||
      selectedAbhebenIndex !== null
    ) {
      return;
    }

    const chosenCard = deck[cardIndex];

    if (!chosenCard) {
      return;
    }

    setSelectedAbhebenIndex(cardIndex);
    setAbgehobenCard(chosenCard);

    // Render one frame face-down.
    setAbhebenAnimation("idle");

    window.setTimeout(() => {
      // Flip the selected card.
      setAbhebenAnimation("revealing");

      window.setTimeout(() => {
        if (isAbhebenCard(chosenCard)) {
          // Kritische flies toward player's hand.
          setAbhebenAnimation("taking");

          window.setTimeout(() => {
            // Actually remove it from the deck.
            setDeck((currentDeck) =>
              currentDeck.filter((card) => card.id !== chosenCard.id),
            );

            // And add it to Abheber's hand.
            setPlayers((currentPlayers) =>
              currentPlayers.map((player, index) =>
                index === abhebenPlayer
                  ? {
                      ...player,
                      cards: [...player.cards, chosenCard],
                    }
                  : player,
              ),
            );

            setAbhebenAnimation("finished");
            setAbhebenFinished(true);

            window.setTimeout(() => {
              setPhase("dealReady");
            }, 350);
          }, 700);
        } else {
          // Normal card returns visually to deck.
          setAbhebenAnimation("returning");

          window.setTimeout(() => {
            // No setDeck() here.
            // It never left the real deck.
            setAbhebenAnimation("finished");
            setAbhebenFinished(true);

            window.setTimeout(() => {
              setPhase("dealReady");
            }, 350);
          }, 700);
        }
      }, 650);
    }, 50);
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
    if (!Farbe || !schlag) {
      return;
    }

    const winningCard = determineTrickWinner(cards, Farbe, schlag);

    setTrickWinner(winningCard);

    // Do NOT remove the cards yet.
    // We want to show them during trickReview.
    setPhase("trickPause");
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
  function isSideGespannt(side: WattenSide) {
    const sidePlayers =
      side === "solo"
        ? [players[trumpCaller]]
        : players.filter((_, index) => index !== trumpCaller);

    return sidePlayers.some((player) => {
      const points = scores[player.id] ?? 0;

      return points >= targetScore - 2 && points < targetScore;
    });
  }

  const currentSide = getPlayerSide(currentPlayer);
  const currentSideIsGespannt = isSideGespannt(currentSide);
  const canRaise =
    phase === "playing" &&
    !winner &&
    !gameWinner &&
    !showPassScreen &&
    !cardPlayedThisTurn &&
    !pendingBid &&
    !currentSideIsGespannt &&
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
    const nextDealer = getNextPlayer(dealer, players.length);

    startNewRound(nextDealer);
  }

  function startNextRound() {
    const nextDealer = getNextPlayer(dealer, players.length);

    startNewRound(nextDealer);
  }

  function startNewRound(nextDealer: number) {
    const newDeck = shuffleDeck(createDeck());
    const nextTrumpCaller = getNextPlayer(nextDealer, players.length);

    const nextAbhebenPlayer = getPreviousPlayer(nextDealer, players.length);
    setDealer(nextDealer);
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
    setAbgehobenCard(null);

    setSelectedAbhebenIndex(null);
    setAbhebenAnimation("idle");
    setAbhebenFinished(false);

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
    if (!abhebenFinished) {
      return;
    }

    const { dealtPlayers, remainingDeck } = dealRemainingCards(
      players,
      deck,
      dealer,
    );

    setPlayers(dealtPlayers);
    setDeck(remainingDeck);

    setCardsSeen(
      Object.fromEntries(playerInfo.map((player) => [player.id, false])),
    );

    // Vorhand chooses Schlag/Farbe
    // and later leads the first trick.
    setCurrentPlayer(trumpCaller);

    setPhase("playing");
    setShowPassScreen(true);
  }

  function canCurrentPlayerPlayCard(card: WattenCard) {
    if (!currentPlayerMustFollowTrumpfOderKritisch) {
      return true;
    }

    return isTrumpfOderKritischCard(card, Farbe);
  }

  function canActivateTrumpfOderKritisch(card: WattenCard) {
    return (
      isFirstTrick(tricksWon) &&
      playedCards.length === 0 &&
      isHauptschlag(card, Farbe, schlag)
    );
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

    if (isHauptschlag(card, Farbe, schlag)) {
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

    const kritische = fullDeck
      .filter((card) => isCritical(card))
      .sort((a, b) => getCriticalValue(b) - getCriticalValue(a));

    const hauptschlag = fullDeck.filter((card) =>
      isHauptschlag(card, Farbe, schlag),
    );

    const schlaege = fullDeck.filter(
      (card) =>
        card.rank === schlag &&
        !isCritical(card) &&
        !isHauptschlag(card, Farbe, schlag),
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
  function dealRemainingCards(
    currentPlayers: Player[],
    currentDeck: WattenCard[],
    dealerIndex: number,
  ) {
    const dealtPlayers = currentPlayers.map((player) => ({
      ...player,
      cards: [...player.cards],
    }));

    const remainingDeck = [...currentDeck];

    // Vorhand receives first.
    const firstPlayer = getNextPlayer(dealerIndex, dealtPlayers.length);

    const dealOrder = Array.from(
      { length: dealtPlayers.length },
      (_, offset) => (firstPlayer + offset) % dealtPlayers.length,
    );

    // First packet -> everyone reaches 3 cards.
    // Second packet -> everyone reaches 5 cards.
    //
    // Someone who already received a Kritische
    // during Abheben gets correspondingly fewer.
    for (const targetHandSize of [3, 5]) {
      for (const playerIndex of dealOrder) {
        const player = dealtPlayers[playerIndex];

        const cardsNeeded = targetHandSize - player.cards.length;

        if (cardsNeeded <= 0) {
          continue;
        }

        const cardsToGive = remainingDeck.splice(0, cardsNeeded);

        player.cards.push(...cardsToGive);
      }
    }

    return {
      dealtPlayers,
      remainingDeck,
    };
  }
  const currentPlayerData = players[currentPlayer];

  const soloPlayer = players[trumpCaller];

  const abhebenPlayerData = players[abhebenPlayer];

  const teamPlayers = players.filter((_, index) => index !== trumpCaller);

  const soloTricks = tricksWon[soloPlayer.id] ?? 0;

  const teamTricks = teamPlayers.reduce(
    (sum, player) => sum + (tricksWon[player.id] ?? 0),
    0,
  );
  const trumpfOderKritischActive = isTrumpfOderKritischActive(
    playedCards,
    tricksWon,
    Farbe,
    schlag,
  );

  const currentPlayerMustFollowTrumpfOderKritisch =
    mustFollowTrumpfOderKritisch(
      currentPlayerData.cards,
      playedCards,
      tricksWon,
      Farbe,
      schlag,
    );

  // Rotate the seating perspective around the current player.
  const leftOpponentIndex = getNextPlayer(currentPlayer, players.length);

  const rightOpponentIndex = getPreviousPlayer(currentPlayer, players.length);

  const leftOpponent = players[leftOpponentIndex];

  const rightOpponent = players[rightOpponentIndex];

  function openTrickReview() {
    setCardPlayedThisTurn(false);
    setPhase("trickReview");
  }

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

              {/* ABHEBEN CARD SELECTION */}
              <div className="mt-8">
                {!abgehobenCard ? (
                  <>
                    <p className="mb-4 text-sm font-semibold text-zinc-300">
                      Wähle eine Karte zum Abheben
                    </p>

                    <div className="space-y-4">
                      {[deck.slice(0, 16), deck.slice(16)].map(
                        (row, rowIndex) => (
                          <div
                            key={rowIndex}
                            className="flex justify-center px-10"
                          >
                            {row.map((card, index) => {
                              const actualIndex = rowIndex * 16 + index;

                              return (
                                <button
                                  key={card.id}
                                  type="button"
                                  onClick={() => chooseAbhebenCard(actualIndex)}
                                  className={`
                relative h-20 w-12
                rounded-lg
                border border-white/20
                bg-zinc-950
                shadow-lg
                transition-all
                duration-200
                hover:z-30
                hover:-translate-y-3
                hover:scale-110
                hover:border-amber-300
                ${index !== 0 ? "-ml-5" : ""}
              `}
                                >
                                  <div className="absolute inset-1 rounded-md border border-emerald-300/30 bg-emerald-900" />
                                </button>
                              );
                            })}
                          </div>
                        ),
                      )}
                    </div>

                    <p className="mt-4 text-xs text-zinc-500">
                      Wähle eine der {deck.length} verdeckten Karten.
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="abheben-card-scene relative h-40 w-28">
                      <div
                        className={`abheben-card-flip relative h-full w-full ${
                          abhebenAnimation !== "idle" ? "is-flipped" : ""
                        }`}
                      >
                        {/* BACK */}
                        <div className="abheben-card-face absolute inset-0 rounded-xl border-2 border-white/20 bg-zinc-950 shadow-xl">
                          <div className="absolute inset-2 rounded-lg border border-emerald-400/40 bg-emerald-900">
                            <div className="absolute inset-2 rounded border border-white/10" />
                          </div>
                        </div>

                        {/* FRONT */}
                        <div className="abheben-card-face abheben-card-front absolute inset-0">
                          <WattenCardComponent card={abgehobenCard} disabled />
                        </div>
                      </div>
                    </div>

                    {abhebenAnimation === "revealing" && (
                      <p className="mt-4 font-semibold text-white">
                        Karte wird aufgedeckt...
                      </p>
                    )}

                    {abhebenAnimation === "returning" && (
                      <p className="mt-4 font-semibold text-zinc-300">
                        Keine Kritische — die Karte kommt zurück in den Stapel.
                      </p>
                    )}

                    {abhebenAnimation === "taking" && (
                      <p className="mt-4 font-semibold text-amber-300">
                        Kritische! Die Karte kommt auf deine Hand.
                      </p>
                    )}

                    {abhebenAnimation === "finished" && (
                      <p className="mt-4 font-semibold text-emerald-300">
                        Abheben beendet — Karten werden zusammengelegt...
                      </p>
                    )}
                  </div>
                )}
              </div>
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

              <h2 className="mt-2 text-3xl font-bold">Trumpf</h2>

              <p className="mt-2 text-zinc-400">Wähle den Trumpf.</p>

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

              <h2 className="mt-2 text-3xl font-bold">Schlag</h2>

              <p className="mt-2 text-zinc-400">Wähle den Schlag.</p>

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
                        {getWattenCardRole(
                          played.card,
                          leadSuit,
                          Farbe,
                          schlag,
                        )}
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
            {/* DECK READY AFTER ABHEBEN */}
            {phase === "dealReady" && !winner && (
              <div className="absolute left-1/2 top-[43%] z-40 -translate-x-1/2 -translate-y-1/2">
                <div className="flex items-center gap-10 rounded-3xl border border-white/10 bg-emerald-950/70 px-10 py-8 shadow-2xl backdrop-blur-sm">
                  {/* Animated deck */}
                  <div className="flex flex-col items-center">
                    <div className="relative h-32 w-24">
                      {[0, 1, 2, 3, 4, 5].map((index) => (
                        <div
                          key={index}
                          className={`watten-deck-gather-card deck-gather-${index} absolute inset-0 rounded-xl border-2 border-white/20 bg-zinc-950 shadow-xl`}
                        >
                          <div className="absolute inset-2 rounded-lg border border-emerald-400/40 bg-emerald-900">
                            <div className="absolute inset-2 rounded border border-white/10" />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-sm font-semibold text-emerald-200">
                      {deck.length} Karten im Stapel
                    </p>
                  </div>

                  {/* Deal button */}
                  <div className="flex flex-col items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                      Abheben beendet
                    </p>

                    <h3 className="mt-1 text-xl font-bold text-white">
                      Karten bereit zum Austeilen
                    </h3>

                    <button
                      type="button"
                      onClick={finishAbheben}
                      className="mt-5 rounded-xl bg-amber-400 px-7 py-4 font-bold text-amber-950 shadow-xl transition hover:scale-105 hover:bg-amber-300"
                    >
                      austeilen und Zug beenden
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* ABHEBER HAND DURING DEAL READY */}
            {phase === "dealReady" && (
              <div className="absolute bottom-4 left-1/2 z-30 w-full -translate-x-1/2 px-10">
                <div className="relative mx-auto min-h-32 max-w-xl rounded-2xl border border-amber-400/20 bg-zinc-950/95 px-6 py-4 shadow-2xl backdrop-blur-md">
                  {/* Player label */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-5 py-1.5 text-sm font-black text-amber-950 shadow-lg">
                    ▼ {abhebenPlayerData.name} · ABHEBER
                  </div>

                  <div className="mt-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                      Deine Hand nach dem Abheben
                    </p>

                    <p className="mt-1 text-xs text-zinc-500">
                      Die restlichen Karten werden gleich ausgeteilt.
                    </p>
                  </div>

                  <div className="mt-4 flex min-h-20 items-center justify-center gap-3">
                    {abhebenPlayerData.cards.length > 0 ? (
                      abhebenPlayerData.cards.map((card) => (
                        <div
                          key={card.id}
                          className="animate-in fade-in zoom-in duration-500"
                        >
                          <WattenCardComponent card={card} disabled />
                        </div>
                      ))
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/15 px-8 text-sm text-zinc-500">
                        Noch keine Karte auf der Hand
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
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
              {phase !== "dealReady" && (
                <div className="absolute -top-2 right-2 rounded-full border border-amber-400/40 bg-amber-400 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-950 shadow">
                  Nächster Spieler
                </div>
              )}

              <div className="text-lg font-bold text-white">
                {leftOpponent.name}
              </div>

              <p className="mt-0.5 text-[11px] text-emerald-300">
                {phase === "dealReady"
                  ? "Wartet auf Karten"
                  : `${leftOpponent.cards.length} Karten · ${
                      tricksWon[leftOpponent.id] ?? 0
                    } Stiche`}
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
              {phase === "dealReady" && (
                <div className="absolute -top-2 left-2 rounded-full border border-amber-400/40 bg-amber-400 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-950 shadow">
                  Beginnt das Spiel
                </div>
              )}
              <div className="text-lg font-bold text-white">
                {rightOpponent.name}
              </div>

              <p className="mt-0.5 text-[11px] text-emerald-300">
                {phase === "dealReady"
                  ? "Wartet auf Karten"
                  : `${rightOpponent.cards.length} Karten · ${
                      tricksWon[rightOpponent.id] ?? 0
                    } Stiche`}
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
            {phase === "trickPause" && (
              <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
                <button
                  type="button"
                  onClick={openTrickReview}
                  className="rounded-xl bg-amber-400 px-6 py-3 font-bold text-amber-950 shadow-xl transition hover:scale-105 hover:bg-amber-300"
                >
                  weiter
                </button>
              </div>
            )}
            <div className="absolute bottom-60 left-50">
              {trumpfOderKritischActive && (
                <div
                  className={`mx-auto mb-3 w-fit rounded-xl border px-4 py-2 text-center text-sm font-bold ${
                    currentPlayerMustFollowTrumpfOderKritisch
                      ? "border-red-400/50 bg-red-500/20 text-red-100"
                      : "border-amber-400/50 bg-amber-400/20 text-amber-100"
                  }`}
                >
                  {currentPlayerMustFollowTrumpfOderKritisch
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
                          Handkarten von
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
                            currentPlayerMustFollowTrumpfOderKritisch;

                          const legalUnderForcedRule =
                            canCurrentPlayerPlayCard(card);

                          const comparison =
                            helpMode &&
                            playedCards.length > 0 &&
                            !cardPlayedThisTurn
                              ? wouldCardWin(
                                  card,
                                  currentPlayerData.id,
                                  playedCards,
                                  Farbe,
                                  schlag,
                                )
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
                          playedCards.length < players.length &&
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
              {currentSideIsGespannt && (
                <p className="text-xs font-bold text-red-300">
                  Gespannt · Erhöhen nicht möglich
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
