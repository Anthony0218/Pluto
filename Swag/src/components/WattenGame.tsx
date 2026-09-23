import { useCallback, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { WattenPlayerInfo, WattenVariant } from "../utils/types";
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
  WATTEN_CARD_CLIP,
  wouldCardWin,
  type WattenCard,
} from "../utils/watten";
import WattenCardComponent from "./WattenCard";
import CardThemeSelector from "./WattenCardGameSelector";
import { useCardTheme } from "@/context/CardThemeContext";
import { getWattenCardImage } from "@/utils/WattenCardImages";
import TableThemeSelector from "./TableThemeSelector";
import { useTableTheme, type TableTheme } from "@/context/TableThemeContext";

import {
  getInitialWattenLanguage,
  setStoredWattenLanguage,
  translateWatten,
  translateWattenPair,
  WattenLanguageSelector,
  type WattenLanguage,
} from "@/games/watten/i18n/wattenLanguage";

const tableBackgrounds: Record<TableTheme, string> = {
  classic: "/images/tables/classic.webp",
  bavarian: "/images/tables/bavarian.webp",
  royal: "/images/tables/royal.webp",
  steampunk: "/images/tables/steampunk.webp",
  alpine: "/images/tables/alpine.webp",
  midnight: "/images/tables/midnight.webp",
};
const suitIcons = {
  Herz: "/images/icons/herz.webp",
  Schellen: "/images/icons/schellen.webp",
  Eichel: "/images/icons/eichel.webp",
  Gras: "/images/icons/gras.webp",
} as const;
type Player = {
  id: string;
  name: string;
  cards: WattenCard[];
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
type DisplayWattenCard = Pick<WattenCard, "suit" | "rank">;

function MiniWattenCard({ card }: { card: DisplayWattenCard }) {
  const { cardTheme } = useCardTheme();

  const imageSrc = getWattenCardImage(card, cardTheme);

  return (
    <div
      className="
        relative
        h-20
        w-12
        shrink-0
        transition-transform
        duration-200
        hover:z-20
        hover:scale-110
      "
    >
      <img
        src={imageSrc}
        alt={`${card.suit} ${card.rank}`}
        draggable={false}
        style={{
          clipPath: WATTEN_CARD_CLIP,
        }}
        className="
          h-full
          w-full
          object-fill
          drop-shadow-md
          rounded-[6px]
        "
      />
    </div>
  );
}

export default function WattenGame() {
  const { tableTheme } = useTableTheme();
  const [language, setLanguage] = useState<WattenLanguage>(
    getInitialWattenLanguage,
  );
  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );
  const l = useCallback(
    (deText: string, enText: string) =>
      translateWattenPair(language, deText, enText),
    [language],
  );

  function changeLanguage(next: WattenLanguage) {
    setLanguage(next);
    setStoredWattenLanguage(next);
  }
  const location = useLocation();
  const [phase, setPhase] = useState<
    | "setup"
    | "reveal"
    | "abheben"
    | "dealReady"
    | "fourPlayerReady"
    | "fourPlayerPlayReady"
    | "trump"
    | "schlag"
    | "playing"
    | "trickPause"
    | "trickReview"
  >("setup");

  const [Farbe, setFarbe] = useState<
    "Herz" | "Schellen" | "Eichel" | "Gras" | null
  >(null);
  const specialCards: DisplayWattenCard[] = [
    {
      suit: "Herz",
      rank: "König",
    },
    {
      suit: "Schellen",
      rank: "7",
    },
    {
      suit: "Eichel",
      rank: "7",
    },
  ];

  const [schlag, setSchlag] = useState<string | null>(null);

  const variant: WattenVariant = location.state?.variant ?? "three-player";

  const playerInfo: WattenPlayerInfo[] =
    location.state?.players ??
    (variant === "four-player"
      ? [
          { id: "1", name: "Player 1" },
          { id: "2", name: "Player 2" },
          { id: "3", name: "Player 3" },
          { id: "4", name: "Player 4" },
        ]
      : [
          { id: "1", name: "Player 1" },
          { id: "2", name: "Player 2" },
          { id: "3", name: "Player 3" },
        ]);

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
  const [, setCardsSeen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(playerInfo.map((player) => [player.id, false])),
  );
  const [cardPlayedThisTurn, setCardPlayedThisTurn] = useState(false);

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
  const [abhebenCriticalCount, setAbhebenCriticalCount] = useState(0);

  const [abhebenTakingPlayer, setAbhebenTakingPlayer] = useState<number | null>(
    null,
  );
  const [helpMode, setHelpMode] = useState(false);
  type FourPlayerTeam = "team-a" | "team-b";

  type WattenSide = "solo" | "team" | FourPlayerTeam;

  const [targetScore, setTargetScore] = useState(15);

  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(playerInfo.map((player) => [player.id, 0])),
  );

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

  const [tricksWon, setTricksWon] = useState<Record<string, number>>(() =>
    Object.fromEntries(playerInfo.map((player) => [player.id, 0])),
  );

  const [winner, setWinner] = useState<string | null>(null);
  const [viewingPlayer, setViewingPlayer] = useState<number | null>(null);
  const [showCardViewer, setShowCardViewer] = useState(false);
  const [showCardViewerPass, setShowCardViewerPass] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showRankingHelp, setShowRankingHelp] = useState(false);
  const [showRules, setShowRules] = useState(false);

  function startGame() {
    setScores(Object.fromEntries(playerInfo.map((player) => [player.id, 0])));

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
        l(
          "Trumpf oder Kritisch!Du musst eine kritische Karte oder einen Trumpf spielen.",
          "Trump or Critical! You must play a critical card or a trump card.",
        ),
      );

      setTimeout(() => {
        setNotification(null);
      }, 2500);

      return;
    }
    if (!Farbe) {
      setNotification(
        l(
          "Wähle zuerst den Trumpf & Schlag.",
          "Choose trump and Schlag first.",
        ),
      );

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
  function finishCut(
    pile: WattenCard[],
    rest: WattenCard[],
    animateReturn: boolean,
  ) {
    function complete() {
      // After cutting:
      // upper part first, cut pile afterwards.
      setDeck([...rest, ...pile]);

      setAbhebenAnimation("finished");
      setAbhebenFinished(true);
      setAbhebenTakingPlayer(null);

      window.setTimeout(() => {
        setPhase("dealReady");
      }, 350);
    }

    if (animateReturn) {
      setAbhebenAnimation("returning");

      window.setTimeout(() => {
        complete();
      }, 700);

      return;
    }

    complete();
  }

  function revealCutCard(
    pile: WattenCard[],
    rest: WattenCard[],
    criticalCount: number,
  ) {
    const exposedCard = pile[pile.length - 1];

    if (!exposedCard) {
      finishCut(pile, rest, false);
      return;
    }

    // Show next exposed card face-down first.
    setAbgehobenCard(exposedCard);
    setAbhebenAnimation("idle");

    window.setTimeout(() => {
      // Flip card.
      setAbhebenAnimation("revealing");

      window.setTimeout(() => {
        /*
        NORMAL CARD:
        sequence ends.
        The normal card remains in the deck.
      */
        if (!isAbhebenCard(exposedCard)) {
          finishCut(pile, rest, true);
          return;
        }

        /*
        KRITISCHE:

        1st Kritische -> Abheber
        2nd Kritische -> Geber
        3rd Kritische -> Abheber
      */
        const recipientIndex = criticalCount % 2 === 0 ? abhebenPlayer : dealer;

        setAbhebenTakingPlayer(recipientIndex);
        setAbhebenAnimation("taking");

        window.setTimeout(() => {
          // Give Kritische to correct player.
          setPlayers((currentPlayers) =>
            currentPlayers.map((player, index) =>
              index === recipientIndex
                ? {
                    ...player,
                    cards: [...player.cards, exposedCard],
                  }
                : player,
            ),
          );

          // Remove taken Kritische from cut pile.
          const nextPile = pile.slice(0, -1);

          const nextCriticalCount = criticalCount + 1;

          setAbhebenCriticalCount(nextCriticalCount);

          setAbhebenTakingPlayer(null);

          /*
          Maximum = all three Kritische.
        */
          if (nextCriticalCount >= 3 || nextPile.length === 0) {
            setDeck([...rest, ...nextPile]);

            setAbhebenAnimation("finished");
            setAbhebenFinished(true);

            window.setTimeout(() => {
              setPhase("dealReady");
            }, 350);

            return;
          }

          /*
          A Kritische was found:
          expose the next card immediately.
        */
          window.setTimeout(() => {
            revealCutCard(nextPile, rest, nextCriticalCount);
          }, 300);
        }, 700);
      }, 650);
    }, 50);
  }

  function chooseCut(cardIndex: number) {
    if (
      abgehobenCard !== null ||
      abhebenFinished ||
      selectedAbhebenIndex !== null
    ) {
      return;
    }

    /*
    Clicking a card means:
    cut immediately after this card.
  */
    const cutIndex = cardIndex + 1;

    // Must leave cards on both sides.
    if (cutIndex <= 0 || cutIndex >= deck.length) {
      return;
    }

    const pile = deck.slice(0, cutIndex);

    const rest = deck.slice(cutIndex);

    setSelectedAbhebenIndex(cardIndex);
    setAbhebenCriticalCount(0);

    revealCutCard(pile, rest, 0);
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
  function getFourPlayerTeam(playerIndex: number): "team-a" | "team-b" {
    return playerIndex % 2 === 0 ? "team-a" : "team-b";
  }

  function getFourPlayerTeamPlayers(team: "team-a" | "team-b") {
    return players.filter((_, index) =>
      team === "team-a" ? index % 2 === 0 : index % 2 === 1,
    );
  }

  function getFourPlayerTeamTricks(
    team: "team-a" | "team-b",
    trickState: Record<string, number>,
  ) {
    return getFourPlayerTeamPlayers(team).reduce(
      (sum, player) => sum + (trickState[player.id] ?? 0),
      0,
    );
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
    if (variant === "four-player") {
      const winnerIndex = players.findIndex((player) => player.id === winnerId);

      const teamATricks = getFourPlayerTeamTricks("team-a", newTricks);

      const teamBTricks = getFourPlayerTeamTricks("team-b", newTricks);

      if (teamATricks >= 3) {
        awardFourPlayerPoints("team-a", roundValue);

        const team = getFourPlayerTeamPlayers("team-a");

        setWinner(`${team[0].name} & ${team[1].name}`);

        setPlayedCards([]);
        setTrickWinner(null);
        setPendingBid(null);
        setPhase("playing");

        return;
      }

      if (teamBTricks >= 3) {
        awardFourPlayerPoints("team-b", roundValue);

        const team = getFourPlayerTeamPlayers("team-b");

        setWinner(`${team[0].name} & ${team[1].name}`);

        setPlayedCards([]);
        setTrickWinner(null);
        setPendingBid(null);
        setPhase("playing");

        return;
      }

      // Winner leads next trick.
      setPlayedCards([]);
      setTrickWinner(null);

      setCurrentPlayer(winnerIndex);
      setPhase("playing");

      setCardPlayedThisTurn(false);

      // Hotseat: pass device to trick winner.
      setShowPassScreen(true);

      return;
    }

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
    if (variant === "four-player") {
      return getFourPlayerTeam(playerIndex);
    }

    return playerIndex === trumpCaller ? "solo" : "team";
  }

  function getSidePlayers(side: WattenSide): Player[] {
    if (side === "solo") {
      return [players[trumpCaller]];
    }

    if (side === "team") {
      return players.filter((_, index) => index !== trumpCaller);
    }

    if (side === "team-a") {
      return getFourPlayerTeamPlayers("team-a");
    }

    return getFourPlayerTeamPlayers("team-b");
  }

  function getSideLabel(side: WattenSide) {
    return getSidePlayers(side)
      .map((player) => player.name)
      .join(" & ");
  }

  function getOpposingSide(side: WattenSide): WattenSide {
    if (side === "team-a") {
      return "team-b";
    }

    if (side === "team-b") {
      return "team-a";
    }

    if (side === "solo") {
      return "team";
    }

    return "solo";
  }

  function isSideGespannt(side: WattenSide) {
    const sidePlayers = getSidePlayers(side);

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
    setAbhebenCriticalCount(0);
    setAbhebenTakingPlayer(null);

    setTricksWon(
      Object.fromEntries(playerInfo.map((player) => [player.id, 0])),
    );
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

    // FOUR PLAYER:
    // cards are dealt, but we intentionally
    // stop before Schlag/Farbe for now.
    if (variant === "four-player") {
      const vorhanden = getNextPlayer(dealer, players.length);

      setCurrentPlayer(vorhanden);
      setPhase("fourPlayerReady");
      setShowPassScreen(false);

      return;
    }

    // THREE PLAYER:
    // keep your existing behaviour.
    setCurrentPlayer(trumpCaller);

    setPhase("playing");
    setShowPassScreen(true);
  }

  function canCurrentPlayerPlayCard(card: WattenCard) {
    const player = players[currentPlayer];

    if (!player) {
      return false;
    }

    const mustFollow = mustFollowTrumpfOderKritisch(
      player.cards,
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
      return l(
        "Hauptschlag — Wenn du diese Karte jetzt ausspielst, wird „Trumpf oder Kritisch“ aktiv.",
        "Main Schlag — playing this card now activates “Trump or Critical”.",
      );
    }

    const criticalValue = getCriticalValue(card);

    if (criticalValue === 3) {
      return l(
        "Max — die höchste Kritische und die höchste Karte beim Watten.",
        "Max — the highest critical card and the highest card in Watten.",
      );
    }

    if (criticalValue === 2) {
      return l(
        "Belli — die zweithöchste Kritische.",
        "Belli — the second-highest critical card.",
      );
    }

    if (criticalValue === 1) {
      return l(
        "Spitz — die dritthöchste Kritische.",
        "Spitz — the third-highest critical card.",
      );
    }

    if (isHauptschlag(card, Farbe, schlag)) {
      return l(
        "Hauptschlag — die stärkste nicht-kritische Karte.",
        "Main Schlag — the strongest non-critical card.",
      );
    }

    if (card.rank === schlag) {
      return l(
        `Schlag (${schlag}) — stärker als normale Trumpfkarten. Werden zwei gleichwertige Schläge gespielt, gewinnt der zuerst gespielte.`,
        `Schlag (${schlag}) — stronger than normal trump cards. If two equal Schlag cards are played, the first one wins.`,
      );
    }

    if (card.suit === Farbe) {
      return l(
        `Trumpf (${Farbe}) — Diese Karte schlägt gewöhnliche Karten, die keine Trümpfe sind.`,
        `Trump (${Farbe}) — this card beats ordinary non-trump cards.`,
      );
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
        description: l(
          "Die drei höchsten Karten: Max → Belli → Spitz.",
          "The three highest cards: Max → Belli → Spitz.",
        ),
        cards: kritische,
      },
      {
        title: "Hauptschlag",
        description: l(
          "Schlag + Farbe. Höchste Karte unterhalb der Kritischen.",
          "Schlag + trump suit. Highest card below the critical cards.",
        ),
        cards: hauptschlag,
      },
      {
        title: "Schläge",
        description: l(
          `Alle anderen ${schlag}. Sie sind gleich stark; der zuerst gespielte gewinnt.`,
          `All other ${schlag}. They are equal in strength; the first played wins.`,
        ),
        cards: schlaege,
      },
      {
        title: l(`Trumpf / Farbe (${Farbe})`, `Trump / suit (${Farbe})`),
        description: l(
          "Danach folgen die übrigen Karten der Trumpffarbe.",
          "Then come the remaining cards of the trump suit.",
        ),
        cards: trumpfCards,
      },
      {
        title: l("Normale Karten", "Normal cards"),
        description: l(
          "Keine feste Reihenfolge zwischen verschiedenen Farben. Es zählt die angespielte Farbe; innerhalb dieser Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
          "No fixed order between different suits. The led suit counts; within that suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.",
        ),
        cards: normalCards,
      },
    ];
  }

  function awardGamePoints(winningSide: WattenSide, points: number) {
    if (winningSide === "team-a" || winningSide === "team-b") {
      awardFourPlayerPoints(winningSide, points);

      return;
    }
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
  function awardFourPlayerPoints(
    winningTeam: "team-a" | "team-b",
    points: number,
  ) {
    const updatedScores = {
      ...scores,
    };

    const winningPlayers = getFourPlayerTeamPlayers(winningTeam);

    winningPlayers.forEach((player) => {
      updatedScores[player.id] = (updatedScores[player.id] ?? 0) + points;
    });

    setScores(updatedScores);

    const teamReachedTarget = winningPlayers.some(
      (player) => (updatedScores[player.id] ?? 0) >= targetScore,
    );

    if (teamReachedTarget) {
      setGameWinner(winningPlayers.map((player) => player.name).join(" & "));
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

  if (variant === "four-player") {
    const vorhandIndex = getNextPlayer(dealer, players.length);

    const vorhandPlayer = players[vorhandIndex];

    const dealerPlayer = players[dealer];
    const bottomPlayerIndex = currentPlayer;

    const leftPlayerIndex = getNextPlayer(bottomPlayerIndex, players.length);

    const topPlayerIndex = getNextPlayer(leftPlayerIndex, players.length);

    const rightPlayerIndex = getPreviousPlayer(
      bottomPlayerIndex,
      players.length,
    );

    const leftPlayer = players[leftPlayerIndex];

    const topPlayer = players[topPlayerIndex];

    const rightPlayer = players[rightPlayerIndex];
    const fourCurrentPlayer = players[currentPlayer];

    const fourCurrentMustFollow = mustFollowTrumpfOderKritisch(
      fourCurrentPlayer.cards,
      playedCards,
      tricksWon,
      Farbe,
      schlag,
    );

    const fourTrumpfOderKritischActive = isTrumpfOderKritischActive(
      playedCards,
      tricksWon,
      Farbe,
      schlag,
    );

    const teamATricks = getFourPlayerTeamTricks("team-a", tricksWon);

    const teamBTricks = getFourPlayerTeamTricks("team-b", tricksWon);

    const teamAPlayers = getFourPlayerTeamPlayers("team-a");

    const teamBPlayers = getFourPlayerTeamPlayers("team-b");
    const teamAScore = scores[teamAPlayers[0]?.id] ?? 0;

    const teamBScore = scores[teamBPlayers[0]?.id] ?? 0;
    function getTeamVisuals(playerIndex: number) {
      const team = getFourPlayerTeam(playerIndex);

      if (team === "team-a") {
        return {
          label: "Team A",
          box: "border-amber-400/40 bg-amber-400/10",
          badge: "bg-amber-400 text-amber-950",
          text: "text-amber-300",
        };
      }

      return {
        label: "Team B",
        box: "border-emerald-400/40 bg-emerald-400/10",
        badge: "bg-emerald-400 text-emerald-950",
        text: "text-emerald-300",
      };
    }

    const bottomTeam = getTeamVisuals(bottomPlayerIndex);

    const leftTeam = getTeamVisuals(leftPlayerIndex);

    const topTeam = getTeamVisuals(topPlayerIndex);

    const rightTeam = getTeamVisuals(rightPlayerIndex);

    function HiddenPreviewCards({ player }: { player: Player }) {
      return (
        <div className="mt-3 flex justify-center max-md:mt-1 max-md:scale-[0.75]">
          {player.cards.map((card, index) => (
            <div
              key={card.id}
              className={`relative h-14 w-9 rounded-md border border-white/20 bg-zinc-900 shadow-md ${
                index !== 0 ? "-ml-3" : ""
              }`}
            >
              <div className="absolute inset-1 rounded-sm border border-emerald-400/20 bg-emerald-950" />
            </div>
          ))}
        </div>
      );
    }

    return (
      <main className="min-h-screen bg-transparent px-2 py-3 text-white sm:px-4 sm:py-4 md:px-8 md:py-6">
        <div className="mx-auto w-full max-w-[1800px]">
          {/* HEADER */}
          <div className="relative z-30 mb-3 flex items-start justify-between gap-2 max-md:flex-col md:mb-4 md:items-center">
            <div className="max-md:ml-0 max-md:pl-0 ml-5 pl-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                {l("Bayerisches Watten", "Bavarian Watten")}
              </p>

              <h1 className="mt-1 text-2xl font-black">
                {l("4 Spieler · Hotseat", "4 Players · Hotseat")}
              </h1>
            </div>

            <div className="flex items-center gap-3 max-md:w-full max-md:gap-2 max-md:overflow-x-auto max-md:pb-1">
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
              <WattenLanguageSelector
                language={language}
                onChange={changeLanguage}
                label={t("Language")}
              />
              <CardThemeSelector />
              <TableThemeSelector />

              <Link
                to="/watten/hotseat"
                className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
              >
                {l("Zurück", "Back")}
              </Link>
            </div>
          </div>
          {/* GAME STATUS - BETWEEN OPPONENTS */}
          <div className="absolute left-1/3 top-3 z-20 -translate-x-1/2 max-md:static max-md:mb-3 max-md:translate-x-0">
            <div className="flex min-w-72 flex-col items-center rounded-2xl border border-white/10 bg-emerald-950/80 px-5 py-3 shadow-lg backdrop-blur max-md:min-w-0 max-md:w-full max-md:px-3 max-md:py-2">
              {/* Farbe + Schlag */}
              <div className="flex items-center justify-center gap-10">
                <div className="text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
                    {l("Farbe", "Trump")}
                  </p>

                  {Farbe ? (
                    <div className="mt-0.5 flex items-center gap-2">
                      <img
                        src={suitIcons[Farbe]}
                        alt={Farbe}
                        draggable={false}
                        className="h-7 w-7 object-contain"
                      />

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
                    {t("Schlag")}
                  </p>

                  <p className="mt-0.5 text-base font-bold text-white">
                    {schlag ?? "–"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {/* TABLE + SIDEBARS */}
          <div className="grid w-full grid-cols-[16rem_minmax(0,1fr)_16rem] items-start gap-5 max-md:grid-cols-1 max-md:gap-3">
            {/* LEFT SIDEBAR: HELP + TEAM SCORE */}
            <aside className="relative w-64 pt-15 max-md:order-2 max-md:w-full max-md:pt-0">
              {/* CARD PRIORITY HELP */}
              {Farbe && schlag && (
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
                    <div className="absolute left-0 top-full mt-2 h-[650px] w-full overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur max-md:fixed max-md:inset-x-2 max-md:top-20 max-md:z-[200] max-md:h-[70vh] max-md:w-auto max-md:p-3">
                      <div className="mb-5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                          {l("Anfängerhilfe", "Beginner")}
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-white">
                          {l("Kartenrangfolge", "Card ranking")}
                        </h2>

                        <p className="mt-1 text-xs text-zinc-400">
                          {l(
                            "Von oben nach unten: höchste Priorität zuerst.",
                            "Highest priority first.",
                          )}
                        </p>

                        <div className="mt-3 flex gap-4 text-xs">
                          <span className="text-emerald-300">
                            {l("Farbe:", "Trump:")}
                            <strong>{Farbe}</strong>
                          </span>

                          <span className="text-amber-300">
                            {t("Schlag:")}
                            <strong>{schlag}</strong>
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
                                {l(
                                  "Keine Karte in dieser Kategorie.",
                                  "No card in this category.",
                                )}
                              </p>
                            )}
                          </section>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TEAM SCORE */}
              <div className="h-[650px] rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl max-md:h-auto max-md:p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                  {l("Punktestand", "Score")}
                </p>

                <h3 className="mt-1 text-lg font-bold text-white">
                  Ziel: {targetScore} Punkte
                </h3>

                {/* TEAM A */}
                <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                    {t("Team A")}
                  </p>

                  <p className="mt-1 font-bold text-white">
                    {teamAPlayers[0]?.name}
                    <span className="text-zinc-500"> & </span>
                    {teamAPlayers[1]?.name}
                  </p>

                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-3xl font-black text-amber-400">
                      {teamAScore}
                    </span>

                    <span className="text-xs text-zinc-500">
                      / {targetScore}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (teamAScore / targetScore) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* VS */}
                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />

                  <span className="text-xs font-bold text-zinc-500">
                    {t("VS")}
                  </span>

                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* TEAM B */}
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                    {t("Team B")}
                  </p>

                  <p className="mt-1 font-bold text-white">
                    {teamBPlayers[0]?.name}
                    <span className="text-zinc-500"> & </span>
                    {teamBPlayers[1]?.name}
                  </p>

                  <div className="mt-4 flex items-end justify-between">
                    <span className="text-3xl font-black text-emerald-400">
                      {teamBScore}
                    </span>

                    <span className="text-xs text-zinc-500">
                      / {targetScore}
                    </span>
                  </div>

                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          (teamBScore / targetScore) * 100,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </aside>
            {/* CENTER: 4 PLAYER TABLE */}
            <div
              className="
    relative
    min-h-[640px]
    min-w-0
    overflow-visible
    rounded-[60px]
    max-md:order-1
    max-md:min-h-[500px]
    max-md:rounded-[32px]
    shadow-2xl
    transition-all
    duration-500
  "
              style={{
                backgroundImage: `url(${tableBackgrounds[tableTheme]})`,
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* TABLE SURFACE */}
              {phase === "setup" && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[110px] bg-black/30">
                  <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950/95 p-8 text-center shadow-2xl max-md:mx-3 max-md:max-w-sm max-md:rounded-2xl max-md:p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      {l("4-Spieler-Watten", "4-player Watten")}
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {l("Bereit?", "Ready?")}
                    </h2>

                    <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-amber-400/10 p-3">
                        <p className="text-amber-300">{t("Team A")}</p>

                        <strong>
                          {players[0].name}
                          {" + "}
                          {players[2].name}
                        </strong>
                      </div>

                      <div className="rounded-xl bg-emerald-400/10 p-3">
                        <p className="text-emerald-300">{t("Team B")}</p>

                        <strong>
                          {players[1].name}
                          {" + "}
                          {players[3].name}
                        </strong>
                      </div>
                    </div>

                    {/* Target score */}
                    <div className="mt-5">
                      <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                        {l("Punkte zum Sieg", "Points to win")}
                      </label>

                      <div className="mt-2 flex items-center justify-center gap-2">
                        {[11, 15, 18].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setTargetScore(score)}
                            className={`h-10 w-14 rounded-lg text-sm font-black transition ${
                              targetScore === score
                                ? "bg-amber-400 text-amber-950 ring-2 ring-amber-200"
                                : "bg-white/10 text-white hover:bg-white/20"
                            }`}
                          >
                            {score}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3">
                        <label className="text-[10px] text-zinc-500">
                          {l("Oder eigener Wert:", "Or custom value:")}
                        </label>

                        <input
                          type="number"
                          min={4}
                          max={50}
                          value={targetScore}
                          onChange={(event) => {
                            const value = Number(event.target.value);

                            if (Number.isFinite(value)) {
                              setTargetScore(Math.max(4, Math.min(50, value)));
                            }
                          }}
                          className="mx-auto mt-1.5 block w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={startGame}
                      className="mt-5 w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-300"
                    >
                      {l("Spiel starten", "Start game")}
                    </button>
                  </div>
                </div>
              )}
              {/* 4-PLAYER GEHEN DECISION */}
              {pendingBid && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl max-md:mx-3 max-md:p-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      {t("Gehen")}
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-white">
                      {getSideLabel(pendingBid.side)} geht auf{" "}
                      {pendingBid.value}
                    </h2>

                    <p className="mt-5 text-sm text-zinc-400">
                      {l("Die Entscheidung liegt bei", "The decision is with")}
                    </p>

                    <p className="mt-1 text-lg font-black text-emerald-300">
                      {getSideLabel(getOpposingSide(pendingBid.side))}
                    </p>

                    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                      Aktueller Rundenwert:{" "}
                      <strong className="text-amber-300">{roundValue}</strong>
                      <br />
                      Neuer Rundenwert bei Halten:{" "}
                      <strong className="text-amber-300">
                        {pendingBid.value}
                      </strong>
                    </div>

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
                      {l("Nicht halten", "Decline")}
                    </button>

                    <p className="mt-4 text-xs leading-5 text-zinc-500">
                      Bei „Nicht halten“ gewinnt {getSideLabel(pendingBid.side)}{" "}
                      die Runde mit dem bisherigen Wert von {roundValue}{" "}
                      Punkten.
                    </p>
                  </div>
                </div>
              )}
              {showPassScreen &&
                (phase === "reveal" ||
                  phase === "schlag" ||
                  phase === "trump") && (
                  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-8 text-center shadow-2xl">
                      <div className="text-4xl">🃏</div>

                      <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                        {phase === "reveal"
                          ? "Abheben"
                          : phase === "schlag"
                            ? l("Schlag bestimmen", "Choose Schlag")
                            : l("Farbe bestimmen", "Choose trump")}
                      </p>

                      <h2 className="mt-2 text-2xl font-bold">
                        {l("Gerät weitergeben", "Pass the device")}
                      </h2>

                      <p className="mt-3 text-zinc-400">
                        {l("Gib das Gerät an", "Give the device to")}
                      </p>

                      <p className="mt-1 text-xl font-black text-emerald-400">
                        {players[currentPlayer].name}
                      </p>

                      <p className="mt-3 text-sm text-zinc-500">
                        {phase === "reveal"
                          ? l(
                              "Dieser Spieler hebt ab.",
                              "This player cuts the deck.",
                            )
                          : phase === "schlag"
                            ? l(
                                "Vorhand bestimmt den Schlag.",
                                "Vorhand chooses Schlag.",
                              )
                            : l(
                                "Der Geber bestimmt die Farbe.",
                                "The dealer chooses the trump suit.",
                              )}
                      </p>

                      <button
                        type="button"
                        onClick={continueHotseat}
                        className="mt-8 w-full rounded-xl bg-emerald-500 px-5 py-3 font-black text-emerald-950 transition hover:bg-emerald-400"
                      >
                        {l("Ich bin bereit", "I'm ready")}
                      </button>
                    </div>
                  </div>
                )}
              {phase === "abheben" && !showPassScreen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      {players[abhebenPlayer].name}
                      {" · "}Abheber
                    </p>

                    <h2 className="mt-2 text-3xl font-black">{t("Abheben")}</h2>

                    {!abgehobenCard ? (
                      <>
                        <p className="mt-3 text-sm text-zinc-400">
                          {l(
                            "Wähle eine Stelle im Stapel. Die gewählte Karte wird beim Abheben sichtbar.",
                            "Choose a position in the deck. The selected card will be revealed while cutting.",
                          )}
                        </p>

                        <div className="mt-8 space-y-4">
                          {[deck.slice(0, 16), deck.slice(16)].map(
                            (row, rowIndex) => (
                              <div
                                key={rowIndex}
                                className="flex justify-center px-10"
                              >
                                {row.map((card, index) => {
                                  const actualIndex = rowIndex * 16 + index;

                                  const cannotCut =
                                    actualIndex === deck.length - 1;

                                  return (
                                    <button
                                      key={card.id}
                                      type="button"
                                      disabled={cannotCut}
                                      onClick={() => chooseCut(actualIndex)}
                                      className={`
                              relative h-20 w-12
                              rounded-lg
                              border border-white/20
                              bg-zinc-950
                              shadow-lg
                              transition-all
                              duration-200

                              ${index !== 0 ? "-ml-5" : ""}

                              ${
                                cannotCut
                                  ? "cursor-not-allowed opacity-30"
                                  : "hover:z-30 hover:-translate-y-3 hover:scale-110 hover:border-amber-300"
                              }
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

                        <p className="mt-5 text-xs text-zinc-500">
                          {l(
                            "Die letzte Karte kann nicht als Schnittstelle gewählt werden.",
                            "The last card cannot be selected as the cut position.",
                          )}
                        </p>
                      </>
                    ) : (
                      <div className="mt-8 flex flex-col items-center">
                        <div className="abheben-card-scene relative h-40 w-28">
                          <div
                            className={`abheben-card-flip relative h-full w-full ${
                              abhebenAnimation !== "idle" ? "is-flipped" : ""
                            }`}
                          >
                            <div className="abheben-card-face absolute inset-0 rounded-xl border-2 border-white/20 bg-zinc-950 shadow-xl">
                              <div className="absolute inset-2 rounded-lg border border-emerald-400/40 bg-emerald-900" />
                            </div>

                            <div className="abheben-card-face abheben-card-front absolute inset-0">
                              <WattenCardComponent
                                card={abgehobenCard}
                                disabled
                              />
                            </div>
                          </div>
                        </div>

                        {abhebenAnimation === "revealing" && (
                          <p className="mt-5 font-semibold text-white">
                            {l("Karte wird aufgedeckt...", "Revealing card...")}
                          </p>
                        )}

                        {abhebenAnimation === "taking" &&
                          abhebenTakingPlayer !== null && (
                            <div className="mt-5">
                              <p className="font-black text-amber-300">
                                {l("Kritische!", "Critical card!")}
                              </p>

                              <p className="mt-1 text-sm text-zinc-300">
                                Die Karte geht an{" "}
                                <strong>
                                  {players[abhebenTakingPlayer].name}
                                </strong>
                              </p>
                            </div>
                          )}

                        {abhebenAnimation === "returning" && (
                          <p className="mt-5 font-semibold text-zinc-300">
                            {l(
                              "Keine Kritische — Abheben beendet.",
                              "No critical card — cut finished.",
                            )}
                          </p>
                        )}

                        {abhebenCriticalCount > 0 && (
                          <p className="mt-3 text-xs font-semibold text-emerald-300">
                            {abhebenCriticalCount} Kritische aufgenommen
                          </p>
                        )}

                        {abhebenAnimation === "finished" && (
                          <p className="mt-5 font-semibold text-emerald-300">
                            {l(
                              "Karten werden wieder zu einem Stapel zusammengelegt...",
                              "The cards are being put back into one deck...",
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {phase === "dealReady" && (
                <>
                  {/* DECK / SAME SIZE AS PLAYING FIELD */}
                  <div className="absolute left-1/2 top-[45%] z-40 flex h-44 w-[440px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border border-white/10 bg-emerald-950/30 p-4 shadow-inner max-md:h-28 max-md:w-[calc(100%-1rem)] max-md:gap-1 max-md:rounded-2xl max-md:p-2">
                    <div className="flex w-full items-center justify-center gap-10">
                      {/* DECK */}
                      <div className="text-center">
                        <div className="relative mx-auto h-24 w-18">
                          {[0, 1, 2, 3, 4, 5].map((index) => (
                            <div
                              key={index}
                              className={`watten-deck-gather-card deck-gather-${index} absolute inset-0 rounded-xl border-2 border-white/20 bg-zinc-950 shadow-xl`}
                            >
                              <div className="absolute inset-2 rounded-lg border border-emerald-400/40 bg-emerald-900" />
                            </div>
                          ))}
                        </div>

                        <p className="mt-2 text-xs font-semibold text-emerald-200">
                          {deck.length} Karten
                        </p>
                      </div>

                      {/* DEAL */}
                      <div className="text-left">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                          {l("Abheben beendet", "Cut finished")}
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-white">
                          {l("Karten bereit", "Cards ready")}
                        </h3>

                        <button
                          type="button"
                          onClick={finishAbheben}
                          className="mt-3 rounded-xl bg-amber-400 px-6 py-3 text-sm font-black text-amber-950 shadow-lg transition hover:scale-105 hover:bg-amber-300"
                        >
                          {l("Karten austeilen", "Deal cards")}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ABHEBER HAND DURING DEAL READY */}
                  <div className="absolute bottom-4 left-1/2 z-30 w-full -translate-x-1/2 px-10 max-md:bottom-2 max-md:px-1">
                    <div className="relative mx-auto min-h-32 max-w-xl rounded-2xl border border-amber-400 px-6 py-4 shadow-2xl backdrop-blur max-md:min-h-24 max-md:px-2 max-md:py-2">
                      {/* Player label */}
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-5 py-1.5 text-sm font-black text-amber-950 shadow-lg max-md:-top-4 max-md:px-3 max-md:py-1 max-md:text-[10px]">
                        ▼ {players[abhebenPlayer].name} · ABHEBER
                      </div>

                      <div className="mt-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                          {l(
                            "Deine Hand nach dem Abheben",
                            "Your hand after cutting",
                          )}
                        </p>

                        <p className="mt-1 text-sm font-bold text-red-300">
                          {l(
                            "Die restlichen Karten werden gleich ausgeteilt.",
                            "The remaining cards will be dealt next.",
                          )}
                        </p>
                      </div>

                      <div className="mt-4 flex min-h-20 items-center justify-center gap-3">
                        {players[abhebenPlayer].cards.length > 0 ? (
                          players[abhebenPlayer].cards.map((card) => (
                            <div
                              key={card.id}
                              className="animate-in fade-in zoom-in duration-500 max-md:-mx-2.5 max-md:scale-[0.72] max-md:origin-center"
                            >
                              <WattenCardComponent card={card} disabled />
                            </div>
                          ))
                        ) : (
                          <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/15 px-8 text-sm text-black">
                            {l(
                              "Noch keine Karte auf der Hand",
                              "No cards in hand yet",
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {phase === "fourPlayerReady" && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[110px] bg-black/35 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950/95 p-8 text-center shadow-2xl max-md:mx-3 max-md:max-w-sm max-md:rounded-2xl max-md:p-4">
                    <div className="text-4xl">✓</div>

                    <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                      {l("Karten ausgeteilt", "Cards dealt")}
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {l(
                        "Alle Spieler haben 5 Karten",
                        "All players have 5 cards",
                      )}
                    </h2>

                    <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                        {t("Vorhand")}
                      </p>

                      <p className="mt-1 text-xl font-black text-white">
                        {vorhandPlayer.name}
                      </p>

                      <p className="mt-2 text-sm text-zinc-400">
                        {l(
                          "Vorhand bestimmt zuerst den Schlag.",
                          "Vorhand chooses the Schlag first.",
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPlayer(vorhandIndex);

                        setPhase("schlag");

                        setShowPassScreen(true);
                      }}
                      className="mt-8 w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-black text-amber-950 transition hover:bg-amber-300"
                    >
                      {l(
                        l("Schlag bestimmen", "Choose Schlag"),
                        "Choose Schlag",
                      )}
                    </button>
                  </div>
                </div>
              )}
              {phase === "schlag" && !showPassScreen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      {t("Vorhand")}
                    </p>

                    <p className="mt-1 text-lg font-bold text-emerald-300">
                      {vorhandPlayer.name}
                    </p>

                    <h2 className="mt-3 text-3xl font-black">
                      {l(
                        l("Schlag bestimmen", "Choose Schlag"),
                        "Choose Schlag",
                      )}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-400">
                      {l(
                        "Wähle den Rang, der in dieser Runde Schlag ist.",
                        "Choose the rank that will be Schlag this round.",
                      )}
                    </p>
                    {/* VORHAND HAND */}
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                        {l("Deine Karten", "Your cards")}
                      </p>

                      <div className="pointer-events-none flex justify-center gap-2">
                        {vorhandPlayer.cards.map((card) => (
                          <WattenCardComponent key={card.id} card={card} />
                        ))}
                      </div>
                    </div>

                    <div className="mt-8 grid grid-cols-4 gap-3 md:grid-cols-8">
                      {[
                        "7",
                        "8",
                        "9",
                        "10",
                        "Unter",
                        "Ober",
                        "König",
                        "Ass",
                      ].map((rank) => (
                        <button
                          key={rank}
                          type="button"
                          onClick={() => {
                            // Save Schlag.
                            setSchlag(rank);

                            // Now the dealer must choose Farbe.
                            setCurrentPlayer(dealer);

                            setPhase("trump");

                            // Hide the choice while the
                            // device is passed.
                            setShowPassScreen(true);
                          }}
                          className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-4 text-sm font-semibold transition hover:border-amber-400 hover:bg-amber-400/10"
                        >
                          {rank}
                        </button>
                      ))}
                    </div>

                    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-400">
                      Danach bestimmt{" "}
                      <strong className="text-white">
                        {dealerPlayer.name}
                      </strong>{" "}
                      als Geber die Farbe.
                    </div>
                  </div>
                </div>
              )}
              {phase === "trump" && !showPassScreen && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      {l("Geber", "Dealer")}
                    </p>

                    <p className="mt-1 text-lg font-bold text-emerald-300">
                      {dealerPlayer.name}
                    </p>

                    <h2 className="mt-3 text-3xl font-black">
                      {l(l("Farbe bestimmen", "Choose trump"), "Choose trump")}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-400">
                      {l(
                        "Schlag wurde bereits von Vorhand bestimmt:",
                        "Schlag was already chosen by Vorhand:",
                      )}
                    </p>

                    <div className="mx-auto mt-3 w-fit rounded-xl border border-amber-400/20 bg-amber-400/10 px-5 py-2 text-lg font-black text-amber-300">
                      {schlag}
                    </div>
                    {/* DEALER HAND */}
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                        {l("Deine Karten", "Your cards")}
                      </p>

                      <div className="pointer-events-none flex justify-center gap-2">
                        {dealerPlayer.cards.map((card) => (
                          <WattenCardComponent key={card.id} card={card} />
                        ))}
                      </div>
                    </div>

                    <div className="mt-8 grid grid-cols-2 gap-3">
                      {(["Herz", "Schellen", "Eichel", "Gras"] as const).map(
                        (value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setFarbe(value);

                              // Vorhand begins the first trick.
                              setCurrentPlayer(vorhandIndex);

                              setPhase("fourPlayerPlayReady");
                              setShowPassScreen(false);
                            }}
                            className="
          flex flex-col items-center justify-center
          rounded-2xl
          border border-zinc-700
          bg-zinc-800
          p-6
          transition
          hover:border-emerald-400
          hover:bg-emerald-500/10
        "
                          >
                            <img
                              src={suitIcons[value]}
                              alt={value}
                              draggable={false}
                              className="h-16 w-16 object-contain"
                            />

                            <span className="mt-2 block font-semibold">
                              {value}
                            </span>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
              {showPassScreen && phase === "playing" && !winner && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-8 text-center shadow-2xl">
                    <div className="text-4xl">🃏</div>

                    <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                      {l("Nächster Spieler", "Next player")}
                    </p>

                    <h2 className="mt-2 text-2xl font-bold">
                      {l("Gerät weitergeben", "Pass the device")}
                    </h2>

                    <p className="mt-4 text-xl font-black text-emerald-300">
                      {players[currentPlayer].name}
                    </p>

                    <button
                      type="button"
                      onClick={continueHotseat}
                      className="mt-8 w-full rounded-xl bg-emerald-500 px-5 py-3 font-black text-emerald-950 transition hover:bg-emerald-400"
                    >
                      {l("Ich bin bereit", "I'm ready")}
                    </button>
                  </div>
                </div>
              )}
              {phase === "fourPlayerPlayReady" && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[110px] bg-black/35 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-zinc-950/95 p-8 text-center shadow-2xl max-md:mx-3 max-md:max-w-sm max-md:rounded-2xl max-md:p-4">
                    <div className="text-4xl">🃏</div>

                    <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-400">
                      {l(
                        "Schlag und Farbe stehen fest",
                        "Schlag and trump are set",
                      )}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                          {t("Schlag")}
                        </p>

                        <p className="mt-2 text-2xl font-black">{schlag}</p>

                        <p className="mt-2 text-xs text-zinc-400">
                          {l("gewählt von", "chosen by")}
                        </p>

                        <p className="font-bold text-white">
                          {vorhandPlayer.name}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                          {l("Farbe", "Trump")}
                        </p>

                        {Farbe && (
                          <div className="mt-2 flex items-center justify-center gap-2">
                            <img
                              src={suitIcons[Farbe]}
                              alt={Farbe}
                              className="h-8 w-8 object-contain"
                              draggable={false}
                            />

                            <span className="text-2xl font-black">{Farbe}</span>
                          </div>
                        )}

                        <p className="mt-2 text-xs text-zinc-400">
                          {l("gewählt vom Geber", "chosen by the dealer")}
                        </p>

                        <p className="font-bold text-white">
                          {dealerPlayer.name}
                        </p>
                      </div>
                    </div>

                    <div className="mt-7 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                        {l("Beginnt den ersten Stich", "Leads the first trick")}
                      </p>

                      <p className="mt-2 text-2xl font-black text-white">
                        {vorhandPlayer.name}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPlayer(vorhandIndex);

                        setPhase("playing");

                        setShowPassScreen(true);
                      }}
                      className="mt-8 w-full rounded-xl bg-amber-400 px-6 py-4 text-lg font-black text-amber-950 transition hover:scale-[1.02] hover:bg-amber-300"
                    >
                      {l("Spiel beginnen", "Start play")}
                    </button>
                  </div>
                </div>
              )}
              {phase === "trickPause" && (
                <div className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2">
                  <button
                    type="button"
                    onClick={() => {
                      setCardPlayedThisTurn(false);
                      setPhase("trickReview");
                    }}
                    className="rounded-xl bg-amber-400 px-7 py-3 font-black text-amber-950 shadow-xl transition hover:scale-105 hover:bg-amber-300"
                  >
                    {l("Stich auswerten", "Review trick")}
                  </button>
                </div>
              )}
              {phase === "trickReview" && trickWinner && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-4xl rounded-3xl border border-white/10 bg-emerald-950 p-8 shadow-2xl">
                    <div className="text-center">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                        {l("Stich Review", "Trick review")}
                      </p>

                      <h2 className="mt-2 text-3xl font-black">
                        {
                          players.find(
                            (player) => player.id === trickWinner.playerId,
                          )?.name
                        }{" "}
                        gewinnt den Stich!
                      </h2>
                    </div>

                    <div className="mt-8 flex items-start justify-center gap-5">
                      {playedCards.map((played, index) => {
                        const isWinner =
                          played.playerId === trickWinner.playerId &&
                          played.card.id === trickWinner.card.id;

                        const player = players.find(
                          (candidate) => candidate.id === played.playerId,
                        );

                        return (
                          <div
                            key={`${played.playerId}-${played.card.id}`}
                            className={`flex flex-col items-center rounded-2xl p-4 ${
                              isWinner
                                ? "bg-amber-400/20 ring-2 ring-amber-400"
                                : "bg-white/5"
                            }`}
                          >
                            <div className="mb-3 rounded-full bg-white/10 px-3 py-1 text-xs font-bold">
                              {index + 1}. {player?.name}
                            </div>

                            <WattenCardComponent card={played.card} disabled />

                            {isWinner && (
                              <div className="mt-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">
                                {l("Stich-Sieger", "Trick winner")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={finishTrickReview}
                      className="mx-auto mt-8 block rounded-xl bg-amber-400 px-8 py-3 font-black text-amber-950 transition hover:bg-amber-300"
                    >
                      {l("Weiter", "Continue")}
                    </button>
                  </div>
                </div>
              )}
              {phase !== "setup" && (
                <div>
                  <div
                    className={`absolute left-1/2 top-6 z-20 w-52 -translate-x-1/2 rounded-2xl border p-4 text-center shadow-xl backdrop-blur max-md:top-2 max-md:w-36 max-md:p-2 ${topTeam.box}`}
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-amber-950">
                      {t("Partner")}
                    </div>

                    <div className="mt-1 text-lg font-bold">
                      {topPlayer.name}
                    </div>

                    <div
                      className={`mx-auto mt-1 w-fit rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${topTeam.badge}`}
                    >
                      {topTeam.label}
                    </div>

                    <HiddenPreviewCards player={topPlayer} />
                  </div>

                  <div
                    className={`absolute left-3 top-1/2 z-20 w-44 -translate-y-1/2 rounded-2xl border p-3 text-center shadow-xl backdrop-blur max-md:left-1 max-md:w-28 max-md:p-2 ${leftTeam.box}`}
                  >
                    <div className="absolute -top-3 right-3 rounded-full bg-amber-400 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-amber-950">
                      {l("Nächster Spieler", "Next player")}
                    </div>

                    <div className="text-lg font-bold">{leftPlayer.name}</div>

                    <div
                      className={`mx-auto mt-1 w-fit rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${leftTeam.badge}`}
                    >
                      {leftTeam.label}
                    </div>

                    <HiddenPreviewCards player={leftPlayer} />
                  </div>

                  <div
                    className={`absolute right-3 top-1/2 z-20 w-44 -translate-y-1/2 rounded-2xl border p-3 text-center shadow-xl backdrop-blur max-md:right-1 max-md:w-28 max-md:p-2 ${rightTeam.box}`}
                  >
                    <div className="text-lg font-bold">{rightPlayer.name}</div>

                    <div
                      className={`mx-auto mt-1 w-fit rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${rightTeam.badge}`}
                    >
                      {rightTeam.label}
                    </div>

                    <HiddenPreviewCards player={rightPlayer} />
                  </div>
                </div>
              )}
              {/* PLAYED CARDS */}
              <div className="absolute left-1/2 top-[45%] z-10 flex h-44 w-[440px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-3 rounded-3xl border border-white/10 bg-emerald-950/30 p-4 shadow-inner max-md:h-28 max-md:w-[calc(100%-1rem)] max-md:gap-1 max-md:rounded-2xl max-md:p-2">
                {playedCards.length === 0 ? (
                  <div className="text-center">
                    <p className="mt-2 text-sm text-emerald-300/50">
                      {l("Spielfeld", "Game table")}
                    </p>
                  </div>
                ) : (
                  playedCards.map((played) => {
                    const player = players.find(
                      (candidate) => candidate.id === played.playerId,
                    );

                    return (
                      <div
                        key={`${played.playerId}-${played.card.id}`}
                        className="flex flex-col items-center gap-2 max-md:scale-[0.72]"
                      >
                        <WattenCardComponent card={played.card} disabled />

                        <span className="text-xs font-medium text-emerald-100">
                          {player?.name}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              {/* CURRENT PLAYER HAND */}
              {!showPassScreen && phase === "playing" && !winner && (
                <div className="absolute bottom-4 left-1/2 z-30 w-full max-w-4xl -translate-x-1/2 px-8 max-md:bottom-2 max-md:px-1">
                  <div
                    className={`relative rounded-2xl px-6 py-5 shadow-2xl max-md:px-1 max-md:py-3`}
                  >
                    {/* ACTIVE PLAYER */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-5 py-1.5 text-sm font-black text-amber-950 shadow-lg max-md:-top-4 max-md:px-3 max-md:py-1 max-md:text-[10px]">
                      ▼ {fourCurrentPlayer.name} · AM ZUG
                    </div>

                    <div
                      className={`mx-auto mt-3 w-fit rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${bottomTeam.badge}`}
                    >
                      {bottomTeam.label}
                    </div>

                    {fourTrumpfOderKritischActive && (
                      <div
                        className={`mx-auto mt-3 w-fit rounded-xl border px-4 py-2 text-xs font-bold ${
                          fourCurrentMustFollow
                            ? "border-red-400/40 bg-red-500/20 text-red-100"
                            : "border-amber-400/40 bg-amber-400/20 text-amber-100"
                        }`}
                      >
                        {fourCurrentMustFollow
                          ? l(
                              "Trumpf oder Kritisch — du musst eine passende Karte spielen.",
                              "Trump or Critical — you must play an eligible card.",
                            )
                          : l(
                              "Trumpf oder Kritisch — du hast keine passende Karte und darfst frei spielen.",
                              "Trump or Critical — you have no eligible card, so you may play any card.",
                            )}
                      </div>
                    )}

                    {/* LEFT: Help legend */}
                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                      <div className="flex justify-end">
                        {helpMode &&
                          playedCards.length > 0 &&
                          !cardPlayedThisTurn && (
                            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold">
                              <span className="flex items-center gap-2 text-green-300">
                                <span className="h-3 w-3 rounded-full bg-green-500" />
                                {l(
                                  "Schlägt den aktuellen Gewinner",
                                  "Beats the current winner",
                                )}
                              </span>

                              <span className="flex items-center gap-2 text-red-300">
                                <span className="h-3 w-3 rounded-full bg-red-500" />
                                {l(
                                  "Schlägt den aktuellen Gewinner nicht",
                                  "Does not beat the current winner",
                                )}
                              </span>
                            </div>
                          )}
                      </div>

                      {/* CARDS */}
                      <div className="flex justify-center gap-2 max-md:gap-0">
                        {fourCurrentPlayer.cards.map((card) => {
                          const legal =
                            !fourCurrentMustFollow ||
                            isTrumpfOderKritischCard(card, Farbe);

                          const comparison =
                            helpMode &&
                            playedCards.length > 0 &&
                            !cardPlayedThisTurn &&
                            legal
                              ? wouldCardWin(
                                  card,
                                  fourCurrentPlayer.id,
                                  playedCards,
                                  Farbe,
                                  schlag,
                                )
                              : null;

                          return (
                            <div
                              key={card.id}
                              className="max-md:-mx-2.5 max-md:scale-[0.72] max-md:origin-center"
                            >
                              <WattenCardComponent
                                card={card}
                                disabled={!!winner || cardPlayedThisTurn}
                                invalid={
                                  fourCurrentMustFollow &&
                                  !legal &&
                                  !cardPlayedThisTurn
                                }
                                requiredChoice={
                                  fourCurrentMustFollow &&
                                  legal &&
                                  !cardPlayedThisTurn
                                }
                                helpStatus={
                                  helpMode &&
                                  !cardPlayedThisTurn &&
                                  legal &&
                                  comparison !== null
                                    ? comparison
                                      ? "winning"
                                      : "losing"
                                    : undefined
                                }
                                hint={getBeginnerCardHint(card)}
                                onClick={() => playCard(card)}
                              />
                            </div>
                          );
                        })}
                      </div>

                      {/* FINISH TURN */}
                      <div className="flex justify-start">
                        {playedCards.length < players.length &&
                          cardPlayedThisTurn && (
                            <button
                              type="button"
                              onClick={finishPlayerTurn}
                              className="animate-pulse whitespace-nowrap rounded-xl bg-amber-400 px-5 py-3 font-black text-amber-950 shadow-xl transition hover:scale-105 hover:bg-amber-300"
                            >
                              {l("Zug beenden", "Finish turn")}
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* CLOCKWISE INDICATOR */}
              <div className="absolute left-7 top-7 z-30 rounded-full border border-white/10 bg-emerald-950/80 px-4 py-2 text-xs font-semibold text-emerald-200 shadow-lg backdrop-blur">
                {l(
                  "↻ Spielrichtung im Uhrzeigersinn",
                  "↻ Play proceeds clockwise",
                )}
              </div>
              {winner && (
                <div className="absolute inset-0 z-[110] flex items-center justify-center rounded-[110px] bg-black/65 backdrop-blur-sm">
                  <div className="w-full max-w-lg rounded-3xl border border-amber-400/30 bg-zinc-950 p-10 text-center shadow-2xl">
                    <div className="text-5xl">🏆</div>

                    <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-amber-400">
                      {l("Rundensieger", "Round winner")}
                    </p>

                    <h2 className="mt-2 text-3xl font-black">{winner}</h2>

                    <p className="mt-3 text-zinc-400">{roundValue} Punkte</p>

                    {!gameWinner && (
                      <button
                        type="button"
                        onClick={startNextRound}
                        className="mt-8 rounded-xl bg-amber-400 px-7 py-3 font-black text-amber-950 transition hover:bg-amber-300"
                      >
                        {l("Nächste Runde", "Next round")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR: STICHSTAND */}
            <aside className="w-64 pt-10 max-md:order-3 max-md:w-full max-md:pt-0">
              <div className="h-[650px] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl max-md:h-auto max-md:max-h-[420px] max-md:p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                  {l("Aktueller Stichstand", "Current trick score")}
                </p>

                <h3 className="mt-1 text-lg font-bold text-white">
                  {l("2 gegen 2", "2 vs 2")}
                </h3>

                {/* TEAM A */}
                <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                    {t("Team A")}
                  </p>

                  <p className="mt-1 font-bold text-white">
                    {teamAPlayers[0]?.name}
                    <span className="text-zinc-500"> & </span>
                    {teamAPlayers[1]?.name}
                  </p>

                  <p className="mt-2 text-2xl font-black text-amber-400">
                    {teamATricks}
                  </p>

                  <p className="text-xs text-zinc-400">
                    {teamATricks === 1 ? "Stich" : "Stiche"}
                  </p>
                </div>

                {/* VS */}
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-white/10" />

                  <span className="text-xs font-bold text-zinc-500">
                    {t("VS")}
                  </span>

                  <div className="h-px flex-1 bg-white/10" />
                </div>

                {/* TEAM B */}
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                    {t("Team B")}
                  </p>

                  <p className="mt-1 font-bold text-white">
                    {teamBPlayers[0]?.name}
                    <span className="text-zinc-500"> & </span>
                    {teamBPlayers[1]?.name}
                  </p>

                  <p className="mt-2 text-2xl font-black text-emerald-400">
                    {teamBTricks}
                  </p>

                  <p className="text-xs text-zinc-400">
                    {teamBTricks === 1 ? "Stich" : "Stiche"}
                  </p>
                </div>

                {/* STICH PROGRESS */}
                <div className="mt-5">
                  <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {l("3 Stiche zum Sieg", "3 tricks to win")}
                  </p>

                  {/* TEAM A */}
                  <div className="grid grid-cols-3 gap-1">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full ${
                          index < teamATricks ? "bg-amber-400" : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>

                  {/* TEAM B */}
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={index}
                        className={`h-2 rounded-full ${
                          index < teamBTricks ? "bg-emerald-400" : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                {/* RUNDENWERT / GEHEN */}
                <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    {l("Rundenwert", "Round value")}
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
                      {l("Maximum erreicht", "Maximum reached")}
                    </p>
                  )}

                  {currentSideIsGespannt && (
                    <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-2">
                      <p className="text-xs font-bold text-red-300">
                        {t("Gespannt")}
                      </p>

                      <p className="mt-1 text-[10px] text-red-200/70">
                        {l("Erhöhen nicht möglich", "Cannot raise")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
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
    <main className="min-h-screen bg-transparent px-2 py-3 text-white sm:px-4 sm:py-4 md:px-8 md:py-6">
      <div className="mx-auto w-full max-w-[1800px]">
        {/* Header */}
        <div className="max-md:ml-0 max-md:pl-0 ml-5 pl-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            {l("Bayerisches Watten", "Bavarian Watten")}
          </p>

          <h1 className="mt-1 text-2xl font-black">
            {l("3 Spieler · Hotseat", "3 Players · Hotseat")}
          </h1>
        </div>

        <div className="relative pb-5 z-30 flex items-center justify-end gap-3 pr-2">
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
            {l("📖 Spielregeln", "📖 Rules")}
          </button>
          <CardThemeSelector />
          <TableThemeSelector />
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
                {t("Player wants to see their cards")}
              </h2>

              <p className="mt-3 text-zinc-400">{t("Pass the device to")}</p>

              <p className="mt-1 text-xl font-bold text-emerald-400">
                {players[viewingPlayer].name}
              </p>

              <p className="mt-3 text-sm text-zinc-500">
                {t("Make sure nobody else can see the cards.")}
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
                {l("Your Cards", "Your cards")}
              </h2>

              <p className="mt-2 text-center text-sm text-zinc-400">
                {t("These cards are only visible to you.")}
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
                {t("Done")}
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

              <h2 className="mt-6 text-2xl font-bold">
                {t("Pass the device")}
              </h2>

              <p className="mt-3 text-zinc-400">{t("Give the device to")}</p>

              <p className="mt-1 text-xl font-bold text-emerald-400">
                {players[currentPlayer].name}
              </p>

              <p className="mt-3 text-sm text-zinc-500">
                {t("Make sure nobody else can see your cards.")}
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
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl max-md:mx-3 max-md:p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                {t("Gehen")}
              </p>

              <h2 className="mt-2 text-2xl font-bold text-white">
                {getSideLabel(pendingBid.side)} geht auf {pendingBid.value}
              </h2>

              <p className="mt-4 text-sm leading-6 text-zinc-400">
                {l(
                  "Die Gegenseite muss entscheiden, ob sie den neuen Rundenwert hält.",
                  "The opposing side must decide whether to hold the new round value.",
                )}
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
                {l("Nicht halten", "Decline")}
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
                {l("Gesamtsieger", "Match winner")}
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

              <h2 className="mt-2 text-3xl font-bold">{t("Abheben")}</h2>

              <p className="mt-3 text-zinc-400">
                {t("One of these three special cards can be drawn:")}
              </p>

              {/* Special cards explanation */}
              <div className="mt-6">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {t("Special cards")}
                </div>

                <div className="flex justify-center gap-4">
                  {specialCards.map((specialCard) => (
                    <div
                      key={`${specialCard.suit}-${specialCard.rank}`}
                      className="flex flex-col items-center gap-2 max-md:scale-[0.72]"
                    >
                      <MiniWattenCard card={specialCard} />

                      <span className="text-[10px] font-semibold text-amber-300">
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
                      {l(
                        "Wähle eine Karte zum Abheben",
                        "Choose a card to cut",
                      )}
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

                              const cannotCut = actualIndex === deck.length - 1;

                              return (
                                <button
                                  key={card.id}
                                  type="button"
                                  disabled={cannotCut}
                                  onClick={() => chooseCut(actualIndex)}
                                  className={`
  relative
  h-20
  w-12
  rounded-lg
  border border-white/20
  bg-zinc-950
  shadow-lg
  transition-all
  duration-200

  ${index !== 0 ? "-ml-5" : ""}

  ${
    cannotCut
      ? "cursor-not-allowed opacity-30"
      : "hover:z-30 hover:-translate-y-3 hover:scale-110 hover:border-amber-300"
  }
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
                        {l("Karte wird aufgedeckt...", "Revealing card...")}
                      </p>
                    )}

                    {abhebenAnimation === "returning" && (
                      <p className="mt-4 font-semibold text-zinc-300">
                        {l(
                          "Keine Kritische — die Karte kommt zurück in den Stapel.",
                          "No critical card — the card returns to the deck.",
                        )}
                      </p>
                    )}

                    {abhebenAnimation === "taking" && (
                      <p className="mt-4 font-semibold text-amber-300">
                        {l(
                          "Kritische! Die Karte kommt auf deine Hand.",
                          "Critical card! The card goes into your hand.",
                        )}
                      </p>
                    )}

                    {abhebenAnimation === "finished" && (
                      <p className="mt-4 font-semibold text-emerald-300">
                        {l(
                          "Abheben beendet — Karten werden zusammengelegt...",
                          "Cut finished — cards are being put back together...",
                        )}
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
              <p className="text-lg font-bold text-white">
                {t("Look at your cards")}
              </p>

              <p className="mt-2 text-sm text-emerald-300">
                {t("Select your player and pass the device to them.")}
              </p>
            </div>
          </div>
        )}
        {phase === "trump" && !winner && !showPassScreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 p-8 text-center text-white shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {players[trumpCaller].name}
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {l("Trumpf bestimmen", "Choose trump")}
              </h2>

              <p className="mt-2 text-zinc-400">
                {l(
                  "Sieh dir deine Karten an und wähle danach den Trumpf.",
                  "Look at your cards and then choose trump.",
                )}
              </p>

              {/* OWN HAND */}
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                  {l("Deine Karten", "Your cards")}
                </p>

                <div className="flex justify-center gap-2 max-md:gap-0">
                  {players[trumpCaller].cards.map((card) => (
                    <div key={card.id} className="pointer-events-none">
                      <WattenCardComponent card={card} />
                    </div>
                  ))}
                </div>
              </div>

              {/* TRUMPF CHOICE */}
              <div className="mt-8 grid grid-cols-2 gap-3">
                {(["Herz", "Schellen", "Eichel", "Gras"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setFarbe(value);
                        setPhase("schlag");
                      }}
                      className="
          flex flex-col items-center justify-center
          rounded-2xl
          border border-zinc-700
          bg-zinc-800
          p-6
          transition
          hover:border-emerald-400
          hover:bg-emerald-500/10
        "
                    >
                      <img
                        src={suitIcons[value]}
                        alt={value}
                        draggable={false}
                        className="h-16 w-16 object-contain"
                      />

                      <span className="mt-3 block font-semibold">{value}</span>
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        )}
        {phase === "schlag" && !winner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 p-8 text-center text-white shadow-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {players[trumpCaller].name}
              </p>

              <h2 className="mt-2 text-3xl font-bold">
                {l(l("Schlag bestimmen", "Choose Schlag"), "Choose Schlag")}
              </h2>

              <p className="mt-2 text-zinc-400">
                {l(
                  "Sieh dir deine Karten an und wähle danach den Schlag.",
                  "Look at your cards and then choose Schlag.",
                )}
              </p>

              {/* SELECTED TRUMPF */}
              <div className="mx-auto mt-4 w-fit rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-2">
                <span className="text-xs uppercase tracking-widest text-emerald-300">
                  {l("Trumpf", "Trump")}
                </span>

                <p className="mt-1 font-black text-white">{Farbe}</p>
              </div>

              {/* OWN HAND */}
              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-300">
                  {l("Deine Karten", "Your cards")}
                </p>

                <div className="flex justify-center gap-2 max-md:gap-0">
                  {players[trumpCaller].cards.map((card) => (
                    <div key={card.id} className="pointer-events-none">
                      <WattenCardComponent card={card} />
                    </div>
                  ))}
                </div>
              </div>

              {/* SCHLAG CHOICE */}
              <div className="mt-8 grid grid-cols-4 gap-3 md:grid-cols-8">
                {["7", "8", "9", "10", "Unter", "Ober", "König", "Ass"].map(
                  (rank) => (
                    <button
                      key={rank}
                      type="button"
                      onClick={() => {
                        setSchlag(rank);
                        setCurrentPlayer(trumpCaller);
                        setPhase("playing");
                      }}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-4 text-sm font-semibold transition hover:border-amber-400 hover:bg-amber-400/10"
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
                  {l("Stich Review", "Trick review")}
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
                {playedCards.map((played) => {
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
                          {l("Stich-Sieger", "Trick winner")}
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
                {l("Weiter", "Continue")}
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
                    {l("Spielregeln", "Rules")}
                  </p>

                  <h2 className="mt-1 text-3xl font-bold">
                    {l(
                      "Bayerisches Watten · 3 Spieler",
                      "Bavarian Watten · 3 Players",
                    )}
                  </h2>

                  <p className="mt-1.5 text-xs text-zinc-400">
                    {l(
                      "Regelvariante, die in diesem Spiel verwendet wird.",
                      "Rules variant used in this game.",
                    )}
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
                    {l("1 · Spieler und Ziel", "1 · Players and goal")}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {l(
                      "Ein Spieler spielt allein. Die beiden anderen Spieler bilden gemeinsam das gegnerische Team. Wer zuerst drei der fünf Stiche gewinnt, gewinnt die Runde.",
                      "One player plays solo. The other two form the opposing team. The first side to win three of five tricks wins the round.",
                    )}
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    {l("2 · Kartenrangfolge", "2 · Card ranking")}
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
                    {l("3 · Schlag und Farbe", "3 · Schlag and trump")}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {l(
                      "Schlag bezeichnet einen Kartenrang, zum Beispiel Ober. Farbe bezeichnet die Trumpffarbe. Die Karte, die gleichzeitig Schlag und Trumpffarbe ist, ist der Hauptschlag.",
                      "Schlag is a card rank, for example Ober. Farbe is the trump suit. The card that is both Schlag and trump suit is the Main Schlag.",
                    )}
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="font-bold text-amber-300">
                    {l("4 · Einen Stich gewinnen", "4 · Winning a trick")}
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
                    {l("5 · Trumpf oder Kritisch", "5 · Trump or Critical")}
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
                    {l("6 · Nächster Stich", "6 · Next trick")}
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-zinc-300">
                    {l(
                      "Der Gewinner eines Stiches spielt die erste Karte des nächsten Stiches aus.",
                      "The winner of a trick leads the next trick.",
                    )}
                  </p>
                </section>
              </div>

              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="mt-8 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-amber-950 transition hover:bg-amber-300"
              >
                {l("Regeln schließen", "Close rules")}
              </button>
            </div>
          </div>
        )}

        {/* Table + round score */}
        <div className="grid w-full grid-cols-[16rem_minmax(0,1fr)_16rem] items-start gap-5 max-md:grid-cols-1 max-md:gap-3">
          {/* LEFT SIDEBAR: PUNKTESTAND */}
          <aside className="relative w-64 pt-15 max-md:order-2 max-md:w-full max-md:pt-0">
            {/* CARD PRIORITY HELP */}
            {Farbe && schlag && (
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
                  <div className="absolute left-0 top-full mt-2 h-[650px] w-full overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur max-md:fixed max-md:inset-x-2 max-md:top-20 max-md:z-[200] max-md:h-[70vh] max-md:w-auto max-md:p-3">
                    <div className="mb-5">
                      <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                        {l("Anfängerhilfe", "Beginner")}
                      </p>

                      <h2 className="mt-1 text-xl font-bold text-white">
                        {l("Kartenrangfolge", "Card ranking")}
                      </h2>

                      <p className="mt-1 text-xs text-zinc-400">
                        {l(
                          "Von oben nach unten: höchste Priorität zuerst.",
                          "Highest priority first.",
                        )}
                      </p>

                      <div className="mt-3 flex gap-4 text-xs">
                        <span className="text-emerald-300">
                          {l("Farbe:", "Trump:")}
                          <strong>{Farbe}</strong>
                        </span>

                        <span className="text-amber-300">
                          {t("Schlag:")}
                          <strong>{schlag}</strong>
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
                              {l(
                                "Keine Karte in dieser Kategorie.",
                                "No card in this category.",
                              )}
                            </p>
                          )}
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="h-[650px] rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl max-md:h-auto max-md:p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                {l("Punktestand", "Score")}
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
                              {l("Alleinspieler", "Solo player")}
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
          <div
            className="
    relative
    h-[520px]
    overflow-hidden
    rounded-[40px]
    max-md:order-1
    max-md:h-[460px]
    max-md:rounded-[28px]
    border border-white/10
    shadow-2xl
    transition-all
    duration-500
  "
            style={{
              backgroundImage: `url(${tableBackgrounds[tableTheme]})`,
              backgroundSize: "100% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          >
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
                      {l("Abheben beendet", "Cut finished")}
                    </p>

                    <h3 className="mt-1 text-xl font-bold text-white">
                      {l("Karten bereit zum Austeilen", "Cards ready to deal")}
                    </h3>

                    <button
                      type="button"
                      onClick={finishAbheben}
                      className="mt-5 rounded-xl bg-amber-400 px-7 py-4 font-bold text-amber-950 shadow-xl transition hover:scale-105 hover:bg-amber-300"
                    >
                      {l("austeilen und Zug beenden", "deal and finish turn")}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* ABHEBER HAND DURING DEAL READY */}
            {phase === "dealReady" && (
              <div className="absolute bottom-4 left-1/2 z-30 w-full -translate-x-1/2 px-10 max-md:bottom-2 max-md:px-1">
                <div className="relative mx-auto min-h-32 max-w-xl rounded-2xl border border-amber-400/20 px-6 py-4 shadow-2xl backdrop-blur-sm max-md:min-h-24 max-md:px-2 max-md:py-2">
                  {/* Player label */}
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-5 py-1.5 text-sm font-black text-amber-950 shadow-lg max-md:-top-4 max-md:px-3 max-md:py-1 max-md:text-[10px]">
                    ▼ {abhebenPlayerData.name} · ABHEBER
                  </div>

                  <div className="mt-3 text-center">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
                      {l(
                        "Deine Hand nach dem Abheben",
                        "Your hand after cutting",
                      )}
                    </p>

                    <p className="mt-1 text-sm font-bold text-black">
                      {l(
                        "Die restlichen Karten werden gleich ausgeteilt.",
                        "The remaining cards will be dealt next.",
                      )}
                    </p>
                  </div>

                  <div className="mt-4 flex min-h-20 items-center justify-center gap-3">
                    {abhebenPlayerData.cards.length > 0 ? (
                      abhebenPlayerData.cards.map((card) => (
                        <div
                          key={card.id}
                          className="animate-in fade-in zoom-in duration-500 max-md:-mx-2.5 max-md:scale-[0.72] max-md:origin-center"
                        >
                          <WattenCardComponent card={card} disabled />
                        </div>
                      ))
                    ) : (
                      <div className="flex h-20 items-center justify-center rounded-xl border border-dashed px-8 text-sm text-black">
                        {l(
                          "Noch keine Karte auf der Hand",
                          "No cards in hand yet",
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* GAME STATUS - BETWEEN OPPONENTS */}
            <div className="absolute left-1/2 top-8 z-20 -translate-x-1/2">
              <div className="flex min-w-72 flex-col items-center rounded-2xl border border-white/10 bg-emerald-950/80 px-5 py-3 shadow-lg backdrop-blur max-md:min-w-0 max-md:w-full max-md:px-3 max-md:py-2">
                {/* Farbe + Schlag */}
                <div className="flex items-center justify-center gap-10">
                  <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
                      {l("Farbe", "Trump")}
                    </p>

                    {Farbe ? (
                      <div className="mt-0.5 flex items-center gap-2">
                        <img
                          src={suitIcons[Farbe]}
                          alt={Farbe}
                          draggable={false}
                          className="h-7 w-7 object-contain"
                        />

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
                      {t("Schlag")}
                    </p>

                    <p className="mt-0.5 text-base font-bold text-white">
                      {schlag ?? "–"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* PRE-GAME SETUP */}
            {phase === "setup" && (
              <div className="absolute inset-0 z-40 flex items-center justify-center rounded-[110px] bg-emerald-950/20 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950/95 p-5 text-center shadow-2xl backdrop-blur-md">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400">
                    {l("Neues Spiel", "New game")}
                  </p>

                  <h2 className="mt-1 text-2xl font-bold text-white">
                    {t("Watten")}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    {l(
                      "Wählt zuerst, wie viele Punkte zum Gesamtsieg benötigt werden.",
                      "First choose how many points are needed to win the match.",
                    )}
                  </p>

                  {/* Players */}
                  <div className="mt-4 flex justify-center gap-1.5">
                    {players.map((player) => (
                      <div
                        key={player.id}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {player.name}
                      </div>
                    ))}
                  </div>

                  {/* Target score */}
                  <div className="mt-5">
                    <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                      {l("Punkte zum Sieg", "Points to win")}
                    </label>

                    <div className="mt-2 flex items-center justify-center gap-2">
                      {[11, 15, 18].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setTargetScore(score)}
                          className={`h-10 w-14 rounded-lg text-sm font-black transition ${
                            targetScore === score
                              ? "bg-amber-400 text-amber-950 ring-2 ring-amber-200"
                              : "bg-white/10 text-white hover:bg-white/20"
                          }`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>

                    <div className="mt-3">
                      <label className="text-[10px] text-zinc-500">
                        {l("Oder eigener Wert:", "Or custom value:")}
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
                        className="mx-auto mt-1.5 block w-20 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-center text-sm font-bold text-white outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Basic scoring explanation */}
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-xs text-zinc-300">
                    <div className="flex justify-between">
                      <span>
                        {l("Normaler Rundensieg", "Normal round win")}
                      </span>
                      <strong className="text-amber-300">
                        {l("2 Punkte", "2 points")}
                      </strong>
                    </div>

                    <div className="mt-2 flex justify-between">
                      <span>
                        {l("Gehen möglich bis", "Gehen possible up to")}
                      </span>
                      <strong className="text-amber-300">
                        {l("4 Punkte", "4 points")}
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startGame}
                    className="mt-5 w-full rounded-xl bg-amber-400 px-5 py-3 text-sm font-black text-amber-950 shadow-xl transition hover:scale-[1.02] hover:bg-amber-300"
                  >
                    {l("Spiel starten", "Start game")}
                  </button>
                </div>
              </div>
            )}
            {phase !== "setup" && (
              <div>
                {/* LEFT OPPONENT */}
                <div className="absolute left-10 top-8 z-20 w-48 rounded-2xl border border-white/10 bg-emerald-950/55 p-3 text-center shadow-lg transition-all duration-300 max-md:left-2 max-md:top-3 max-md:w-32 max-md:p-2">
                  {/* NEXT PLAYER */}
                  {phase !== "dealReady" && (
                    <div className="absolute -top-2 right-2 rounded-full border border-amber-400/40 bg-amber-400 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-950 shadow">
                      {l("Nächster Spieler", "Next player")}
                    </div>
                  )}

                  <div className="text-lg font-bold text-white">
                    {leftOpponent.name}
                  </div>

                  <p className="mt-0.5 text-[11px] text-emerald-300">
                    {phase === "dealReady"
                      ? l("Wartet auf Karten", "Waiting for cards")
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
                    {l("👁 Karten ansehen", "👁 View cards")}
                  </button>
                </div>

                {/* RIGHT OPPONENT */}
                <div className="absolute right-10 top-8 z-20 w-48 rounded-2xl border border-white/10 bg-emerald-950/55 p-3 text-center shadow-lg transition-all duration-300 max-md:right-2 max-md:top-3 max-md:w-32 max-md:p-2">
                  {phase === "dealReady" && (
                    <div className="absolute -top-2 left-2 rounded-full border border-amber-400/40 bg-amber-400 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-950 shadow">
                      {l("Beginnt das Spiel", "Starts the game")}
                    </div>
                  )}
                  <div className="text-lg font-bold text-white">
                    {rightOpponent.name}
                  </div>

                  <p className="mt-0.5 text-[11px] text-emerald-300">
                    {phase === "dealReady"
                      ? l("Wartet auf Karten", "Waiting for cards")
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
                    {l("👁 Karten ansehen", "👁 View cards")}
                  </button>
                </div>
              </div>
            )}

            {/* PLAYED CARDS */}
            <div className="absolute left-1/2 top-[46%] z-10 flex h-44 w-[380px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-3 rounded-3xl border border-white/10 bg-emerald-950/30 p-4 shadow-inner">
              {playedCards.length === 0 ? (
                <div className="text-center">
                  <p className="mt-2 text-sm text-emerald-300/50">
                    {l("Spielfeld", "Game table")}
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
                          {l("Choose Trumpf", "Choose trump")}
                        </button>
                      </div>
                    )}
                </div>
              ) : (
                playedCards.map((played) => (
                  <div
                    onMouseEnter={playHoverSound}
                    key={`${played.playerId}-${played.card.id}`}
                    className="flex flex-col items-center gap-2 max-md:scale-[0.72]"
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
                  {l("weiter", "continue")}
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
                  <div className="relative mx-auto min-h-40 max-w-3xl rounded-2xl p-2.5 shadow-2xl">
                    {/* Active player label */}
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-5 py-1.5 text-sm font-black text-amber-950 shadow-lg max-md:-top-4 max-md:px-3 max-md:py-1 max-md:text-[10px]">
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
                          {l("Handkarten von", "Hand of")}
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
                                {l(
                                  "Schlägt den aktuellen Gewinner",
                                  "Beats the current winner",
                                )}
                              </span>

                              <span className="flex items-center gap-2 text-red-300">
                                <span className="h-3 w-3 rounded-full bg-red-500" />
                                {l(
                                  "Schlägt den aktuellen Gewinner nicht",
                                  "Does not beat the current winner",
                                )}
                              </span>
                            </div>
                          )}
                      </div>

                      {/* CENTER: Cards */}
                      <div className="flex justify-center gap-2 max-md:gap-0">
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
                            <div
                              key={card.id}
                              className="max-md:-mx-2.5 max-md:scale-[0.72] max-md:origin-center"
                            >
                              <WattenCardComponent
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
                            </div>
                          );
                        })}
                      </div>

                      {/* RIGHT: Finish Turn */}
                      <div className="flex justify-start">
                        {phase === "playing" &&
                          playedCards.length < players.length &&
                          cardPlayedThisTurn && (
                            <div className="flex flex-col items-center gap-2 max-md:scale-[0.72]">
                              <p className="text-center text-xs font-medium text-emerald-200">
                                {t("Card played.")}
                              </p>

                              <button
                                type="button"
                                onClick={finishPlayerTurn}
                                className="animate-pulse whitespace-nowrap rounded-xl bg-amber-400 px-5 py-3 font-bold text-amber-950 shadow-xl shadow-amber-400/30 transition hover:scale-105 hover:bg-amber-300"
                              >
                                {l("Finish Turn", "Finish turn")}
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
                    {l("Round Winner", "Round winner")}
                  </p>

                  <h2 className="mt-2 text-4xl font-bold text-white">
                    {winner}
                  </h2>

                  <button
                    type="button"
                    onClick={restartGame}
                    className="mt-8 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500"
                  >
                    {l("Play Again", "Play again")}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* RIGHT SIDEBAR: STICHSTAND */}
          <aside className="w-64 pt-10 max-md:order-3 max-md:w-full max-md:pt-0">
            <div className="h-[650px] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl max-md:h-auto max-md:max-h-[420px] max-md:p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                {l("Aktueller Stichstand", "Current trick score")}
              </p>

              <h3 className="mt-1 text-lg font-bold text-white">
                {l("1 gegen 2", "1 vs 2")}
              </h3>

              {/* SOLO */}
              <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                  {l("Alleinspieler", "Solo player")}
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

                <span className="text-xs font-bold text-zinc-500">
                  {t("VS")}
                </span>

                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* TEAM */}
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  {l("Gegenspieler", "Opponents")}
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
                  {l("3 Stiche zum Sieg", "3 tricks to win")}
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
                  {l("Rundenwert", "Round value")}
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
                    {l("Maximum erreicht", "Maximum reached")}
                  </p>
                )}
              </div>
              {currentSideIsGespannt && (
                <p className="text-xs font-bold text-red-300">
                  {l(
                    "Gespannt · Erhöhen nicht möglich",
                    "Gespannt · Cannot raise",
                  )}
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
