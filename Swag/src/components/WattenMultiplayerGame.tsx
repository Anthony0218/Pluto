import { useEffect, useRef, useState } from "react";

import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

import WattenCardComponent from "./WattenCard";
import {
  createDeck,
  getCriticalValue,
  isCritical,
  isFirstTrick,
  isHauptschlag,
  isTrumpfOderKritischCard,
  mustFollowTrumpfOderKritisch,
  normalRankValue,
  WATTEN_CARD_CLIP,
  wouldCardWin,
  type WattenCard,
} from "../utils/watten";
import CardThemeSelector from "./WattenCardGameSelector";
import { useCardTheme } from "@/context/CardThemeContext";
import { getWattenCardImage } from "@/utils/WattenCardImages";
import TableThemeSelector from "./TableThemeSelector";

import { useTableTheme, type TableTheme } from "@/context/TableThemeContext";

type Room = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "finished";
};

type RoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
};

type AbhebenEvent = {
  card: WattenCard;

  critical: boolean;

  recipient_seat: number | null;

  order: number;
};

type MultiplayerGame = {
  room_id: string;

  phase: string;

  dealer: number;
  abheben_player: number;
  current_player: number;

  farbe: "Herz" | "Schellen" | "Gras" | "Eichel" | null;

  schlag: string | null;

  played_cards: {
    playerId: string;
    seat: number;
    card: WattenCard;
  }[];

  tricks_won: Record<string, number>;

  cards_remaining: Record<string, number>;

  trick_winner_seat: number | null;

  round_value: number;
  team_a_score: number;
  team_b_score: number;

  target_score: number;

  pending_bid_team: "team-a" | "team-b" | null;

  pending_bid_value: number | null;

  last_bid_team: "team-a" | "team-b" | null;

  match_winner: "team-a" | "team-b" | null;

  round_end_reason: "tricks" | "declined" | null;

  winner: string | null;

  version: number;

  abheben_result: AbhebenEvent[] | null;
};

type HandRow = {
  room_id: string;
  user_id: string;
  cards: WattenCard[];
};
type WattenSuit = "Herz" | "Schellen" | "Eichel" | "Gras";

type WattenRank = "7" | "8" | "9" | "10" | "Unter" | "Ober" | "König" | "Ass";
type WattenTeam = "team-a" | "team-b";

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
          rounded-[6px]
          object-fill
          drop-shadow-md
        "
      />
    </div>
  );
}

function getTeamForSeat(seat: number): WattenTeam {
  return seat % 2 === 0 ? "team-a" : "team-b";
}

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
function playCardSound() {
  const audio = new Audio("/sounds/card-play.mp3");

  audio.volume = 0.5;

  void audio.play();
}
function playHoverSound() {
  const audio = new Audio("/sounds/card-hover.mp3");

  audio.volume = 0.1;

  void audio.play();
}

export default function WattenMultiplayerGame() {
  const { roomCode } = useParams();

  const navigate = useNavigate();

  const { user } = useAuth();

  const { tableTheme } = useTableTheme();

  const [room, setRoom] = useState<Room | null>(null);

  const [game, setGame] = useState<MultiplayerGame | null>(null);

  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  const [hand, setHand] = useState<WattenCard[]>([]);

  const [mySeat, setMySeat] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);

  const [abhebenPreview, setAbhebenPreview] = useState<AbhebenEvent[]>([]);

  const [showAbhebenPreview, setShowAbhebenPreview] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const [playingCard, setPlayingCard] = useState(false);

  const [continuingTrick, setContinuingTrick] = useState(false);

  const [bidAction, setBidAction] = useState<
    "raise" | "hold" | "decline" | null
  >(null);

  const [startingNextRound, setStartingNextRound] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const shownAbhebenResultRef = useRef<string | null>(null);

  const [helpMode, setHelpMode] = useState(false);

  const [showRankingHelp, setShowRankingHelp] = useState(false);

  async function loadHand(roomId: string) {
    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from("watten_hands")
      .select(
        `
        room_id,
        user_id,
        cards
        `,
      )
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      console.error("Could not load hand:", error);

      return;
    }

    const row = data as HandRow;

    setHand(row.cards ?? []);
  }
  async function performCut(cutIndex: number) {
    if (!room || !game || mySeat === null) {
      return;
    }

    if (game.phase !== "abheben" || game.abheben_player !== mySeat) {
      return;
    }

    if (cutting) {
      return;
    }

    setCutting(true);
    setError(null);

    const { data, error } = await supabase.rpc("perform_watten_abheben", {
      p_room_id: room.id,

      p_cut_index: cutIndex,
    });

    setCutting(false);

    if (error) {
      console.error("Abheben failed:", error);

      setError(error.message ?? "Abheben fehlgeschlagen.");

      return;
    }

    console.log("Abheben:", data);
  }

  async function chooseSchlag(rank: WattenRank) {
    if (!room || !game || mySeat === null || choosing) {
      return;
    }

    if (game.phase !== "schlag" || game.current_player !== mySeat) {
      return;
    }

    setChoosing(true);
    setError(null);

    const { data, error } = await supabase.rpc("choose_watten_schlag", {
      p_room_id: room.id,
      p_schlag: rank,
    });

    setChoosing(false);

    if (error) {
      console.error("Schlag selection failed:", error);

      setError(error.message);
      return;
    }

    console.log("Schlag selected:", data);
  }

  async function chooseFarbe(farbe: WattenSuit) {
    if (!room || !game || mySeat === null || choosing) {
      return;
    }

    if (game.phase !== "trump" || game.current_player !== mySeat) {
      return;
    }

    setChoosing(true);
    setError(null);

    const { data, error } = await supabase.rpc("choose_watten_farbe", {
      p_room_id: room.id,
      p_farbe: farbe,
    });

    setChoosing(false);

    if (error) {
      console.error("Farbe selection failed:", error);

      setError(error.message);
      return;
    }

    console.log("Farbe selected:", data);
  }
  function cardIsLegal(card: WattenCard) {
    if (!mustPlayTrumpfOderKritisch) {
      return true;
    }

    if (!resolvedGame.farbe) {
      return true;
    }

    return isTrumpfOderKritischCard(card, resolvedGame.farbe);
  }
  async function playCard(card: WattenCard) {
    if (!room || !game || mySeat === null || playingCard) {
      return;
    }

    if (game.phase !== "playing" || game.current_player !== mySeat) {
      return;
    }

    if (!cardIsLegal(card)) {
      setError(
        "Trumpf oder Kritisch: Du musst Trumpf oder einen Kritischen spielen.",
      );

      return;
    }

    setPlayingCard(true);
    setError(null);

    const { data, error } = await supabase.rpc("play_watten_card", {
      p_room_id: room.id,

      p_card_id: card.id,
    });

    setPlayingCard(false);

    if (error) {
      console.error("Card play failed:", error);

      setError(error.message ?? "Die Karte konnte nicht gespielt werden.");

      return;
    }
    playCardSound();
    console.log("Card played:", data);
  }
  async function continueTrick() {
    if (!room || continuingTrick) {
      return;
    }

    setContinuingTrick(true);
    setError(null);

    const { error } = await supabase.rpc("continue_watten_trick", {
      p_room_id: room.id,
    });

    setContinuingTrick(false);

    if (error) {
      /*
       * Another player may already
       * have clicked Weiter.
       */
      if (error.message.includes("No trick is waiting")) {
        return;
      }

      console.error("Could not continue trick:", error);

      setError(error.message);
    }
  }

  async function raiseBid() {
    if (!room || !game || mySeat === null || bidAction) {
      return;
    }

    if (game.phase !== "playing" || game.current_player !== mySeat) {
      return;
    }

    setBidAction("raise");
    setActionError(null);

    const { error } = await supabase.rpc("raise_watten_bid", {
      p_room_id: room.id,
    });

    setBidAction(null);

    if (error) {
      console.error("Gehen failed:", error);

      setActionError(error.message);
    }
  }
  async function respondToBid(hold: boolean) {
    if (!room || !game || mySeat === null || bidAction) {
      return;
    }

    if (game.phase !== "bidPending" || !game.pending_bid_team) {
      return;
    }

    const myTeam = getTeamForSeat(mySeat);

    if (myTeam === game.pending_bid_team) {
      return;
    }

    setBidAction(hold ? "hold" : "decline");

    setActionError(null);

    const { error } = await supabase.rpc("respond_watten_bid", {
      p_room_id: room.id,

      p_hold: hold,
    });

    setBidAction(null);

    if (error) {
      /*
       * Another teammate may already
       * have answered.
       */
      if (error.message.includes("No Gehen decision")) {
        return;
      }

      console.error("Bid response failed:", error);

      setActionError(error.message);
    }
  }
  async function startNextRound() {
    if (!room || !game || startingNextRound) {
      return;
    }

    if (game.phase !== "roundFinished") {
      return;
    }

    setStartingNextRound(true);
    setActionError(null);

    const { error } = await supabase.rpc("start_next_watten_round", {
      p_room_id: room.id,
    });

    setStartingNextRound(false);

    if (error) {
      if (error.message.includes("Round is not finished")) {
        return;
      }

      console.error("Next round failed:", error);

      setActionError(error.message);
    }
  }

  function cardCountForSeat(seat: number) {
    return resolvedGame.cards_remaining?.[String(seat)] ?? 0;
  }
  useEffect(() => {
    if (!roomCode || !user) {
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | undefined;

    async function loadGame() {
      setLoading(true);
      setError(null);

      // -----------------------------------
      // ROOM
      // -----------------------------------

      const { data: roomData, error: roomError } = await supabase
        .from("watten_rooms")
        .select(
          `
          id,
          code,
          host_id,
          status
          `,
        )
        .eq("code", roomCode?.toUpperCase())
        .single();

      if (roomError || !roomData) {
        console.error(roomError);

        setError("Raum nicht gefunden.");

        setLoading(false);

        return;
      }

      const loadedRoom = roomData as Room;

      setRoom(loadedRoom);

      if (loadedRoom.status !== "playing") {
        navigate(`/watten/multiplayer/${loadedRoom.code}`);

        return;
      }

      // -----------------------------------
      // PLAYERS
      // -----------------------------------

      const { data: playerData, error: playerError } = await supabase
        .from("watten_room_players")
        .select(
          `
          room_id,
          user_id,
          seat,
          display_name
          `,
        )
        .eq("room_id", loadedRoom.id)
        .order("seat", {
          ascending: true,
        });

      if (playerError) {
        console.error(playerError);

        setError("Spieler konnten nicht geladen werden.");

        setLoading(false);

        return;
      }

      const loadedPlayers = (playerData ?? []) as RoomPlayer[];

      setPlayers(loadedPlayers);

      const me = loadedPlayers.find((player) => player.user_id === user?.id);

      if (!me) {
        setError("Du bist kein Spieler dieses Raumes.");

        setLoading(false);

        return;
      }

      setMySeat(me.seat);

      // -----------------------------------
      // PUBLIC GAME
      // -----------------------------------

      const { data: gameData, error: gameError } = await supabase
        .from("watten_games")
        .select("*")
        .eq("room_id", loadedRoom.id)
        .single();

      if (gameError || !gameData) {
        console.error(gameError);

        setError("Spielstatus konnte nicht geladen werden.");

        setLoading(false);

        return;
      }

      setGame(gameData as MultiplayerGame);

      // -----------------------------------
      // PRIVATE HAND
      // -----------------------------------

      await loadHand(loadedRoom.id);

      // -----------------------------------
      // REALTIME
      // -----------------------------------

      channel = supabase
        .channel(`watten-game-${loadedRoom.id}-${user?.id}`)

        // PUBLIC GAME UPDATE
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "watten_games",
            filter: `room_id=eq.${loadedRoom.id}`,
          },
          (payload) => {
            setGame(payload.new as MultiplayerGame);
          },
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "watten_hands",
            filter: `user_id=eq.${user?.id}`,
          },
          () => {
            void loadHand(loadedRoom.id);
          },
        )
        .subscribe();

      setLoading(false);
    }

    void loadGame();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [roomCode, user, navigate]);
  useEffect(() => {
    if (!game?.abheben_result || game.abheben_result.length === 0) {
      return;
    }

    const key = JSON.stringify(game.abheben_result);

    if (shownAbhebenResultRef.current === key) {
      return;
    }

    shownAbhebenResultRef.current = key;

    setAbhebenPreview(game.abheben_result);
    setShowAbhebenPreview(true);

    const timer = window.setTimeout(() => {
      setShowAbhebenPreview(false);
    }, 4500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [game?.abheben_result]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 text-white">
        <div className="text-center">
          <p className="text-red-300">{error}</p>

          <Link
            to="/watten/multiplayer"
            className="mt-6 inline-block rounded-xl bg-white/10 px-5 py-3"
          >
            Zurück
          </Link>
        </div>
      </main>
    );
  }

  if (loading || !room || !game || mySeat === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-emerald-950 text-white">
        <p>Multiplayer-Spiel wird geladen...</p>
      </main>
    );
  }
  const resolvedGame = game;
  const resolvedMySeat = mySeat;

  const me = players.find((player) => player.seat === mySeat);

  const dealer = players.find((player) => player.seat === game.dealer);

  const abheber = players.find((player) => player.seat === game.abheben_player);

  const isMyTurn = game.current_player === mySeat;
  const myTeam = getTeamForSeat(mySeat);

  const teamAPlayers = players.filter(
    (player) => getTeamForSeat(player.seat) === "team-a",
  );

  const teamBPlayers = players.filter(
    (player) => getTeamForSeat(player.seat) === "team-b",
  );

  const teamAScore = game.team_a_score ?? 0;

  const teamBScore = game.team_b_score ?? 0;

  const targetScore = game.target_score ?? 15;

  const myTeamScore = myTeam === "team-a" ? teamAScore : teamBScore;

  const myTeamIsGespannt =
    myTeamScore >= targetScore - 2 && myTeamScore < targetScore;

  const canRaise =
    game.phase === "playing" &&
    isMyTurn &&
    game.pending_bid_team === null &&
    game.round_value < 4 &&
    game.last_bid_team !== myTeam &&
    !myTeamIsGespannt &&
    bidAction === null;

  const canRespondToBid =
    game.phase === "bidPending" &&
    game.pending_bid_team !== null &&
    game.pending_bid_team !== myTeam;

  function teamName(team: WattenTeam) {
    const teamPlayers = team === "team-a" ? teamAPlayers : teamBPlayers;

    return teamPlayers.map((player) => player.display_name).join(" & ");
  }
  const mustPlayTrumpfOderKritisch =
    game.phase === "playing" && game.farbe !== null && game.schlag !== null
      ? mustFollowTrumpfOderKritisch(
          hand,
          game.played_cards,
          game.tricks_won,
          game.farbe,
          game.schlag,
        )
      : false;
  const vorhandSeat = (game.dealer + 1) % 4;

  const vorhand = players.find((player) => player.seat === vorhandSeat);
  const leftSeat = (mySeat + 1) % 4;

  const topSeat = (mySeat + 2) % 4;

  const rightSeat = (mySeat + 3) % 4;
  const topPlayer = players.find((player) => player.seat === topSeat);

  const leftPlayer = players.find((player) => player.seat === leftSeat);

  const rightPlayer = players.find((player) => player.seat === rightSeat);

  const currentPlayerData = players.find(
    (player) => player.seat === game.current_player,
  );
  const teamATricks =
    (game.tricks_won?.["0"] ?? 0) + (game.tricks_won?.["2"] ?? 0);

  const teamBTricks =
    (game.tricks_won?.["1"] ?? 0) + (game.tricks_won?.["3"] ?? 0);

  function tricksForTeam(team: WattenTeam) {
    return team === "team-a" ? teamATricks : teamBTricks;
  }
  function playedCardPosition(seat: number) {
    const relativeSeat = (seat - resolvedMySeat + 4) % 4;
    switch (relativeSeat) {
      case 0:
        return `
        bottom-0
        left-1/2
        -translate-x-1/2
      `;

      case 1:
        return `
        left-0
        top-1/2
        -translate-y-1/2
      `;

      case 2:
        return `
        left-1/2
        top-0
        -translate-x-1/2
      `;

      case 3:
        return `
        right-0
        top-1/2
        -translate-y-1/2
      `;

      default:
        return "";
    }
  }
  function playedCardAnimation(seat: number) {
    const relativeSeat = (seat - resolvedMySeat + 4) % 4;

    switch (relativeSeat) {
      case 0:
        return "watten-card-in-bottom";

      case 1:
        return "watten-card-in-left";

      case 2:
        return "watten-card-in-top";

      case 3:
        return "watten-card-in-right";

      default:
        return "";
    }
  }
  function getBeginnerCardHint(card: WattenCard): string | undefined {
    if (!helpMode) {
      return undefined;
    }

    if (
      resolvedGame.farbe &&
      resolvedGame.schlag &&
      isFirstTrick(resolvedGame.tricks_won) &&
      resolvedGame.played_cards.length === 0 &&
      isHauptschlag(card, resolvedGame.farbe, resolvedGame.schlag)
    ) {
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

    if (
      resolvedGame.farbe &&
      resolvedGame.schlag &&
      isHauptschlag(card, resolvedGame.farbe, resolvedGame.schlag)
    ) {
      return "Hauptschlag — die stärkste nicht-kritische Karte.";
    }

    if (card.rank === resolvedGame.schlag) {
      return `Schlag (${resolvedGame.schlag}) — stärker als normale Trumpfkarten.`;
    }

    if (card.suit === resolvedGame.farbe) {
      return `Trumpf (${resolvedGame.farbe})`;
    }

    return undefined;
  }

  function getCardPriorityGroups() {
    if (!resolvedGame.farbe || !resolvedGame.schlag) {
      return [];
    }

    const fullDeck = createDeck();

    const sortByRankDescending = (a: WattenCard, b: WattenCard) =>
      (normalRankValue[b.rank] ?? 0) - (normalRankValue[a.rank] ?? 0);

    const kritische = fullDeck
      .filter((card) => isCritical(card))
      .sort((a, b) => getCriticalValue(b) - getCriticalValue(a));

    const hauptschlag = fullDeck.filter((card) =>
      isHauptschlag(card, resolvedGame.farbe, resolvedGame.schlag),
    );

    const schlaege = fullDeck.filter(
      (card) =>
        card.rank === resolvedGame.schlag &&
        !isCritical(card) &&
        !isHauptschlag(card, resolvedGame.farbe, resolvedGame.schlag),
    );

    const trumpfCards = fullDeck
      .filter(
        (card) =>
          card.suit === resolvedGame.farbe &&
          card.rank !== resolvedGame.schlag &&
          !isCritical(card),
      )
      .sort(sortByRankDescending);

    const specialIds = new Set(
      [...kritische, ...hauptschlag, ...schlaege, ...trumpfCards].map(
        (card) => card.id,
      ),
    );

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
        description: "Max → Belli → Spitz",
        cards: kritische,
      },
      {
        title: "Hauptschlag",
        description: "Schlag + Farbe. Höchste nicht-kritische Karte.",
        cards: hauptschlag,
      },
      {
        title: "Schläge",
        description: `Alle anderen ${resolvedGame.schlag}. Gleich stark; der zuerst gespielte gewinnt.`,
        cards: schlaege,
      },
      {
        title: `Trumpf / Farbe (${resolvedGame.farbe})`,
        description: "Danach folgen die übrigen Karten der Trumpffarbe.",
        cards: trumpfCards,
      },
      {
        title: "Normale Karten",
        description:
          "Angespielte Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
        cards: normalCards,
      },
    ];
  }

  return (
    <main className="min-h-screen bg-emerald-950 px-4 py-6 text-white md:px-8">
      {actionError && (
        <div className="fixed left-1/2 top-5 z-[250] -translate-x-1/2 rounded-xl border border-red-400/30 bg-red-950/95 px-5 py-3 text-sm font-bold text-red-200 shadow-2xl">
          {actionError}

          <button
            type="button"
            onClick={() => setActionError(null)}
            className="ml-4 text-red-300 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
      {showAbhebenPreview && abhebenPreview.length > 0 && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
              Abheben
            </p>

            <h2 className="mt-2 text-3xl font-black">Ergebnis</h2>

            <div className="mt-8 flex flex-wrap items-start justify-center gap-6">
              {abhebenPreview.map((event, index) => {
                const recipient =
                  event.recipient_seat !== null
                    ? players.find(
                        (player) => player.seat === event.recipient_seat,
                      )
                    : null;

                return (
                  <div
                    key={`${event.card.id}-${index}`}
                    className="flex flex-col items-center"
                  >
                    <div className="pointer-events-none">
                      <WattenCardComponent card={event.card} />
                    </div>

                    {event.critical ? (
                      <>
                        <p className="mt-3 font-black text-amber-300">
                          Kritische!
                        </p>

                        <p className="mt-1 text-xs text-zinc-400">geht an</p>

                        <p className="mt-1 text-sm font-bold text-white">
                          {recipient?.display_name}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-3 font-bold text-zinc-300">
                          Keine Kritische
                        </p>

                        <p className="mt-1 text-xs text-zinc-500">
                          Abheben beendet
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="mt-8 text-sm text-emerald-300">
              Die Karten wurden ausgeteilt.
            </p>

            <button
              type="button"
              onClick={() => setShowAbhebenPreview(false)}
              className="mt-6 rounded-xl bg-emerald-500 px-6 py-3 font-black text-emerald-950 transition hover:bg-emerald-400"
            >
              Weiter
            </button>
          </div>
        </div>
      )}
      {/* GEHEN DECISION */}

      {game.phase === "bidPending" &&
        game.pending_bid_team &&
        game.pending_bid_value !== null && (
          <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 px-6 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                Gehen
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                {teamName(game.pending_bid_team)}
              </h2>

              <p className="mt-2 text-zinc-300">geht auf</p>

              <p className="mt-2 text-5xl font-black text-amber-400">
                {game.pending_bid_value}
              </p>

              <p className="mt-1 text-sm text-zinc-500">Punkte</p>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                Aktueller Rundenwert:{" "}
                <strong className="text-amber-300">{game.round_value}</strong>
                <br />
                Neuer Wert bei Halten:{" "}
                <strong className="text-emerald-300">
                  {game.pending_bid_value}
                </strong>
              </div>

              {canRespondToBid ? (
                <>
                  <p className="mt-6 text-sm font-bold text-emerald-300">
                    Dein Team muss entscheiden.
                  </p>

                  <button
                    type="button"
                    disabled={bidAction !== null}
                    onClick={() => {
                      void respondToBid(true);
                    }}
                    className="mt-5 w-full rounded-xl bg-emerald-500 px-5 py-3 font-black text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40"
                  >
                    {game.pending_bid_value} halten
                  </button>

                  <button
                    type="button"
                    disabled={bidAction !== null}
                    onClick={() => {
                      void respondToBid(false);
                    }}
                    className="mt-3 w-full rounded-xl bg-red-500/20 px-5 py-3 font-bold text-red-200 transition hover:bg-red-500/30 disabled:opacity-40"
                  >
                    Nicht halten
                  </button>

                  <p className="mt-4 text-xs leading-5 text-zinc-500">
                    Bei „Nicht halten“ erhält {teamName(game.pending_bid_team)}{" "}
                    den bisherigen Rundenwert von {game.round_value} Punkten.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-7 text-sm text-zinc-400">
                    Die Gegenseite entscheidet...
                  </p>

                  <div className="mx-auto mt-4 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
                </>
              )}
            </div>
          </div>
        )}
      <div className="mx-auto w-full max-w-[1800px]">
        {/* HEADER */}

        <div className="relative z-30 mb-4 flex items-center justify-between">
          <div className="ml-5 pl-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              Bayerisches Watten
            </p>

            <h1 className="mt-1 text-2xl font-black">
              4 Spieler · Multiplayer
            </h1>

            <p className="mt-1 text-xs text-zinc-400">Raum {room.code}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setHelpMode((current) => !current)}
              className={`
        rounded-lg
        px-4
        py-2
        text-sm
        font-semibold
        transition
        ${
          helpMode
            ? "bg-amber-400 text-amber-950 hover:bg-amber-300"
            : "bg-white/10 text-white hover:bg-white/20"
        }
      `}
            >
              {helpMode ? "💡 Help On" : "💡 Help"}
            </button>

            <CardThemeSelector />

            <TableThemeSelector />

            <Link
              to="/watten/multiplayer"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
            >
              Exit
            </Link>
          </div>
        </div>

        {/* TABLE + SIDEBARS */}

        <div
          className="
    grid
    w-full
    grid-cols-[16rem_minmax(0,1fr)_16rem]
    items-start
    gap-5
  "
        >
          {/* LEFT SIDEBAR */}

          <aside className="relative w-64 pt-15">
            {/* CARD PRIORITY */}

            {game.farbe && game.schlag && (
              <div className="absolute left-0 top-5 z-50 w-full">
                <button
                  type="button"
                  onClick={() => setShowRankingHelp((current) => !current)}
                  className={`
              w-full
              rounded-xl
              border
              px-4
              py-2
              text-xs
              font-bold
              shadow-lg
              transition

              ${
                showRankingHelp
                  ? "border-amber-400/40 bg-amber-400 text-amber-950"
                  : "border-white/10 bg-zinc-950/95 text-white hover:bg-zinc-900"
              }
            `}
                >
                  {showRankingHelp
                    ? "📚 Kartenrangfolge ausblenden"
                    : "📚 Kartenrangfolge einblenden"}
                </button>

                {showRankingHelp && (
                  <div
                    className="
                absolute
                left-0
                top-full
                mt-2
                h-[720px]
                w-full
                overflow-y-auto
                rounded-3xl
                border
                border-white/10
                bg-zinc-950/95
                p-4
                shadow-2xl
                backdrop-blur
              "
                  >
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                      Anfängerhilfe
                    </p>

                    <h2 className="mt-1 text-xl font-bold">Kartenrangfolge</h2>

                    <p className="mt-1 text-xs text-zinc-400">
                      Höchste Priorität zuerst.
                    </p>

                    <div className="mt-3 text-xs">
                      <span className="text-emerald-300">
                        Farbe: <strong>{game.farbe}</strong>
                      </span>

                      <span className="ml-3 text-amber-300">
                        Schlag: <strong>{game.schlag}</strong>
                      </span>
                    </div>

                    <div className="mt-5 space-y-5">
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
                              <h3 className="font-bold">{group.title}</h3>

                              <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                                {group.description}
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {group.cards.map((card) => (
                              <MiniWattenCard key={card.id} card={card} />
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SCORE */}

            <div className="h-[720px] rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Punktestand
              </p>

              <h3 className="mt-1 text-lg font-bold">
                Ziel: {targetScore} Punkte
              </h3>

              <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                  Team A
                </p>

                <p className="mt-1 font-bold">{teamName("team-a")}</p>

                <div className="mt-4 flex items-end justify-between">
                  <span className="text-3xl font-black text-amber-400">
                    {teamAScore}
                  </span>

                  <span className="text-xs text-zinc-500">/ {targetScore}</span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (teamAScore / targetScore) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs font-bold text-zinc-500">VS</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  Team B
                </p>

                <p className="mt-1 font-bold">{teamName("team-b")}</p>

                <div className="mt-4 flex items-end justify-between">
                  <span className="text-3xl font-black text-emerald-400">
                    {teamBScore}
                  </span>

                  <span className="text-xs text-zinc-500">/ {targetScore}</span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all"
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
          {/* CENTER COLUMN */}
          <div className="min-w-0">
            {game.phase === "playing" && (
              <div className="mb-3 flex justify-center">
                <div
                  className="
        flex
        items-center
        gap-3
        rounded-2xl
        border
        border-white/10
        bg-zinc-950/75
        px-4
        py-2
        shadow-xl
        backdrop-blur-md
      "
                >
                  {/* SCHLAG */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Schlag
                    </span>

                    <span className="rounded-lg bg-amber-400/15 px-2.5 py-1 text-lg font-black text-amber-300">
                      {game.schlag}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-white/10" />

                  {/* FARBE */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      Farbe
                    </span>

                    {game.farbe && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-400/10 px-2.5 py-1">
                        <img
                          src={suitIcons[game.farbe]}
                          alt={game.farbe}
                          draggable={false}
                          className="h-7 w-7 object-contain"
                        />

                        <span className="text-sm font-black text-emerald-200">
                          {game.farbe}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* TABLE */}

            <div
              className="
    relative
    min-h-[720px]
    min-w-0
    overflow-visible
    rounded-[60px]
    shadow-2xl
  "
              style={{
                backgroundImage: `url(${tableBackgrounds[tableTheme]})`,
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <div
                className="
    pointer-events-none
    absolute
    inset-0
    rounded-[60px]
    bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_58%)]
  "
              />

              <div
                className="
    pointer-events-none
    absolute
    inset-[18px]
    rounded-[48px]
    border
    border-white/5
  "
              />
              {/* TOP */}

              <PlayerBox
                player={topPlayer}
                seat={topSeat}
                dealer={game.dealer}
                abheber={game.abheben_player}
                current={game.current_player}
                team={getTeamForSeat(topSeat)}
                teamTricks={tricksForTeam(getTeamForSeat(topSeat))}
                className="
    absolute
    left-1/2
    top-7
    -translate-x-1/2
  "
                cardCount={cardCountForSeat(topSeat)}
              />

              {/* LEFT */}
              <PlayerBox
                player={leftPlayer}
                seat={leftSeat}
                dealer={game.dealer}
                abheber={game.abheben_player}
                current={game.current_player}
                team={getTeamForSeat(leftSeat)}
                teamTricks={tricksForTeam(getTeamForSeat(leftSeat))}
                className="
    absolute
    left-7
    top-1/2
    -translate-y-1/2
  "
                cardCount={cardCountForSeat(leftSeat)}
              />

              {/* RIGHT */}

              <PlayerBox
                player={rightPlayer}
                seat={rightSeat}
                dealer={game.dealer}
                abheber={game.abheben_player}
                current={game.current_player}
                team={getTeamForSeat(rightSeat)}
                teamTricks={tricksForTeam(getTeamForSeat(rightSeat))}
                className="
    absolute
    right-7
    top-1/2
    -translate-y-1/2
  "
                cardCount={cardCountForSeat(rightSeat)}
              />

              {/* CENTER */}

              <div
                className={
                  game.phase === "playing"
                    ? `
          pointer-events-none
          absolute
          inset-0
          z-20
        `
                    : `
          absolute
          left-1/2
          top-1/2
          z-20
          w-80
          -translate-x-1/2
          -translate-y-1/2
          rounded-3xl
          border
          border-white/10
          bg-black/40
          p-7
          text-center
          backdrop-blur
        `
                }
              >
                {game.phase === "abheben" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      Abheben
                    </p>

                    {isMyTurn ? (
                      <>
                        <h2 className="mt-3 text-2xl font-black text-emerald-300">
                          Du hebst ab
                        </h2>

                        <p className="mt-2 text-xs text-zinc-400">
                          Wähle eine Stelle im Stapel.
                        </p>

                        <div className="mt-7 space-y-4">
                          {[0, 1].map((rowIndex) => (
                            <div
                              key={rowIndex}
                              className="flex justify-center px-8"
                            >
                              {Array.from({
                                length: 16,
                              }).map((_, index) => {
                                const actualIndex = rowIndex * 16 + index;

                                const cannotCut = actualIndex === 31;

                                return (
                                  <button
                                    key={actualIndex}
                                    type="button"
                                    onMouseEnter={playHoverSound}
                                    disabled={cannotCut || cutting}
                                    onClick={() => {
                                      void performCut(actualIndex);
                                    }}
                                    className={`
                          relative
                          h-20
                          w-12
                          rounded-[7px]
                          border
                          border-amber-100/20
                          bg-zinc-950
                          shadow-lg
                          transition-all
                          duration-200

                          ${index !== 0 ? "-ml-5" : ""}

                          ${
                            cannotCut || cutting
                              ? "cursor-not-allowed opacity-30"
                              : "hover:z-30 hover:-translate-y-3 hover:scale-110 hover:border-amber-300"
                          }
                        `}
                                  >
                                    <div className="absolute inset-[3px] rounded-[5px] border border-emerald-300/30 bg-emerald-950">
                                      <div className="absolute inset-1 rounded-[3px] border border-amber-300/15" />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>

                        {cutting && (
                          <p className="mt-5 animate-pulse text-sm font-bold text-amber-300">
                            Karte wird aufgedeckt...
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h2 className="mt-3 text-xl font-black">
                          {abheber?.display_name} hebt ab
                        </h2>

                        <p className="mt-3 text-sm text-zinc-400">
                          Bitte warten...
                        </p>
                      </>
                    )}
                  </>
                ) : game.phase === "schlag" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      Schlag bestimmen
                    </p>

                    {isMyTurn ? (
                      <>
                        <h2 className="mt-3 text-2xl font-black text-amber-300">
                          Du bist Vorhand
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          Wähle den Schlag.
                        </p>

                        <div className="mt-6 grid grid-cols-4 gap-2">
                          {(
                            [
                              "7",
                              "8",
                              "9",
                              "10",
                              "Unter",
                              "Ober",
                              "König",
                              "Ass",
                            ] as WattenRank[]
                          ).map((rank) => (
                            <button
                              key={rank}
                              type="button"
                              disabled={choosing}
                              onClick={() => {
                                void chooseSchlag(rank);
                              }}
                              className="
                rounded-xl
                border
                border-white/10
                bg-zinc-900
                px-3
                py-4
                text-sm
                font-black
                transition
                hover:border-amber-400
                hover:bg-amber-400/10
                disabled:opacity-40
              "
                            >
                              {rank}
                            </button>
                          ))}
                        </div>

                        {choosing && (
                          <p className="mt-4 animate-pulse text-xs font-bold text-amber-300">
                            Schlag wird gespeichert...
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h2 className="mt-3 text-xl font-black">
                          {vorhand?.display_name} bestimmt den Schlag
                        </h2>

                        <p className="mt-3 text-sm text-zinc-400">
                          Bitte warten...
                        </p>
                      </>
                    )}
                  </>
                ) : game.phase === "trump" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                      Farbe bestimmen
                    </p>

                    <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2">
                      <span className="text-xs text-zinc-400">Schlag</span>

                      <p className="text-xl font-black text-amber-300">
                        {game.schlag}
                      </p>
                    </div>

                    {isMyTurn ? (
                      <>
                        <h2 className="mt-5 text-2xl font-black text-emerald-300">
                          Du bist Geber
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          Wähle die Trumpffarbe.
                        </p>

                        <div className="mt-6 grid grid-cols-2 gap-3">
                          {(
                            [
                              "Herz",
                              "Schellen",
                              "Eichel",
                              "Gras",
                            ] as WattenSuit[]
                          ).map((farbe) => (
                            <button
                              key={farbe}
                              type="button"
                              disabled={choosing}
                              onClick={() => {
                                void chooseFarbe(farbe);
                              }}
                              className="
                flex
                flex-col
                items-center
                justify-center
                rounded-2xl
                border
                border-white/10
                bg-zinc-900
                p-4
                transition
                hover:border-emerald-400
                hover:bg-emerald-400/10
                disabled:opacity-40
              "
                            >
                              <img
                                src={suitIcons[farbe]}
                                alt={farbe}
                                draggable={false}
                                className="h-12 w-12 object-contain"
                              />

                              <span className="mt-2 text-sm font-black">
                                {farbe}
                              </span>
                            </button>
                          ))}
                        </div>

                        {choosing && (
                          <p className="mt-4 animate-pulse text-xs font-bold text-emerald-300">
                            Farbe wird gespeichert...
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h2 className="mt-5 text-xl font-black">
                          {dealer?.display_name} bestimmt die Farbe
                        </h2>

                        <p className="mt-3 text-sm text-zinc-400">
                          Bitte warten...
                        </p>
                      </>
                    )}
                  </>
                ) : game.phase === "playing" ? (
                  <>
                    {/* PLAYED CARDS */}

                    <div
                      className="
        absolute
        left-1/2
        top-1/2
        h-[300px]
        w-[420px]
        -translate-x-1/2
        -translate-y-1/2
      "
                    >
                      {game.played_cards.length === 0 ? (
                        <div
                          className="
            absolute
            left-1/2
            top-1/2
            flex
            h-24
            w-24
            -translate-x-1/2
            -translate-y-1/2
            items-center
            justify-center
            rounded-full
            border
            border-white/10
            bg-black/10
          "
                        >
                          <div
                            className="
              h-14
              w-14
              rounded-full
              border
              border-white/5
            "
                          />
                        </div>
                      ) : (
                        game.played_cards.map((played) => {
                          const player = players.find(
                            (candidate) => candidate.seat === played.seat,
                          );

                          return (
                            <div
                              key={`${played.seat}-${played.card.id}`}
                              className={`
                  absolute
                  flex
                  flex-col
                  items-center
                  gap-1
                  transition-all
                  duration-300

                  ${playedCardPosition(played.seat)}

                  ${playedCardAnimation(played.seat)}
                `}
                            >
                              <div
                                className="
                    pointer-events-none
                    scale-[0.78]
                    drop-shadow-2xl
                  "
                              >
                                <WattenCardComponent card={played.card} />
                              </div>

                              <span
                                className="
                    -mt-3
                    rounded-full
                    border
                    border-white/10
                    bg-zinc-950/80
                    px-2.5
                    py-1
                    text-[9px]
                    font-bold
                    text-zinc-200
                    shadow-lg
                    backdrop-blur-md
                  "
                              >
                                {player?.display_name}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* CURRENT TURN */}

                    <div
                      className="
        absolute
        bottom-[155px]
        left-1/2
        z-30
        -translate-x-1/2
      "
                    >
                      {isMyTurn ? (
                        <div
                          className="
      rounded-full
      border
      border-amber-400/20
      bg-black/30
      px-4
      py-1.5
      text-[10px]
      font-bold
      uppercase
      tracking-widest
      text-amber-300
      backdrop-blur
    "
                        >
                          Spiel deine Karte
                        </div>
                      ) : (
                        <div
                          className="
            rounded-full
            border
            border-white/10
            bg-zinc-950/70
            px-5
            py-2
            text-xs
            font-bold
            text-zinc-300
            shadow-xl
            backdrop-blur-md
          "
                        >
                          <span className="mr-2 text-emerald-400">●</span>
                          {currentPlayerData?.display_name} ist am Zug
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p>{game.phase}</p>
                )}
              </div>
              {game.phase === "trickReview" &&
                game.trick_winner_seat !== null && (
                  <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                    <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
                      <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                        Stich
                      </p>

                      <h2 className="mt-2 text-3xl font-black">
                        Stich beendet
                      </h2>

                      <div className="mt-8 flex justify-center gap-5">
                        {game.played_cards.map((played) => {
                          const won = played.seat === game.trick_winner_seat;

                          const player = players.find(
                            (candidate) => candidate.seat === played.seat,
                          );

                          return (
                            <div
                              key={`${played.seat}-${played.card.id}`}
                              className="flex flex-col items-center"
                            >
                              <div
                                className={`
                      pointer-events-none
                      rounded-xl
                      transition-all 
                      duration-500
                      ${
                        won
                          ? `
      z-20
      scale-110
      ring-4
      ring-amber-400
      ring-offset-4
      ring-offset-zinc-950
      shadow-[0_0_35px_rgba(251,191,36,0.75)]
    `
                          : `
      scale-95
      opacity-60
    `
                      }
                    `}
                              >
                                <WattenCardComponent card={played.card} />
                              </div>

                              <p className="mt-3 text-sm font-bold">
                                {player?.display_name}
                              </p>

                              {won && (
                                <span className="mt-2 animate-pulse rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">
                                  Stich-Sieger
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <p className="mt-8 text-lg font-black text-emerald-300">
                        {
                          players.find(
                            (player) => player.seat === game.trick_winner_seat,
                          )?.display_name
                        }{" "}
                        gewinnt den Stich
                      </p>

                      <button
                        type="button"
                        disabled={continuingTrick}
                        onClick={() => {
                          void continueTrick();
                        }}
                        className="mt-7 rounded-xl bg-emerald-500 px-8 py-3 font-black text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {continuingTrick ? "Bitte warten..." : "Weiter"}
                      </button>
                    </div>
                  </div>
                )}
              {game.phase === "roundFinished" && (
                <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-zinc-950 p-9 text-center shadow-2xl">
                    <div className="text-5xl">🏆</div>

                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                      Runde beendet
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {game.winner === "team-a"
                        ? teamName("team-a")
                        : teamName("team-b")}
                    </h2>

                    <p className="mt-2 text-xl font-black text-emerald-300">
                      gewinnt die Runde
                    </p>

                    <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs uppercase tracking-widest text-zinc-500">
                        Grund
                      </p>

                      <p className="mt-1 font-bold">
                        {game.round_end_reason === "declined"
                          ? "Gehen wurde nicht gehalten"
                          : "3 Stiche erreicht"}
                      </p>

                      <p className="mt-5 text-xs uppercase tracking-widest text-zinc-500">
                        Rundenwert
                      </p>

                      <p className="mt-1 text-4xl font-black text-amber-400">
                        {game.round_value}
                      </p>
                    </div>

                    <div className="mt-7 grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-amber-400/10 p-4">
                        <p className="text-xs text-amber-300">Team A</p>

                        <p className="mt-1 text-3xl font-black">{teamAScore}</p>
                      </div>

                      <div className="rounded-xl bg-emerald-400/10 p-4">
                        <p className="text-xs text-emerald-300">Team B</p>

                        <p className="mt-1 text-3xl font-black">{teamBScore}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={startingNextRound}
                      onClick={() => {
                        void startNextRound();
                      }}
                      className="mt-8 w-full rounded-xl bg-amber-400 px-7 py-4 text-lg font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
                    >
                      {startingNextRound
                        ? "Neue Runde wird vorbereitet..."
                        : "Nächste Runde"}
                    </button>
                  </div>
                </div>
              )}
              {/* MATCH FINISHED */}

              {game.phase === "matchFinished" && game.match_winner && (
                <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/90 px-6 backdrop-blur-md">
                  <div className="w-full max-w-lg rounded-3xl border border-amber-400/40 bg-zinc-950 p-10 text-center shadow-2xl">
                    <div className="text-7xl">🏆</div>

                    <p className="mt-6 text-xs font-black uppercase tracking-[0.3em] text-amber-400">
                      Gesamtsieger
                    </p>

                    <h2 className="mt-4 text-4xl font-black text-white">
                      {teamName(game.match_winner)}
                    </h2>

                    <p className="mt-3 text-zinc-400">
                      {game.match_winner === "team-a" ? teamAScore : teamBScore}{" "}
                      Punkte erreicht
                    </p>

                    <div className="mt-8 grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-amber-400/10 p-4">
                        <p className="text-xs text-amber-300">Team A</p>

                        <p className="mt-1 text-3xl font-black">{teamAScore}</p>
                      </div>

                      <div className="rounded-xl bg-emerald-400/10 p-4">
                        <p className="text-xs text-emerald-300">Team B</p>

                        <p className="mt-1 text-3xl font-black">{teamBScore}</p>
                      </div>
                    </div>

                    <Link
                      to="/watten/multiplayer"
                      className="mt-8 inline-block rounded-xl bg-amber-400 px-7 py-3 font-black text-amber-950 transition hover:bg-amber-300"
                    >
                      Zur Lobby
                    </Link>
                  </div>
                </div>
              )}

              {/* ME / BOTTOM */}

              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center">
                <div
                  className={`
                relative
                inline-block
                rounded-2xl
                border
                px-5
                py-3
                ${
                  isMyTurn
                    ? "border-emerald-400 bg-emerald-400/15"
                    : "border-white/10 bg-black/40"
                }
              `}
                >
                  {isMyTurn && game.phase === "playing" && (
                    <div
                      className="
        absolute
        -top-4
        left-1/2
        z-50
        -translate-x-1/2
        whitespace-nowrap
        rounded-full
        bg-amber-400
        px-4
        py-1
        text-xs
        font-black
        text-amber-950
        shadow-xl
      "
                    >
                      ▼ DU BIST AM ZUG
                    </div>
                  )}
                  <p className="font-black">{me?.display_name}</p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <span
                      className={`
      rounded-full
      px-3
      py-1
      text-[9px]
      font-black
      uppercase
      tracking-widest

      ${
        myTeam === "team-a"
          ? "bg-amber-400/15 text-amber-300"
          : "bg-emerald-400/15 text-emerald-300"
      }
    `}
                    >
                      {myTeam === "team-a" ? "Team A" : "Team B"}
                    </span>

                    <span className="text-[10px] font-bold text-zinc-400">
                      {tricksForTeam(myTeam)}{" "}
                      {tricksForTeam(myTeam) === 1 ? "Stich" : "Stiche"}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                    Du
                  </p>
                </div>
                {game.phase === "playing" &&
                  isMyTurn &&
                  mustPlayTrumpfOderKritisch && (
                    <div className="mx-auto mb-4 w-fit rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-2 text-xs font-bold text-red-100">
                      Trumpf oder Kritisch — du musst eine passende Karte
                      spielen.
                    </div>
                  )}

                {/* PRIVATE HAND */}

                <div className="mt-4 flex justify-center">
                  {hand.map((card, index) => {
                    const legal = cardIsLegal(card);
                    const comparison =
                      helpMode &&
                      game.phase === "playing" &&
                      game.played_cards.length > 0 &&
                      legal &&
                      game.farbe &&
                      game.schlag
                        ? wouldCardWin(
                            card,
                            me?.user_id ?? "",
                            game.played_cards,
                            game.farbe,
                            game.schlag,
                          )
                        : null;

                    const canPlay =
                      game.phase === "playing" &&
                      isMyTurn &&
                      legal &&
                      !playingCard;

                    return (
                      <div
                        key={card.id}
                        style={{
                          zIndex: index,
                        }}
                        className={`
    relative
    rounded-xl
    transition-all
    duration-200

    ${index > 0 ? "-ml-3" : ""}

    ${
      game.phase === "playing" && isMyTurn && !legal
        ? "opacity-40 ring-2 ring-red-500"
        : ""
    }

    ${helpMode && comparison === true ? "ring-2 ring-green-500" : ""}

    ${helpMode && comparison === false ? "ring-2 ring-red-500" : ""}

    ${canPlay ? "hover:z-50 hover:-translate-y-4" : ""}
  `}
                      >
                        <WattenCardComponent
                          card={card}
                          disabled={!canPlay}
                          hint={
                            helpMode ? getBeginnerCardHint(card) : undefined
                          }
                          onClick={
                            canPlay
                              ? () => {
                                  void playCard(card);
                                }
                              : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}

          <aside className="w-64 pt-10">
            <div className="h-[720px] overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                Aktueller Stichstand
              </p>

              <h3 className="mt-1 text-lg font-bold">2 gegen 2</h3>

              {/* TEAM A */}

              <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                  Team A
                </p>

                <p className="mt-1 font-bold">{teamName("team-a")}</p>

                <p className="mt-2 text-2xl font-black text-amber-400">
                  {teamATricks}
                </p>

                <p className="text-xs text-zinc-400">
                  {teamATricks === 1 ? "Stich" : "Stiche"}
                </p>
              </div>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />

                <span className="text-xs font-bold text-zinc-500">VS</span>

                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* TEAM B */}

              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-300">
                  Team B
                </p>

                <p className="mt-1 font-bold">{teamName("team-b")}</p>

                <p className="mt-2 text-2xl font-black text-emerald-400">
                  {teamBTricks}
                </p>

                <p className="text-xs text-zinc-400">
                  {teamBTricks === 1 ? "Stich" : "Stiche"}
                </p>
              </div>

              {/* 3-STICH PROGRESS */}

              <div className="mt-5">
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  3 Stiche zum Sieg
                </p>

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

              {/* GEHEN */}

              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                  Rundenwert
                </p>

                <p className="mt-1 text-2xl font-black text-amber-400">
                  {game.round_value} Punkte
                </p>

                {canRaise && (
                  <button
                    type="button"
                    disabled={bidAction !== null}
                    onClick={() => {
                      void raiseBid();
                    }}
                    className="mt-3 w-full rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
                  >
                    Gehen auf {game.round_value + 1}
                  </button>
                )}

                {game.round_value === 4 && (
                  <p className="mt-2 text-xs font-semibold text-zinc-500">
                    Maximum erreicht
                  </p>
                )}

                {isMyTurn && myTeamIsGespannt && (
                  <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-2">
                    <p className="text-xs font-bold text-red-300">Gespannt</p>

                    <p className="mt-1 text-[10px] text-red-200/70">
                      Erhöhen nicht möglich
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

function PlayerBox({
  player,
  seat,
  dealer,
  abheber,
  current,
  className,
  cardCount,
  team,
  teamTricks,
}: {
  player: RoomPlayer | undefined;

  seat: number;

  dealer: number;

  abheber: number;

  current: number;

  className?: string;

  cardCount: number;

  team: WattenTeam;
  teamTricks: number;
}) {
  if (!player) {
    return null;
  }

  return (
    <div
      className={`
      w-48
      max-w-48
      shrink-0
      rounded-2xl
      border
      px-5
      py-4
      text-center
      shadow-xl
      backdrop-blur-md
      transition-all
      duration-300

      ${
        team === "team-a"
          ? "border-amber-400/30 bg-zinc-950/85"
          : "border-emerald-400/30 bg-zinc-950/85"
      }

      ${seat === current ? "scale-105 ring-2 ring-white/70 shadow-2xl" : ""}

      ${className ?? ""}
    `}
    >
      {seat === current && (
        <div
          className="
          absolute
          -top-3
          left-1/2
          -translate-x-1/2
          whitespace-nowrap
          rounded-full
          bg-white
          px-3
          py-1
          text-[9px]
          font-black
          uppercase
          tracking-wider
          text-zinc-950
          shadow-lg
        "
        >
          ● Am Zug
        </div>
      )}

      <p className="text-base font-black text-white">{player.display_name}</p>

      <div className="mt-2 flex items-center justify-center gap-2">
        <span
          className={`
          rounded-full
          px-2.5
          py-1
          text-[9px]
          font-black
          uppercase
          tracking-wider

          ${
            team === "team-a"
              ? "bg-amber-400/15 text-amber-300"
              : "bg-emerald-400/15 text-emerald-300"
          }
        `}
        >
          {team === "team-a" ? "Team A" : "Team B"}
        </span>

        <span className="text-[10px] font-bold text-zinc-400">
          {teamTricks} {teamTricks === 1 ? "Stich" : "Stiche"}
        </span>
      </div>

      <div className="mt-2 flex justify-center gap-2 text-[9px] font-bold uppercase tracking-wider">
        {seat === dealer && (
          <span className="rounded-full bg-amber-400 px-2 py-1 text-amber-950">
            Geber
          </span>
        )}

        {seat === abheber && (
          <span className="rounded-full bg-emerald-400 px-2 py-1 text-emerald-950">
            Abheber
          </span>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        {Array.from({
          length: cardCount,
        }).map((_, index) => (
          <div
            key={index}
            onMouseEnter={playHoverSound}
            className={`
    relative
    h-12
    w-8
    rounded-md
    border
    border-amber-100/20
    bg-zinc-950
    shadow-lg
    transition-all
    duration-200
    ease-out

    hover:z-30
    hover:-translate-y-2
    hover:scale-110
    hover:border-amber-300/50
    hover:shadow-xl

    ${index > 0 ? "-ml-3" : ""}
  `}
            style={{
              zIndex: index,
            }}
          >
            <div className="absolute inset-[2px] rounded-[4px] border border-emerald-300/25 bg-emerald-950">
              <div className="absolute inset-1 rounded-[2px] border border-amber-300/15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
