import { useAppLanguage } from "@/i18n/languageStore";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

import WattenCardComponent from "./WattenCard";
import CardThemeSelector from "./WattenCardGameSelector";
import TableThemeSelector from "../App/TableThemeSelector";
import { HeaderTools } from "@/components/App/PublicHeader";
import { ProfileAvatar } from "../social/ProfileAvatarPicker";
import "./wattenGameScreen.css";
import { wattenPlayAnimation, wattenTableStyle } from "@/games/watten/presentation";
import WattenTurnNotice from "./WattenTurnNotice";

import { useCardTheme } from "@/context/CardThemeContext";
import { useTableTheme } from "@/context/TableThemeContext";
import { getWattenCardImage } from "@/utils/WattenCardImages";

import {
  createDeck,
  getCriticalValue,
  getWattenCardRole,
  isCritical,
  isHauptschlag,
  isTrumpfOderKritischCard,
  mustFollowTrumpfOderKritisch,
  normalRankValue,
  WATTEN_CARD_CLIP,
  type WattenCard,
} from "../../utils/watten";
import { getWattenHelpComparison } from "@/games/watten/help";

import {
  translateWatten,
  translateWattenPair,
} from "@/games/watten/i18n/wattenLanguage";

type WattenSuit = "Herz" | "Schellen" | "Eichel" | "Gras";
type WattenRank = "7" | "8" | "9" | "10" | "Unter" | "Ober" | "König" | "Ass";
type WattenSide = "solo" | "team";

type Room = {
  id: string;
  code: string;
  host_id: string;
  status: "waiting" | "playing" | "finished";
  target_score: number;
};

type RoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  avatar_id: string;
};

type PlayedCard = {
  playerId: string;
  seat: number;
  card: WattenCard;
};

type AbhebenEvent = {
  card: WattenCard;
  critical: boolean;
  recipient_seat: number | null;
  order: number;
};

type Watten3Game = {
  room_id: string;
  phase:
    | "waiting"
    | "abheben"
    | "trump"
    | "schlag"
    | "playing"
    | "bidPending"
    | "trickReview"
    | "roundFinished"
    | "matchFinished";

  dealer: number;
  abheben_player: number;
  trump_caller: number;
  current_player: number;

  farbe: WattenSuit | null;
  schlag: WattenRank | null;

  played_cards: PlayedCard[];
  tricks_won: Record<string, number>;
  cards_remaining: Record<string, number>;

  trick_winner_seat: number | null;

  round_value: number;
  pending_bid_side: WattenSide | null;
  pending_bid_value: number | null;
  last_bid_side: WattenSide | null;

  match_scores: Record<string, number>;
  winner_side: WattenSide | null;
  match_winner_seats: number[] | null;
  round_end_reason: "tricks" | "declined" | null;

  abheben_result: AbhebenEvent[] | null;
  version: number;
};

type HandRow = {
  room_id: string;
  user_id: string;
  cards: WattenCard[];
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

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function nextSeat(seat: number) {
  return (seat + 1) % 3;
}

function previousSeat(seat: number) {
  return (seat + 2) % 3;
}

function sideForSeat(seat: number, trumpCaller: number): WattenSide {
  return seat === trumpCaller ? "solo" : "team";
}

function MiniWattenCard({ card }: { card: Pick<WattenCard, "suit" | "rank"> }) {
  const { cardTheme } = useCardTheme();
  const imageSrc = getWattenCardImage(card, cardTheme);

  return (
    <div
      onMouseEnter={playHoverSound}
      className="relative h-20 w-12 shrink-0 transition-transform duration-200 hover:z-20 hover:scale-110"
    >
      <img
        src={imageSrc}
        alt={`${card.suit} ${card.rank}`}
        draggable={false}
        style={{ clipPath: WATTEN_CARD_CLIP }}
        className="h-full w-full rounded-[6px] object-fill drop-shadow-md"
      />
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-zinc-900/75 p-5 shadow-xl shadow-black/20">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
        {title}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function PlayerAvatarRow({
  player,
  active,
  role,
  cards,
  points,
  dealer,
  cutter,
  me,
  t,
}: {
  player: RoomPlayer;
  active: boolean;
  role: WattenSide;
  cards: number;
  points: number;
  dealer: boolean;
  cutter: boolean;
  me: boolean;
  t: (key: string) => string;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 transition ${
        active
          ? "border-amber-300/50 bg-amber-400/10 shadow-lg shadow-amber-950/20"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/10">
          <ProfileAvatar
            avatarId={player.avatar_id || "m1"}
            className="h-full w-full"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-black text-white">
              {player.display_name}
            </p>
            {me && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black text-zinc-300">
                {t("You")}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                role === "solo"
                  ? "bg-amber-400/15 text-amber-300"
                  : "bg-emerald-400/15 text-emerald-300"
              }`}
            >
              {role === "solo" ? t("Solo") : t("Team")}
            </span>

            {dealer && (
              <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[9px] font-black text-sky-300">
                {t("Dealer")}
              </span>
            )}

            {cutter && (
              <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[9px] font-black text-violet-300">
                {t("Cutter")}
              </span>
            )}
          </div>
        </div>

        {active && (
          <span className="rounded-full bg-amber-300 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-amber-950 shadow-lg">
            ● {t("Turn")}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-black/20 px-2 py-2">
          <p className="text-[9px] font-bold uppercase text-zinc-600">
            {t("Cards")}
          </p>
          <p className="mt-1 font-black text-zinc-200">{cards}</p>
        </div>
        <div className="rounded-xl bg-black/20 px-2 py-2">
          <p className="text-[9px] font-bold uppercase text-zinc-600">
            {t("Points")}
          </p>
          <p className="mt-1 font-black text-zinc-200">{points}</p>
        </div>
      </div>
    </div>
  );
}

function HiddenCards({ count }: { count: number }) {
  return (
    <div className="mt-2 flex justify-center max-md:mt-1">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          onMouseEnter={playHoverSound}
          className={`relative h-12 w-8 rounded-md border border-white/20 bg-zinc-950 shadow-md max-md:h-9 max-md:w-6 ${
            index !== 0 ? "-ml-3 max-md:-ml-2" : ""
          }`}
        >
          <div className="absolute inset-1 rounded border border-emerald-400/25 bg-emerald-950" />
        </div>
      ))}
    </div>
  );
}

function DealAnimation({ playerCount }: { playerCount: 3 | 4 }) {
  const directions =
    playerCount === 3
      ? ["bottom", "left", "right"]
      : ["bottom", "left", "top", "right"];

  return (
    <div className="pointer-events-none absolute inset-0 z-[110] overflow-hidden rounded-[42px]">
      <style>{`
        @keyframes watten-deal-bottom {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(-4deg); opacity: 1; }
          100% { transform: translate(-50%, 285px) scale(.96) rotate(8deg); opacity: 0; }
        }
        @keyframes watten-deal-left {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(4deg); opacity: 1; }
          100% { transform: translate(-355px, -150px) scale(.96) rotate(-12deg); opacity: 0; }
        }
        @keyframes watten-deal-top {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(-3deg); opacity: 1; }
          100% { transform: translate(-50%, -300px) scale(.96) rotate(6deg); opacity: 0; }
        }
        @keyframes watten-deal-right {
          0% { transform: translate(-50%, -50%) scale(.88) rotate(-4deg); opacity: 1; }
          100% { transform: translate(305px, -150px) scale(.96) rotate(12deg); opacity: 0; }
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
              animation: `watten-deal-${direction} 650ms cubic-bezier(.18,.75,.25,1) ${index * 100}ms both`,
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
        className={`group relative mx-auto block h-28 w-24 transition ${
          canDeal
            ? "cursor-pointer hover:-translate-y-2 hover:scale-105"
            : "cursor-default"
        }`}
      >
        {[0, 1, 2, 3].map((layer) => (
          <span
            key={layer}
            className="absolute left-1/2 top-1/2 h-24 w-16 rounded-[8px] border border-amber-200/35 bg-zinc-950 shadow-xl"
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

function OpponentBox({
  player,
  avatarId,
  cards,
  tricks,
  role,
  active,
  t,
}: {
  player: RoomPlayer | undefined;
  avatarId: string;
  cards: number;
  tricks: number;
  role: WattenSide;
  active: boolean;
  t: (key: string) => string;
}) {
  if (!player) return null;

  return (
    <div
      className={`w-52 rounded-2xl border p-3 text-center shadow-xl backdrop-blur max-md:w-40 max-md:p-2 ${
        active
          ? "border-amber-300/50 bg-amber-950/75"
          : "border-white/10 bg-emerald-950/65"
      }`}
    >
      <div className="mx-auto h-12 w-12 overflow-hidden rounded-2xl border border-white/10 max-md:h-9 max-md:w-9 max-md:rounded-xl">
        <ProfileAvatar avatarId={avatarId} className="h-full w-full" />
      </div>

      <p className="mt-2 truncate font-black text-white max-md:mt-1 max-md:text-xs">
        {player.display_name}
      </p>

      <span
        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
          role === "solo"
            ? "bg-amber-400/15 text-amber-300"
            : "bg-emerald-400/15 text-emerald-300"
        }`}
      >
        {role === "solo" ? t("Solo") : t("Team")}
      </span>

      <p className="mt-1 text-[10px] text-zinc-300 max-md:text-[9px]">
        {cards} {t("Cards")} · {tricks} {t("Tricks")}
      </p>

      <HiddenCards count={cards} />
    </div>
  );
}

export function WattenThreePlayerMultiplayerLobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const { language } = useAppLanguage();
  const [joinCode, setJoinCode] = useState("");
  const [targetScore, setTargetScore] = useState(15);
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );

  const displayName = useMemo(() => {
    const username =
      typeof profile?.username === "string" ? profile.username.trim() : "";
    return username || user?.email?.split("@")[0]?.trim() || "Player";
  }, [profile?.username, user?.email]);

  const avatarId =
    (profile as { avatar_id?: string | null } | null)?.avatar_id ?? "m1";


  async function createRoom() {
    if (!user) {
      setError(t("Sign in required"));
      return;
    }

    setLoading("create");
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      "create_watten3_room",
      {
        p_display_name: displayName,
        p_avatar_id: avatarId,
        p_target_score: targetScore,
      },
    );

    setLoading(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(`/games/watten/multiplayer/3/${String(data)}`);
  }

  async function joinRoom() {
    if (!user) {
      setError(t("Sign in required"));
      return;
    }

    const code = normalizeCode(joinCode);

    if (code.length !== 6) {
      setError("Enter the 6-character room code.");
      return;
    }

    setLoading("join");
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("join_watten3_room", {
      p_code: code,
      p_display_name: displayName,
      p_avatar_id: avatarId,
    });

    setLoading(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(`/games/watten/multiplayer/3/${String(data ?? code)}`);
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 rounded-[30px] border border-emerald-300/15 bg-zinc-950/65 p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300">
                {t("Bavarian Watten")}
              </p>
              <h1 className="mt-1 text-3xl font-black">
                {t("3 Player Multiplayer")}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                {t("Three players. One plays solo, the other two form a team.")}
              </p>
            </div>

          </div>
        </header>

        {!user ? (
          <Panel title={t("Sign in required")}>
            <p className="text-sm text-zinc-400">
              {t("Multiplayer uses your Supabase account.")}
            </p>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title={t("Create room")}
              subtitle={t("Game starts automatically.")}
            >
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="h-14 w-14 overflow-hidden rounded-2xl">
                  <ProfileAvatar
                    avatarId={avatarId}
                    className="h-full w-full"
                  />
                </div>
                <div>
                  <p className="font-black text-white">{displayName}</p>
                </div>
              </div>

              <p className="mt-5 text-xs font-black uppercase tracking-wider text-zinc-500">
                {t("Target score")}
              </p>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {[11, 15, 18].map((score) => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setTargetScore(score)}
                    className={`rounded-xl px-4 py-3 font-black transition ${
                      targetScore === score
                        ? "bg-amber-300 text-amber-950"
                        : "border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>

              <label className="mt-3 block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                {t("Custom")} · 2–30
              </label>
              <input
                type="number"
                min={2}
                max={30}
                value={targetScore}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    setTargetScore(
                      Math.max(2, Math.min(30, Math.trunc(value))),
                    );
                  }
                }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-lg font-black outline-none transition focus:border-amber-300/50"
              />

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-amber-950 transition hover:bg-amber-200 disabled:opacity-40"
              >
                {loading === "create" ? "..." : t("Create 3-player room")}
              </button>
            </Panel>

            <Panel title={t("Join room")}>
              <label className="text-xs font-black uppercase tracking-wider text-zinc-500">
                {t("Room code")}
              </label>

              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeCode(event.target.value))
                }
                placeholder="ABC123"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-center font-mono text-2xl font-black tracking-[0.22em] outline-none transition focus:border-amber-300/50"
              />

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-5 w-full rounded-xl bg-emerald-300 px-5 py-3 font-black text-emerald-950 transition hover:bg-emerald-200 disabled:opacity-40"
              >
                {loading === "join" ? "..." : t("Join 3-player room")}
              </button>
            </Panel>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-200">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}

export function WattenThreePlayerMultiplayerGame() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const { tableTheme } = useTableTheme();

  const { language } = useAppLanguage();

  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [game, setGame] = useState<Watten3Game | null>(null);
  const [hand, setHand] = useState<WattenCard[]>([]);
  const [mySeat, setMySeat] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [helpMode, setHelpMode] = useState(false);
  const [showRankingHelp, setShowRankingHelp] = useState(false);
  const [waitingTargetScore, setWaitingTargetScore] = useState(15);
  const [startingGame, setStartingGame] = useState(false);
  // Polling/realtime reloads the room while we are waiting. Initialize the
  // host's editable target score only once for this room, otherwise every
  // refresh would overwrite a temporary 11/18/custom selection with the
  // database value (normally 15 before Start Game is pressed).
  const waitingTargetInitializedForRoomRef = useRef<string | null>(null);

  const [selectedCutIndex, setSelectedCutIndex] = useState<number | null>(null);
  const [abhebenPreview, setAbhebenPreview] = useState<AbhebenEvent[]>([]);
  const [visibleAbhebenCount, setVisibleAbhebenCount] = useState(0);
  const [showAbhebenPreview, setShowAbhebenPreview] = useState(false);
  const [abhebenRevealDone, setAbhebenRevealDone] = useState(false);
  const [dealReady, setDealReady] = useState(false);
  const [dealCompletedKey, setDealCompletedKey] = useState<string | null>(null);
  const [dealAnimating, setDealAnimating] = useState(false);

  const lastVersionRef = useRef<number | null>(null);
  const shownAbhebenResultRef = useRef<string | null>(null);
  const dealChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const dealAnimatingRef = useRef(false);
  const dealCloseTimerRef = useRef<number | null>(null);

  const t = useCallback(
    (key: string) => translateWatten(language, key),
    [language],
  );

  const l = useCallback(
    (de: string, en: string) => translateWattenPair(language, de, en),
    [language],
  );

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
      setVisibleAbhebenCount(0);
      dealCloseTimerRef.current = null;
    }, 2750);
  }, []);


  const loadAll = useCallback(async () => {
    if (!roomCode || !user) return;

    const { data: roomData, error: roomError } = await supabase
      .from("watten3_rooms")
      .select("id, code, host_id, status, target_score")
      .eq("code", roomCode.toUpperCase())
      .maybeSingle();

    if (roomError || !roomData) {
      setError(roomError?.message ?? "Room not found.");
      setLoading(false);
      return;
    }

    const loadedRoom = roomData as Room;

    const [
      { data: playerData, error: playerError },
      { data: gameData, error: gameError },
    ] = await Promise.all([
      supabase
        .from("watten3_room_players")
        .select("room_id, user_id, seat, display_name, avatar_id")
        .eq("room_id", loadedRoom.id)
        .order("seat", { ascending: true }),

      supabase
        .from("watten3_games")
        .select(
          `
              room_id,
              phase,
              dealer,
              abheben_player,
              trump_caller,
              current_player,
              farbe,
              schlag,
              played_cards,
              tricks_won,
              cards_remaining,
              trick_winner_seat,
              round_value,
              pending_bid_side,
              pending_bid_value,
              last_bid_side,
              match_scores,
              winner_side,
              match_winner_seats,
              round_end_reason,
              abheben_result,
              version
            `,
        )
        .eq("room_id", loadedRoom.id)
        .maybeSingle(),
    ]);

    if (playerError || gameError || !gameData) {
      setError(
        playerError?.message ?? gameError?.message ?? "Could not load game.",
      );
      setLoading(false);
      return;
    }

    const loadedPlayers = (playerData ?? []) as RoomPlayer[];
    const me = loadedPlayers.find((player) => player.user_id === user.id);

    if (!me) {
      setError(t("You are not a player in this room."));
      setLoading(false);
      return;
    }

    const { data: handData } = await supabase
      .from("watten3_hands")
      .select("room_id, user_id, cards")
      .eq("room_id", loadedRoom.id)
      .eq("user_id", user.id)
      .maybeSingle();

    setRoom(loadedRoom);
    if (
      (loadedRoom.status === "waiting" ||
        (gameData as Watten3Game).phase === "waiting") &&
      waitingTargetInitializedForRoomRef.current !== loadedRoom.id
    ) {
      setWaitingTargetScore(
        Math.max(2, Math.min(30, Number(loadedRoom.target_score ?? 15))),
      );
      waitingTargetInitializedForRoomRef.current = loadedRoom.id;
    }
    setPlayers(loadedPlayers);
    setMySeat(me.seat);
    setGame(gameData as Watten3Game);
    setHand(((handData as HandRow | null)?.cards ?? []) as WattenCard[]);
    lastVersionRef.current = Number((gameData as Watten3Game).version);
    setLoading(false);
  }, [roomCode, user, t]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!room || !user) return;

    const channel = supabase
      .channel(`watten3:${room.id}:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "watten3_games",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const next = payload.new as Watten3Game;
          lastVersionRef.current = Number(next.version);
          setGame(next);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "watten3_rooms",
          filter: `id=eq.${room.id}`,
        },
        () => void loadAll(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watten3_room_players",
          filter: `room_id=eq.${room.id}`,
        },
        () => void loadAll(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "watten3_hands",
          filter: `user_id=eq.${user.id}`,
        },
        () => void loadAll(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room, user, loadAll]);

  useEffect(() => {
    if (!room) return;

    const timer = window.setInterval(() => {
      if (!actionLoading) {
        void loadAll();
      }
    }, 1800);

    return () => window.clearInterval(timer);
  }, [room, actionLoading, loadAll]);

  // Use a serialized primitive as the dependency. Polling reloads the JSON array
  // as a new object even when its contents did not change.
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

    if (shownAbhebenResultRef.current === abhebenResultKey) return;

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

    const revealDuration = Math.max(1900, events.length * perCardDelay + 700);

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

    const channel = supabase.channel(`watten3-deal-${room.id}`);
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

  async function startThreePlayerGame() {
    if (!room || !user || startingGame) return;
    if (room.host_id !== user.id) return;

    if (players.length !== 3) {
      setActionError(
        l(
          "Es müssen genau 3 Spieler im Raum sein.",
          "There must be exactly 3 players in the room.",
        ),
      );
      return;
    }

    const target = Math.max(
      2,
      Math.min(30, Math.trunc(waitingTargetScore || 15)),
    );

    setWaitingTargetScore(target);
    setStartingGame(true);
    setActionError(null);

    const { error: startError } = await supabase.rpc("start_watten3_game", {
      p_room_id: room.id,
      p_target_score: target,
    });

    setStartingGame(false);

    if (startError) {
      console.error("Could not start 3-player Watten:", startError);
      setActionError(
        startError.message ??
          l(
            "Das 3-Spieler-Spiel konnte nicht gestartet werden.",
            "The 3-player game could not be started.",
          ),
      );
      return;
    }

    await loadAll();
  }

  async function copyRoomCode() {
    if (!room?.code || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setActionError(t("Could not copy room code."));
    }
  }

  async function runRpc(name: string, args: Record<string, unknown>) {
    setActionLoading(name);
    setActionError(null);

    const { error: rpcError } = await supabase.rpc(name, args);

    setActionLoading(null);

    if (rpcError) {
      setActionError(rpcError.message);
      return false;
    }

    await loadAll();
    return true;
  }

  async function performCut(cutIndex: number) {
    if (!room || actionLoading !== null) return;

    setSelectedCutIndex(cutIndex);

    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 260);
    });

    await runRpc("perform_watten3_abheben", {
      p_room_id: room.id,
      p_cut_index: cutIndex,
    });

    window.setTimeout(() => {
      setSelectedCutIndex(null);
    }, 700);
  }

  async function chooseFarbe(farbe: WattenSuit) {
    if (!room) return;
    await runRpc("choose_watten3_farbe", {
      p_room_id: room.id,
      p_farbe: farbe,
    });
  }

  async function chooseSchlag(schlag: WattenRank) {
    if (!room) return;
    await runRpc("choose_watten3_schlag", {
      p_room_id: room.id,
      p_schlag: schlag,
    });
  }

  async function playCard(card: WattenCard) {
    if (!room || !game || mySeat === null) return;

    const mustFollow =
      game.farbe && game.schlag
        ? mustFollowTrumpfOderKritisch(
            hand,
            game.played_cards,
            game.tricks_won,
            game.farbe,
            game.schlag,
          )
        : false;

    if (
      mustFollow &&
      game.farbe &&
      !isTrumpfOderKritischCard(card, game.farbe)
    ) {
      setActionError(t("You must play trump or a critical card."));
      return;
    }

    const ok = await runRpc("play_watten3_card", {
      p_room_id: room.id,
      p_card_id: card.id,
    });

    if (ok) playCardSound();
  }

  async function continueTrick() {
    if (!room) return;
    await runRpc("continue_watten3_trick", {
      p_room_id: room.id,
    });
  }

  async function raiseBid() {
    if (!room) return;
    await runRpc("raise_watten3_bid", {
      p_room_id: room.id,
    });
  }

  async function respondBid(hold: boolean) {
    if (!room) return;
    await runRpc("respond_watten3_bid", {
      p_room_id: room.id,
      p_hold: hold,
    });
  }

  async function nextRound() {
    if (!room) return;
    await runRpc("start_next_watten3_round", {
      p_room_id: room.id,
    });
  }

  function cardCount(seat: number) {
    return Number(game?.cards_remaining?.[String(seat)] ?? 0);
  }

  function trickCount(seat: number) {
    return Number(game?.tricks_won?.[String(seat)] ?? 0);
  }

  function scoreForSeat(seat: number) {
    return Number(game?.match_scores?.[String(seat)] ?? 0);
  }

  function priorityGroups() {
    if (!game?.farbe || !game?.schlag) return [];

    const fullDeck = createDeck();

    const sortByRank = (a: WattenCard, b: WattenCard) =>
      (normalRankValue[b.rank] ?? 0) - (normalRankValue[a.rank] ?? 0);

    const critical = fullDeck
      .filter((card) => isCritical(card))
      .sort((a, b) => getCriticalValue(b) - getCriticalValue(a));

    const main = fullDeck.filter((card) =>
      isHauptschlag(card, game.farbe, game.schlag),
    );

    const schlag = fullDeck.filter(
      (card) =>
        card.rank === game.schlag &&
        !isCritical(card) &&
        !isHauptschlag(card, game.farbe, game.schlag),
    );

    const trump = fullDeck
      .filter(
        (card) =>
          card.suit === game.farbe &&
          card.rank !== game.schlag &&
          !isCritical(card),
      )
      .sort(sortByRank);

    const used = new Set(
      [...critical, ...main, ...schlag, ...trump].map((card) => card.id),
    );

    const normal = fullDeck
      .filter((card) => !used.has(card.id))
      .sort(sortByRank);

    return [
      { title: t("Critical cards"), cards: critical },
      { title: t("Main Schlag"), cards: main },
      { title: t("Other Schlag cards"), cards: schlag },
      { title: t("Trump cards"), cards: trump },
      { title: t("Normal cards"), cards: normal },
    ];
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
        <Panel title={t("Sign in required")}>
          <p className="text-sm text-zinc-400">
            {t("Multiplayer uses your Supabase account.")}
          </p>
        </Panel>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-4 text-white">
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

  if (loading || !room || !game || mySeat === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent text-white">
        <p>{t("Game is loading...")}</p>
      </main>
    );
  }

  const me = players.find((player) => player.seat === mySeat);
  const leftSeat = nextSeat(mySeat);
  const rightSeat = previousSeat(mySeat);
  const leftPlayer = players.find((player) => player.seat === leftSeat);
  const rightPlayer = players.find((player) => player.seat === rightSeat);
  const currentPlayer = players.find(
    (player) => player.seat === game.current_player,
  );

  const soloPlayer = players.find(
    (player) => player.seat === game.trump_caller,
  );
  const teamPlayers = players.filter(
    (player) => player.seat !== game.trump_caller,
  );

  const soloTricks = trickCount(game.trump_caller);
  const teamTricks = teamPlayers.reduce(
    (sum, player) => sum + trickCount(player.seat),
    0,
  );

  const soloScore = scoreForSeat(game.trump_caller);
  const teamScore = Math.max(
    0,
    ...teamPlayers.map((player) => scoreForSeat(player.seat)),
  );

  // 3-player rule: the solo player is also the Abheber.
  const abheberSeat = game.trump_caller;

  const mySide = sideForSeat(mySeat, game.trump_caller);
  const currentSide = sideForSeat(game.current_player, game.trump_caller);

  const mySideScores =
    mySide === "solo"
      ? [scoreForSeat(game.trump_caller)]
      : teamPlayers.map((player) => scoreForSeat(player.seat));

  // Gespannt normally means a side may not raise when it is within two
  // points of the match target. For very short 2–4 point matches that would
  // suppress Gehen almost immediately (target 2 even blocks it at 0–0), so
  // keep Gespannt disabled for those quick/test match lengths.
  const gespanntRuleActive = room.target_score >= 5;

  const mySideGespannt =
    gespanntRuleActive &&
    mySideScores.some(
      (score) => score >= room.target_score - 2 && score < room.target_score,
    );

  const canRaise =
    game.phase === "playing" &&
    game.current_player === mySeat &&
    game.pending_bid_side === null &&
    game.round_value < 4 &&
    game.last_bid_side !== mySide &&
    !mySideGespannt &&
    actionLoading === null;

  const canRespond =
    game.phase === "bidPending" &&
    game.pending_bid_side !== null &&
    game.pending_bid_side !== mySide &&
    actionLoading === null;

  const mustFollow =
    game.phase === "playing" && game.farbe && game.schlag
      ? mustFollowTrumpfOderKritisch(
          hand,
          game.played_cards,
          game.tricks_won,
          game.farbe,
          game.schlag,
        )
      : false;

  const matchWinnerNames =
    game.match_winner_seats
      ?.map(
        (seat) => players.find((player) => player.seat === seat)?.display_name,
      )
      .filter(Boolean)
      .join(" & ") ?? "";

  return (
    <main className="watten-game-screen min-h-screen bg-transparent px-4 py-5 text-white md:px-6 max-md:px-2 max-md:py-3">
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
          <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
            <div className="w-full max-w-3xl rounded-3xl border border-violet-300/20 bg-zinc-950 p-8 text-center shadow-2xl max-md:max-w-[94vw] max-md:p-4">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-violet-300">
                {t("Abheben")}
              </p>
              <h2 className="mt-2 text-2xl font-black">{t("Cut result")}</h2>

              <div className="mt-7 flex min-h-40 flex-wrap items-start justify-center gap-6">
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
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <div onMouseEnter={playHoverSound}>
                          <WattenCardComponent card={event.card} />
                        </div>
                        <p className="mt-2 text-xs font-black text-white">
                          {event.critical
                            ? recipient
                              ? `${t("Critical card")} → ${recipient.display_name}`
                              : t("Critical card")
                            : t("Normal card")}
                        </p>
                      </div>
                    );
                  })}
              </div>

              {visibleAbhebenCount < abhebenPreview.length ? (
                <p className="mt-4 animate-pulse text-sm font-black text-amber-300">
                  {t("Next card")}...
                </p>
              ) : (
                <p className="mt-4 text-xs font-bold text-zinc-500">
                  {l(
                    "Die Karte bleibt kurz sichtbar. Danach liegt der Stapel wieder auf dem Tisch.",
                    "The card stays visible briefly. Then the deck returns to the table.",
                  )}
                </p>
              )}
            </div>
          </div>
        )}

      <div className="watten-game-content mx-auto w-full max-w-[1780px]">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-4 max-md:mb-3 max-md:gap-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
              {t("Bavarian Watten")}
            </p>
            <h1 className="mt-1 text-2xl font-black max-md:text-xl">
              {t("3 Player Multiplayer")}
            </h1>
            <p className="mt-1 text-xs text-emerald-300/70">
              {t("Room code")}:{" "}
              <span className="font-mono font-black">{room.code}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 max-md:w-full max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:pb-1">
            <button
              type="button"
              onClick={() => setHelpMode((value) => !value)}
              className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                helpMode
                  ? "bg-amber-300 text-amber-950"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              💡 {t(helpMode ? "Help On" : "Help")}
            </button>

            <HeaderTools><CardThemeSelector /><TableThemeSelector /></HeaderTools>


            <Link
              to="/games/watten/multiplayer"
              className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-white/20"
            >
              {t("Leave")}
            </Link>
          </div>
        </header>

        <WattenTurnNotice player={me?.display_name ?? t("You")} active={game.phase === "playing" && game.current_player === mySeat && mustFollow} mustFollow={mustFollow} />
        <div className="watten-game-grid grid grid-cols-1 gap-4 xl:grid-cols-[270px_minmax(0,1fr)_270px] max-md:gap-3">
          {/* PLAYERS SIDEBAR */}
          <aside className="max-md:order-2">
            <Panel title={t("Players")} subtitle="1 vs 2">
              <div className="space-y-3">
                {players.map((player) => (
                  <PlayerAvatarRow
                    key={player.user_id}
                    player={player}
                    active={player.seat === game.current_player}
                    role={sideForSeat(player.seat, game.trump_caller)}
                    cards={cardCount(player.seat)}
                    points={scoreForSeat(player.seat)}
                    dealer={player.seat === game.dealer}
                    cutter={player.seat === abheberSeat}
                    me={player.user_id === user.id}
                    t={t}
                  />
                ))}
              </div>
            </Panel>

            <div className="mt-4 rounded-[28px] border border-white/10 bg-zinc-900/75 p-5 shadow-xl shadow-black/20">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                {t("Score")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t("Target score")}: {room.target_score}
              </p>

              <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                      {t("Solo")}
                    </p>
                    <p className="mt-1 truncate text-sm font-black">
                      {soloPlayer?.display_name ?? "—"}
                    </p>
                  </div>
                  <p className="text-3xl font-black text-amber-300">
                    {soloScore}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-300 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (soloScore / room.target_score) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="my-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[9px] font-black text-zinc-600">VS</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                      {t("Team")}
                    </p>
                    <p className="mt-1 truncate text-xs font-black">
                      {teamPlayers
                        .map((player) => player.display_name)
                        .join(" & ")}
                    </p>
                  </div>
                  <p className="text-3xl font-black text-emerald-300">
                    {teamScore}
                  </p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-emerald-300 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        (teamScore / room.target_score) * 100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </aside>

          {/* TABLE */}
          <section
            className="watten-table relative min-h-[690px] overflow-hidden rounded-[42px] border border-white/10 shadow-2xl max-md:order-1 max-md:min-h-[560px] max-md:rounded-[28px]"
            style={wattenTableStyle(tableTheme)}
          >
            {dealAnimating && <DealAnimation playerCount={3} />}

            {waitingForDeal && dealReady && !dealAnimating && (
              <div className="absolute left-1/2 top-[46%] z-[95] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-black/45 px-7 py-5 shadow-2xl backdrop-blur-sm">
                <DealDeckControl
                  canDeal={mySeat === game.dealer}
                  onDeal={() => void distributeCards()}
                  l={l}
                />
              </div>
            )}

            {(room.status === "waiting" || game.phase === "waiting") && (
              <div className="absolute inset-0 z-[120] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-[3px]">
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
                      {players.length}/3{" "}
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

                  {room.host_id === user.id && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-xl">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                            {l("Siegpunkte", "Points to win")}
                          </p>
                          <p className="mt-1 text-[10px] text-zinc-600">
                            {l(
                              "Vor dem Start festlegen.",
                              "Choose before starting.",
                            )}
                          </p>
                        </div>
                        <span className="rounded-lg bg-amber-300/10 px-3 py-1 text-sm font-black text-amber-300">
                          {waitingTargetScore}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {[11, 15, 18].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setWaitingTargetScore(score)}
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
                            "Eigene Siegpunktzahl",
                            "Custom target score",
                          )}
                          type="number"
                          min={2}
                          max={30}
                          value={waitingTargetScore}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value)) {
                              setWaitingTargetScore(
                                Math.max(2, Math.min(30, Math.trunc(value))),
                              );
                            }
                          }}
                          className="w-20 rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-center text-sm font-black outline-none transition focus:border-amber-300/50"
                        />
                      </div>

                      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                          {l("Gehen-Regel", "Gehen rule")}
                        </span>
                        <span className="font-mono text-sm font-black text-emerald-300">
                          2 → 3 → 4
                        </span>
                      </div>
                    </div>
                  )}

                  {room.host_id === user.id ? (
                    <button
                      type="button"
                      disabled={players.length !== 3 || startingGame}
                      onClick={() => void startThreePlayerGame()}
                      className="mt-3 w-full rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {startingGame
                        ? l("Spiel wird gestartet...", "Game is starting...")
                        : players.length === 3
                          ? l("Spiel starten", "Start game")
                          : l(
                              `Warte auf ${3 - players.length} ${
                                3 - players.length === 1
                                  ? "weiteren Spieler"
                                  : "weitere Spieler"
                              }`,
                              `Waiting for ${3 - players.length} more ${
                                3 - players.length === 1 ? "player" : "players"
                              }`,
                            )}
                    </button>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-zinc-950/85 px-5 py-4 text-center">
                      <p className="text-sm font-black text-zinc-300">
                        {players.length === 3
                          ? l("Alle Spieler sind da.", "All players are here.")
                          : l(
                              "Warte auf weitere Spieler...",
                              "Waiting for more players...",
                            )}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        {l(
                          "Der Gastgeber wählt die Siegpunkte und startet die Partie.",
                          "The host chooses the target score and starts the game.",
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STATUS */}
            <div className="absolute left-1/2 top-5 z-30 -translate-x-1/2 rounded-2xl border border-white/10 bg-emerald-950/80 px-5 py-3 shadow-xl backdrop-blur max-md:left-2 max-md:right-2 max-md:top-2 max-md:translate-x-0 max-md:px-2 max-md:py-2">
              <div className="flex items-center gap-7 max-md:grid max-md:grid-cols-4 max-md:gap-1">
                <div className="text-center">
                  <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">
                    {t("Trump")}
                  </p>
                  {game.farbe ? (
                    <div className="mt-1 flex items-center gap-2">
                      <img
                        src={suitIcons[game.farbe]}
                        alt={game.farbe}
                        className="h-7 w-7 object-contain"
                      />
                      <span className="text-sm font-black">{game.farbe}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500">—</span>
                  )}
                </div>

                <div className="h-8 w-px bg-white/10 max-md:hidden" />

                <div className="text-center">
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                    {t("Schlag")}
                  </p>
                  <p className="mt-1 font-black">{game.schlag ?? "—"}</p>
                </div>

                <div className="h-8 w-px bg-white/10" />

                <div className="text-center">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">
                    {t("Round value")}
                  </p>
                  <p className="mt-1 font-black text-amber-300">
                    {game.round_value}
                  </p>
                </div>

                <div className="h-8 w-px bg-white/10" />

                <div className="min-w-28 text-center max-md:min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-wider text-amber-300">
                    {t("Turn")}
                  </p>
                  <p className="mt-1 truncate text-xs font-black text-white">
                    {currentPlayer?.display_name ?? "—"}
                  </p>
                  {game.phase === "abheben" && (
                    <p className="mt-0.5 text-[9px] font-black uppercase text-violet-300">
                      {t("Cutter")}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* OPPONENTS */}
            <div className="absolute left-8 top-24 z-20 max-md:left-1 max-md:top-[82px] max-md:origin-top-left max-md:scale-[0.72]">
              <OpponentBox
                player={leftPlayer}
                avatarId={leftPlayer?.avatar_id ?? "m1"}
                cards={waitingForDeal ? 0 : cardCount(leftSeat)}
                tricks={trickCount(leftSeat)}
                role={sideForSeat(leftSeat, game.trump_caller)}
                active={game.current_player === leftSeat}
                t={t}
              />
            </div>

            <div className="absolute right-8 top-24 z-20 max-md:right-1 max-md:top-[82px] max-md:origin-top-right max-md:scale-[0.72]">
              <OpponentBox
                player={rightPlayer}
                avatarId={rightPlayer?.avatar_id ?? "f1"}
                cards={waitingForDeal ? 0 : cardCount(rightSeat)}
                tricks={trickCount(rightSeat)}
                role={sideForSeat(rightSeat, game.trump_caller)}
                active={game.current_player === rightSeat}
                t={t}
              />
            </div>

            {/* CURRENT TRICK */}
            <div className="absolute left-1/2 top-[45%] z-20 flex min-h-48 w-[460px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-4 rounded-3xl border border-white/10 bg-emerald-950/30 p-4 shadow-inner max-md:min-h-36 max-md:w-[calc(100%-1rem)] max-md:gap-0 max-md:p-2">
              {game.played_cards.length === 0 ? (
                <p className="text-sm font-bold text-emerald-200/40">
                  {t("Game table")}
                </p>
              ) : (
                game.played_cards.map((played) => {
                  const player = players.find(
                    (candidate) => candidate.seat === played.seat,
                  );

                  return (
                    <div
                      key={`${played.seat}-${played.card.id}`}
                      onMouseEnter={playHoverSound}
                      className={`watten-played-card flex flex-col items-center gap-2 ${wattenPlayAnimation(played.seat, mySeat, 3)}`}
                    >
                      <WattenCardComponent card={played.card} disabled />
                      <span className="max-w-28 truncate text-[10px] font-bold text-emerald-100">
                        {player?.display_name}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* ABHEBEN */}
            {game.phase === "abheben" && players.length === 3 && (
              <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/55 p-6 backdrop-blur-sm">
                <div className="w-full max-w-4xl rounded-3xl border border-violet-300/20 bg-zinc-950/95 p-7 text-center shadow-2xl max-md:max-w-[94vw] max-md:p-4">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                    {t("Abheben")}
                  </p>

                  <h2 className="mt-2 text-2xl font-black">
                    {abheberSeat === mySeat
                      ? t("You are cutting the deck.")
                      : t("Waiting for the cutter.")}
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    {soloPlayer?.display_name} · {t("Solo")} · {t("Cutter")}
                  </p>

                  {abheberSeat === mySeat && (
                    <>
                      <p className="mt-6 text-xs font-black uppercase tracking-wider text-zinc-500">
                        {t("Choose a cut position")}
                      </p>

                      <p className="mt-1 text-[10px] text-zinc-600">
                        {l(
                          "31 mögliche Abhebestellen · die letzte Karte ist sichtbar, aber gesperrt.",
                          "31 possible cut positions · the final card is visible but disabled.",
                        )}
                      </p>

                      <div
                        className="mx-auto mt-5 grid max-w-3xl gap-y-3 px-4"
                        style={{
                          gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
                        }}
                      >
                        {Array.from({ length: 32 }, (_, index) => {
                          const cutIndex = index + 1;
                          const cannotCut = cutIndex === 32;
                          const selected = selectedCutIndex === cutIndex;

                          return (
                            <button
                              key={cutIndex}
                              type="button"
                              onMouseEnter={playHoverSound}
                              disabled={cannotCut || actionLoading !== null}
                              onClick={() => void performCut(cutIndex)}
                              className={`relative h-20 w-12 rounded-[7px] border bg-zinc-950 shadow-lg transition-all duration-300 ${
                                index !== 0 && index !== 16 ? "-ml-5" : ""
                              } ${
                                cannotCut
                                  ? "cursor-not-allowed border-red-400/20 opacity-35"
                                  : selected
                                    ? "z-40 -translate-y-5 scale-110 border-amber-300 ring-2 ring-amber-300/40"
                                    : "border-amber-100/20 hover:z-30 hover:-translate-y-3 hover:scale-110 hover:border-amber-300"
                              }`}
                              title={
                                cannotCut
                                  ? "Letzte Karte – hier kann nicht abgehoben werden"
                                  : `Abheben nach Karte ${cutIndex}`
                              }
                            >
                              <span className="absolute inset-[3px] rounded-[5px] border border-emerald-300/30 bg-emerald-950">
                                <span className="absolute inset-1 rounded-[3px] border border-amber-300/15" />
                              </span>

                              {cannotCut && (
                                <span className="absolute inset-0 z-10 flex items-center justify-center rounded-[7px] bg-black/45 text-lg">
                                  🔒
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {actionLoading === "perform_watten3_abheben" && (
                        <p className="mt-5 animate-pulse text-sm font-black text-amber-300">
                          {t("Abheben")}...
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* CHOOSE TRUMP */}
            {!waitingForDeal &&
              game.phase === "trump" &&
              game.trump_caller === mySeat && (
                <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-7 text-center max-md:max-w-[94vw] max-md:p-4">
                    <h2 className="text-2xl font-black">{t("Choose trump")}</h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      {t("Choose the trump suit.")}
                    </p>

                    {/* YOUR CARDS */}
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                        {t("Your cards")}
                      </p>

                      <div className="pointer-events-none flex justify-center gap-2 overflow-x-auto pb-2">
                        {hand.length > 0 ? (
                          hand.map((card) => (
                            <div key={card.id} onMouseEnter={playHoverSound}>
                              <WattenCardComponent card={card} disabled />
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/15 px-6 py-4 text-sm text-zinc-600">
                            {t("No cards available.")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-7 grid grid-cols-2 gap-3">
                      {(["Herz", "Schellen", "Eichel", "Gras"] as const).map(
                        (suit) => (
                          <button
                            key={suit}
                            type="button"
                            disabled={actionLoading !== null}
                            onClick={() => void chooseFarbe(suit)}
                            className="rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-emerald-300/40 hover:bg-emerald-400/10"
                          >
                            <img
                              src={suitIcons[suit]}
                              alt={suit}
                              className="mx-auto h-14 w-14 object-contain"
                            />
                            <p className="mt-2 font-black">{suit}</p>
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* CHOOSE SCHLAG */}
            {!waitingForDeal &&
              game.phase === "schlag" &&
              game.trump_caller === mySeat && (
                <div className="absolute inset-0 z-[80] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 p-7 text-center">
                    <h2 className="text-2xl font-black">{t("Choose rank")}</h2>
                    <p className="mt-2 text-sm text-zinc-500">
                      {t("Choose the Schlag rank.")}
                    </p>

                    {/* YOUR CARDS */}
                    <div className="mt-6">
                      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                        {t("Your cards")}
                      </p>

                      <div className="pointer-events-none flex justify-center gap-2 overflow-x-auto pb-2">
                        {hand.length > 0 ? (
                          hand.map((card) => (
                            <div key={card.id} onMouseEnter={playHoverSound}>
                              <WattenCardComponent card={card} disabled />
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-white/15 px-6 py-4 text-sm text-zinc-600">
                            {t("No cards available.")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-7 grid grid-cols-4 gap-3 md:grid-cols-8">
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
                        ] as const
                      ).map((rank) => (
                        <button
                          key={rank}
                          type="button"
                          disabled={actionLoading !== null}
                          onClick={() => void chooseSchlag(rank)}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-sm font-black transition hover:border-amber-300/40 hover:bg-amber-400/10"
                        >
                          {rank}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            {/* OTHER PLAYERS WAIT DURING TRUMP / SCHLAG */}
            {!waitingForDeal &&
              (game.phase === "trump" || game.phase === "schlag") &&
              game.trump_caller !== mySeat && (
                <div className="absolute left-1/2 top-[55%] z-30 -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950/85 px-6 py-4 text-center shadow-xl">
                  <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                    {t("Waiting")}
                  </p>
                  <p className="mt-1 font-black">{soloPlayer?.display_name}</p>
                </div>
              )}

            {/* GEHEN DECISION */}
            {game.phase === "bidPending" &&
              game.pending_bid_side &&
              game.pending_bid_value !== null && (
                <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-7 text-center shadow-2xl max-md:max-w-[94vw] max-md:p-4">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                      {l("Gehen", "Raise")}
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      {game.pending_bid_side === "solo"
                        ? soloPlayer?.display_name
                        : teamPlayers
                            .map((player) => player.display_name)
                            .join(" & ")}
                    </h2>

                    <p className="mt-2 text-sm text-zinc-400">
                      {l("geht auf", "raises to")}
                    </p>
                    <p className="mt-1 text-5xl font-black text-amber-300">
                      {game.pending_bid_value}
                    </p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">
                      {t("Points")}
                    </p>

                    <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
                      <div className="flex items-center justify-between gap-3">
                        <span>
                          {l("Aktueller Rundenwert", "Current round value")}
                        </span>
                        <strong className="text-amber-300">
                          {game.round_value}
                        </strong>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span>{l("Bei Halten", "If held")}</span>
                        <strong className="text-emerald-300">
                          {game.pending_bid_value}
                        </strong>
                      </div>
                    </div>

                    {canRespond ? (
                      <>
                        <p className="mt-5 text-sm font-bold text-emerald-300">
                          {l(
                            "Deine Seite muss entscheiden.",
                            "Your side must decide.",
                          )}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={actionLoading !== null}
                            onClick={() => void respondBid(false)}
                            className="rounded-xl bg-red-500/15 px-4 py-3 font-black text-red-200 transition hover:bg-red-500/25 disabled:opacity-40"
                          >
                            {l("Nicht halten", "Decline")}
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading !== null}
                            onClick={() => void respondBid(true)}
                            className="rounded-xl bg-emerald-300 px-4 py-3 font-black text-emerald-950 transition hover:bg-emerald-200 disabled:opacity-40"
                          >
                            {game.pending_bid_value} {l("halten", "Hold")}
                          </button>
                        </div>

                        <p className="mt-4 text-xs leading-5 text-zinc-500">
                          {l(
                            `Bei „Nicht halten“ erhält die gehende Seite den bisherigen Rundenwert von ${game.round_value} Punkten.`,
                            `If declined, the raising side receives the previous round value of ${game.round_value} points.`,
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="mt-6 text-sm text-zinc-500">
                        {l(
                          "Die Gegenseite entscheidet...",
                          "The opposing side is deciding...",
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

            {/* TRICK REVIEW */}
            {game.phase === "trickReview" &&
              game.trick_winner_seat !== null && (
                <div className="absolute inset-0 z-[85] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-950 p-7 text-center shadow-2xl">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                      {t("Current trick")}
                    </p>

                    <h2 className="mt-2 text-2xl font-black">
                      {
                        players.find(
                          (player) => player.seat === game.trick_winner_seat,
                        )?.display_name
                      }
                      {" · "}
                      {t("Round winner")}
                    </h2>

                    <p className="mt-2 text-xs text-emerald-300/80">
                      {l("Angespielte Farbe", "Lead suit")}:{" "}
                      {game.played_cards[0]?.card.suit ?? "–"}
                    </p>

                    <div className="mt-6 flex flex-wrap items-start justify-center gap-4">
                      {game.played_cards.map((played) => {
                        const won = played.seat === game.trick_winner_seat;
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
                            className={`w-40 rounded-2xl p-3 ${
                              won
                                ? "bg-amber-400/15 ring-2 ring-amber-300"
                                : "bg-white/5"
                            }`}
                          >
                            <div className="mx-auto w-fit">
                              <WattenCardComponent
                                card={played.card}
                                disabled
                              />
                            </div>
                            <p className="mt-2 truncate text-xs font-bold">
                              {
                                players.find(
                                  (player) => player.seat === played.seat,
                                )?.display_name
                              }
                            </p>
                            <p className="mt-1 min-h-8 text-[10px] leading-4 text-emerald-300">
                              {role}
                            </p>
                            {won && (
                              <span className="mt-2 inline-block rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black text-amber-950">
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
                        <div className="mx-auto mt-5 max-w-xl rounded-2xl border border-amber-300/20 bg-amber-400/[0.07] px-4 py-3">
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

                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() => void continueTrick()}
                      className="mt-7 rounded-xl bg-amber-300 px-7 py-3 font-black text-amber-950 hover:bg-amber-200 disabled:opacity-40"
                    >
                      {t("Continue")}
                    </button>
                  </div>
                </div>
              )}

            {/* ROUND FINISHED */}
            {game.phase === "roundFinished" && (
              <div className="absolute inset-0 z-[90] flex items-center justify-center bg-black/65 p-6 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl border border-amber-300/25 bg-zinc-950 p-8 text-center shadow-2xl">
                  <div className="text-5xl">🏆</div>
                  <p className="mt-4 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                    {t("Round winner")}
                  </p>
                  <h2 className="mt-2 text-3xl font-black">
                    {game.winner_side === "solo"
                      ? soloPlayer?.display_name
                      : teamPlayers
                          .map((player) => player.display_name)
                          .join(" & ")}
                  </h2>
                  <p className="mt-2 text-zinc-500">
                    +{game.round_value} {t("Points")}
                  </p>

                  <button
                    type="button"
                    disabled={actionLoading !== null}
                    onClick={() => void nextRound()}
                    className="mt-7 w-full rounded-xl bg-amber-300 px-5 py-3 font-black text-amber-950 hover:bg-amber-200 disabled:opacity-40"
                  >
                    {t("Next round")}
                  </button>
                </div>
              </div>
            )}

            {/* MATCH FINISHED */}
            {game.phase === "matchFinished" && (
              <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/75 p-6 backdrop-blur-md">
                <div className="w-full max-w-lg rounded-3xl border border-amber-300/30 bg-zinc-950 p-9 text-center shadow-2xl">
                  <div className="text-6xl">🏆</div>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                    {t("Match winner")}
                  </p>
                  <h2 className="mt-2 text-4xl font-black">
                    {matchWinnerNames}
                  </h2>
                  <p className="mt-3 text-zinc-500">
                    {room.target_score} {t("Points")}
                  </p>
                </div>
              </div>
            )}

            {/* OWN HAND */}
            <div className="absolute bottom-4 left-1/2 z-30 w-full max-w-4xl -translate-x-1/2 px-8 max-md:bottom-2 max-md:px-2">
              <div
                className={`relative rounded-3xl border p-4 shadow-2xl backdrop-blur max-md:rounded-2xl max-md:p-2 ${
                  game.current_player === mySeat
                    ? "border-amber-300/35 bg-emerald-950/65"
                    : "border-white/10 bg-emerald-950/50"
                }`}
              >
                <div className="flex items-center justify-center gap-3 max-md:gap-2">
                  {me && (
                    <div className="h-11 w-11 overflow-hidden rounded-xl border border-white/10 max-md:h-8 max-md:w-8">
                      <ProfileAvatar
                        avatarId={me.avatar_id || "m1"}
                        className="h-full w-full"
                      />
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-emerald-300">
                      {game.current_player === mySeat
                        ? t("Your turn")
                        : `${t("Current player")}: ${currentPlayer?.display_name ?? "—"}`}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {t("Your cards")} · {waitingForDeal ? 0 : hand.length}
                    </p>
                  </div>
                </div>

                <div className="watten-hand mt-3 flex justify-center gap-2 max-md:mt-1 max-md:gap-0">
                  {!waitingForDeal &&
                    hand.map((card) => {
                      const legal =
                        !mustFollow ||
                        !game.farbe ||
                        isTrumpfOderKritischCard(card, game.farbe);

                      const comparison = getWattenHelpComparison({
                        card, hand, trick: game.played_cards, tricksWon: game.tricks_won,
                        trump: game.farbe, schlag: game.schlag, playerId: user.id,
                        active: helpMode && game.phase === "playing" && game.current_player === mySeat,
                      });

                      return (
                        <div key={card.id} onMouseEnter={playHoverSound}>
                          <WattenCardComponent
                            card={card}
                            disabled={
                              game.phase !== "playing" ||
                              game.current_player !== mySeat ||
                              actionLoading !== null
                            }
                            invalid={mustFollow && !legal}
                            requiredChoice={mustFollow && legal}
                            helpStatus={
                              comparison === null
                                ? undefined
                                : comparison
                                  ? "winning"
                                  : "losing"
                            }
                            onClick={() => void playCard(card)}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </section>

          {/* ROUND SIDEBAR */}
          <aside className="relative max-md:order-3">
            {game.farbe && game.schlag && (
              <div className="relative z-[170] mb-3">
                <button
                  type="button"
                  onClick={() => setShowRankingHelp((value) => !value)}
                  className="w-full rounded-xl border border-white/10 bg-zinc-950/90 px-4 py-3 text-xs font-black shadow-lg transition hover:bg-zinc-900"
                >
                  📚{" "}
                  {t(
                    showRankingHelp ? "Hide card ranking" : "Show card ranking",
                  )}
                </button>

                {showRankingHelp && (
                  <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[180] max-h-[650px] overflow-y-auto rounded-3xl border border-amber-300/20 bg-zinc-950/98 p-4 shadow-2xl shadow-black/70 backdrop-blur-xl">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                          {t("Beginner")}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {t("Highest priority first.")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRankingHelp(false)}
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-black text-zinc-400 transition hover:bg-white/10 hover:text-white"
                        aria-label={t("Hide card ranking")}
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {priorityGroups().map((group, index) => (
                        <section
                          key={group.title}
                          className="rounded-xl border border-white/10 bg-white/5 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-300 text-[10px] font-black text-amber-950">
                              {index + 1}
                            </span>
                            <p className="text-xs font-black">{group.title}</p>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1">
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

            <Panel title={t("Round")} subtitle={t("3 tricks to win")}>
              <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  {t("Solo player")}
                </p>

                {soloPlayer && (
                  <div className="mx-auto mt-3 h-14 w-14 overflow-hidden rounded-2xl">
                    <ProfileAvatar
                      avatarId={soloPlayer.avatar_id || "m1"}
                      className="h-full w-full"
                    />
                  </div>
                )}

                <p className="mt-2 font-black">{soloPlayer?.display_name}</p>
                <p className="mt-2 text-3xl font-black text-amber-300">
                  {soloTricks}
                </p>
                <p className="text-xs text-zinc-500">{t("Tricks")}</p>
              </div>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-black text-zinc-600">VS</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="rounded-2xl border border-emerald-300/25 bg-emerald-400/10 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                  {t("Opponents")}
                </p>

                <div className="mt-3 flex justify-center -space-x-2">
                  {teamPlayers.map((player) => (
                    <div
                      key={player.user_id}
                      className="h-12 w-12 overflow-hidden rounded-2xl border-2 border-emerald-950"
                    >
                      <ProfileAvatar
                        avatarId={player.avatar_id || "f1"}
                        className="h-full w-full"
                      />
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-xs font-black">
                  {teamPlayers.map((player) => player.display_name).join(" & ")}
                </p>
                <p className="mt-2 text-3xl font-black text-emerald-300">
                  {teamTricks}
                </p>
                <p className="text-xs text-zinc-500">{t("Tricks")}</p>
              </div>

              <div className="mt-5">
                <div className="grid grid-cols-3 gap-1">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={`solo-${index}`}
                      className={`h-2 rounded-full ${
                        index < soloTricks ? "bg-amber-300" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={`team-${index}`}
                      className={`h-2 rounded-full ${
                        index < teamTricks ? "bg-emerald-300" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-3 text-center">
                <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
                  {l("Gehen · Rundenwert", "Gehen · Round value")}
                </p>
                <p className="mt-1 text-2xl font-black text-amber-300">
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
                    disabled={actionLoading !== null}
                    onClick={() => void raiseBid()}
                    className="mt-3 w-full rounded-xl bg-amber-300 px-3 py-2 text-sm font-black text-amber-950 transition hover:bg-amber-200 disabled:opacity-40"
                  >
                    {l("Gehen auf", "Raise to")} {game.round_value + 1}
                  </button>
                )}

                {game.round_value >= 4 && (
                  <p className="mt-2 text-[10px] font-bold text-zinc-500">
                    {l("Maximum erreicht", "Maximum reached")}
                  </p>
                )}

                {game.phase === "playing" &&
                  game.current_player === mySeat &&
                  mySideGespannt && (
                    <div className="mt-3 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2">
                      <p className="text-xs font-black text-red-300">
                        {t("Gespannt")}
                      </p>
                      <p className="mt-1 text-[10px] leading-4 text-red-200/70">
                        {l(
                          "Deine Seite ist gespannt und darf nicht gehen.",
                          "Your side is gespannt and cannot raise.",
                        )}
                      </p>
                    </div>
                  )}

                {!canRaise &&
                  game.phase === "playing" &&
                  game.current_player === mySeat &&
                  !mySideGespannt &&
                  game.round_value < 4 &&
                  game.last_bid_side === mySide && (
                    <p className="mt-3 text-[10px] leading-4 text-zinc-500">
                      {l(
                        "Nach deinem letzten Gehen muss zuerst die Gegenseite erhöhen.",
                        "After your side raised last, the opposing side must raise next.",
                      )}
                    </p>
                  )}

                {game.current_player !== mySeat && game.phase === "playing" && (
                  <p className="mt-3 text-xs text-zinc-600">
                    {currentSide === "solo" ? t("Solo") : t("Team")} ·{" "}
                    {t("Waiting")}
                  </p>
                )}

                <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-4 text-zinc-600">
                  {l(
                    "Standard: 2 Punkte. Gehen erhöht auf 3, danach maximal 4. Die Gegenseite hält oder lehnt ab.",
                    "Standard: 2 points. Gehen raises to 3, then at most 4. The opposing side holds or declines.",
                  )}
                </p>

                {room.target_score < 5 && (
                  <p className="mt-2 text-[10px] leading-4 text-sky-300/80">
                    {l(
                      "Bei kurzen Spielen bis 4 Punkte ist die Gespannt-Sperre deaktiviert, damit Gehen weiterhin möglich bleibt.",
                      "For short matches up to 4 points, the Gespannt restriction is disabled so Gehen remains usable.",
                    )}
                  </p>
                )}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}
