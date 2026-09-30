import { useAppLanguage } from "@/i18n/languageStore";
import { useCallback, useEffect, useRef, useState } from "react";

import { Link, useParams } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

import WattenCardComponent from "./WattenCard";
import {
  createDeck,
  getCriticalValue,
  getWattenCardRole,
  isCritical,
  isFirstTrick,
  isHauptschlag,
  isTrumpfOderKritischCard,
  mustFollowTrumpfOderKritisch,
  normalRankValue,
  WATTEN_CARD_CLIP,
  wouldCardWin,
  type WattenCard,
} from "../../utils/watten";
import CardThemeSelector from "./WattenCardGameSelector";
import { useCardTheme } from "@/context/CardThemeContext";
import { getWattenCardImage } from "@/utils/WattenCardImages";
import TableThemeSelector from "../App/TableThemeSelector";
import { HeaderTools } from "@/components/App/PublicHeader";
import { ProfileAvatar } from "../social/ProfileAvatarPicker";
import "./wattenGameScreen.css";

import { useTableTheme, type TableTheme } from "@/context/TableThemeContext";
import {
  translateWatten,
  translateWattenPair,
} from "@/games/watten/i18n/wattenLanguage";

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
      onMouseEnter={playHoverSound}
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

function DealAnimation({ playerCount }: { playerCount: 3 | 4 }) {
  const directions =
    playerCount === 3
      ? ["bottom", "left", "right"]
      : ["bottom", "left", "top", "right"];

  return (
    <div className="pointer-events-none absolute inset-0 z-[110] overflow-hidden rounded-[60px]">
      <style>{`
        @keyframes watten-deal-bottom {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(-4deg); opacity: 1; }
          100% { transform: translate(-50%, 300px) scale(.96) rotate(8deg); opacity: 0; }
        }
        @keyframes watten-deal-left {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(4deg); opacity: 1; }
          100% { transform: translate(-390px, -25px) scale(.96) rotate(-12deg); opacity: 0; }
        }
        @keyframes watten-deal-top {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(-3deg); opacity: 1; }
          100% { transform: translate(-50%, -315px) scale(.96) rotate(6deg); opacity: 0; }
        }
        @keyframes watten-deal-right {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(-4deg); opacity: 1; }
          100% { transform: translate(340px, -25px) scale(.96) rotate(12deg); opacity: 0; }
        }
        @keyframes watten-deck-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.04); }
        }
      `}</style>

      <div
        className="absolute left-1/2 top-1/2 h-24 w-16 rounded-[8px] border border-amber-200/40 bg-zinc-950 shadow-2xl"
        style={{ animation: "watten-deck-pulse 700ms ease-in-out infinite" }}
      >
        <div className="absolute inset-[4px] rounded-[6px] border border-emerald-300/40 bg-emerald-950">
          <div className="absolute inset-1 rounded-[4px] border border-amber-300/20" />
        </div>
      </div>

      {Array.from({ length: playerCount * 5 }, (_, index) => {
        const direction = directions[index % playerCount];
        return (
          <div
            key={index}
            className="absolute left-1/2 top-1/2 h-24 w-16 rounded-[8px] border border-amber-200/35 bg-zinc-950 shadow-2xl"
            style={{
              animation: `watten-deal-${direction} 650ms cubic-bezier(.18,.75,.25,1) ${index * 92}ms both`,
            }}
          >
            <div className="absolute inset-[4px] rounded-[6px] border border-emerald-300/35 bg-emerald-950">
              <div className="absolute inset-1 rounded-[4px] border border-amber-300/15" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DealDeckControl({
  canDeal,
  onDeal,
  l,
}: {
  canDeal: boolean;
  onDeal: () => void;
  l: (de: string, en: string) => string;
}) {
  return (
    <div className="text-center">
      <button
        type="button"
        disabled={!canDeal}
        onClick={onDeal}
        onMouseEnter={playHoverSound}
        className={`group relative mx-auto block h-28 w-24 transition max-md:h-20 max-md:w-16 ${
          canDeal
            ? "cursor-pointer hover:-translate-y-2 hover:scale-105"
            : "cursor-default"
        }`}
      >
        {[0, 1, 2, 3].map((layer) => (
          <span
            key={layer}
            className="absolute left-1/2 top-1/2 h-24 w-16 rounded-[8px] border border-amber-200/35 bg-zinc-950 shadow-xl max-md:h-16 max-md:w-11"
            style={{
              transform: `translate(calc(-50% + ${layer * 2}px), calc(-50% - ${layer * 2}px))`,
              zIndex: layer,
            }}
          >
            <span className="absolute inset-[4px] rounded-[6px] border border-emerald-300/35 bg-emerald-950">
              <span className="absolute inset-1 rounded-[4px] border border-amber-300/15" />
            </span>
          </span>
        ))}
      </button>

      <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-amber-300">
        {canDeal
          ? l("Karten austeilen", "Distribute cards")
          : l("Der Geber teilt gleich aus", "Waiting for the dealer")}
      </p>
      {canDeal && (
        <p className="mt-1 text-[10px] text-zinc-400">
          {l("Klicke auf den Kartenstapel.", "Click the deck to deal.")}
        </p>
      )}
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

  const { user } = useAuth();

  const { tableTheme } = useTableTheme();

  const { language } = useAppLanguage();
  const [waitingTargetScore, setWaitingTargetScore] = useState(15);

  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );

  const l = useCallback(
    (de: string, en: string) => translateWattenPair(language, de, en),
    [language],
  );


  const [room, setRoom] = useState<Room | null>(null);

  const [game, setGame] = useState<MultiplayerGame | null>(null);

  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  const [playerAvatarIds, setPlayerAvatarIds] = useState<
    Record<string, string>
  >({});

  const [hand, setHand] = useState<WattenCard[]>([]);

  const [mySeat, setMySeat] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cutting, setCutting] = useState(false);

  const [abhebenPreview, setAbhebenPreview] = useState<AbhebenEvent[]>([]);
  const [visibleAbhebenCount, setVisibleAbhebenCount] = useState(0);

  const [showAbhebenPreview, setShowAbhebenPreview] = useState(false);
  const [abhebenRevealDone, setAbhebenRevealDone] = useState(false);
  const [dealReady, setDealReady] = useState(false);
  const [dealCompletedKey, setDealCompletedKey] = useState<string | null>(null);
  const [dealAnimating, setDealAnimating] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const [playingCard, setPlayingCard] = useState(false);

  const [continuingTrick, setContinuingTrick] = useState(false);

  const [bidAction, setBidAction] = useState<
    "raise" | "hold" | "decline" | null
  >(null);

  const [startingNextRound, setStartingNextRound] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  const shownAbhebenResultRef = useRef<string | null>(null);
  const dealChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const dealAnimatingRef = useRef(false);
  const dealCloseTimerRef = useRef<number | null>(null);

  const [helpMode, setHelpMode] = useState(false);

  const [showRankingHelp, setShowRankingHelp] = useState(false);

  const beginDealAnimation = useCallback((key: string) => {
    if (dealAnimatingRef.current) return;

    dealAnimatingRef.current = true;
    setDealReady(false);
    setAbhebenRevealDone(false);
    setShowAbhebenPreview(false);
    setDealAnimating(true);

    if (dealCloseTimerRef.current !== null) {
      window.clearTimeout(dealCloseTimerRef.current);
    }

    dealCloseTimerRef.current = window.setTimeout(() => {
      dealAnimatingRef.current = false;
      setDealAnimating(false);
      setDealCompletedKey(key);
      dealCloseTimerRef.current = null;
    }, 2750);
  }, []);

  async function copyRoomCode() {
    if (!room?.code || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch {
      setError(
        l(
          "Der Raumcode konnte nicht kopiert werden.",
          "Could not copy room code.",
        ),
      );
    }
  }

  async function startGame() {
    if (!room || !user) {
      return;
    }

    if (room.host_id !== user.id) {
      return;
    }

    if (players.length !== 4 || starting) {
      return;
    }

    const target = Math.max(2, Math.min(30, Math.trunc(waitingTargetScore)));
    setWaitingTargetScore(target);
    setStarting(true);
    setError(null);

    // Use the backend signature that is actually installed. The previous
    // implementation first probed a p_target_score overload; when that
    // overload did not exist Supabase correctly returned HTTP 400, even
    // though the fallback below then started the game successfully.
    const { error: startError } = await supabase.rpc("start_watten_game", {
      p_room_id: room.id,
    });

    if (startError) {
      setStarting(false);
      console.error("Could not start Watten:", startError);
      setError(
        startError.message ??
          l(
            "Das Spiel konnte nicht gestartet werden.",
            "The game could not be started.",
          ),
      );
      return;
    }

    let targetError: { message: string } | null = null;

    // Preserve the selected target score after the game row has been created.
    const targetRpc = await supabase.rpc("set_watten_target_score", {
      p_room_id: room.id,
      p_target_score: target,
    });

    if (targetRpc.error) {
      const targetRpcMessage = targetRpc.error.message.toLowerCase();
      const helperMissing =
        targetRpcMessage.includes("set_watten_target_score") &&
        (targetRpcMessage.includes("schema cache") ||
          targetRpcMessage.includes("could not find the function") ||
          targetRpcMessage.includes("function public.set_watten_target_score"));

      if (helperMissing) {
        const directUpdate = await supabase
          .from("watten_games")
          .update({ target_score: target })
          .eq("room_id", room.id);
        targetError = directUpdate.error;
      } else {
        targetError = targetRpc.error;
      }
    }

    setStarting(false);

    if (targetError) {
      console.error("Could not set Watten target score:", targetError);
      setError(
        l(
          `Das Spiel wurde gestartet, aber das Ziel konnte nicht auf ${target} Punkte gesetzt werden: ${targetError.message}`,
          `The game started, but the target could not be set to ${target} points: ${targetError.message}`,
        ),
      );
    }
  }

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!room?.id || room.status !== "waiting") return;

    const stored = window.localStorage.getItem(`watten-target-${room.id}`);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed) && parsed >= 2 && parsed <= 30) {
      setWaitingTargetScore(Math.trunc(parsed));
    }
  }, [room?.id, room?.status]);

  function updateWaitingTargetScore(value: number) {
    const next = Math.max(2, Math.min(30, Math.trunc(value)));
    setWaitingTargetScore(next);
    if (room?.id) {
      window.localStorage.setItem(`watten-target-${room.id}`, String(next));
    }
  }

  const loadHand = useCallback(
    async (roomId: string) => {
      if (!userId) {
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
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Could not load hand:", error);
        return;
      }

      const row = data as HandRow | null;
      setHand(row?.cards ?? []);
    },
    [userId],
  );
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

      setError(
        error.message ??
          l("Abheben fehlgeschlagen.", "Cutting the deck failed."),
      );

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

      setError(
        l(
          `Schlag konnte nicht gespeichert werden: ${error.message}`,
          `Could not save Schlag: ${error.message}`,
        ),
      );
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

      setError(
        l(
          `Die Farbe konnte nicht gespeichert werden: ${error.message}`,
          `Could not save the suit: ${error.message}`,
        ),
      );
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
        l(
          "Trumpf oder Kritisch: Du musst Trumpf oder einen Kritischen spielen.",
          "Trump or critical: you must play a trump or critical card.",
        ),
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

      setError(
        error.message ??
          l(
            "Die Karte konnte nicht gespielt werden.",
            "The card could not be played.",
          ),
      );

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

      setError(
        l(
          `Der nächste Stich konnte nicht gestartet werden: ${error.message}`,
          `Could not continue to the next trick: ${error.message}`,
        ),
      );
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

      setActionError(
        l(
          `Gehen konnte nicht erhöht werden: ${error.message}`,
          `Could not raise: ${error.message}`,
        ),
      );
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

      setActionError(
        l(
          `Die Entscheidung konnte nicht gespeichert werden: ${error.message}`,
          `Could not save the decision: ${error.message}`,
        ),
      );
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

      setActionError(
        l(
          `Die nächste Runde konnte nicht gestartet werden: ${error.message}`,
          `Could not start the next round: ${error.message}`,
        ),
      );
    }
  }

  function cardCountForSeat(seat: number) {
    return resolvedGame.cards_remaining?.[String(seat)] ?? 0;
  }
  const refreshRoomState = useCallback(
    async (showLoader = false) => {
      if (!roomCode || !userId) {
        return;
      }

      if (showLoader) {
        setLoading(true);
      }

      const normalizedCode = roomCode.trim().toUpperCase();

      const { data: roomData, error: roomError } = await supabase
        .from("watten_rooms")
        .select("id, code, host_id, status")
        .eq("code", normalizedCode)
        .maybeSingle();

      if (roomError || !roomData) {
        console.error(roomError);
        setError(l("Raum nicht gefunden.", "Room not found."));
        if (showLoader) setLoading(false);
        return;
      }

      const loadedRoom = roomData as Room;

      const { data: playerData, error: playerError } = await supabase
        .from("watten_room_players")
        .select("room_id, user_id, seat, display_name")
        .eq("room_id", loadedRoom.id)
        .order("seat", { ascending: true });

      if (playerError) {
        console.error(playerError);
        setError(
          l(
            "Spieler konnten nicht geladen werden.",
            "Players could not be loaded.",
          ),
        );
        if (showLoader) setLoading(false);
        return;
      }

      const loadedPlayers = (playerData ?? []) as RoomPlayer[];
      const me = loadedPlayers.find((player) => player.user_id === userId);

      if (!me) {
        setError(
          l(
            "Du bist kein Spieler dieses Raumes.",
            "You are not a player in this room.",
          ),
        );
        if (showLoader) setLoading(false);
        return;
      }

      setRoom(loadedRoom);
      setPlayers(loadedPlayers);
      setMySeat(me.seat);
      setError(null);

      const playerUserIds = [
        ...new Set(
          loadedPlayers.map((player) => player.user_id).filter(Boolean),
        ),
      ];

      if (playerUserIds.length > 0) {
        const { data: avatarRows, error: avatarError } = await supabase
          .from("profiles")
          .select("id, avatar_id")
          .in("id", playerUserIds);

        if (avatarError) {
          console.warn("Could not load Watten avatars:", avatarError);
        } else {
          const nextAvatars: Record<string, string> = {};

          for (const row of avatarRows ?? []) {
            if (typeof row.id === "string") {
              nextAvatars[row.id] =
                typeof row.avatar_id === "string" && row.avatar_id
                  ? row.avatar_id
                  : "m1";
            }
          }

          setPlayerAvatarIds(nextAvatars);
        }
      }

      if (loadedRoom.status === "playing" || loadedRoom.status === "finished") {
        const { data: gameData, error: gameError } = await supabase
          .from("watten_games")
          .select("*")
          .eq("room_id", loadedRoom.id)
          .maybeSingle();

        if (gameError) {
          console.error(gameError);
          setError(
            l(
              "Spielstatus konnte nicht geladen werden.",
              "Game state could not be loaded.",
            ),
          );
        } else if (gameData) {
          setGame(gameData as MultiplayerGame);
          await loadHand(loadedRoom.id);
        }
      } else {
        setGame(null);
        setHand([]);
      }

      if (showLoader) {
        setLoading(false);
      }
    },
    [roomCode, userId, loadHand, l],
  );

  // Initial room/game load. This effect performs data fetching only.
  useEffect(() => {
    if (!roomCode || !userId) {
      return;
    }

    void refreshRoomState(true);
  }, [roomCode, userId, refreshRoomState]);

  // Realtime lifecycle is intentionally separate from async loading. All
  // postgres_changes callbacks are registered synchronously before subscribe().
  useEffect(() => {
    if (!room?.id || !userId) {
      return;
    }

    const roomId = room.id;
    const channelInstance =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // Supabase reuses an existing channel when the topic is identical. A unique
    // instance suffix prevents React StrictMode cleanup/reattach races from
    // returning a channel that has already been subscribed.
    const channel = supabase.channel(
      `watten-game-${roomId}-${userId}-${channelInstance}`,
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "watten_room_players",
        filter: `room_id=eq.${roomId}`,
      },
      () => {
        void refreshRoomState(false);
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "watten_rooms",
        filter: `id=eq.${roomId}`,
      },
      () => {
        void refreshRoomState(false);
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "watten_games",
        filter: `room_id=eq.${roomId}`,
      },
      () => {
        void refreshRoomState(false);
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "watten_hands",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        void refreshRoomState(false);
      },
    );

    channel.subscribe((status, subscriptionError) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error(
          "Watten realtime subscription failed:",
          status,
          subscriptionError,
        );
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room?.id, userId, refreshRoomState]);

  // Polling fallback keeps the room usable even if a Realtime event is missed.
  useEffect(() => {
    if (!room?.id || !userId) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshRoomState(false);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [room?.id, userId, refreshRoomState]);

  const abhebenResultKey = JSON.stringify(game?.abheben_result ?? []);
  const waitingForDeal =
    abhebenResultKey !== "[]" && dealCompletedKey !== abhebenResultKey;

  useEffect(() => {
    const events = game?.abheben_result ?? [];

    if (events.length === 0) {
      setShowAbhebenPreview(false);
      setVisibleAbhebenCount(0);
      setAbhebenRevealDone(false);
      setDealReady(false);
      return;
    }

    if (shownAbhebenResultRef.current === abhebenResultKey) {
      return;
    }

    shownAbhebenResultRef.current = abhebenResultKey;
    dealAnimatingRef.current = false;
    setDealAnimating(false);
    setDealCompletedKey(null);
    setDealReady(false);
    setAbhebenPreview(events);
    setVisibleAbhebenCount(1);
    setAbhebenRevealDone(false);
    setShowAbhebenPreview(true);

    const timers: number[] = [];
    const perCardDelay = 2500;

    for (let index = 1; index < events.length; index += 1) {
      timers.push(
        window.setTimeout(() => {
          setVisibleAbhebenCount(index + 1);
        }, index * perCardDelay),
      );
    }

    const revealDuration = Math.max(2000, events.length * perCardDelay + 700);

    timers.push(
      window.setTimeout(() => {
        setAbhebenRevealDone(true);
        setShowAbhebenPreview(false);
        setDealReady(true);
      }, revealDuration),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [abhebenResultKey]);

  useEffect(() => {
    if (!room?.id) return;

    const channel = supabase.channel(`watten4-deal-${room.id}`);
    channel.on("broadcast", { event: "distribute_cards" }, ({ payload }) => {
      const key =
        payload && typeof payload === "object" && "abhebenKey" in payload
          ? String(payload.abhebenKey)
          : "";

      if (key && key !== abhebenResultKey) return;
      beginDealAnimation(key || abhebenResultKey);
    });
    channel.subscribe();
    dealChannelRef.current = channel;

    return () => {
      if (dealChannelRef.current === channel) {
        dealChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [room?.id, abhebenResultKey, beginDealAnimation]);

  useEffect(() => {
    return () => {
      if (dealCloseTimerRef.current !== null) {
        window.clearTimeout(dealCloseTimerRef.current);
      }
    };
  }, []);

  async function distributeCards() {
    if (
      !game ||
      mySeat === null ||
      mySeat !== game.dealer ||
      !abhebenRevealDone
    ) {
      return;
    }

    beginDealAnimation(abhebenResultKey);

    const channel = dealChannelRef.current;
    if (channel) {
      await channel.send({
        type: "broadcast",
        event: "distribute_cards",
        payload: { abhebenKey: abhebenResultKey },
      });
    }
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent text-white">
        <div className="text-center">
          <p className="text-red-300">{error}</p>

          <Link
            to="/games/watten/multiplayer"
            className="mt-6 inline-block rounded-xl bg-white/10 px-5 py-3"
          >
            {t("Back")}
          </Link>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <div className="text-center">
          <p className="text-lg font-black">
            {l("Bitte zuerst einloggen.", "Please sign in first.")}
          </p>

          <Link
            to="/games/watten/multiplayer"
            className="mt-5 inline-block rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10"
          >
            {t("Back")}
          </Link>
        </div>
      </main>
    );
  }

  if (loading || !room || mySeat === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent text-white">
        <p>
          {l(
            "Multiplayer-Spiel wird geladen...",
            "Loading multiplayer game...",
          )}
        </p>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * WAITING ROOM
   * ---------------------------------------------------------
   *
   * This used to live in WattenMultiplayerRoom.tsx.
   * It now stays on the same route/component as the real game.
   */
  if (room.status === "waiting") {
    const isHost = room.host_id === user.id;
    const missingPlayers = Math.max(0, 4 - players.length);

    return (
      <main className="min-h-screen bg-transparent px-4 py-8 text-white sm:px-6">
        <div className="mx-auto max-w-6xl">
          <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-[30px] border border-emerald-300/15 bg-zinc-950/65 p-6 shadow-2xl shadow-black/30">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
                {t("Bavarian Watten")} · Multiplayer
              </p>

              <h1 className="mt-1 text-3xl font-black">
                {l("4 Spieler · 2 gegen 2", "4 Players · 2 vs 2")}
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                {l(
                  "Teile den Raumcode mit drei Mitspielern. Der Gastgeber kann die Partie starten, sobald alle vier Plätze belegt sind.",
                  "Share the room code with three other players. The host can start once all four seats are filled.",
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 max-md:w-full max-md:gap-2 max-md:overflow-x-auto max-md:pb-1">

              <Link
                to="/games/watten/multiplayer"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 hover:text-white"
              >
                {t("Leave")}
              </Link>
            </div>
          </header>

          <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5">
            {/* PLAYERS */}
            <aside className="rounded-[30px] border border-white/10 bg-zinc-950/75 p-5 shadow-xl shadow-black/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">
                    {t("Players")}
                  </p>

                  <h2 className="mt-1 text-xl font-black">
                    {players.length}/4 {l("verbunden", "connected")}
                  </h2>
                </div>

                <span
                  className={`h-3 w-3 rounded-full ${
                    players.length === 4
                      ? "bg-emerald-400"
                      : "animate-pulse bg-amber-400"
                  }`}
                />
              </div>

              <div className="mt-5 space-y-3">
                {[0, 1, 2, 3].map((seat) => {
                  const player = players.find(
                    (current) => current.seat === seat,
                  );

                  const teamA = seat % 2 === 0;

                  return (
                    <div
                      key={seat}
                      className={`rounded-2xl border p-4 ${
                        player
                          ? teamA
                            ? "border-amber-400/25 bg-amber-400/[0.06]"
                            : "border-emerald-400/25 bg-emerald-400/[0.06]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center gap-3 max-md:w-full max-md:gap-2 max-md:overflow-x-auto max-md:pb-1">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                            player
                              ? teamA
                                ? "bg-amber-300 text-amber-950"
                                : "bg-emerald-300 text-emerald-950"
                              : "bg-zinc-800 text-zinc-600"
                          }`}
                        >
                          {seat + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-black">
                              {player?.display_name ??
                                l(
                                  "Wartet auf Spieler...",
                                  "Waiting for player...",
                                )}
                            </p>

                            {player?.user_id === user.id && (
                              <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[9px] font-black text-sky-300">
                                {l("DU", "YOU")}
                              </span>
                            )}
                          </div>

                          <p
                            className={`mt-1 text-[10px] font-black uppercase tracking-wider ${
                              teamA ? "text-amber-300" : "text-emerald-300"
                            }`}
                          >
                            {teamA ? "Team A" : "Team B"}
                          </p>

                          {player?.user_id === room.host_id && (
                            <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                              {l("Gastgeber", "Host")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl border border-white/5 bg-black/20 p-4 text-center">
                {players.length < 4 ? (
                  <>
                    <p className="text-xs font-black text-zinc-300">
                      {l("Noch", "Still")} {missingPlayers}{" "}
                      {l(
                        missingPlayers === 1
                          ? "Spieler benötigt"
                          : "Spieler benötigt",
                        missingPlayers === 1
                          ? "player needed"
                          : "players needed",
                      )}
                    </p>

                    <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                      {l(
                        "Neue Spieler erscheinen automatisch.",
                        "New players appear automatically.",
                      )}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-black text-emerald-300">
                      {l(
                        "Alle vier Spieler sind verbunden.",
                        "All four players are connected.",
                      )}
                    </p>

                    <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                      {l(
                        "Die Partie kann jetzt gestartet werden.",
                        "The game can now be started.",
                      )}
                    </p>
                  </>
                )}
              </div>
            </aside>

            {/* TABLE / COPYABLE ROOM CODE */}
            <section
              className="relative min-h-[620px] overflow-hidden rounded-[42px] border border-white/10 shadow-2xl max-md:min-h-[480px] max-md:rounded-[28px]"
              style={{
                backgroundImage: `url(${tableBackgrounds[tableTheme]})`,
                backgroundSize: "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-[2px]">
                <div className="w-full max-w-lg">
                  <button
                    type="button"
                    onClick={() => void copyRoomCode()}
                    className="w-full rounded-[26px] border border-white/15 bg-zinc-900/95 px-6 py-5 text-center shadow-2xl shadow-black/60 transition hover:border-amber-300/35 hover:bg-zinc-900 active:scale-[0.99]"
                    title={l("Raumcode kopieren", "Copy room code")}
                  >
                    <div className="text-3xl">🃏</div>

                    <p className="mt-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                      {t("Waiting for players")}
                    </p>

                    <h2 className="mt-1 text-xl font-black text-white">
                      {players.length}/4{" "}
                      {l("Spieler verbunden", "players connected")}
                    </h2>

                    <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-zinc-500">
                      {l(
                        "Teile diesen Raumcode mit deinen Mitspielern.",
                        "Share this room code with the other players.",
                      )}
                    </p>

                    <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                        {t("Room code")}
                      </p>

                      <p className="mt-1 break-all font-mono text-3xl font-black tracking-[0.14em] text-amber-200 sm:text-4xl">
                        {room.code}
                      </p>
                    </div>

                    <p className="mt-2 text-[10px] font-bold text-zinc-400">
                      {copied
                        ? `✓ ${t("Copied to clipboard")}`
                        : t("Click this box to copy the code")}
                    </p>
                  </button>

                  {isHost && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-950/85 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                          {l("Siegpunkte", "Target score")}
                        </p>
                        <span className="text-sm font-black text-amber-300">
                          {waitingTargetScore}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        {[11, 15, 18].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => updateWaitingTargetScore(score)}
                            className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-sm font-black transition ${
                              waitingTargetScore === score
                                ? "bg-amber-300 text-amber-950"
                                : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                            }`}
                          >
                            {score}
                          </button>
                        ))}

                        <input
                          aria-label={l(
                            "Eigener Zielwert",
                            "Custom target score",
                          )}
                          type="number"
                          min={2}
                          max={30}
                          value={waitingTargetScore}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value))
                              updateWaitingTargetScore(value);
                          }}
                          className="w-20 rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-center text-sm font-black outline-none transition focus:border-amber-300/50"
                        />
                      </div>

                      <p className="mt-1 text-[9px] font-bold text-zinc-600">
                        {l("Eigener Wert: 2–30", "Custom: 2–30")}
                      </p>
                    </div>
                  )}

                  {isHost ? (
                    <button
                      type="button"
                      disabled={players.length !== 4 || starting}
                      onClick={() => void startGame()}
                      className="mt-3 w-full rounded-xl bg-amber-300 px-5 py-2.5 text-sm font-black text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {starting
                        ? l("Spiel wird gestartet...", "Game is starting...")
                        : players.length === 4
                          ? l("Spiel starten", "Start game")
                          : l(
                              `Warte auf ${missingPlayers} ${missingPlayers === 1 ? "weiteren Spieler" : "weitere Spieler"}`,
                              `Waiting for ${missingPlayers} more ${missingPlayers === 1 ? "player" : "players"}`,
                            )}
                    </button>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-950/85 px-5 py-4 text-center">
                      <p className="text-sm font-black text-zinc-300">
                        {players.length === 4
                          ? l("Alle Spieler sind da.", "All players are here.")
                          : l(
                              "Warte auf weitere Spieler...",
                              "Waiting for more players...",
                            )}
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        {l(
                          "Der Gastgeber startet die Partie.",
                          "The host starts the game.",
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  /*
   * A room can switch to "playing" a fraction before the game row is
   * received through Realtime. Keep a short loading state instead of
   * throwing the user back to a separate room page.
   */
  if (!game) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-amber-300" />
          <p className="mt-4 text-sm font-bold text-zinc-300">
            {l("Spiel wird gestartet...", "Game is starting...")}
          </p>
        </div>
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

  // For short test/quick matches up to 4 points, disable the Gespannt
  // restriction so Gehen remains usable (same behavior as the 3-player mode).
  const myTeamIsGespannt =
    targetScore >= 5 &&
    myTeamScore >= targetScore - 2 &&
    myTeamScore < targetScore;

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
      return l(
        "Hauptschlag — Wenn du diese Karte jetzt ausspielst, wird „Trumpf oder Kritisch“ aktiv.",
        "Main Schlag — playing this card now activates ‘Trump or Critical’. ",
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

    if (
      resolvedGame.farbe &&
      resolvedGame.schlag &&
      isHauptschlag(card, resolvedGame.farbe, resolvedGame.schlag)
    ) {
      return l(
        "Hauptschlag — die stärkste nicht-kritische Karte.",
        "Main Schlag — the strongest non-critical card.",
      );
    }

    if (card.rank === resolvedGame.schlag) {
      return l(
        `Schlag (${resolvedGame.schlag}) — stärker als normale Trumpfkarten.`,
        `Schlag (${resolvedGame.schlag}) — stronger than normal trump cards.`,
      );
    }

    if (card.suit === resolvedGame.farbe) {
      return l(
        `Trumpf (${resolvedGame.farbe})`,
        `Trump (${resolvedGame.farbe})`,
      );
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
        title: l("Kritische", "Critical cards"),
        description: "Max → Belli → Spitz",
        cards: kritische,
      },
      {
        title: l("Hauptschlag", "Main Schlag"),
        description: l(
          "Schlag + Farbe. Höchste nicht-kritische Karte.",
          "Schlag + suit. Highest non-critical card.",
        ),
        cards: hauptschlag,
      },
      {
        title: l("Schläge", "Schlag cards"),
        description: l(
          `Alle anderen ${resolvedGame.schlag}. Gleich stark; der zuerst gespielte gewinnt.`,
          `All other ${resolvedGame.schlag}. Equal strength; the first played wins.`,
        ),
        cards: schlaege,
      },
      {
        title: l(
          `Trumpf / Farbe (${resolvedGame.farbe})`,
          `Trump / suit (${resolvedGame.farbe})`,
        ),
        description: l(
          "Danach folgen die übrigen Karten der Trumpffarbe.",
          "Then follow the remaining cards of the trump suit.",
        ),
        cards: trumpfCards,
      },
      {
        title: l("Normale Karten", "Normal cards"),
        description: l(
          "Angespielte Farbe: Ass → König → Ober → Unter → 10 → 9 → 8 → 7.",
          "Led suit: Ace → King → Ober → Unter → 10 → 9 → 8 → 7.",
        ),
        cards: normalCards,
      },
    ];
  }

  return (
    <main className="watten-game-screen min-h-screen bg-transparent px-4 py-6 text-white md:px-8">
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
      {showAbhebenPreview &&
        mySeat === game.abheben_player &&
        abhebenPreview.length > 0 && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 p-8 text-center shadow-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                {t("Abheben")}
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {l("Ergebnis", "Result")}
              </h2>

              <div className="mt-8 flex min-h-44 flex-wrap items-start justify-center gap-6">
                {abhebenPreview
                  .slice(0, visibleAbhebenCount)
                  .map((event, index) => {
                    const recipient =
                      event.recipient_seat !== null
                        ? players.find(
                            (player) => player.seat === event.recipient_seat,
                          )
                        : null;

                    return (
                      <div
                        key={`${event.card.id}-${index}`}
                        className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <div onMouseEnter={playHoverSound}>
                          <WattenCardComponent card={event.card} />
                        </div>

                        {event.critical ? (
                          <>
                            <p className="mt-3 font-black text-amber-300">
                              {l("Kritische!", "Critical!")}
                            </p>

                            <p className="mt-1 text-xs text-zinc-400">
                              {l("geht an", "goes to")}
                            </p>

                            <p className="mt-1 text-sm font-bold text-white">
                              {recipient?.display_name}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="mt-3 font-bold text-zinc-300">
                              {l("Keine Kritische", "No critical card")}
                            </p>

                            <p className="mt-1 text-xs text-zinc-500">
                              {l("Abheben beendet", "Cut finished")}
                            </p>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>

              {visibleAbhebenCount < abhebenPreview.length ? (
                <p className="mt-5 animate-pulse text-sm font-black text-amber-300">
                  {l("Nächste Karte...", "Next card...")}
                </p>
              ) : (
                <p className="mt-5 text-xs font-bold text-zinc-500">
                  {l(
                    "Die letzte Karte bleibt kurz sichtbar. Danach liegt der Stapel wieder auf dem Tisch.",
                    "The final card stays visible briefly. Then the deck returns to the table.",
                  )}
                </p>
              )}

              <p className="mt-4 text-xs font-bold text-zinc-500">
                {l(
                  "Die aufgedeckte Karte bleibt kurz sichtbar. Danach liegt der Stapel wieder auf dem Tisch.",
                  "The revealed card stays visible briefly. Then the deck returns to the table.",
                )}
              </p>
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
                {l("Gehen", "Raise")}
              </p>

              <h2 className="mt-3 text-2xl font-black text-white">
                {teamName(game.pending_bid_team)}
              </h2>

              <p className="mt-2 text-zinc-300">{l("geht auf", "raises to")}</p>

              <p className="mt-2 text-5xl font-black text-amber-400">
                {game.pending_bid_value}
              </p>

              <p className="mt-1 text-sm text-zinc-500">{t("Points")}</p>

              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                {l("Aktueller Rundenwert", "Current round value")}:{" "}
                <strong className="text-amber-300">{game.round_value}</strong>
                <br />
                {l("Neuer Wert bei Halten", "New value if held")}:{" "}
                <strong className="text-emerald-300">
                  {game.pending_bid_value}
                </strong>
              </div>

              {canRespondToBid ? (
                <>
                  <p className="mt-6 text-sm font-bold text-emerald-300">
                    {l("Dein Team muss entscheiden.", "Your team must decide.")}
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
                    {l("Nicht halten", "Decline")}
                  </button>

                  <p className="mt-4 text-xs leading-5 text-zinc-500">
                    {l("Bei „Nicht halten“ erhält", "If declined,")}{" "}
                    {teamName(game.pending_bid_team)}{" "}
                    {l(
                      "den bisherigen Rundenwert von",
                      "receives the current round value of",
                    )}{" "}
                    {game.round_value} {t("Points")}.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-7 text-sm text-zinc-400">
                    {l(
                      "Die Gegenseite entscheidet...",
                      "The other team is deciding...",
                    )}
                  </p>

                  <div className="mx-auto mt-4 h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-amber-400" />
                </>
              )}
            </div>
          </div>
        )}
      <div className="watten-game-content mx-auto w-full max-w-[1800px] max-md:px-2">
        {/* HEADER */}

        <div className="relative z-30 mb-3 flex items-start justify-between gap-2 max-md:flex-col md:mb-4 md:items-center">
          <div className="ml-5 pl-5 max-md:ml-0 max-md:pl-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
              {t("Bavarian Watten")}
            </p>

            <h1 className="mt-1 text-2xl font-black">
              {l("4 Spieler · Multiplayer", "4 Players · Multiplayer")}
            </h1>

            <p className="mt-1 text-xs text-zinc-400">
              {t("Room code")}: {room.code}
            </p>
          </div>

          <div className="flex items-center gap-3 max-md:w-full max-md:gap-2 max-md:overflow-x-auto max-md:pb-1">

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
              {helpMode
                ? l("💡 Hilfe an", "💡 Help On")
                : l("💡 Hilfe", "💡 Help")}
            </button>

            <HeaderTools><CardThemeSelector /><TableThemeSelector /></HeaderTools>

            <Link
              to="/games/watten/multiplayer"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/20"
            >
              {t("Leave")}
            </Link>
          </div>
        </div>

        {/* TABLE + SIDEBARS */}

        <div
          className="watten-game-grid
    grid
    w-full
    grid-cols-[16rem_minmax(0,1fr)_16rem]
    items-start
    gap-5
    max-md:grid-cols-1
    max-md:gap-3
  "
        >
          {/* LEFT SIDEBAR */}

          <aside className="relative w-64 pt-15 max-md:order-2 max-md:w-full max-md:pt-0">
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
                    ? l("📚 Kartenrangfolge ausblenden", "📚 Hide card ranking")
                    : l(
                        "📚 Kartenrangfolge einblenden",
                        "📚 Show card ranking",
                      )}
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
                max-md:fixed
                max-md:inset-x-2
                max-md:top-20
                max-md:z-[200]
                max-md:h-[70vh]
                max-md:w-auto
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
                      {l("Anfängerhilfe", "Beginner help")}
                    </p>

                    <h2 className="mt-1 text-xl font-bold">
                      {l("Kartenrangfolge", "Card ranking")}
                    </h2>

                    <p className="mt-1 text-xs text-zinc-400">
                      {t("Highest priority first.")}
                    </p>

                    <div className="mt-3 text-xs">
                      <span className="text-emerald-300">
                        {l("Farbe", "Suit")}: <strong>{game.farbe}</strong>
                      </span>

                      <span className="ml-3 text-amber-300">
                        {t("Schlag")}: <strong>{game.schlag}</strong>
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

            <div className="h-[720px] rounded-3xl border border-white/10 bg-zinc-950/95 p-5 shadow-2xl max-md:h-auto max-md:p-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400">
                {l("Punktestand", "Score")}
              </p>

              <h3 className="mt-1 text-lg font-bold">
                {l("Ziel", "Target")}: {targetScore} {t("Points")}
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
                      {t("Schlag")}
                    </span>

                    <span className="rounded-lg bg-amber-400/15 px-2.5 py-1 text-lg font-black text-amber-300">
                      {game.schlag}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-white/10" />

                  {/* FARBE */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">
                      {l("Farbe", "Suit")}
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
    max-md:order-1
    max-md:min-h-[540px]
    max-md:rounded-[32px]
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
    max-md:rounded-[32px]
    bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.10),transparent_58%)]
  "
              />

              <div
                className="
    pointer-events-none
    absolute
    inset-[18px]
    rounded-[48px]
    max-md:inset-[8px]
    max-md:rounded-[24px]
    border
    border-white/5
  "
              />

              {dealAnimating && <DealAnimation playerCount={4} />}
              {/* TOP */}

              <PlayerBox
                l={l}
                player={topPlayer}
                avatarId={
                  topPlayer
                    ? (playerAvatarIds[topPlayer.user_id] ?? "m1")
                    : "m1"
                }
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
    max-md:top-2
  "
                cardCount={waitingForDeal ? 0 : cardCountForSeat(topSeat)}
              />

              {/* LEFT */}
              <PlayerBox
                l={l}
                player={leftPlayer}
                avatarId={
                  leftPlayer
                    ? (playerAvatarIds[leftPlayer.user_id] ?? "f1")
                    : "f1"
                }
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
    max-md:left-1
  "
                cardCount={waitingForDeal ? 0 : cardCountForSeat(leftSeat)}
              />

              {/* RIGHT */}

              <PlayerBox
                l={l}
                player={rightPlayer}
                avatarId={
                  rightPlayer
                    ? (playerAvatarIds[rightPlayer.user_id] ?? "m2")
                    : "m2"
                }
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
    max-md:right-1
  "
                cardCount={waitingForDeal ? 0 : cardCountForSeat(rightSeat)}
              />

              {/* CENTER */}

              <div
                className={
                  game.phase === "playing" && !waitingForDeal
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
                {waitingForDeal ? (
                  dealReady && !dealAnimating ? (
                    <DealDeckControl
                      canDeal={mySeat === game.dealer}
                      onDeal={() => void distributeCards()}
                      l={l}
                    />
                  ) : (
                    <p className="animate-pulse text-sm font-black text-zinc-400">
                      {l(
                        "Abheben wird abgeschlossen...",
                        "Finishing the cut...",
                      )}
                    </p>
                  )
                ) : game.phase === "abheben" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      {t("Abheben")}
                    </p>

                    {isMyTurn ? (
                      <>
                        <h2 className="mt-3 text-2xl font-black text-emerald-300">
                          {l("Du hebst ab", "You are cutting")}
                        </h2>

                        <p className="mt-2 text-xs text-zinc-400">
                          {l(
                            "Wähle eine Stelle im Stapel.",
                            "Choose a cut position in the deck.",
                          )}
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
                            {l("Karte wird aufgedeckt...", "Revealing card...")}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h2 className="mt-3 text-xl font-black">
                          {abheber?.display_name} {l("hebt ab", "is cutting")}
                        </h2>

                        <p className="mt-3 text-sm text-zinc-400">
                          {l("Bitte warten...", "Please wait...")}
                        </p>
                      </>
                    )}
                  </>
                ) : game.phase === "schlag" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-300">
                      {l("Schlag bestimmen", "Choose Schlag")}
                    </p>

                    {isMyTurn ? (
                      <>
                        <h2 className="mt-3 text-2xl font-black text-amber-300">
                          {l("Du bist Vorhand", "You are Forehand")}
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          {l("Wähle den Schlag.", "Choose the Schlag rank.")}
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
                            {l(
                              "Schlag wird gespeichert...",
                              "Saving Schlag...",
                            )}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h2 className="mt-3 text-xl font-black">
                          {vorhand?.display_name}{" "}
                          {l("bestimmt den Schlag", "chooses the Schlag")}
                        </h2>

                        <p className="mt-3 text-sm text-zinc-400">
                          {l("Bitte warten...", "Please wait...")}
                        </p>
                      </>
                    )}
                  </>
                ) : game.phase === "trump" ? (
                  <>
                    <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
                      {l("Farbe bestimmen", "Choose suit")}
                    </p>

                    <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2">
                      <span className="text-xs text-zinc-400">
                        {t("Schlag")}
                      </span>

                      <p className="text-xl font-black text-amber-300">
                        {game.schlag}
                      </p>
                    </div>

                    {isMyTurn ? (
                      <>
                        <h2 className="mt-5 text-2xl font-black text-emerald-300">
                          {l("Du bist Geber", "You are the dealer")}
                        </h2>

                        <p className="mt-2 text-sm text-zinc-400">
                          {l(
                            "Wähle die Trumpffarbe.",
                            "Choose the trump suit.",
                          )}
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
                            {l("Farbe wird gespeichert...", "Saving suit...")}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <h2 className="mt-5 text-xl font-black">
                          {dealer?.display_name}{" "}
                          {l("bestimmt die Farbe", "chooses the suit")}
                        </h2>

                        <p className="mt-3 text-sm text-zinc-400">
                          {l("Bitte warten...", "Please wait...")}
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
                              onMouseEnter={playHoverSound}
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
                          {l("Spiel deine Karte", "Play your card")}
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
                        {l("Stich", "Trick")}
                      </p>

                      <h2 className="mt-2 text-3xl font-black">
                        {l("Stich beendet", "Trick finished")}
                      </h2>

                      <p className="mt-2 text-xs text-emerald-300/80">
                        {l("Angespielte Farbe", "Lead suit")}:{" "}
                        {game.played_cards[0]?.card.suit ?? "–"}
                      </p>

                      <div className="mt-8 flex flex-wrap items-start justify-center gap-5">
                        {game.played_cards.map((played) => {
                          const won = played.seat === game.trick_winner_seat;

                          const player = players.find(
                            (candidate) => candidate.seat === played.seat,
                          );
                          const leadSuit = game.played_cards[0]?.card.suit;
                          const role = leadSuit
                            ? getWattenCardRole(
                                played.card,
                                leadSuit,
                                game.farbe,
                                game.schlag,
                              )
                            : "";

                          return (
                            <div
                              key={`${played.seat}-${played.card.id}`}
                              onMouseEnter={playHoverSound}
                              className="flex w-40 flex-col items-center"
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
                              <p className="mt-1 min-h-8 text-[10px] leading-4 text-emerald-300">
                                {role}
                              </p>

                              {won && (
                                <span className="mt-2 animate-pulse rounded-full bg-amber-400 px-3 py-1 text-xs font-black text-amber-950">
                                  {l("Stich-Sieger", "Trick winner")}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {(() => {
                        const winningPlay = game.played_cards.find(
                          (played) => played.seat === game.trick_winner_seat,
                        );
                        const leadSuit = game.played_cards[0]?.card.suit;
                        if (!winningPlay || !leadSuit) return null;

                        return (
                          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                              {l(
                                "Warum diese Karte gewinnt",
                                "Why this card won",
                              )}
                            </p>
                            <p className="mt-1 text-sm font-bold text-white">
                              {getWattenCardRole(
                                winningPlay.card,
                                leadSuit,
                                game.farbe,
                                game.schlag,
                              )}
                            </p>
                          </div>
                        );
                      })()}

                      <p className="mt-8 text-lg font-black text-emerald-300">
                        {
                          players.find(
                            (player) => player.seat === game.trick_winner_seat,
                          )?.display_name
                        }{" "}
                        {l("gewinnt den Stich", "wins the trick")}
                      </p>

                      <button
                        type="button"
                        disabled={continuingTrick}
                        onClick={() => {
                          void continueTrick();
                        }}
                        className="mt-7 rounded-xl bg-emerald-500 px-8 py-3 font-black text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {continuingTrick
                          ? l("Bitte warten...", "Please wait...")
                          : t("Continue")}
                      </button>
                    </div>
                  </div>
                )}
              {game.phase === "roundFinished" && (
                <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/80 px-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-zinc-950 p-9 text-center shadow-2xl">
                    <div className="text-5xl">🏆</div>

                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                      {l("Runde beendet", "Round finished")}
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {game.winner === "team-a"
                        ? teamName("team-a")
                        : teamName("team-b")}
                    </h2>

                    <p className="mt-2 text-xl font-black text-emerald-300">
                      {l("gewinnt die Runde", "wins the round")}
                    </p>

                    <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5">
                      <p className="text-xs uppercase tracking-widest text-zinc-500">
                        {l("Grund", "Reason")}
                      </p>

                      <p className="mt-1 font-bold">
                        {game.round_end_reason === "declined"
                          ? l(
                              "Gehen wurde nicht gehalten",
                              "Raise was declined",
                            )
                          : l("3 Stiche erreicht", "3 tricks reached")}
                      </p>

                      <p className="mt-5 text-xs uppercase tracking-widest text-zinc-500">
                        {t("Round value")}
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
                        ? l(
                            "Neue Runde wird vorbereitet...",
                            "Preparing next round...",
                          )
                        : t("Next round")}
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
                      {l("Gesamtsieger", "Match winner")}
                    </p>

                    <h2 className="mt-4 text-4xl font-black text-white">
                      {teamName(game.match_winner)}
                    </h2>

                    <p className="mt-3 text-zinc-400">
                      {game.match_winner === "team-a" ? teamAScore : teamBScore}{" "}
                      {l("Punkte erreicht", "Target reached")}
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
                      to="/games/watten/multiplayer"
                      className="mt-8 inline-block rounded-xl bg-amber-400 px-7 py-3 font-black text-amber-950 transition hover:bg-amber-300"
                    >
                      {l("Zur Lobby", "Back to lobby")}
                    </Link>
                  </div>
                </div>
              )}

              {/* ME / BOTTOM */}

              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-center max-md:bottom-2 max-md:w-full max-md:px-1">
                <div
                  className={`
                relative
                inline-block
                rounded-2xl
                border
                px-5
                py-3
                max-md:px-3
                max-md:py-2
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
                      ▼ {l("DU BIST AM ZUG", "YOUR TURN")}
                    </div>
                  )}
                  <div className="flex items-center justify-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10">
                      <ProfileAvatar
                        avatarId={
                          me ? (playerAvatarIds[me.user_id] ?? "m1") : "m1"
                        }
                        className="h-full w-full"
                      />
                    </div>

                    <p className="font-black">{me?.display_name}</p>
                  </div>
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
                      {l(
                        tricksForTeam(myTeam) === 1 ? "Stich" : "Stiche",
                        tricksForTeam(myTeam) === 1 ? "trick" : "tricks",
                      )}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                    {l("Du", "You")}
                  </p>
                </div>
                {game.phase === "playing" &&
                  isMyTurn &&
                  mustPlayTrumpfOderKritisch && (
                    <div className="mx-auto mb-4 w-fit rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-2 text-xs font-bold text-red-100">
                      {l(
                        "Trumpf oder Kritisch — du musst eine passende Karte",
                        "Trump or Critical — you must play an eligible card",
                      )}
                      spielen.
                    </div>
                  )}

                {/* PRIVATE HAND */}

                <div className="mt-4 flex justify-center">
                  {!waitingForDeal &&
                    hand.map((card, index) => {
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
                          onMouseEnter={playHoverSound}
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
                {l("Aktueller Stichstand", "Current trick score")}
              </p>

              <h3 className="mt-1 text-lg font-bold">
                {l("2 gegen 2", "2 vs 2")}
              </h3>

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
                  {l(
                    teamATricks === 1 ? "Stich" : "Stiche",
                    teamATricks === 1 ? "trick" : "tricks",
                  )}
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
                  {l(
                    teamBTricks === 1 ? "Stich" : "Stiche",
                    teamBTricks === 1 ? "trick" : "tricks",
                  )}
                </p>
              </div>

              {/* 3-STICH PROGRESS */}

              <div className="mt-5">
                <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {l("3 Stiche zum Sieg", "3 tricks to win")}
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
                  {l("Gehen · Rundenwert", "Gehen · Round value")}
                </p>

                <p className="mt-1 text-2xl font-black text-amber-400">
                  {game.round_value} {t("Points")}
                </p>

                <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-black text-zinc-600">
                  <span
                    className={game.round_value >= 2 ? "text-amber-300" : ""}
                  >
                    2
                  </span>
                  <span>→</span>
                  <span
                    className={game.round_value >= 3 ? "text-amber-300" : ""}
                  >
                    3
                  </span>
                  <span>→</span>
                  <span
                    className={game.round_value >= 4 ? "text-amber-300" : ""}
                  >
                    4
                  </span>
                </div>

                {canRaise && (
                  <button
                    type="button"
                    disabled={bidAction !== null}
                    onClick={() => {
                      void raiseBid();
                    }}
                    className="mt-3 w-full rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-amber-950 transition hover:bg-amber-300 disabled:opacity-40"
                  >
                    {l("Gehen auf", "Raise to")} {game.round_value + 1}
                  </button>
                )}

                {game.round_value >= 4 && (
                  <p className="mt-2 text-xs font-semibold text-zinc-500">
                    {l("Maximum erreicht", "Maximum reached")}
                  </p>
                )}

                {isMyTurn && myTeamIsGespannt && (
                  <div className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-2">
                    <p className="text-xs font-bold text-red-300">
                      {t("Gespannt")}
                    </p>

                    <p className="mt-1 text-[10px] text-red-200/70">
                      {l(
                        "Dein Team ist gespannt und darf nicht gehen.",
                        "Your team is gespannt and cannot raise.",
                      )}
                    </p>
                  </div>
                )}

                <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-4 text-zinc-600">
                  {l(
                    "Standard: 2 Punkte. Gehen erhöht auf 3, danach maximal 4. Die Gegenseite hält oder lehnt ab.",
                    "Standard: 2 points. Gehen raises to 3, then at most 4. The opposing team holds or declines.",
                  )}
                </p>

                {targetScore < 5 && (
                  <p className="mt-2 text-[10px] leading-4 text-sky-300/80">
                    {l(
                      "Bei kurzen Spielen bis 4 Punkte ist die Gespannt-Sperre deaktiviert, damit Gehen weiterhin möglich bleibt.",
                      "For short matches up to 4 points, the Gespannt restriction is disabled so Gehen remains usable.",
                    )}
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

function PlayerBox({
  l,
  player,
  avatarId,
  seat,
  dealer,
  abheber,
  current,
  className,
  cardCount,
  team,
  teamTricks,
}: {
  l: (de: string, en: string) => string;

  player: RoomPlayer | undefined;

  avatarId: string;

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
      max-md:w-28
      max-md:max-w-28
      max-md:rounded-xl
      max-md:px-2
      max-md:py-2
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
          ● {l("Am Zug", "Turn")}
        </div>
      )}

      <div className="mx-auto h-14 w-14 overflow-hidden rounded-2xl border border-white/10 shadow-lg max-md:h-9 max-md:w-9 max-md:rounded-xl">
        <ProfileAvatar avatarId={avatarId} className="h-full w-full" />
      </div>

      <p className="mt-2 text-base font-black text-white max-md:mt-1 max-md:truncate max-md:text-xs">
        {player.display_name}
      </p>

      <div className="mt-2 flex items-center justify-center gap-2 max-md:mt-1 max-md:flex-col max-md:gap-1">
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
          {teamTricks}{" "}
          {l(
            teamTricks === 1 ? "Stich" : "Stiche",
            teamTricks === 1 ? "trick" : "tricks",
          )}
        </span>
      </div>

      <div className="mt-2 flex justify-center gap-2 text-[9px] font-bold uppercase tracking-wider">
        {seat === dealer && (
          <span className="rounded-full bg-amber-400 px-2 py-1 text-amber-950">
            {l("Geber", "Dealer")}
          </span>
        )}

        {seat === abheber && (
          <span className="rounded-full bg-emerald-400 px-2 py-1 text-emerald-950">
            {l("Abheber", "Cutter")}
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
