import InviteFriendButton from "@/components/chess/InviteFriendButton";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { useVariantRecordAudio } from "@/games/chess/audio/useVariantRecordAudio";
import type { ChessSoundEvent } from "@/games/chess/audio/chessAudio";
import RouletteInfo from "@/components/chess/singleplayer/RouletteInfo";
import { ui, useUiLanguage } from "@/i18n/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Chess, type Square } from "chess.js";

import Board from "@/components/chess/singleplayer/Board";
import PromotionBar from "@/components/chess/singleplayer/PromotionBar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getSquareName } from "@/utils/chessUtils";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "@/utils/sound";

import {
  clonePortalState,
  applyRouletteCard,
  getRouletteMoves,
  moveRoulette,
  isPortalKingAttacked,
  createInitialPortalState,
  createPortalSeed,
  expireTriggeredLuckySquares,
  finalizePortalPromotionEvent,
  getLuckySquareSquares,
  resolvePortalAfterMove,
  roulettePositionKey,
  spawnLuckySquaresAfterMove,
  type PendingPortalPromotion,
  type Portal,
  type PortalEffect,
  type PortalEvent,
  type PortalPieceType,
  type PortalPromotionCard,
  type PortalSide,
  type PortalState,
} from "@/games/chess/variants/chessRoulette";

import type {
  TwoPlayerColor,
  VariantGame,
  VariantRoom,
  VariantRoomPlayer,
} from "@/games/chess/multiplayer/variantMultiplayerTypes";

type PromotionPiece = "q" | "r" | "b" | "n";

type RouletteRecord = {
  ply: number;
  san: string;
  color: PortalSide;
  piece: PortalPieceType;
  from: Square;
  to: Square;
  captured?: PortalPieceType;
  fenBefore: string;
  fenAfter: string;
  portalsAfter: Portal[];
  portalStateAfter?: PortalState;
  portalEvent: PortalEvent | null;
};

type RouletteStoredState = {
  portalState: PortalState;
  records: RouletteRecord[];
};

type PendingRoulettePromotion = {
  pending: PendingPortalPromotion;
  move: {
    color: PortalSide;
    piece: PortalPieceType;
    from: Square;
    to: Square;
    san: string;
    captured?: PortalPieceType;
  };
  beforeFen: string;
  workingFen: string;
  portalBefore: PortalState;
  portalAfterReveal: PortalState;
};

type ActionLoading =
  | "resign"
  | "undo-request"
  | "undo-response"
  | "rematch"
  | null;

const STANDARD_FEN = new Chess().fen();

const whiteSymbols: Record<PortalPieceType, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
  k: "♔",
};

const blackSymbols: Record<PortalPieceType, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

const promotionCardNames: Record<PortalPromotionCard, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

function normalizeCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function colorToSide(color: TwoPlayerColor): PortalSide {
  return color === "white" ? "w" : "b";
}

function clonePortals(portals: Portal[]): Portal[] {
  return portals.map((portal) => ({ ...portal }));
}

function cloneEvent(event: PortalEvent | null): PortalEvent | null {
  return event ? { ...event } : null;
}

function createStoredState(seed: number): RouletteStoredState {
  return {
    portalState: createInitialPortalState(seed),
    records: [],
  };
}

function normalizeStoredState(
  rawState: Record<string, unknown> | null | undefined,
  seed: number,
): RouletteStoredState {
  const rawPortalState = rawState?.portalState as
    | Partial<PortalState>
    | undefined;
  const rawRecords = rawState?.records;

  const initial = createInitialPortalState(seed);

  const portalState: PortalState = rawPortalState
    ? {
        kingPowers: rawPortalState.kingPowers,
        loser: rawPortalState.loser,
        seed:
          typeof rawPortalState.seed === "number" ? rawPortalState.seed : seed,
        portals: Array.isArray(rawPortalState.portals)
          ? clonePortals(rawPortalState.portals as Portal[])
          : initial.portals,
        events: Array.isArray(rawPortalState.events)
          ? (rawPortalState.events as PortalEvent[]).map((event) => ({
              ...event,
            }))
          : [],
      }
    : initial;

  const records: RouletteRecord[] = Array.isArray(rawRecords)
    ? (rawRecords as RouletteRecord[]).map((record) => ({
        ...record,
        portalsAfter: clonePortals(record.portalsAfter ?? []),
        portalEvent: cloneEvent(record.portalEvent ?? null),
      }))
    : [];

  return { portalState, records };
}

function normalizeGame(raw: VariantGame): VariantGame {
  return {
    ...raw,
    moves: raw.moves ?? [],
    state: raw.state ?? {},
    white_rematch_ready: raw.white_rematch_ready ?? false,
    black_rematch_ready: raw.black_rematch_ready ?? false,
    next_seed: raw.next_seed ?? null,
    next_initial_fen: raw.next_initial_fen ?? null,
    next_state: raw.next_state ?? null,
    undo_requested_by: raw.undo_requested_by ?? null,
    undo_requested_version: raw.undo_requested_version ?? null,
    undo_previous_fen: raw.undo_previous_fen ?? null,
    undo_previous_last_from: raw.undo_previous_last_from ?? null,
    undo_previous_last_to: raw.undo_previous_last_to ?? null,
    undo_previous_state: raw.undo_previous_state ?? null,
    undo_last_requested_by: raw.undo_last_requested_by ?? null,
    undo_last_requested_version: raw.undo_last_requested_version ?? null,
  };
}

function stateAtPly(
  seed: number,
  records: RouletteRecord[],
  ply: number,
): PortalState {
  if (ply <= 0) {
    return createInitialPortalState(seed);
  }

  const boundedPly = Math.min(ply, records.length);
  const record = records[boundedPly - 1];

  if (record?.portalStateAfter) return clonePortalState(record.portalStateAfter);
  return {
    seed,
    portals: clonePortals(record?.portalsAfter ?? []),
    events: records
      .slice(0, boundedPly)
      .map((item) => item.portalEvent)
      .filter((event): event is PortalEvent => Boolean(event))
      .map((event) => ({ ...event })),
  };
}

function buildStoredStateAtPly(
  seed: number,
  records: RouletteRecord[],
  ply: number,
): RouletteStoredState {
  const nextRecords = records.slice(0, Math.max(0, ply));
  return {
    portalState: stateAtPly(seed, nextRecords, nextRecords.length),
    records: nextRecords,
  };
}

function isThreefoldRoulette(initialFen: string, records: RouletteRecord[], currentFen: string, state: PortalState) {
  const counts = new Map<string, number>();
  const add = (fen: string, portal: PortalState) => {
    const key = roulettePositionKey(fen, portal);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };
  add(initialFen, createInitialPortalState(state.seed));
  for (const record of records) add(record.fenAfter, record.portalStateAfter ?? { seed: state.seed, portals: record.portalsAfter, events: [] });
  if (records.at(-1)?.fenAfter !== currentFen) add(currentFen, state);
  return [...counts.values()].some((count) => count >= 3);
}

function getOutcome(
  game: Chess,
  initialFen: string,
  records: RouletteRecord[],
  state: PortalState,
) {
  if (state.loser) return { finished: true, winner: state.loser === "w" ? "black" as const : "white" as const, reason: "King card drawn" };
  const noMoves = getRouletteMoves(game, state).length === 0;
  const inCheck = isPortalKingAttacked(game, game.turn(), state);
  if (noMoves && inCheck) {
    return {
      finished: true,
      winner: game.turn() === "w" ? ("black" as const) : ("white" as const),
      reason: "checkmate",
    };
  }

  if (noMoves && !inCheck) {
    return { finished: true, winner: "draw" as const, reason: "stalemate" };
  }

  if (!Object.values(state.kingPowers ?? {}).some((power) => power.movesLeft > 0) && game.isInsufficientMaterial()) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "insufficient material",
    };
  }

  if (game.isDrawByFiftyMoves()) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "50-move rule",
    };
  }

  if (isThreefoldRoulette(initialFen, records, game.fen(), state)) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "threefold repetition",
    };
  }

  return { finished: false, winner: null, reason: null };
}

function findCheckedKing(game: Chess): Square | null {
  if (!game.isCheck()) return null;

  const target = game.turn();
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece?.type === "k" && piece.color === target) return piece.square;
    }
  }

  return null;
}

function effectIcon(effect: PortalEffect) {
  if (effect === "extra-turn") return "↻";
  if (effect === "destroy") return "💥";
  if (effect === "teleport") return "🌀";
  if (effect === "swap") return "🔄";
  return "🎴";
}

function cardSymbol(card: PortalPromotionCard, color: PortalSide) {
  return color === "w" ? whiteSymbols[card] : blackSymbols[card];
}

function resultLabel(game: VariantGame) {
  if (game.winner === "draw") return `Draw · ${game.end_reason ?? "Game over"}`;
  if (game.winner === "white")
    return `White wins · ${game.end_reason ?? "Game over"}`;
  if (game.winner === "black")
    return `Black wins · ${game.end_reason ?? "Game over"}`;
  return game.end_reason ?? "Game over";
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
  useUiLanguage();
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/15 backdrop-blur">
      <div className="mb-3">
        <h2 className="text-sm font-black text-white">{ui(title)}</h2>
        {subtitle && (
          <p className="mt-1 text-[11px] text-zinc-500">{ui(subtitle)}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function PromotionRouletteModal({
  pending,
  color,
  piece,
  onResolve,
}: {
  pending: PendingPortalPromotion;
  color: PortalSide;
  piece: PortalPieceType;
  onResolve: (card: PortalPromotionCard) => void;
}) {
  useUiLanguage();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [stage, setStage] = useState<"choose" | "reveal" | "prank">("choose");

  const selectedCard =
    selectedIndex === null ? null : pending.deck[selectedIndex];

  function chooseCard(index: number) {
    if (stage !== "choose") return;
    setSelectedIndex(index);

    window.setTimeout(() => {
      setStage("reveal");
      if (pending.deck[index] === "k") {
        window.setTimeout(() => setStage("prank"), 1200);
      }
    }, 420);
  }

  const title =
    selectedCard === "k"
      ? stage === "prank"
        ? "PRANK!"
        : "KING?!"
      : selectedCard === piece
        ? "No change!"
        : selectedCard === "p"
          ? "Demoted!"
          : selectedCard === "q"
            ? "JACKPOT!"
            : selectedCard
              ? "Nice pull!"
              : "Choose one card";

  const result =
    selectedCard === "k"
      ? stage === "prank"
        ? piece === "k" ? ui("King card drawn") : "There are no bonus Kings. Your piece disappears."
        : "No way... you pulled a King!"
      : selectedCard
        ? `${promotionCardNames[piece]} → ${promotionCardNames[selectedCard]}`
        : "One card decides your piece's fate.";

  const canContinue =
    (selectedCard !== null && stage === "reveal" && selectedCard !== "k") ||
    (selectedCard === "k" && stage === "prank");

  // Resolve automatically after the reveal so a player cannot strand the
  // shared game behind this modal if they do not press Continue.
  useEffect(() => {
    if (!canContinue || !selectedCard) return;
    const timer = window.setTimeout(() => onResolve(selectedCard), 1800);
    return () => window.clearTimeout(timer);
  }, [canContinue, onResolve, selectedCard]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-zinc-950/85 p-4 backdrop-blur-md">
      <div className="w-full max-w-3xl overflow-hidden rounded-[28px] border border-violet-300/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-violet-950/70 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.7)] sm:p-7">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-200/25 bg-violet-400/10 text-3xl shadow-[0_0_30px_rgba(167,139,250,0.3)]">
            🎴
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">{ui("Promotion Roulette!")}</h2>
          <p className="mt-1 text-sm font-bold text-violet-200">{ui(title)}</p>
          <p className="mt-1 text-xs text-zinc-400">{result}</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-sm font-black text-zinc-200">
            <span className="font-serif text-2xl">
              {cardSymbol(piece, color)}
            </span>
            <span>{promotionCardNames[piece]}</span>
            <span className="text-zinc-600">→</span>
            <span className="text-violet-300">?</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[
            ["♙", "8", "Pawn"],
            ["♗", "2", "Bishop"],
            ["♘", "2", "Knight"],
            ["♖", "2", "Rook"],
            ["♕", "1", "Queen"],
            ["♔", "1", "King"],
          ].map(([symbol, count, name]) => (
            <div
              key={name}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2 text-center"
            >
              <div className="text-xl leading-none text-amber-100">
                {symbol}
              </div>
              <div className="mt-1 text-[10px] font-black text-white">
                {count}× {name}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {pending.deck.map((card, index) => {
            const selected = selectedIndex === index;
            const revealed = selected && stage !== "choose";

            return (
              <button
                key={index}
                type="button"
                disabled={stage !== "choose"}
                onClick={() => chooseCard(index)}
                className={`aspect-[3/4] rounded-xl border text-2xl font-black transition ${
                  selected
                    ? "scale-[1.03] border-violet-300/60 bg-violet-400/15 shadow-[0_0_24px_rgba(167,139,250,0.25)]"
                    : "border-white/10 bg-white/[0.04] hover:-translate-y-1 hover:border-violet-300/30 hover:bg-violet-400/[0.08]"
                } disabled:cursor-default`}
              >
                {revealed ? cardSymbol(card, color) : "?"}
              </button>
            );
          })}
        </div>

        {canContinue && selectedCard && (
          <button
            type="button"
            onClick={() => onResolve(selectedCard)}
            className="mt-6 w-full rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-violet-200"
          >{ui("Continue")}</button>
        )}
      </div>
    </div>
  );
}

export function RouletteMultiplayerLobby() {
  useUiLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [hostColor, setHostColor] = useState<TwoPlayerColor>("white");
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const username =
      typeof profile?.username === "string" ? profile.username.trim() : "";
    if (username) return username;
    return user?.email?.split("@")[0]?.trim() || "Player";
  }, [profile?.username, user?.email]);

  async function createRoom() {
    if (!user) return setError("Sign in first.");

    setLoading("create");
    setError(null);

    const seed = createPortalSeed();
    const initialState = createStoredState(seed);

    const { data, error: rpcError } = await supabase.rpc(
      "create_roulette_variant_room",
      {
        p_seed: seed,
        p_initial_state: initialState,
        p_display_name: displayName,
        p_host_color: hostColor,
      },
    );

    setLoading(null);
    if (rpcError) return setError(rpcError.message);

    navigate(`/games/chess/variants/roulette/multiplayer/${String(data)}`);
  }

  async function joinRoom() {
    if (!user) return setError("Sign in first.");

    const code = normalizeCode(joinCode);
    if (code.length !== 6) return setError("Enter the 6-character room code.");

    setLoading("join");
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("join_variant_room", {
      p_code: code,
      p_expected_variant: "roulette",
      p_display_name: displayName,
    });

    setLoading(null);
    if (rpcError) return setError(rpcError.message);

    navigate(
      `/games/chess/variants/roulette/multiplayer/${String(data ?? code)}`,
    );
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ChessPageHeader className="mb-7 rounded-3xl border border-violet-400/15 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30" description={<> {ui("The seed, Lucky Squares, effects and Roulette events stay synchronized for both players.")} </>}>

        </ChessPageHeader>

        {!user ? (
          <Panel title={ui("Sign in required")}>
            <p className="text-sm text-zinc-400">{ui("Multiplayer rooms use your existing Supabase account.")}</p>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={ui("Create room")} subtitle={ui("Choose your side")}>
              <div className="grid grid-cols-2 gap-2">
                {(["white", "black"] as TwoPlayerColor[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setHostColor(color)}
                    className={`rounded-xl border px-4 py-3 font-black transition ${
                      hostColor === color
                        ? "border-violet-400/30 bg-violet-400/10 text-violet-200"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    {color === "white" ? "♔" : "♚"}{" "}
                    {color[0].toUpperCase() + color.slice(1)}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-violet-300/10 bg-violet-400/[0.05] p-3 text-xs leading-5 text-zinc-400">{ui("A single Roulette seed is stored with the room. Both browsers therefore use the exact same Lucky Squares and deterministic effects.")}</div>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-violet-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "create" ? ui("Creating...") : ui("Create Multiplayer Room")}
              </button>
            </Panel>

            <Panel title={ui("Join room")} subtitle={ui("Enter the room code")}>
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeCode(event.target.value))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") void joinRoom();
                }}
                placeholder={ui("ABC123")}
                maxLength={6}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-400/40"
              />

              <p className="mt-3 text-xs leading-5 text-zinc-500">{ui("The joining player automatically receives the opposite color.")}</p>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-black text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "join" ? ui("Joining...") : ui("Join Room")}
              </button>
            </Panel>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">
            {ui(error)}
          </div>
        )}
      </div>
    </main>
  );
}

export function RouletteMultiplayerGame() {
  useUiLanguage();
  const { roomCode } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);
  const [myColor, setMyColor] = useState<TwoPlayerColor | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [pendingRoulettePromotion, setPendingRoulettePromotion] =
    useState<PendingRoulettePromotion | null>(null);
  const [activePortalSquare, setActivePortalSquare] = useState<Square | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyRoomCode() {
    if (!room?.code || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Could not copy room code.");
    }
  }

  const lastSeenMoveCountRef = useRef(0);
  const activeTimerRef = useRef<number | null>(null);

  const seed = gameState?.seed ?? 0;
  const initialFen = gameState?.initial_fen ?? STANDARD_FEN;
  const storedState = useMemo(
    () => normalizeStoredState(gameState?.state, seed),
    [gameState?.state, seed],
  );
  const records = storedState.records;
  useVariantRecordAudio(gameState ? records : null, record => {
    const event = record.portalEvent;
    if (!event) return [];
    const sounds: ChessSoundEvent[] = ["rouletteEvent"];
    if (event.promotionCard === "k") sounds.push("rouletteKing");
    else if (event.promotionCard === "p" || event.promotionCard === record.piece) sounds.push("roulettePromotionFailure");
    else if (event.promotionCard) sounds.push("roulettePromotionSuccess");
    return sounds;
  });

  const liveFen =
    pendingRoulettePromotion?.workingFen ?? gameState?.fen ?? initialFen;

  const previewFen =
    historyPreviewPly === null
      ? null
      : historyPreviewPly === 0
        ? initialFen
        : (records[historyPreviewPly - 1]?.fenAfter ?? initialFen);

  const displayedFen = previewFen ?? liveFen;

  const displayedChess = useMemo(() => {
    try {
      return new Chess(displayedFen);
    } catch {
      return new Chess(initialFen);
    }
  }, [displayedFen, initialFen]);

  const displayedBoard = displayedChess.board();

  const displayedPortalState = useMemo(() => {
    if (historyPreviewPly === null) {
      if (pendingRoulettePromotion)
        return pendingRoulettePromotion.portalAfterReveal;
      return storedState.portalState;
    }

    return stateAtPly(seed, records, historyPreviewPly);
  }, [
    historyPreviewPly,
    pendingRoulettePromotion,
    records,
    seed,
    storedState.portalState,
  ]);

  const luckySquares = getLuckySquareSquares(displayedPortalState);
  const destroyLuckySquares = displayedPortalState.portals
    .filter((portal) => portal.revealed && portal.effect === "destroy")
    .map((portal) => portal.square);
  const teleportLuckySquares = displayedPortalState.portals
    .filter((portal) => portal.revealed && portal.effect === "teleport")
    .map((portal) => portal.square);
  const swapLuckySquares = displayedPortalState.portals
    .filter((portal) => portal.revealed && portal.effect === "swap")
    .map((portal) => portal.square);
  const promoteLuckySquares = displayedPortalState.portals
    .filter((portal) => portal.revealed && portal.effect === "promote")
    .map((portal) => portal.square);

  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";
  const mySide = myColor ? colorToSide(myColor) : null;
  const liveChess = useMemo(() => {
    try {
      return new Chess(gameState?.fen ?? initialFen);
    } catch {
      return new Chess(initialFen);
    }
  }, [gameState?.fen, initialFen]);

  const isMyTurn =
    Boolean(mySide) &&
    gameState?.status === "playing" &&
    liveChess.turn() === mySide;

  const checkedKingSquare = findCheckedKing(displayedChess);

  const displayedLastMove =
    historyPreviewPly === 0
      ? null
      : historyPreviewPly !== null
        ? (() => {
            const record = records[historyPreviewPly - 1];
            return record ? { from: record.from, to: record.to } : null;
          })()
        : gameState?.last_move_from && gameState?.last_move_to
          ? {
              from: gameState.last_move_from as Square,
              to: gameState.last_move_to as Square,
            }
          : null;

  const movesUntilNextLuckySpawn = 15 - (records.length % 15);

  const refreshPlayers = useCallback(async () => {
    if (!room || !user) return;

    const { data, error: playerError } = await supabase
      .from("variant_room_players")
      .select("room_id,user_id,seat,display_name,chosen_color")
      .eq("room_id", room.id)
      .order("seat", { ascending: true });

    if (playerError || !data) return;

    const nextPlayers = data as VariantRoomPlayer[];
    setPlayers(nextPlayers);

    const me = nextPlayers.find((player) => player.user_id === user.id);
    setMyColor(me?.chosen_color ?? null);
  }, [room, user]);

  const refreshGame = useCallback(async () => {
    if (!room) return;

    const { data, error: gameError } = await supabase
      .from("variant_games")
      .select(
        "room_id,variant,seed,initial_fen,fen,moves,state,status,winner,end_reason,version,last_move_from,last_move_to,white_rematch_ready,black_rematch_ready,next_seed,next_initial_fen,next_state,undo_requested_by,undo_requested_version,undo_previous_fen,undo_previous_last_from,undo_previous_last_to,undo_previous_state,undo_last_requested_by,undo_last_requested_version",
      )
      .eq("room_id", room.id)
      .single();

    if (gameError || !data) return;

    const next = normalizeGame(data as VariantGame);
    setGameState(next);
    lastSeenMoveCountRef.current = next.moves.length;
  }, [room]);

  const loadRoom = useCallback(async () => {
    if (!roomCode || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data: roomData, error: roomError } = await supabase
      .from("variant_rooms")
      .select("id,code,host_id,variant,max_players,status")
      .eq("code", roomCode.toUpperCase())
      .single();

    if (roomError || !roomData) {
      setError("Room not found.");
      setLoading(false);
      return;
    }

    const loadedRoom = roomData as VariantRoom;
    if (loadedRoom.variant !== "roulette") {
      setError("This is not a ChessRoulette room.");
      setLoading(false);
      return;
    }

    setRoom(loadedRoom);

    const { data: playerData, error: playerError } = await supabase
      .from("variant_room_players")
      .select("room_id,user_id,seat,display_name,chosen_color")
      .eq("room_id", loadedRoom.id)
      .order("seat", { ascending: true });

    if (playerError || !playerData) {
      setError("Players could not be loaded.");
      setLoading(false);
      return;
    }

    const loadedPlayers = playerData as VariantRoomPlayer[];
    const me = loadedPlayers.find((player) => player.user_id === user.id);

    if (!me) {
      setError("You are not a player in this room.");
      setLoading(false);
      return;
    }

    setPlayers(loadedPlayers);
    setMyColor(me.chosen_color);

    const { data: gameData, error: gameError } = await supabase
      .from("variant_games")
      .select(
        "room_id,variant,seed,initial_fen,fen,moves,state,status,winner,end_reason,version,last_move_from,last_move_to,white_rematch_ready,black_rematch_ready,next_seed,next_initial_fen,next_state,undo_requested_by,undo_requested_version,undo_previous_fen,undo_previous_last_from,undo_previous_last_to,undo_previous_state,undo_last_requested_by,undo_last_requested_version",
      )
      .eq("room_id", loadedRoom.id)
      .single();

    if (gameError || !gameData) {
      setError("Game could not be loaded.");
      setLoading(false);
      return;
    }

    const loadedGame = normalizeGame(gameData as VariantGame);
    setGameState(loadedGame);
    lastSeenMoveCountRef.current = loadedGame.moves.length;
    setLoading(false);
  }, [roomCode, user]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  function flashPortal(square: Square | null) {
    if (activeTimerRef.current !== null) {
      window.clearTimeout(activeTimerRef.current);
      activeTimerRef.current = null;
    }

    setActivePortalSquare(square);
    if (!square) return;

    activeTimerRef.current = window.setTimeout(() => {
      setActivePortalSquare(null);
      activeTimerRef.current = null;
    }, 900);
  }

  function playRecordSound(record: RouletteRecord | undefined) {
    if (!record) return;
    if (record.captured) playPieceCaptureSound(record.piece);
    else playPieceMoveSound(record.piece);
  }

  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`roulette-game-${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_games",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const updated = normalizeGame(payload.new as VariantGame);
          const updatedState = normalizeStoredState(
            updated.state,
            updated.seed ?? 0,
          );
          const nextMoveCount = updated.moves.length;

          if (nextMoveCount > lastSeenMoveCountRef.current) {
            const latest = updatedState.records.at(-1);
            playRecordSound(latest);
            if (latest?.portalEvent) flashPortal(latest.portalEvent.square);
          }

          lastSeenMoveCountRef.current = nextMoveCount;
          setGameState(updated);
          setSelectedSquare(null);
          setLegalMoves([]);
          setPromotionFrom(null);
          setPromotionSquare(null);
          setPendingRoulettePromotion(null);
          setHistoryPreviewPly(null);

          if (updated.status === "playing" && updated.moves.length === 0) {
            void refreshPlayers();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room, refreshPlayers]);

  useEffect(() => {
    if (!room) return;

    const interval = window.setInterval(() => {
      if (!moving && !pendingRoulettePromotion) {
        void refreshGame();
        void refreshPlayers();
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [moving, pendingRoulettePromotion, refreshGame, refreshPlayers, room]);

  useEffect(() => {
    return () => {
      if (activeTimerRef.current !== null) {
        window.clearTimeout(activeTimerRef.current);
      }
    };
  }, []);

  async function commitResolvedMove(
    workingGame: Chess,
    move: {
      color: PortalSide;
      piece: PortalPieceType;
      from: Square;
      to: Square;
      san: string;
      captured?: PortalPieceType;
    },
    beforeFen: string,
    portalAfter: PortalState,
    portalEvent: PortalEvent | null,
  ) {
    if (!room || !gameState || moving) return;

    const completedPly = records.length + 1;
    let finalPortalState = expireTriggeredLuckySquares(
      portalAfter,
      completedPly,
    );
    finalPortalState = spawnLuckySquaresAfterMove(
      workingGame,
      finalPortalState,
      completedPly,
    );

    const record: RouletteRecord = {
      ply: completedPly,
      san: move.san,
      color: move.color,
      piece: move.piece,
      from: move.from,
      to: move.to,
      captured: move.captured,
      fenBefore: beforeFen,
      fenAfter: workingGame.fen(),
      portalsAfter: clonePortals(finalPortalState.portals),
      portalStateAfter: clonePortalState(finalPortalState),
      portalEvent: cloneEvent(portalEvent),
    };

    const nextRecords = [...records, record];
    const nextStoredState: RouletteStoredState = {
      portalState: clonePortalState(finalPortalState),
      records: nextRecords,
    };

    const outcome = getOutcome(workingGame, initialFen, nextRecords, finalPortalState);
    const previous = gameState;
    const optimistic: VariantGame = {
      ...gameState,
      fen: workingGame.fen(),
      moves: [...gameState.moves, move.san],
      state: nextStoredState as unknown as Record<string, unknown>,
      version: gameState.version + 1,
      last_move_from: move.from,
      last_move_to: move.to,
      status: outcome.finished ? "finished" : "playing",
      winner: outcome.finished ? outcome.winner : null,
      end_reason: outcome.finished ? outcome.reason : null,
    };

    setMoving(true);
    setError(null);
    setGameState(optimistic);
    lastSeenMoveCountRef.current = optimistic.moves.length;
    setSelectedSquare(null);
    setLegalMoves([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setHistoryPreviewPly(null);
    if (portalEvent) flashPortal(portalEvent.square);

    const { error: moveError } = await supabase.rpc("play_roulette_move_v2", {
      p_room_id: room.id,
      p_from: move.from,
      p_to: move.to,
      p_move_san: move.san,
      p_new_fen: workingGame.fen(),
      p_new_state: nextStoredState,
      p_expected_version: previous.version,
      p_is_finished: outcome.finished,
      p_winner: outcome.winner,
      p_end_reason: outcome.reason,
    });

    setMoving(false);

    if (moveError) {
      setGameState(previous);
      lastSeenMoveCountRef.current = previous.moves.length;
      setError(moveError.message);
      await refreshGame();
    }
  }

  function beginResolvedMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (
      !gameState ||
      !isMyTurn ||
      moving ||
      gameState.undo_requested_by ||
      historyPreviewPly !== null ||
      pendingRoulettePromotion
    ) {
      return;
    }

    const workingGame = new Chess(gameState.fen ?? initialFen);
    const beforeFen = workingGame.fen();
    const portalBefore = clonePortalState(storedState.portalState);

    let move;
    try {
      move = moveRoulette(workingGame, portalBefore, { from, to, promotion });
    } catch {
      setError("Illegal move.");
      return;
    }

    if (!move) return;

    const moveInfo = {
      color: move.color as PortalSide,
      piece: move.piece as PortalPieceType,
      from: move.from,
      to: move.to,
      san: move.san,
      captured: move.captured as PortalPieceType | undefined,
    };

    if (move.captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);

    const resolution = resolvePortalAfterMove(
      workingGame,
      portalBefore,
      moveInfo.to,
      { color: moveInfo.color, piece: moveInfo.piece },
      records.length + 1,
    );

    if (resolution.pendingPromotion) {
      setPendingRoulettePromotion({
        pending: resolution.pendingPromotion,
        move: moveInfo,
        beforeFen,
        workingFen: workingGame.fen(),
        portalBefore,
        portalAfterReveal: clonePortalState(resolution.state),
      });
      flashPortal(moveInfo.to);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPromotionFrom(null);
      setPromotionSquare(null);
      return;
    }

    void commitResolvedMove(
      workingGame,
      moveInfo,
      beforeFen,
      resolution.state,
      resolution.event,
    );
  }

  function resolvePromotionCard(card: PortalPromotionCard) {
    if (!pendingRoulettePromotion) return;

    const pending = pendingRoulettePromotion;
    const workingGame = new Chess(pending.workingFen);
    const square = pending.pending.portalSquare;

    applyRouletteCard(workingGame, square, card);

    const event: PortalEvent = {
      ply: records.length + 1,
      square,
      effect: "promote",
      result: "promotion-card",
      color: pending.move.color,
      piece: pending.move.piece,
      promotionCard: card,
    };

    const finalPortal = finalizePortalPromotionEvent(
      pending.portalAfterReveal,
      event,
    );

    setPendingRoulettePromotion(null);

    void commitResolvedMove(
      workingGame,
      pending.move,
      pending.beforeFen,
      finalPortal,
      event,
    );
  }

  function handleSquareClick(row: number, column: number) {
    if (
      !gameState ||
      !isMyTurn ||
      moving ||
      gameState.undo_requested_by ||
      historyPreviewPly !== null ||
      pendingRoulettePromotion ||
      promotionFrom
    ) {
      return;
    }

    const square = getSquareName(row, column);
    const piece = liveChess.get(square);

    if (!selectedSquare) {
      if (!piece || piece.color !== liveChess.turn()) return;
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      setLegalMoves(
        getRouletteMoves(liveChess, storedState.portalState, square).map((move) => move.to),
      );
      return;
    }

    if (piece && piece.color === liveChess.turn()) {
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      setLegalMoves(
        getRouletteMoves(liveChess, storedState.portalState, square).map((move) => move.to),
      );
      return;
    }

    const selectedPiece = liveChess.get(selectedSquare);
    if (
      selectedPiece?.type === "p" &&
      legalMoves.includes(square) &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotionFrom(selectedSquare);
      setPromotionSquare(square);
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    if (!legalMoves.includes(square)) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    beginResolvedMove(selectedSquare, square);
  }

  function promotePawn(piece: PromotionPiece) {
    if (!promotionFrom || !promotionSquare) return;
    const from = promotionFrom;
    const to = promotionSquare;
    setPromotionFrom(null);
    setPromotionSquare(null);
    beginResolvedMove(from, to, piece);
  }

  async function requestUndo() {
    if (
      !room ||
      !gameState ||
      !user ||
      records.length === 0 ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      actionLoading
    ) {
      return;
    }

    const latest = records.at(-1)!;
    if (!mySide || latest.color !== mySide) {
      setError("Only the player who made the latest move can request Undo.");
      return;
    }

    if (
      gameState.undo_last_requested_by === user.id &&
      gameState.undo_last_requested_version === gameState.version
    ) {
      setError("You already requested Undo for this move.");
      return;
    }

    const previousRecords = records.slice(0, -1);
    const previousState = buildStoredStateAtPly(
      seed,
      previousRecords,
      previousRecords.length,
    );
    const previousLast = previousRecords.at(-1);

    setActionLoading("undo-request");
    setError(null);

    const { error: undoError } = await supabase.rpc("request_roulette_undo", {
      p_room_id: room.id,
      p_previous_fen: latest.fenBefore,
      p_previous_state: previousState,
      p_previous_last_from: previousLast?.from ?? null,
      p_previous_last_to: previousLast?.to ?? null,
    });

    setActionLoading(null);
    if (undoError) setError(undoError.message);
    else await refreshGame();
  }

  async function respondUndo(accept: boolean) {
    if (!room || !gameState?.undo_requested_by || actionLoading) return;

    setActionLoading("undo-response");
    setError(null);

    const { error: undoError } = await supabase.rpc("respond_roulette_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });

    setActionLoading(null);
    if (undoError) setError(undoError.message);
    else {
      setHistoryPreviewPly(null);
      await refreshGame();
    }
  }

  async function resign() {
    if (!room || gameState?.status !== "playing" || actionLoading) return;

    setActionLoading("resign");
    setError(null);

    const { error: resignError } = await supabase.rpc("resign_variant_game", {
      p_room_id: room.id,
      p_expected_variant: "roulette",
    });

    setActionLoading(null);
    if (resignError) setError(resignError.message);
  }

  async function requestRematch() {
    if (!room || gameState?.status !== "finished" || actionLoading) return;

    const nextSeed = createPortalSeed();
    const nextState = createStoredState(nextSeed);

    setActionLoading("rematch");
    setError(null);

    const { error: rematchError } = await supabase.rpc(
      "request_roulette_rematch",
      {
        p_room_id: room.id,
        p_next_seed: nextSeed,
        p_next_state: nextState,
      },
    );

    setActionLoading(null);
    if (rematchError) setError(rematchError.message);
    else await refreshGame();
  }

  if (loading) {
    return (
      <main className="flex chess-variant-page min-h-[var(--app-height)] items-center justify-center bg-transparent text-zinc-400">
      <ChessPageHeader className="mb-4" />{ui("Loading ChessRoulette room...")}</main>
    );
  }

  if (!user) {
    return (
      <main className="flex chess-variant-page min-h-[var(--app-height)] items-center justify-center bg-transparent p-6 text-zinc-200">
      <ChessPageHeader className="mb-4" />
        <Panel title={ui("Sign in required")}>
          <Link
            className="text-violet-300"
            to="/games/chess/variants/roulette/multiplayer"
          >{ui("Back to Roulette multiplayer")}</Link>
        </Panel>
      </main>
    );
  }

  if (!room || !gameState) {
    return (
      <main className="flex chess-variant-page min-h-[var(--app-height)] items-center justify-center bg-transparent p-6 text-zinc-200">
      <ChessPageHeader className="mb-4" />
        <Panel title={ui("Room unavailable")}>
          <p className="text-sm text-zinc-400">
            {error ?? "Could not load the room."}
          </p>
        </Panel>
      </main>
    );
  }

  const myPlayer = players.find((player) => player.user_id === user.id);
  const opponent = players.find((player) => player.user_id !== user.id);
  const undoRequesterIsMe = gameState.undo_requested_by === user.id;
  const myRematchReady =
    myColor === "white"
      ? gameState.white_rematch_ready
      : myColor === "black"
        ? gameState.black_rematch_ready
        : false;

  const canRequestUndo =
    gameState.status === "playing" &&
    records.length > 0 &&
    !gameState.undo_requested_by &&
    Boolean(mySide) &&
    records.at(-1)?.color === mySide;

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1600px]">
        <ChessPageHeader className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-violet-400/10 bg-zinc-900/50 px-5 py-4" description={<> {ui("Visible Lucky Squares · synchronized deterministic outcomes")} </>}>


          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-300/15 bg-violet-400/[0.06] px-3 py-1.5 text-xs font-black text-violet-200">{ui("Room")}{room.code}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
              {gameState.status === "playing" ? `${liveChess.turn() === "w" ? "White" : "Black"} to move` : gameState.status === "waiting" ? ui("Waiting for opponent") : ui("Game finished")}
            </span>
          </div>
        </ChessPageHeader>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">
            {ui(error)}
          </div>
        )}

        {gameState.status === "waiting" && (
          <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">{ui("Waiting for the second player. Share room code")}<b>{room.code}</b>.
          </div>
        )}

        {gameState.undo_requested_by && gameState.status === "playing" && (
          <div className="mb-4 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] p-4">
            {undoRequesterIsMe ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-violet-200">{ui("Undo requested")}</p>
                  <p className="mt-1 text-xs text-zinc-500">{ui("Waiting for your opponent.")}</p>
                </div>
                <span className="text-2xl">↶</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-black text-violet-200">{ui("Opponent requests Undo")}</p>
                  <p className="mt-1 text-xs text-zinc-500">{ui("Restore the exact board and Lucky Square state before the latest move?")}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => void respondUndo(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-300 hover:bg-white/10 disabled:opacity-50"
                  >{ui("Decline")}</button>
                  <button
                    type="button"
                    disabled={Boolean(actionLoading)}
                    onClick={() => void respondUndo(true)}
                    className="rounded-xl bg-violet-300 px-4 py-2 text-xs font-black text-zinc-950 hover:bg-violet-200 disabled:opacity-50"
                  >{ui("Accept Undo")}</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-5 chess-game-grid xl:grid-cols-[290px_minmax(0,1fr)_320px]">
          <aside className="space-y-4">
            <Panel title={ui("Players")} subtitle={ui("Supabase Realtime")}>
              <div className="space-y-2">
                {players.map((player) => {
                  const mine = player.user_id === user.id;
                  return (
                    <div
                      key={player.user_id}
                      className={`rounded-xl border p-3 ${
                        mine
                          ? "border-violet-400/20 bg-violet-400/[0.06]"
                          : "border-white/5 bg-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black text-zinc-200">
                            {player.display_name}
                            {mine ? ui(" · You") : ""}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">
                            {player.chosen_color ?? "—"}
                          </p>
                        </div>
                        <span className="text-2xl">
                          {player.chosen_color === "black" ? "♚" : "♔"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3 text-[10px] leading-5 text-zinc-500">
                {myPlayer ? `You are ${myColor ?? "waiting"}.` : ui("Loading your seat...")}
                {opponent ? ` Opponent: ${opponent.display_name}.` : ui(" Waiting for opponent.")}
              </div>
            </Panel>

            <Panel
              title={ui("Game Controls")}
              subtitle={ui("Negotiated multiplayer actions")}
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void requestUndo()}
                  disabled={!canRequestUndo || Boolean(actionLoading)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-zinc-600 disabled:opacity-40"
                >{ui("↶ Undo")}</button>
                <button
                  type="button"
                  onClick={() => void resign()}
                  disabled={
                    gameState.status !== "playing" || Boolean(actionLoading)
                  }
                  className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-xs font-black text-red-200 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >{ui("Resign")}</button>
              </div>
            </Panel>

            <Panel title={ui("Lucky Square Status")} subtitle={ui("Shared room state")}>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{ui("Active")}</p>
                  <p className="mt-2 text-2xl font-black text-violet-200">
                    {storedState.portalState.portals.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{ui("Next spawn")}</p>
                  <p className="mt-2 text-2xl font-black text-violet-200">
                    {movesUntilNextLuckySpawn}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {storedState.portalState.portals.length === 0 ? (
                  <span className="text-xs text-zinc-600">{ui("No active Lucky Squares")}</span>
                ) : (
                  storedState.portalState.portals.map((portal) => (
                    <span
                      key={portal.id}
                      className="rounded-lg border border-violet-300/10 bg-violet-400/[0.05] px-2 py-1 font-mono text-[10px] font-black text-violet-200"
                    >
                      {portal.square}{" "}
                      {portal.revealed ? effectIcon(portal.effect) : "?"}
                    </span>
                  ))
                )}
              </div>
            </Panel>

            <Panel
              title={ui("Move History")}
              subtitle={ui("Click a move to preview it locally")}
            >
              <div className="max-h-[320px] overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setHistoryPreviewPly(0)}
                  className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                    historyPreviewPly === 0
                      ? "bg-violet-400/10 text-violet-200"
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                >
                  <span>{ui("Start")}</span>
                  <span className="text-[9px]">{ui("Initial position")}</span>
                </button>

                {records.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-zinc-600">{ui("No moves yet")}</p>
                ) : (
                  records.map((record) => (
                    <button
                      key={record.ply}
                      type="button"
                      onClick={() => setHistoryPreviewPly(record.ply)}
                      className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition ${
                        historyPreviewPly === record.ply
                          ? "bg-violet-400/10 text-violet-200"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 text-[9px] font-black text-zinc-600">
                          {Math.floor((record.ply - 1) / 2) + 1}
                          {record.color === "w" ? "." : "..."}
                        </span>
                        <span className="font-mono text-xs font-black text-zinc-200">
                          {record.san}
                        </span>
                      </div>
                      <span className="text-sm">
                        {record.portalEvent ? effectIcon(record.portalEvent.effect) : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Panel>
          </aside>

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {historyPreviewPly !== null && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-violet-300/15 bg-violet-400/[0.06] px-4 py-3">
                  <div>
                    <p className="text-xs font-black text-violet-200">{ui("History Preview")}</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {historyPreviewPly === 0 ? ui("Initial position") : records[historyPreviewPly - 1]?.san}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-zinc-200 transition hover:bg-white/20"
                  >{ui("Back to Live Board")}</button>
                </div>
              )}

              <div className="relative overflow-hidden rounded-[28px] shadow-2xl shadow-black/35">
                <Board
                  board={displayedBoard}
                  selectedSquare={
                    historyPreviewPly === null ? selectedSquare : null
                  }
                  legalMoves={historyPreviewPly === null ? legalMoves : []}
                  lastMove={displayedLastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={
                    historyPreviewPly !== null ||
                    !isMyTurn ||
                    moving ||
                    Boolean(gameState.undo_requested_by) ||
                    Boolean(pendingRoulettePromotion)
                      ? () => {}
                      : handleSquareClick
                  }
                  orientation={orientation}
                  luckySquares={luckySquares}
                  destroyLuckySquares={destroyLuckySquares}
                  teleportLuckySquares={teleportLuckySquares}
                  swapLuckySquares={swapLuckySquares}
                  promoteLuckySquares={promoteLuckySquares}
                  activeLuckySquares={
                    activePortalSquare ? [activePortalSquare] : []
                  }
                />
                {players.length < 2 && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/70 p-4 backdrop-blur-[3px]">
                    <button
                      type="button"
                      onClick={() => void copyRoomCode()}
                      className="w-full max-w-lg rounded-[30px] border border-white/15 bg-zinc-900/95 px-8 py-8 text-center shadow-2xl shadow-black/60 transition hover:border-amber-300/35 hover:bg-zinc-900 active:scale-[0.99]"
                      title={ui("Copy room code")}
                    >
                      <div className="text-4xl">🌐</div>

                      <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-amber-300">{ui("Waiting for players")}</p>

                      <h2 className="mt-2 text-2xl font-black text-white">
                        {players.length}{ui("/2 players connected")}</h2>

                      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">{ui("Share this room code. The game starts automatically when everyone has joined.")}</p>

                      <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-5 py-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">{ui("Room Code")}</p>

                        <p className="mt-2 break-all font-mono text-4xl font-black tracking-[0.16em] text-amber-200 sm:text-5xl">
                          {room.code}
                        </p>
                      </div>

                      <p className="mt-4 text-xs font-bold text-zinc-400">
                        {copied ? ui("✓ Copied to clipboard") : ui("Click this box to copy the code")}
                      </p>
                    </button>
                    <InviteFriendButton overlay />
                  </div>
                )}

                {promotionFrom &&
                  promotionSquare &&
                  historyPreviewPly === null && (
                    <PromotionBar onPromote={promotePawn} />
                  )}

                {gameState.status === "finished" &&
                  historyPreviewPly === null && (
                    <div className="absolute inset-0 z-[90] flex items-center justify-center bg-zinc-950/75 p-6 backdrop-blur-sm">
                      <div className="w-full max-w-sm rounded-3xl border border-violet-300/20 bg-zinc-900/95 p-7 text-center shadow-2xl">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">{ui("Game Over")}</p>
                        <h2 className="mt-2 text-2xl font-black text-white">
                          {resultLabel(gameState)}
                        </h2>
                        <button
                          type="button"
                          disabled={Boolean(actionLoading) || myRematchReady}
                          onClick={() => void requestRematch()}
                          className="mt-5 w-full rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {myRematchReady ? ui("Waiting for opponent...") : ui("↺ Request Rematch")}
                        </button>
                        <Link
                          to="/games/chess/variants/roulette/multiplayer"
                          className="mt-2 block rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-zinc-300 hover:bg-white/10"
                        >{ui("Back to Lobby")}</Link>
                      </div>
                    </div>
                  )}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/5 bg-zinc-900/50 px-4 py-3 text-xs">
                <span className="text-zinc-500">
                  {gameState.status === "playing" ? isMyTurn ? ui("Your turn") : ui("Opponent's turn") : gameState.status === "waiting" ? ui("Waiting for opponent") : ui("Game finished")}
                </span>
                <span className="font-black text-violet-200">{ui("Seed ")}{seed}</span>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <RouletteInfo state={storedState.portalState} />
            <Panel
              title={ui("Lucky Square Info")}
              subtitle={ui("What can happen on a Lucky Square?")}
            >
              <p className="mb-3 rounded-xl border border-violet-300/10 bg-violet-400/[0.05] px-3 py-2 text-[11px] font-bold text-violet-100">{ui("Lucky Squares are visible. Their actual effect stays hidden until triggered.")}</p>

              <div className="mb-3 space-y-1 rounded-xl border border-amber-300/10 bg-amber-300/[0.05] px-3 py-2 text-[10px] font-bold leading-relaxed text-amber-100/90">
                <p>{ui("⏳ Triggered squares survive the opponent's reply, then disappear.")}</p>
                <p>{ui("✨ Every 15 played plies, up to 2 new Lucky Squares spawn.")}</p>
              </div>

              <div className="space-y-2">
                {[
                  ["💥", "Destroy", "Your piece may vanish."],
                  [
                    "🌀",
                    "Teleport",
                    "Your piece jumps to a seeded safe empty square.",
                  ],
                  [
                    "🔄",
                    "Swap",
                    "Your piece may swap with a seeded enemy piece.",
                  ],
                  [
                    "🎴",
                    "Promote",
                    "Any non-King piece draws one mystery card.",
                  ],
                ].map(([icon, title, description]) => (
                  <div
                    key={title}
                    className="flex gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
                  >
                    <div className="text-2xl">{icon}</div>
                    <div>
                      <p className="text-xs font-black text-white">{ui(title)}</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">
                        {ui(description)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title={ui("Promotion Card Pool")}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["♙", "8", "Pawn"],
                  ["♗", "2", "Bishop"],
                  ["♘", "2", "Knight"],
                  ["♖", "2", "Rook"],
                  ["♕", "1", "Queen"],
                  ["♔", "1", "King"],
                ].map(([symbol, count, name]) => (
                  <div
                    key={name}
                    className="rounded-xl border border-white/5 bg-white/[0.03] p-2 text-center"
                  >
                    <div className="text-2xl text-amber-100">{symbol}</div>
                    <p className="mt-1 text-[10px] font-black text-zinc-300">
                      {count}× {name}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[10px] font-bold text-red-300/80">{ui("⚠ The King card is still the prank card.")}</p>
            </Panel>

            <Panel title={ui("Roulette Events")}>
              {storedState.portalState.events.length === 0 ? (
                <p className="text-xs text-zinc-500">{ui("No Lucky Square has fired yet")}</p>
              ) : (
                <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                  {[...storedState.portalState.events]
                    .reverse()
                    .map((event, index) => (
                      <div
                        key={`${event.ply}-${index}`}
                        className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-white">
                            {effectIcon(event.effect)} {event.square}
                          </span>
                          <span className="text-[9px] font-bold text-zinc-600">
                            #{event.ply}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-500">
                          {event.result}
                          {event.destination ? ` → ${event.destination}` : ""}
                          {event.swapSquare ? ` ↔ ${event.swapSquare}` : ""}
                          {event.promotionCard ? ` · ${promotionCardNames[event.promotionCard]}` : ""}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </Panel>
          </aside>
        </div>
      </div>

      {pendingRoulettePromotion && (
        <PromotionRouletteModal
          pending={pendingRoulettePromotion.pending}
          color={pendingRoulettePromotion.move.color}
          piece={pendingRoulettePromotion.move.piece}
          onResolve={resolvePromotionCard}
        />
      )}
    </main>
  );
}
