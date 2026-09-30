import VisibleGameResult from "@/components/chess/VisibleGameResult";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Link, useParams } from "react-router-dom";
import { Chess, type Square } from "chess.js";

import Board from "@/components/chess/singleplayer/Board";
import PromotionBar from "@/components/chess/singleplayer/PromotionBar";

import { getSquareName } from "@/utils/chessUtils";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "@/utils/sound";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

import {
  createRandomStartPosition,
  type RandomStartPosition,
} from "@/games/chess/variants/randomStartChess";

import {
  countPiecesByZone,
  createTotalChaosPosition,
  type TotalChaosPosition,
} from "@/games/chess/variants/totalChaosChess";

import type {
  MultiplayerVariantId,
  TwoPlayerColor,
  VariantGame,
  VariantRoom,
  VariantRoomPlayer,
} from "@/games/chess/multiplayer/variantMultiplayerTypes";
import VariantRoomSetup from "./VariantRoomSetup";

type Props = {
  variant: Extract<MultiplayerVariantId, "randomstart" | "complete-chaos">;
};

type PromotionPiece = "q" | "r" | "b" | "n";

type HistoryRow = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  from: Square;
  to: Square;
  piece: string;
  fenAfter: string;
};

type ActionLoading =
  | "resign"
  | "undo-request"
  | "undo-response"
  | "rematch"
  | null;

const variantInfo = {
  randomstart: {
    title: "Random Start Chess",
    subtitle: "Independent random back ranks. No mirroring. No castling.",
    icon: "🎲",
    lobby: "/games/chess/variants/randomstart/multiplayer",
    accentText: "text-violet-300",
    accentBorder: "border-violet-400/20",
    accentSoft: "bg-violet-400/[0.08]",
    accentSelected: "bg-violet-400/10 text-violet-200",
    accentButton: "bg-violet-400 text-violet-950 hover:bg-violet-300",
    accentOutline:
      "border-violet-400/20 bg-violet-400/[0.07] text-violet-200 hover:bg-violet-400/10",
    overlayBorder: "border-violet-300/20",
    overlayEyebrow: "text-violet-300",
  },
  "complete-chaos": {
    title: "Total Chaos Chess",
    subtitle: "Every piece. Any part of the board.",
    icon: "🌀",
    lobby: "/games/chess/variants/complete-chaos/multiplayer",
    accentText: "text-pink-300",
    accentBorder: "border-pink-400/20",
    accentSoft: "bg-pink-400/[0.08]",
    accentSelected: "bg-pink-400/10 text-pink-200",
    accentButton: "bg-pink-300 text-zinc-950 hover:bg-pink-200",
    accentOutline:
      "border-pink-400/20 bg-pink-400/[0.07] text-pink-200 hover:bg-pink-400/10",
    overlayBorder: "border-pink-300/20",
    overlayEyebrow: "text-pink-300",
  },
} as const;

function normalizeVariantGame(raw: VariantGame): VariantGame {
  return {
    ...raw,
    moves: raw.moves ?? [],
    state: raw.state ?? {},
    white_rematch_ready: raw.white_rematch_ready ?? false,
    black_rematch_ready: raw.black_rematch_ready ?? false,
    next_seed: raw.next_seed ?? null,
    next_initial_fen: raw.next_initial_fen ?? null,
    undo_requested_by: raw.undo_requested_by ?? null,
    undo_requested_version: raw.undo_requested_version ?? null,
    undo_previous_fen: raw.undo_previous_fen ?? null,
    undo_previous_last_from: raw.undo_previous_last_from ?? null,
    undo_previous_last_to: raw.undo_previous_last_to ?? null,
    undo_last_requested_by: raw.undo_last_requested_by ?? null,
    undo_last_requested_version: raw.undo_last_requested_version ?? null,
  };
}

function colorToChess(color: TwoPlayerColor) {
  return color === "white" ? "w" : "b";
}

function chessToPlayerColor(color: "w" | "b"): TwoPlayerColor {
  return color === "w" ? "white" : "black";
}

function getOutcome(game: Chess) {
  if (game.isCheckmate()) {
    return {
      finished: true,
      winner: game.turn() === "w" ? ("black" as const) : ("white" as const),
      reason: "checkmate",
    };
  }

  if (game.isStalemate()) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "stalemate",
    };
  }

  if (game.isThreefoldRepetition()) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "threefold repetition",
    };
  }

  if (game.isInsufficientMaterial()) {
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

  if (game.isDraw()) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "draw",
    };
  }

  return {
    finished: false,
    winner: null,
    reason: null,
  };
}

function replayGame(initialFen: string, moves: string[]) {
  const game = new Chess(initialFen);

  for (const san of moves) {
    game.move(san);
  }

  return game;
}

function buildHistoryRows(initialFen: string, moves: string[]): HistoryRow[] {
  const replay = new Chess(initialFen);
  const rows: HistoryRow[] = [];

  for (const [index, san] of moves.entries()) {
    try {
      const move = replay.move(san);

      rows.push({
        ply: index + 1,
        moveNumber: Math.floor(index / 2) + 1,
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece,
        fenAfter: replay.fen(),
      });
    } catch {
      break;
    }
  }

  return rows;
}

function findCheckedKing(game: Chess): Square | null {
  if (!game.isCheck()) return null;

  const targetColor = game.turn();

  for (const row of game.board()) {
    for (const piece of row) {
      if (piece?.type === "k" && piece.color === targetColor) {
        return piece.square;
      }
    }
  }

  return null;
}

function playLatestMoveSound(initialFen: string, moves: string[]) {
  if (moves.length === 0) return;

  try {
    const replay = new Chess(initialFen);
    let lastMove: ReturnType<Chess["move"]> | null = null;

    for (const san of moves) {
      lastMove = replay.move(san);
    }

    if (!lastMove) return;

    if (lastMove.captured) {
      playPieceCaptureSound(lastMove.piece);
    } else {
      playPieceMoveSound(lastMove.piece);
    }
  } catch {
    // Sound feedback must never break synchronization.
  }
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
    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/15 backdrop-blur-md">
      <div className="mb-4">
        <h2 className="text-sm font-black text-zinc-100">{ui(title)}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{ui(subtitle)}</p>}
      </div>
      {children}
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  useUiLanguage();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-xs last:border-0">
      <span className="text-zinc-500">{ui(label)}</span>
      <span className="font-black text-zinc-200">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(label)}
      </p>
      <p className="mt-2 text-xl font-black text-zinc-200">{value}</p>
    </div>
  );
}

function Lineup({ title, value }: { title: string; value: string }) {
  useUiLanguage();
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {ui(title)}
      </p>
      <p className="mt-2 break-words font-mono text-sm font-black tracking-[0.12em] text-zinc-300">
        {value}
      </p>
    </div>
  );
}

function RuleLine({ icon, text }: { icon: string; text: string }) {
  useUiLanguage();
  return (
    <div className="flex gap-3 rounded-xl border border-white/5 bg-black/20 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-black text-zinc-300">
        {icon}
      </span>
      <p className="text-xs leading-5 text-zinc-500">{ui(text)}</p>
    </div>
  );
}

export default function SeededVariantMultiplayerGame({ variant }: Props) {
  useUiLanguage();
  const { roomCode } = useParams();
  const { user } = useAuth();
  const page = variantInfo[variant];

  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  /* null = live board, 0 = initial position, N = board after ply N */
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );

  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lastSeenMoveCountRef = useRef(0);
  const lastInitialFenRef = useRef<string | null>(null);

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === user?.id) ?? null,
    [players, user?.id],
  );


  const myColor = myPlayer?.chosen_color ?? null;
  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  const historyRows = useMemo(() => {
    if (!gameState?.initial_fen) return [];
    return buildHistoryRows(gameState.initial_fen, gameState.moves);
  }, [gameState?.initial_fen, gameState?.moves]);

  useEffect(() => {
    if (historyPreviewPly !== null && historyPreviewPly > historyRows.length) {
      setHistoryPreviewPly(null);
    }
  }, [historyPreviewPly, historyRows.length]);

  const liveGame = useMemo(() => {
    if (!gameState?.fen) return new Chess();
    return new Chess(gameState.fen);
  }, [gameState?.fen]);

  const previewGame = useMemo(() => {
    if (historyPreviewPly === null || !gameState?.initial_fen) return null;

    if (historyPreviewPly === 0) {
      return new Chess(gameState.initial_fen);
    }

    const row = historyRows[historyPreviewPly - 1];
    return row ? new Chess(row.fenAfter) : null;
  }, [gameState?.initial_fen, historyPreviewPly, historyRows]);

  const displayedGame = previewGame ?? liveGame;
  const board = displayedGame.board();

  const displayedLastMove = useMemo(() => {
    if (historyPreviewPly !== null) {
      if (historyPreviewPly === 0) return null;
      const row = historyRows[historyPreviewPly - 1];
      return row ? { from: row.from, to: row.to } : null;
    }

    if (gameState?.last_move_from && gameState?.last_move_to) {
      return {
        from: gameState.last_move_from as Square,
        to: gameState.last_move_to as Square,
      };
    }

    return null;
  }, [
    gameState?.last_move_from,
    gameState?.last_move_to,
    historyPreviewPly,
    historyRows,
  ]);

  const checkedKingSquare = findCheckedKing(displayedGame);

  const isMyTurn =
    Boolean(myColor) && liveGame.turn() === colorToChess(myColor!);

  const undoPending = Boolean(gameState?.undo_requested_by);

  const canSubmitMove =
    room?.status === "playing" &&
    gameState?.status === "playing" &&
    isMyTurn &&
    !moving &&
    actionLoading === null &&
    historyPreviewPly === null &&
    !undoPending;
  const canMove = canSubmitMove && !pendingPromotion;

  const lastHistoryMove = historyRows[historyRows.length - 1] ?? null;
  const lastMoverColor = lastHistoryMove
    ? chessToPlayerColor(lastHistoryMove.color)
    : null;

  const alreadyRequestedUndoForThisMove =
    Boolean(user?.id) &&
    gameState?.undo_last_requested_by === user?.id &&
    gameState?.undo_last_requested_version === gameState?.version;

  const canRequestUndo =
    gameState?.status === "playing" &&
    gameState.moves.length > 0 &&
    myColor !== null &&
    lastMoverColor === myColor &&
    !undoPending &&
    !alreadyRequestedUndoForThisMove &&
    !moving &&
    actionLoading === null;

  const myUndoRequest =
    Boolean(user?.id) && gameState?.undo_requested_by === user?.id;
  const opponentUndoRequest =
    Boolean(gameState?.undo_requested_by) && !myUndoRequest;

  const myRematchReady =
    myColor === "white"
      ? Boolean(gameState?.white_rematch_ready)
      : myColor === "black"
        ? Boolean(gameState?.black_rematch_ready)
        : false;


  const randomStartMeta: RandomStartPosition | null = useMemo(() => {
    if (
      variant !== "randomstart" ||
      gameState?.seed === null ||
      gameState?.seed === undefined
    ) {
      return null;
    }

    return createRandomStartPosition(gameState.seed);
  }, [variant, gameState?.seed]);

  const chaosMeta: TotalChaosPosition | null = useMemo(() => {
    if (
      variant !== "complete-chaos" ||
      gameState?.seed === null ||
      gameState?.seed === undefined
    ) {
      return null;
    }

    return createTotalChaosPosition(gameState.seed);
  }, [variant, gameState?.seed]);

  const chaosZoneStats = useMemo(() => {
    if (variant !== "complete-chaos" || !gameState?.initial_fen) return null;
    return countPiecesByZone(new Chess(gameState.initial_fen));
  }, [variant, gameState?.initial_fen]);

  const applyAuthoritativeGame = useCallback((raw: VariantGame) => {
    const updated = normalizeVariantGame(raw);
    const nextMoveCount = updated.moves.length;
    const initialChanged =
      lastInitialFenRef.current !== null &&
      updated.initial_fen !== lastInitialFenRef.current;

    if (initialChanged) {
      setHistoryPreviewPly(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
      lastSeenMoveCountRef.current = 0;
    }

    if (nextMoveCount < lastSeenMoveCountRef.current) {
      setHistoryPreviewPly(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
    }

    if (updated.initial_fen && nextMoveCount > lastSeenMoveCountRef.current) {
      playLatestMoveSound(updated.initial_fen, updated.moves);
    }

    lastSeenMoveCountRef.current = nextMoveCount;
    lastInitialFenRef.current = updated.initial_fen;

    setGameState(updated);

    if (updated.undo_requested_by || updated.status !== "playing") {
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
    }
  }, []);

  const loadRoom = useCallback(
    async (silent = false) => {
      if (!roomCode || !user) return;

      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const normalizedCode = roomCode.toUpperCase();

      const { data: roomData, error: roomError } = await supabase
        .from("variant_rooms")
        .select("id, code, host_id, variant, max_players, status, created_at")
        .eq("code", normalizedCode)
        .eq("variant", variant)
        .single();

      if (roomError || !roomData) {
        if (!silent) setError("Room not found.");
        setLoading(false);
        return;
      }

      const loadedRoom = roomData as VariantRoom;

      const { data: playerData, error: playerError } = await supabase
        .from("variant_room_players")
        .select("room_id, user_id, seat, display_name, chosen_color")
        .eq("room_id", loadedRoom.id)
        .order("seat", { ascending: true });

      if (playerError) {
        if (!silent) setError(playerError.message);
        setLoading(false);
        return;
      }

      const loadedPlayers = (playerData ?? []) as VariantRoomPlayer[];

      if (!loadedPlayers.some((player) => player.user_id === user.id)) {
        if (!silent) setError("You are not a player in this room.");
        setLoading(false);
        return;
      }

      const { data: gameData, error: gameError } = await supabase
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
            next_seed,
            next_initial_fen,
            undo_requested_by,
            undo_requested_version,
            undo_previous_fen,
            undo_previous_last_from,
            undo_previous_last_to,
            undo_last_requested_by,
            undo_last_requested_version
          `,
        )
        .eq("room_id", loadedRoom.id)
        .single();

      if (gameError || !gameData) {
        if (!silent) setError("Game could not be loaded.");
        setLoading(false);
        return;
      }

      setRoom(loadedRoom);
      setPlayers(loadedPlayers);
      applyAuthoritativeGame(gameData as VariantGame);
      setLoading(false);
    },
    [applyAuthoritativeGame, roomCode, user, variant],
  );

  useEffect(() => {
    void loadRoom(false);
  }, [loadRoom]);

  useEffect(() => {
    if (!room) return;

    const roomId = room.id;

    const gameChannel = supabase
      .channel(`variant-game-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_games",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          applyAuthoritativeGame(payload.new as VariantGame);
        },
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`variant-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "variant_room_players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          const { data } = await supabase
            .from("variant_room_players")
            .select("room_id, user_id, seat, display_name, chosen_color")
            .eq("room_id", roomId)
            .order("seat", { ascending: true });

          if (data) setPlayers(data as VariantRoomPlayer[]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          setRoom(payload.new as VariantRoom);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(gameChannel);
      void supabase.removeChannel(roomChannel);
    };
  }, [applyAuthoritativeGame, room?.id]);

  /* Realtime is the fast path; polling is only the recovery path. */
  useEffect(() => {
    if (!room) return;

    const interval = window.setInterval(() => {
      if (!moving && actionLoading === null) {
        void loadRoom(true);
      }
    }, 1500);

    return () => window.clearInterval(interval);
  }, [actionLoading, loadRoom, moving, room?.id]);

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  async function submitMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (!room || !gameState || !gameState.initial_fen || !canSubmitMove) {
      return;
    }

    const localGame = replayGame(gameState.initial_fen, gameState.moves);

    let move;

    try {
      move = localGame.move({ from, to, promotion });
    } catch {
      setError("Illegal move.");
      return;
    }

    if (!move) return;

    const outcome = getOutcome(localGame);
    const previousGameState = gameState;

    const optimisticGameState: VariantGame = {
      ...gameState,
      fen: localGame.fen(),
      moves: [...gameState.moves, move.san],
      version: gameState.version + 1,
      last_move_from: move.from,
      last_move_to: move.to,
      status: outcome.finished ? "finished" : "playing",
      winner: outcome.finished ? outcome.winner : null,
      end_reason: outcome.finished ? outcome.reason : null,
      undo_requested_by: null,
      undo_requested_version: null,
    };

    /* Optimistic UI: the local board changes immediately. */
    setGameState(optimisticGameState);
    lastSeenMoveCountRef.current = optimisticGameState.moves.length;

    if (move.captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);

    clearSelection();
    setPendingPromotion(null);
    setMoving(true);
    setError(null);

    const { error: moveError } = await supabase.rpc("play_variant_chess_move", {
      p_room_id: room.id,
      p_expected_variant: variant,
      p_from: move.from,
      p_to: move.to,
      p_move_san: move.san,
      p_new_fen: localGame.fen(),
      /* Server still has the pre-optimistic version. */
      p_expected_version: previousGameState.version,
      p_is_finished: outcome.finished,
      p_winner: outcome.winner,
      p_end_reason: outcome.reason,
    });

    setMoving(false);

    if (moveError) {
      setGameState(previousGameState);
      lastSeenMoveCountRef.current = previousGameState.moves.length;
      setError(moveError.message);
      await loadRoom(true);
    }
  }

  function handleSquareClick(row: number, column: number) {
    if (!canMove) return;

    const square = getSquareName(row, column);
    const piece = liveGame.get(square);

    if (!selectedSquare) {
      if (!piece || !myColor || piece.color !== colorToChess(myColor)) return;

      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((move) => move.to as Square));
      playPieceSelectSound(piece.type);
      return;
    }

    if (piece && myColor && piece.color === colorToChess(myColor)) {
      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((move) => move.to as Square));
      playPieceSelectSound(piece.type);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const movingPiece = liveGame.get(selectedSquare);
    const reachesPromotionRank =
      movingPiece?.type === "p" && (square[1] === "8" || square[1] === "1");

    if (reachesPromotionRank) {
      setPendingPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }

    void submitMove(selectedSquare, square);
  }

  async function promotePawn(piece: PromotionPiece) {
    if (!pendingPromotion) return;
    await submitMove(pendingPromotion.from, pendingPromotion.to, piece);
  }

  function buildUndoSnapshot() {
    if (!gameState?.initial_fen || gameState.moves.length === 0) return null;

    const previousMove =
      historyRows.length >= 2 ? historyRows[historyRows.length - 2] : null;

    return {
      previousFen:
        gameState.moves.length === 1
          ? gameState.initial_fen
          : (previousMove?.fenAfter ?? gameState.initial_fen),
      previousLastFrom: previousMove?.from ?? null,
      previousLastTo: previousMove?.to ?? null,
    };
  }

  async function requestUndo() {
    if (!room || !gameState || !canRequestUndo || !user) return;

    const snapshot = buildUndoSnapshot();
    if (!snapshot) return;

    setActionLoading("undo-request");
    setError(null);

    const { error: undoError } = await supabase.rpc("request_variant_undo", {
      p_room_id: room.id,
      p_previous_fen: snapshot.previousFen,
      p_previous_last_from: snapshot.previousLastFrom,
      p_previous_last_to: snapshot.previousLastTo,
    });

    if (undoError) {
      setError(undoError.message);
    } else {
      setGameState((current) =>
        current
          ? {
              ...current,
              undo_requested_by: user.id,
              undo_requested_version: current.version,
              undo_last_requested_by: user.id,
              undo_last_requested_version: current.version,
            }
          : current,
      );
    }

    await loadRoom(true);
    setActionLoading(null);
  }

  async function respondToUndo(accept: boolean) {
    if (
      !room ||
      !gameState ||
      gameState.status !== "playing" ||
      !gameState.undo_requested_by ||
      !opponentUndoRequest ||
      actionLoading
    ) {
      return;
    }

    setActionLoading("undo-response");
    setError(null);

    const { error: undoError } = await supabase.rpc("respond_variant_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });

    if (undoError) {
      setError(undoError.message);
    } else if (accept) {
      setHistoryPreviewPly(null);
      clearSelection();
      setPendingPromotion(null);
    }

    await loadRoom(true);
    setActionLoading(null);
  }

  function buildNextSetup() {
    if (variant === "randomstart") {
      const next = createRandomStartPosition();
      return { seed: next.seed, initialFen: next.fen };
    }

    const next = createTotalChaosPosition();
    return { seed: next.seed, initialFen: next.fen };
  }

  async function requestRematch() {
    if (
      !room ||
      !gameState ||
      gameState.status !== "finished" ||
      myRematchReady ||
      actionLoading
    ) {
      return;
    }

    const next = buildNextSetup();

    setActionLoading("rematch");
    setError(null);

    const { error: rematchError } = await supabase.rpc(
      "request_variant_rematch",
      {
        p_room_id: room.id,
        p_next_seed: next.seed,
        p_next_initial_fen: next.initialFen,
      },
    );

    if (rematchError) setError(rematchError.message);

    await loadRoom(true);
    setActionLoading(null);
  }

  async function resign() {
    if (
      !room ||
      gameState?.status !== "playing" ||
      moving ||
      actionLoading ||
      undoPending
    ) {
      return;
    }

    setActionLoading("resign");
    setError(null);

    const { error: resignError } = await supabase.rpc("resign_variant_game", {
      p_room_id: room.id,
      p_expected_variant: variant,
    });

    if (resignError) setError(resignError.message);

    await loadRoom(true);
    setActionLoading(null);
  }

  async function copyRoomCode() {
    if (!room?.code || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard is a convenience only.
    }
  }

  if (!user) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
        <div className="mx-auto max-w-2xl rounded-3xl border border-amber-400/20 bg-amber-400/[0.06] p-6">{ui("Sign in to open this multiplayer room.")}</div>
      </main>
    );
  }

  if (loading && !gameState) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-900/70 p-6 text-center">{ui("Loading multiplayer room...")}</div>
      </main>
    );
  }

  if (!room || !gameState) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
        <div className="mx-auto max-w-2xl rounded-3xl border border-red-400/20 bg-red-400/[0.06] p-6">
          <p className="font-black text-red-200">
            {error ?? "Room could not be loaded."}
          </p>
          <Link
            to={page.lobby}
            className="mt-4 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-zinc-200"
          >{ui("Back to lobby")}</Link>
        </div>
      </main>
    );
  }

  const finished = gameState.status === "finished";
  const statusText =
    room.status === "waiting"
      ? "Waiting for opponent..."
      : finished
        ? gameState.winner === "draw"
          ? "Draw"
          : gameState.winner === myColor
            ? "You win"
            : "You lose"
        : isMyTurn
          ? "Your turn"
          : "Opponent's turn";

  const whiteLineup = randomStartMeta
    ? randomStartMeta.whiteBackRank
        .map((piece) => piece.toUpperCase())
        .join(" ")
    : "—";

  const blackLineup = randomStartMeta
    ? randomStartMeta.blackBackRank
        .map((piece) => piece.toUpperCase())
        .join(" ")
    : "—";

  if (room.status === "waiting") {
    return (
      <VariantRoomSetup
        roomId={room.id}
        variantName={page.title}
        lobbyPath={page.lobby}
        onStarted={() => void loadRoom(true)}
      />
    );
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <ChessPageHeader className={`mb-6 rounded-3xl border ${page.accentBorder} bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20`} description={<> {ui(page.subtitle)} </>}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${page.accentBorder} ${page.accentSoft} text-3xl`}
              >
                {page.icon}
              </div>

              <div>
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.28em] ${page.accentText}`}
                >{ui("Chess Variant · Multiplayer")}</p>
                <h1 className="mt-0.5 text-2xl font-black text-white">
                  {ui(page.title)}
                </h1>
                <p className="mt-1 text-sm text-zinc-500">{ui(page.subtitle)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyRoomCode()}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-300 transition hover:bg-white/10"
              >
                {copied ? ui("Copied") : `Room ${room.code}`}
              </button>

              <span
                className={`rounded-xl border px-3 py-2 text-xs font-black ${
                  finished
                    ? "border-zinc-500/20 bg-zinc-500/10 text-zinc-300"
                    : isMyTurn
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                      : `${page.accentBorder} ${page.accentSoft} ${page.accentText}`
                }`}
              >
                {statusText}
              </span>
            </div>
          </div>
        </ChessPageHeader>

        <div className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title={ui("Players")} subtitle={ui("Online room")}>
                <div className="space-y-2">
                  {players.map((player) => {
                    const mine = player.user_id === user.id;
                    return (
                      <div
                        key={player.user_id}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                          mine
                            ? `${page.accentBorder} ${page.accentSoft}`
                            : "border-white/5 bg-black/20"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-zinc-200">
                            {player.display_name}
                            {mine ? ui(" · You") : ""}
                          </p>
                          <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-600">
                            {player.chosen_color ?? "Waiting"}
                          </p>
                        </div>
                        <span className="text-2xl">
                          {player.chosen_color === "black" ? "♚" : "♔"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel title={ui("Game Controls")} subtitle={ui("Players and actions")}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void requestUndo()}
                    disabled={!canRequestUndo}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/[0.02] disabled:text-zinc-600 disabled:opacity-45 disabled:hover:bg-white/[0.02]"
                  >{ui("↶ Undo")}</button>

                  <button
                    type="button"
                    onClick={() => void resign()}
                    disabled={
                      gameState.status !== "playing" ||
                      moving ||
                      actionLoading !== null ||
                      undoPending
                    }
                    className="rounded-xl border border-red-400/15 bg-red-400/[0.05] px-3 py-2.5 text-xs font-black text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                  >{ui("Resign")}</button>
                </div>

                {alreadyRequestedUndoForThisMove && !undoPending && (
                  <p className="mt-2 text-[10px] leading-4 text-zinc-600">{ui("You already requested undo for this move.")}</p>
                )}

                {myUndoRequest && (
                  <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3">
                    <p className="text-xs font-black text-amber-200">{ui("Undo request sent")}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{ui("Waiting for opponent response...")}</p>
                  </div>
                )}

                {opponentUndoRequest && (
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3">
                    <p className="text-xs font-black text-amber-200">{ui("Opponent requests to undo the last move.")}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => void respondToUndo(true)}
                        className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-black text-emerald-950 disabled:opacity-40"
                      >{ui("Accept")}</button>
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => void respondToUndo(false)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-300 disabled:opacity-40"
                      >{ui("Decline")}</button>
                    </div>
                  </div>
                )}

                <Link
                  to={page.lobby}
                  className="mt-3 block w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-xs font-bold text-zinc-400 transition hover:bg-white/10"
                >{ui("Leave room")}</Link>
              </Panel>

              {variant === "randomstart" ? (
                <Panel
                  title={ui("Starting Position")}
                  subtitle={ui("This game's independent shuffle")}
                >
                  <Lineup title={ui("White back rank")} value={whiteLineup} />
                  <div className="mt-3">
                    <Lineup title={ui("Black back rank")} value={blackLineup} />
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-zinc-600">{ui("The two back ranks are shuffled separately, so Black is not a reflection of White.")}</p>
                </Panel>
              ) : (
                <Panel
                  title={ui("Chaos Setup")}
                  subtitle={ui("The opening book is useless")}
                >
                  <InfoRow
                    label={ui("Chaos seed")}
                    value={String(gameState.seed ?? "—")}
                  />
                  <InfoRow
                    label={ui("Orthodox matches")}
                    value={String(chaosMeta?.orthodoxMatches ?? "—")}
                  />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <MiniStat
                      label={ui("White pieces in Black half")}
                      value={chaosZoneStats?.whiteInEnemyHalf ?? "—"}
                    />
                    <MiniStat
                      label={ui("Black pieces in White half")}
                      value={chaosZoneStats?.blackInEnemyHalf ?? "—"}
                    />
                  </div>
                </Panel>
              )}
            </div>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreviewPly !== null && (
              <div
                className={`mb-3 flex items-center justify-between rounded-xl border ${page.accentBorder} ${page.accentSoft} px-4 py-3`}
              >
                <div>
                  <p
                    className={`text-[9px] font-black uppercase tracking-widest ${page.accentText}`}
                  >{ui("History Preview · Frontend only")}</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {historyPreviewPly === 0 ? ui("Starting position") : `${historyRows[historyPreviewPly - 1]?.moveNumber}${
                          historyRows[historyPreviewPly - 1]?.color === "w"
                            ? "."
                            : "..."
                        } ${historyRows[historyPreviewPly - 1]?.san ?? ""}`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setHistoryPreviewPly(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/20"
                >{ui("Back to Live Board")}</button>
              </div>
            )}

            {finished && historyPreviewPly === null && (
              <VisibleGameResult
                winner={gameState.winner}
                playerColor={myColor}
                reason={gameState.end_reason}
                actions={
                  <>
                    <button
                      type="button"
                      disabled={myRematchReady || actionLoading !== null}
                      onClick={() => void requestRematch()}
                      className={`mt-5 w-full rounded-xl px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${page.accentButton}`}
                    >
                      {myRematchReady ? ui("Rematch requested") : ui("Rematch")}
                    </button>
                    <Link
                      to={page.lobby}
                      className="mt-3 block w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-300 transition hover:bg-white/10"
                    >{ui("Back to lobby")}</Link>
                  </>
                }
              />
            )}

            <div className="relative">
              <Board
                board={board}
                selectedSquare={canMove ? selectedSquare : null}
                legalMoves={canMove ? legalMoves : []}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={handleSquareClick}
                orientation={orientation}
              />

              {pendingPromotion && historyPreviewPly === null && (
                <PromotionBar onPromote={promotePawn} />
              )}

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

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel
                title={ui("Move History")}
                subtitle={`${historyRows.length} plies · click to preview`}
              >
                <ChessMoveHistoryList
                  listClassName="max-h-[380px] rounded-xl border border-white/5 bg-black/20"
                  selectedPly={historyPreviewPly}
                  emptyLabel="No moves yet"
                  leading={
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryPreviewPly(0);
                        clearSelection();
                      }}
                      className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs transition ${
                        historyPreviewPly === 0
                          ? page.accentSelected
                          : "text-zinc-500 hover:bg-white/5"
                      }`}
                    >
                      <span>{ui("Start")}</span>
                      <span className="font-black">{ui("Initial position")}</span>
                    </button>
                  }
                  entries={historyRows.map((row) => ({
                    ply: row.ply,
                    side: row.color,
                    moveNumber: row.moveNumber,
                    content: <span className="truncate font-mono text-xs font-black text-zinc-200">{row.san}</span>,
                  }))}
                  onSelect={(ply) => {
                    setHistoryPreviewPly(ply);
                    clearSelection();
                  }}
                />

                {historyPreviewPly !== null && (
                  <p className="mt-2 text-[10px] leading-4 text-zinc-600">{ui("Preview is local only. It never changes the multiplayer game state.")}</p>
                )}
              </Panel>

              {variant === "randomstart" ? (
                <Panel title={ui("Random Start")} subtitle={ui("Random setup only")}>
                  <div className="space-y-2">
                    <RuleLine
                      icon="8"
                      text={ui("Each side keeps the normal set of 8 back-rank pieces.")}
                    />
                    <RuleLine
                      icon="↯"
                      text={ui("White and Black are shuffled independently.")}
                    />
                    <RuleLine icon="♙" text={ui("Pawns remain on ranks 2 and 7.")} />
                    <RuleLine
                      icon="♖"
                      text={ui("Castling is disabled for the entire game.")}
                    />
                    <RuleLine
                      icon="✓"
                      text={ui("After setup, normal chess rules apply.")}
                    />
                  </div>
                </Panel>
              ) : (
                <Panel title={ui("Total Chaos")} subtitle={ui("Full-board random setup")}>
                  <div className="space-y-2">
                    <RuleLine
                      icon="32"
                      text={ui("The normal 32 pieces are scattered across the full board.")}
                    />
                    <RuleLine
                      icon="♔"
                      text={ui("Kings never begin in check and never begin adjacent.")}
                    />
                    <RuleLine
                      icon="♙"
                      text={ui("Pawns may begin anywhere except ranks 1 and 8.")}
                    />
                    <RuleLine icon="♖" text={ui("Castling is disabled.")} />
                    <RuleLine
                      icon="✓"
                      text={ui("After setup, normal chess rules apply.")}
                    />
                  </div>
                </Panel>
              )}

              {error && (
                <section className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-sm font-semibold text-red-200">
                  {ui(error)}
                </section>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
