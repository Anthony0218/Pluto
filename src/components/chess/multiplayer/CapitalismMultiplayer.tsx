import { useInviteAutoJoin } from "@/hooks/useInviteAutoJoin";
import VisibleGameResult from "@/components/chess/VisibleGameResult";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { playChessSound } from "@/games/chess/audio/chessAudio";
import { useVariantRecordAudio } from "@/games/chess/audio/useVariantRecordAudio";
import type { ChessSoundEvent } from "@/games/chess/audio/chessAudio";
import { ui, useUiLanguage } from "@/i18n/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Chess, type Square } from "chess.js";

import Board from "../singleplayer/Board";
import PromotionBar from "../singleplayer/PromotionBar";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { getSquareName } from "../../../utils/chessUtils";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../../utils/sound";

import {
  ROYAL_POWER_COSTS,
  SHOP_PIECE_COSTS,
  applyRoyalPower,
  buyPiece,
  canBuyPiece,
  canUseRoyalPower,
  createCapitalismSeed,
  createInitialCapitalState,
  getAvailableShopSquares,
  getShopSpawnSquares,
  isThreefoldFromCapitalRecords,
  missionDefinitions,
  resolveCapitalismAfterMove,
  sideFromColor,
  type CapitalSide,
  type CapitalState,
  type CapitalismMoveRecord,
  type RoyalPowerId,
  type ShopPieceType,
} from "../../../games/chess/variants/capitalismChess";
import VariantRoomSetup from "./VariantRoomSetup";

type PlayerColor = "white" | "black";
type PromotionPiece = "q" | "r" | "b" | "n";

type VariantRoom = {
  id: string;
  code: string;
  host_id: string;
  variant: string;
  status: "waiting" | "playing" | "finished";
};

type VariantRoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: PlayerColor;
};

type CapitalismStoredState = {
  capital: CapitalState;
  records: CapitalismMoveRecord[];
};

type VariantGame = {
  room_id: string;
  variant: "capitalism";
  seed: number;
  initial_fen: string;
  fen: string;
  moves: string[];
  state: CapitalismStoredState;
  status: "waiting" | "playing" | "finished";
  winner: "white" | "black" | "draw" | null;
  end_reason: string | null;
  version: number;
  last_move_from: string | null;
  last_move_to: string | null;
  white_rematch_ready: boolean | null;
  black_rematch_ready: boolean | null;
  undo_requested_by: string | null;
  undo_requested_version: number | null;
  undo_last_requested_by: string | null;
  undo_last_requested_version: number | null;
};

type FinishedGame = {
  winner: "white" | "black" | "draw";
  reason: string;
} | null;

const START_FEN = new Chess().fen();

const shopPieces: Array<{
  type: ShopPieceType;
  label: string;
  white: string;
  black: string;
}> = [
  { type: "p", label: "Pawn", white: "♙", black: "♟" },
  { type: "n", label: "Knight", white: "♘", black: "♞" },
  { type: "b", label: "Bishop", white: "♗", black: "♝" },
  { type: "r", label: "Rook", white: "♖", black: "♜" },
  { type: "q", label: "Queen", white: "♕", black: "♛" },
];

const royalPowers: Array<{
  id: RoyalPowerId;
  label: string;
  detail: string;
}> = [
  {
    id: "mission_decree",
    label: "Mission Decree",
    detail: "Replace your current mission with a new contract.",
  },
  {
    id: "bounty_decree",
    label: "Bounty Decree",
    detail: "Replace your current bounty target and reward.",
  },
];

function sideToColor(side: CapitalSide): "w" | "b" {
  return side === "white" ? "w" : "b";
}

function oppositeColor(color: "w" | "b"): PlayerColor {
  return color === "w" ? "black" : "white";
}

function createInitialStoredState(seed: number): CapitalismStoredState {
  const game = new Chess();
  return {
    capital: createInitialCapitalState(game, seed),
    records: [],
  };
}

function normalizeStoredState(
  value: unknown,
  seed: number,
): CapitalismStoredState {
  const fallback = createInitialStoredState(seed);
  if (!value || typeof value !== "object") return fallback;

  const raw = value as Partial<CapitalismStoredState>;

  return {
    capital:
      raw.capital && typeof raw.capital === "object"
        ? (raw.capital as CapitalState)
        : fallback.capital,
    records: Array.isArray(raw.records)
      ? (raw.records as CapitalismMoveRecord[])
      : [],
  };
}

function getCheckedKingSquare(game: Chess): Square | null {
  if (!game.isCheck()) return null;
  const color = game.turn();
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece?.type === "k" && piece.color === color) {
        return piece.square as Square;
      }
    }
  }
  return null;
}

function gameOutcome(
  game: Chess,
  records: CapitalismMoveRecord[],
): FinishedGame {
  if (game.isCheckmate()) {
    return {
      winner: oppositeColor(game.turn()),
      reason: "checkmate",
    };
  }

  if (game.isStalemate()) {
    return { winner: "draw", reason: "stalemate" };
  }

  if (game.isInsufficientMaterial()) {
    return { winner: "draw", reason: "insufficient" };
  }

  if (game.isDrawByFiftyMoves()) {
    return { winner: "draw", reason: "fifty" };
  }

  if (isThreefoldFromCapitalRecords(records, game.fen())) {
    return { winner: "draw", reason: "repetition" };
  }

  return null;
}

function stateBeforeLastMove(
  seed: number,
  state: CapitalismStoredState,
): {
  fen: string;
  state: CapitalismStoredState;
  lastFrom: string | null;
  lastTo: string | null;
} | null {
  if (state.records.length === 0) return null;

  const previousRecords = state.records.slice(0, -1);
  const previousRecord = previousRecords.at(-1) ?? null;

  if (!previousRecord) {
    return {
      fen: START_FEN,
      state: createInitialStoredState(seed),
      lastFrom: null,
      lastTo: null,
    };
  }

  return {
    fen: previousRecord.fenAfter,
    state: {
      capital: previousRecord.stateAfter,
      records: previousRecords,
    },
    lastFrom: previousRecord.from,
    lastTo: previousRecord.to,
  };
}

function MissionCard({
  side,
  capital,
}: {
  side: CapitalSide;
  capital: CapitalState;
}) {
  useUiLanguage();
  const mission = capital.missions[side];
  const definition = missionDefinitions[mission.id];

  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
            {side === "white" ? ui("White mission") : ui("Black mission")}
          </p>
          <p className="mt-1 text-sm font-black text-zinc-100">
            {ui(definition.label)}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">
            {definition.detail}
          </p>
          {mission.id === "king_journey" && mission.targetSquare && (
            <p className="mt-2 font-mono text-xs font-black uppercase text-violet-300">{ui("Target")}{mission.targetSquare}
            </p>
          )}
        </div>
        <span className="rounded-lg bg-emerald-400/10 px-2 py-1 text-xs font-black text-emerald-300">
          +{mission.reward}
        </span>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  useUiLanguage();
  return (
    <section className="rounded-3xl border border-white/5 bg-zinc-900/75 p-4 shadow-xl shadow-black/20">
      <h2 className="font-black text-zinc-100">{ui(title)}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function CapitalismMultiplayerLobby() {
  useUiLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [displayName, setDisplayName] = useState(
    (profile as { username?: string | null } | null)?.username ?? "Player",
  );
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "");
  useInviteAutoJoin(() => joinRoom());
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (!user || busy) return;

    setBusy("create");
    setError(null);

    const seed = createCapitalismSeed();
    const state = createInitialStoredState(seed);

    const { data, error: rpcError } = await supabase.rpc(
      "create_capitalism_variant_room",
      {
        p_seed: seed,
        p_initial_state: state,
        p_display_name: displayName.trim() || "Player",
        p_host_color: "black",
      },
    );

    setBusy(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(
      `/games/chess/variants/capitalism/multiplayer/${String(data).toUpperCase()}`,
    );
  }

  async function joinRoom() {
    if (!user || busy || !joinCode.trim()) return;

    setBusy("join");
    setError(null);

    const code = joinCode.trim().toUpperCase();

    const { error: rpcError } = await supabase.rpc(
      "join_capitalism_variant_room",
      {
        p_code: code,
        p_display_name: displayName.trim() || "Player",
      },
    );

    setBusy(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(`/games/chess/variants/capitalism/multiplayer/${code}`);
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-amber-400/15 bg-zinc-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-3xl">
              🪙
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-400">{ui("Multiplayer Variant")}</p>
              <h1 className="mt-1 text-3xl font-black">{ui("Capitalism Chess")}</h1>
              <p className="mt-1 text-sm text-zinc-500">{ui("Coins come only from missions and bounty rewards.")}</p>
            </div>
          </div>

          <label className="mt-8 block text-xs font-black uppercase tracking-wider text-zinc-500">{ui("Display name")}</label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-amber-400/40"
          />

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {ui(error)}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <h2 className="font-black">{ui("Create room")}</h2>
              <p className="mt-1 text-xs text-zinc-500">{ui("Colors are picked in the room.")}</p>


              <button
                type="button"
                onClick={createRoom}
                disabled={busy !== null}
                className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 font-black text-amber-950 disabled:opacity-50"
              >
                {busy === "create" ? ui("Creating...") : ui("Create Capitalism room")}
              </button>
            </section>

            <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <h2 className="font-black">{ui("Join room")}</h2>
              <p className="mt-1 text-xs text-zinc-500">{ui("Enter the room code from the other player.")}</p>

              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                placeholder={ui("ROOM CODE")}
                className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-amber-400/40"
              />

              <button
                type="button"
                onClick={joinRoom}
                disabled={busy !== null || !joinCode.trim()}
                className="mt-4 w-full rounded-xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 font-black text-amber-200 disabled:opacity-50"
              >
                {busy === "join" ? ui("Joining...") : ui("Join room")}
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export function CapitalismMultiplayerGame() {
  useUiLanguage();
  const { roomCode = "" } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [promotion, setPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [selectedShopPiece, setSelectedShopPiece] =
    useState<ShopPieceType>("p");
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [moving, setMoving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
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

  const lastVersionRef = useRef<number | null>(null);

  const me = players.find((player) => player.user_id === user?.id) ?? null;
  const mySide: CapitalSide | null = me?.chosen_color ?? null;
  const myColor = mySide ? sideToColor(mySide) : null;
  const orientation: "white" | "black" = mySide === "black" ? "black" : "white";

  const stored = useMemo(
    () =>
      gameState
        ? normalizeStoredState(gameState.state, Number(gameState.seed))
        : null,
    [gameState],
  );
  useVariantRecordAudio(stored?.records ?? null, record => {
    const sounds: ChessSoundEvent[] = [];
    if (record.economy.bountyClaimed) sounds.push("bountyComplete");
    if (record.economy.missionCompleted) sounds.push("missionComplete");
    return sounds;
  });

  const liveGame = useMemo(
    () => (gameState?.fen ? new Chess(gameState.fen) : new Chess()),
    [gameState?.fen],
  );

  const previewRecord =
    historyPreviewPly !== null && stored
      ? (stored.records[historyPreviewPly - 1] ?? null)
      : null;

  const displayedGame = useMemo(
    () => (previewRecord ? new Chess(previewRecord.fenAfter) : liveGame),
    [previewRecord, liveGame],
  );

  const displayedCapital = previewRecord?.stateAfter ?? stored?.capital ?? null;

  const loadAll = useCallback(async () => {
    if (!user || !roomCode) return;

    const { data: roomData, error: roomError } = await supabase
      .from("variant_rooms")
      .select("id, code, host_id, variant, status")
      .eq("code", roomCode.toUpperCase())
      .eq("variant", "capitalism")
      .single();

    if (roomError || !roomData) {
      setError(roomError?.message ?? "Room not found.");
      return;
    }

    const loadedRoom = roomData as VariantRoom;

    const [
      { data: playerData, error: playerError },
      { data: gameData, error: gameError },
    ] = await Promise.all([
      supabase
        .from("variant_room_players")
        .select("room_id, user_id, seat, display_name, chosen_color")
        .eq("room_id", loadedRoom.id)
        .order("seat", { ascending: true }),
      supabase
        .from("variant_games")
        .select(
          `
              room_id,
              variant,
              seed,
              initial_fen,
              fen,
              moves,
              state,
              status,
              winner,
              end_reason,
              version,
              last_move_from,
              last_move_to,
              white_rematch_ready,
              black_rematch_ready,
              undo_requested_by,
              undo_requested_version,
              undo_last_requested_by,
              undo_last_requested_version
            `,
        )
        .eq("room_id", loadedRoom.id)
        .single(),
    ]);

    if (playerError || gameError || !gameData) {
      setError(
        playerError?.message ?? gameError?.message ?? "Game load failed.",
      );
      return;
    }

    setRoom(loadedRoom);
    setPlayers((playerData ?? []) as VariantRoomPlayer[]);
    setGameState(gameData as VariantGame);
    lastVersionRef.current = Number((gameData as VariantGame).version);
  }, [roomCode, user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!room) return;

    const channel = supabase
      .channel(`capitalism:${room.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_games",
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          const next = payload.new as VariantGame;
          lastVersionRef.current = Number(next.version);
          setGameState(next);
          setHistoryPreviewPly(null);
          setSelectedSquare(null);
          setLegalMoves([]);
          setPromotion(null);
          setMoving(false);
          setActionBusy(null);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "variant_room_players",
          filter: `room_id=eq.${room.id}`,
        },
        () => void loadAll(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [room, loadAll]);

  useEffect(() => {
    if (!room) return;

    const timer = window.setInterval(async () => {
      const { data } = await supabase
        .from("variant_games")
        .select(
          `
            room_id,
            variant,
            seed,
            initial_fen,
            fen,
            moves,
            state,
            status,
            winner,
            end_reason,
            version,
            last_move_from,
            last_move_to,
            white_rematch_ready,
            black_rematch_ready,
            undo_requested_by,
            undo_requested_version,
            undo_last_requested_by,
            undo_last_requested_version
          `,
        )
        .eq("room_id", room.id)
        .single();

      if (!data) return;

      const next = data as VariantGame;
      if (
        lastVersionRef.current !== Number(next.version) ||
        next.undo_requested_by !== gameState?.undo_requested_by ||
        next.white_rematch_ready !== gameState?.white_rematch_ready ||
        next.black_rematch_ready !== gameState?.black_rematch_ready ||
        next.status !== gameState?.status
      ) {
        lastVersionRef.current = Number(next.version);
        setGameState(next);
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [
    room,
    gameState?.undo_requested_by,
    gameState?.white_rematch_ready,
    gameState?.black_rematch_ready,
    gameState?.status,
  ]);

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  async function commitMove(
    from: Square,
    to: Square,
    promotionPiece?: PromotionPiece,
  ) {
    if (
      !room ||
      !gameState ||
      !stored ||
      !myColor ||
      !mySide ||
      moving ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== myColor
    ) {
      return;
    }

    const nextGame = new Chess(liveGame.fen());
    const destinationBefore = nextGame.get(to);

    let move;
    try {
      move = nextGame.move({
        from,
        to,
        ...(promotionPiece ? { promotion: promotionPiece } : {}),
      });
    } catch {
      setError("Illegal move.");
      return;
    }

    const captured =
      move.captured === "p" ||
      move.captured === "n" ||
      move.captured === "b" ||
      move.captured === "r" ||
      move.captured === "q"
        ? move.captured
        : undefined;

    const promotedTo =
      move.promotion === "q" ||
      move.promotion === "r" ||
      move.promotion === "b" ||
      move.promotion === "n"
        ? move.promotion
        : undefined;

    let capturedSquare: Square | null = null;
    if (captured) {
      capturedSquare = destinationBefore
        ? move.to
        : (`${move.to[0]}${move.from[1]}` as Square);
    }

    const economy = resolveCapitalismAfterMove({
      previousState: stored.capital,
      gameAfterMove: nextGame,
      seed: Number(gameState.seed),
      move: {
        color: move.color,
        piece: move.piece,
        from: move.from,
        to: move.to,
        captured,
        capturedSquare,
        promotion: promotedTo,
        isCheck: nextGame.isCheck(),
        isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
        isKingsideCastle: move.isKingsideCastle(),
      },
    });

    const nextPly = stored.records.length + 1;
    const record: CapitalismMoveRecord = {
      ply: nextPly,
      moveNumber: Math.ceil(nextPly / 2),
      color: move.color,
      san: move.san,
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured,
      promotion: promotedTo,
      fenAfter: nextGame.fen(),
      economy: economy.event,
      stateAfter: economy.state,
    };

    const nextRecords = [...stored.records, record];
    const nextState: CapitalismStoredState = {
      capital: economy.state,
      records: nextRecords,
    };

    const finish = gameOutcome(nextGame, nextRecords);

    setMoving(true);
    setError(null);
    clearSelection();
    setPromotion(null);

    setGameState((current) =>
      current
        ? {
            ...current,
            fen: nextGame.fen(),
            moves: [...(current.moves ?? []), move.san],
            state: nextState,
            last_move_from: move.from,
            last_move_to: move.to,
            status: finish ? "finished" : "playing",
            winner: finish?.winner ?? null,
            end_reason: finish?.reason ?? null,
            version: current.version + 1,
          }
        : current,
    );

    if (captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);

    const { error: rpcError } = await supabase.rpc("play_capitalism_move", {
      p_room_id: room.id,
      p_expected_version: gameState.version,
      p_new_fen: nextGame.fen(),
      p_san: move.san,
      p_new_state: nextState,
      p_from: move.from,
      p_to: move.to,
      p_winner: finish?.winner ?? null,
      p_end_reason: finish?.reason ?? null,
    });

    if (rpcError) {
      setError(rpcError.message);
      await loadAll();
    }

    setMoving(false);
  }

  function handleSquareClick(row: number, column: number) {
    if (
      !gameState ||
      !myColor ||
      moving ||
      historyPreviewPly !== null ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== myColor
    ) {
      return;
    }

    const square = getSquareName(row, column);

    if (!selectedSquare) {
      const piece = liveGame.get(square);
      if (!piece || piece.color !== myColor) return;

      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      setLegalMoves(
        liveGame
          .moves({ square, verbose: true })
          .map((candidate) => candidate.to),
      );
      return;
    }

    const selectedPiece = liveGame.get(selectedSquare);
    if (
      selectedPiece?.type === "p" &&
      legalMoves.includes(square) &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }

    if (!legalMoves.includes(square)) {
      const clicked = liveGame.get(square);
      if (clicked?.color === myColor) {
        setSelectedSquare(square);
        playPieceSelectSound(clicked.type);
        setLegalMoves(
          liveGame
            .moves({ square, verbose: true })
            .map((candidate) => candidate.to),
        );
      } else {
        clearSelection();
      }
      return;
    }

    void commitMove(selectedSquare, square);
  }

  async function purchasePiece(piece: ShopPieceType, square: Square) {
    if (
      !room ||
      !gameState ||
      !stored ||
      !mySide ||
      !myColor ||
      actionBusy ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== myColor
    ) {
      return;
    }

    const nextGame = new Chess(liveGame.fen());

    if (
      !canBuyPiece({
        state: stored.capital,
        game: nextGame,
        side: mySide,
        piece,
        square,
      })
    ) {
      setError("That market purchase is not legal right now.");
      return;
    }

    const nextCapital = buyPiece({
      state: stored.capital,
      game: nextGame,
      seed: Number(gameState.seed),
      side: mySide,
      piece,
      square,
    });

    const nextState: CapitalismStoredState = {
      capital: nextCapital,
      records: stored.records,
    };

    setActionBusy("purchase");
    setError(null);
    clearSelection();

    setGameState((current) =>
      current
        ? {
            ...current,
            fen: nextGame.fen(),
            state: nextState,
            version: current.version + 1,
          }
        : current,
    );

    const { error: rpcError } = await supabase.rpc(
      "purchase_capitalism_piece",
      {
        p_room_id: room.id,
        p_expected_version: gameState.version,
        p_piece: piece,
        p_square: square,
        p_new_fen: nextGame.fen(),
        p_new_state: nextState,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      await loadAll();
    } else {
      playChessSound("marketSpawn");
    }

    setActionBusy(null);
  }

  async function useRoyalPower(power: RoyalPowerId) {
    if (
      !room ||
      !gameState ||
      !stored ||
      !mySide ||
      !myColor ||
      actionBusy ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== myColor ||
      !canUseRoyalPower(stored.capital, mySide, power)
    ) {
      return;
    }

    const nextCapital = applyRoyalPower({
      state: stored.capital,
      game: new Chess(liveGame.fen()),
      seed: Number(gameState.seed),
      side: mySide,
      power,
    });

    const nextState: CapitalismStoredState = {
      capital: nextCapital,
      records: stored.records,
    };

    setActionBusy("power");
    setError(null);

    setGameState((current) =>
      current
        ? {
            ...current,
            state: nextState,
            version: current.version + 1,
          }
        : current,
    );

    const { error: rpcError } = await supabase.rpc(
      "use_capitalism_royal_power",
      {
        p_room_id: room.id,
        p_expected_version: gameState.version,
        p_power: power,
        p_new_state: nextState,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      await loadAll();
    }

    setActionBusy(null);
  }

  async function requestUndo() {
    if (
      !room ||
      !gameState ||
      !stored ||
      actionBusy ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by
    ) {
      return;
    }

    const previous = stateBeforeLastMove(Number(gameState.seed), stored);
    if (!previous) return;

    setActionBusy("undo");
    setError(null);

    const { error: rpcError } = await supabase.rpc("request_capitalism_undo", {
      p_room_id: room.id,
      p_previous_fen: previous.fen,
      p_previous_state: previous.state,
      p_previous_last_from: previous.lastFrom,
      p_previous_last_to: previous.lastTo,
    });

    setActionBusy(null);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function respondUndo(accept: boolean) {
    if (!room || !gameState?.undo_requested_by || actionBusy) return;

    setActionBusy("undo-response");
    const { error: rpcError } = await supabase.rpc("respond_capitalism_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });

    setActionBusy(null);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function resign() {
    if (!room || gameState?.status !== "playing" || actionBusy) return;

    setActionBusy("resign");
    const { error: rpcError } = await supabase.rpc("resign_capitalism_game", {
      p_room_id: room.id,
    });
    setActionBusy(null);

    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function requestRematch() {
    if (!room || gameState?.status !== "finished" || actionBusy) return;

    const seed = createCapitalismSeed();
    const nextState = createInitialStoredState(seed);

    setActionBusy("rematch");

    const { error: rpcError } = await supabase.rpc(
      "request_capitalism_rematch",
      {
        p_room_id: room.id,
        p_next_seed: seed,
        p_next_state: nextState,
      },
    );

    setActionBusy(null);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  if (!room || !gameState || !stored || !me || !displayedCapital) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="font-black">{ui("Loading Capitalism room…")}</p>
          {error && <p className="mt-3 text-sm text-red-300">{ui(error)}</p>}
        </div>
      </main>
    );
  }

  const liveFinish: FinishedGame =
    gameState.status === "finished" && gameState.winner
      ? {
          winner: gameState.winner,
          reason: gameState.end_reason ?? "finished",
        }
      : null;

  const displayedLastMove = previewRecord
    ? { from: previewRecord.from, to: previewRecord.to }
    : gameState.last_move_from && gameState.last_move_to
      ? {
          from: gameState.last_move_from as Square,
          to: gameState.last_move_to as Square,
        }
      : null;

  const displayedBounties = [
    displayedCapital.bountyTargets.white,
    displayedCapital.bountyTargets.black,
  ].filter((square): square is Square => Boolean(square));

  const whiteJourney =
    displayedCapital.missions.white.id === "king_journey" &&
    displayedCapital.missions.white.targetSquare
      ? [displayedCapital.missions.white.targetSquare]
      : [];

  const blackJourney =
    displayedCapital.missions.black.id === "king_journey" &&
    displayedCapital.missions.black.targetSquare
      ? [displayedCapital.missions.black.targetSquare]
      : [];

  const displayedTurnSide: CapitalSide = sideFromColor(displayedGame.turn());
  const displayedShopSquares = [
    ...getShopSpawnSquares("white"),
    ...getShopSpawnSquares("black"),
  ];
  const displayedAvailableShopSquares = getAvailableShopSquares(
    displayedGame,
    displayedTurnSide,
  );

  const checkedKingSquare = getCheckedKingSquare(displayedGame);
  const canAct =
    gameState.status === "playing" &&
    myColor === liveGame.turn() &&
    !gameState.undo_requested_by &&
    !moving &&
    !actionBusy;

  const myAvailableSquares = mySide
    ? getAvailableShopSquares(liveGame, mySide)
    : [];

  const myRematchReady =
    mySide === "white"
      ? Boolean(gameState.white_rematch_ready)
      : Boolean(gameState.black_rematch_ready);

  if (room.status === "waiting") {
    return (
      <VariantRoomSetup
        roomId={room.id}
        variantName={"Capitalism Chess"}
        lobbyPath={"/games/chess/variants/capitalism/multiplayer"}
        onStarted={() => void loadAll()}
      />
    );
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <ChessPageHeader className="mb-6 flex flex-col gap-4 rounded-3xl border border-amber-400/10 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between" description={<> {ui("Room")}<span className="font-mono">{room.code}</span> </>}>


          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-black">
            {gameState.status === "waiting" ? ui("Waiting for opponent…") : gameState.status === "finished" ? ui("Game finished") : canAct ? ui("Your turn · market open") : ui("Opponent's turn")}
          </div>
        </ChessPageHeader>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {ui(error)}
          </div>
        )}

        <div className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="space-y-4">
            <Panel title={ui("Treasuries")}>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-center">
                  <p className="text-xs font-black text-zinc-400">{ui("White")}</p>
                  <p className="mt-1 text-3xl font-black text-amber-300">
                    {displayedCapital.coins.white}
                  </p>
                  <p className="text-[10px] text-zinc-600">{ui("coins")}</p>
                </div>
                <div className="rounded-xl border border-white/5 bg-black/20 p-3 text-center">
                  <p className="text-xs font-black text-zinc-400">{ui("Black")}</p>
                  <p className="mt-1 text-3xl font-black text-amber-300">
                    {displayedCapital.coins.black}
                  </p>
                  <p className="text-[10px] text-zinc-600">{ui("coins")}</p>
                </div>
              </div>
            </Panel>

            <Panel title={ui("Contracts")}>
              <div className="space-y-2">
                <MissionCard side="white" capital={displayedCapital} />
                <MissionCard side="black" capital={displayedCapital} />
              </div>
            </Panel>

            <Panel title={ui("Move History")}>
              <ChessMoveHistoryList
                listClassName="max-h-80 rounded-xl border border-white/5 bg-black/20"
                selectedPly={historyPreviewPly}
                emptyLabel="No moves yet"
                entries={stored.records.map((record) => ({
                  ply: record.ply,
                  side: record.color,
                  moveNumber: record.moveNumber,
                  content: <span className="truncate font-mono text-xs font-bold text-zinc-200">{record.san}</span>,
                  trailing: <span className="font-black text-emerald-300">{record.economy.totalEarned > 0 ? `+$${record.economy.totalEarned}` : ""}</span>,
                }))}
                onSelect={(ply) => {
                  setHistoryPreviewPly(ply);
                  clearSelection();
                  setPromotion(null);
                }}
              />
            </Panel>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreviewPly !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{ui("History Preview")}</p>
                  <p className="text-sm text-zinc-400">{ui("Economy and board after move")}{historyPreviewPly}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryPreviewPly(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black"
                >{ui("Back to live board")}</button>
              </div>
            )}

            {promotion && historyPreviewPly === null && (
              <div className="relative mb-3">
                <PromotionBar
                  onPromote={(piece) =>
                    void commitMove(promotion.from, promotion.to, piece)
                  }
                />
              </div>
            )}

            {liveFinish && historyPreviewPly === null && (
              <VisibleGameResult
                winner={liveFinish.winner}
                playerColor={myColor}
                reason={liveFinish.reason}
                actions={
                  <button
                    type="button"
                    onClick={requestRematch}
                    disabled={myRematchReady || Boolean(actionBusy)}
                    className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-3 font-black text-amber-950 disabled:opacity-50"
                  >
                    {myRematchReady ? ui("Waiting for opponent…") : ui("Play again")}
                  </button>
                }
              />
            )}

            <div className="relative">
              <Board
                board={displayedGame.board()}
                selectedSquare={
                  historyPreviewPly !== null ? null : selectedSquare
                }
                legalMoves={historyPreviewPly !== null ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreviewPly !== null || !canAct
                    ? () => {}
                    : handleSquareClick
                }
                bountySquares={displayedBounties}
                shopSpawnSquares={displayedShopSquares}
                availableShopSpawnSquares={displayedAvailableShopSquares}
                whiteMissionTargetSquares={whiteJourney}
                blackMissionTargetSquares={blackJourney}
                orientation={orientation}
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


            </div>
          </section>

          <aside className="space-y-4">
            <Panel title={ui("Piece Market")}>
              <p className="text-xs leading-5 text-zinc-500">{ui("Buy before your move and spawn the piece on an empty original rook square.")}</p>

              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {shopPieces.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => setSelectedShopPiece(item.type)}
                    className={`rounded-xl border px-1 py-2 text-center ${
                      selectedShopPiece === item.type
                        ? "border-amber-300/30 bg-amber-400/15"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="text-xl">
                      {mySide === "black" ? item.black : item.white}
                    </div>
                    <div className="text-[9px] font-black text-zinc-500">
                      ${SHOP_PIECE_COSTS[item.type]}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {(mySide ? getShopSpawnSquares(mySide) : []).map((square) => {
                  const legal =
                    Boolean(mySide) &&
                    canAct &&
                    canBuyPiece({
                      state: stored.capital,
                      game: liveGame,
                      side: mySide!,
                      piece: selectedShopPiece,
                      square,
                    });

                  return (
                    <button
                      key={square}
                      type="button"
                      disabled={!legal}
                      onClick={() =>
                        void purchasePiece(selectedShopPiece, square)
                      }
                      className="rounded-xl border border-amber-300/15 bg-amber-400/[0.07] px-3 py-2 text-xs font-black text-amber-200 disabled:cursor-not-allowed disabled:opacity-30"
                    >{ui("Spawn on")}{square.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              {myAvailableSquares.length === 0 && (
                <p className="mt-3 text-[10px] text-zinc-600">{ui("No shop square is empty for your side right now.")}</p>
              )}
            </Panel>

            <Panel title={ui("Royal Powers")}>
              <div className="space-y-2">
                {royalPowers.map((power) => {
                  const enabled =
                    Boolean(mySide) &&
                    canAct &&
                    canUseRoyalPower(stored.capital, mySide!, power.id);

                  return (
                    <button
                      key={power.id}
                      type="button"
                      disabled={!enabled}
                      onClick={() => void useRoyalPower(power.id)}
                      className="w-full rounded-xl border border-violet-300/15 bg-violet-400/[0.06] p-3 text-left disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-black text-violet-200">
                          {ui(power.label)}
                        </span>
                        <span className="text-xs font-black text-amber-300">
                          ${ROYAL_POWER_COSTS[power.id]}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-zinc-500">
                        {power.detail}
                      </p>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel title={ui("Bounties")}>
              {(["white", "black"] as CapitalSide[]).map((side) => (
                <div
                  key={side}
                  className="mb-2 flex items-center justify-between rounded-xl bg-black/20 p-3 last:mb-0"
                >
                  <div>
                    <p className="text-[10px] font-black uppercase text-zinc-600">
                      {side}{ui("hunts")}</p>
                    <p className="mt-1 font-mono text-sm font-black uppercase text-zinc-200">
                      {displayedCapital.bountyTargets[side] ?? "—"}
                    </p>
                  </div>
                  <span className="text-lg font-black text-amber-300">
                    ${displayedCapital.bountyRewards[side]}
                  </span>
                </div>
              ))}
            </Panel>

            <Panel title={ui("Game Actions")}>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={requestUndo}
                  disabled={
                    gameState.status !== "playing" ||
                    stored.records.length === 0 ||
                    Boolean(gameState.undo_requested_by) ||
                    Boolean(actionBusy)
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black disabled:opacity-40"
                >{ui("↶ Request Undo")}</button>
                <button
                  type="button"
                  onClick={resign}
                  disabled={
                    gameState.status !== "playing" || Boolean(actionBusy)
                  }
                  className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-black text-red-300 disabled:opacity-40"
                >{ui("Resign")}</button>
                <Link
                  to="/games/chess/variants/capitalism/multiplayer"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm font-black text-zinc-300"
                >{ui("Leave room")}</Link>
              </div>
            </Panel>
          </aside>
        </div>

        {gameState.undo_requested_by && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
              {gameState.undo_requested_by === user?.id ? (
                <>
                  <h2 className="text-xl font-black">{ui("Undo requested")}</h2>
                  <p className="mt-2 text-sm text-zinc-500">{ui("Waiting for your opponent to accept or decline.")}</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black">{ui("Opponent requests Undo")}</h2>
                  <p className="mt-2 text-sm text-zinc-500">{ui("Accepting restores the position before the latest chess move, including coins, market purchases, missions, bounties and royal powers.")}</p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void respondUndo(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black"
                    >{ui("Decline")}</button>
                    <button
                      type="button"
                      onClick={() => void respondUndo(true)}
                      className="rounded-xl bg-amber-400 px-4 py-3 font-black text-amber-950"
                    >{ui("Accept")}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
