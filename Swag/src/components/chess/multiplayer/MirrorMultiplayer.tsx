import InviteFriendButton from "@/components/chess/InviteFriendButton";
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
  applyMirrorSetupAction,
  buildMirrorStartFen,
  createInitialMirrorSetupState,
  createMirrorSeed,
  getAvailableMirrorSquares,
  getCurrentMirrorPiece,
  getMirrorSetupSquares,
  isMirrorStartPositionValid,
  isThreefoldMirror,
  mirrorSetupToBoard,
  type MirrorMoveRecord,
  type MirrorPieceType,
  type MirrorSetupState,
  type MirrorSide,
} from "@/games/chess/variants/mirrorChess";
import type {
  TwoPlayerColor,
  VariantGame,
  VariantRoom,
  VariantRoomPlayer,
} from "@/games/chess/multiplayer/variantMultiplayerTypes";

type PromotionPiece = "q" | "r" | "b" | "n";
type ActionLoading =
  | "setup"
  | "finalize"
  | "undo-request"
  | "undo-response"
  | "resign"
  | "rematch"
  | null;

type MirrorPublicState = {
  phase: "setup" | "playing";
  setup: MirrorSetupState;
};

const pieceNames: Record<MirrorPieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const whiteSymbols: Record<MirrorPieceType, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
  k: "♔",
};

const blackSymbols: Record<MirrorPieceType, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

function normalizeCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function colorToSide(color: TwoPlayerColor): MirrorSide {
  return color === "white" ? "w" : "b";
}

function sideToColor(side: MirrorSide): TwoPlayerColor {
  return side === "w" ? "white" : "black";
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
    undo_last_requested_by: raw.undo_last_requested_by ?? null,
    undo_last_requested_version: raw.undo_last_requested_version ?? null,
  };
}

function readMirrorState(game: VariantGame | null): MirrorPublicState | null {
  if (!game) return null;
  const raw = game.state as Partial<MirrorPublicState>;
  if (raw.phase !== "setup" && raw.phase !== "playing") return null;
  if (!raw.setup) return null;
  return raw as MirrorPublicState;
}

function buildHistory(initialFen: string, moves: string[]): MirrorMoveRecord[] {
  const replay = new Chess(initialFen, { skipValidation: true });
  const rows: MirrorMoveRecord[] = [];

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
        captured:
          move.captured && move.captured !== "k" ? move.captured : undefined,
        promotion: move.promotion as PromotionPiece | undefined,
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
  const color = game.turn();
  for (const row of game.board()) {
    for (const piece of row) {
      if (piece?.type === "k" && piece.color === color) return piece.square;
    }
  }
  return null;
}

function getMirrorOutcome(
  game: Chess,
  rows: MirrorMoveRecord[],
  initialFen: string,
) {
  if (game.isCheckmate()) {
    return {
      finished: true,
      winner: game.turn() === "w" ? ("black" as const) : ("white" as const),
      reason: "checkmate",
    };
  }
  if (game.isStalemate()) {
    return { finished: true, winner: "draw" as const, reason: "stalemate" };
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
  if (isThreefoldMirror(rows, initialFen, game.fen())) {
    return {
      finished: true,
      winner: "draw" as const,
      reason: "threefold repetition",
    };
  }
  return { finished: false, winner: null, reason: null };
}

function playLatestMoveSound(initialFen: string, moves: string[]) {
  if (moves.length === 0) return;
  try {
    const replay = new Chess(initialFen, { skipValidation: true });
    let latest: ReturnType<Chess["move"]> | null = null;
    for (const san of moves) latest = replay.move(san);
    if (!latest) return;
    if (latest.captured) playPieceCaptureSound(latest.piece);
    else playPieceMoveSound(latest.piece);
  } catch {
    // Sound should never break synchronization.
  }
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
    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
      <div className="mb-4">
        <h2 className="text-sm font-black text-zinc-100">{ui(title)}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{ui(subtitle)}</p>}
      </div>
      {children}
    </section>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  useUiLanguage();
  return (
    <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">
      {children}
    </div>
  );
}

function PlayerCard({
  name,
  color,
  active,
  you,
}: {
  name: string;
  color: TwoPlayerColor | null;
  active: boolean;
  you: boolean;
}) {
  useUiLanguage();
  return (
    <div
      className={`rounded-2xl border p-3 ${
        active
          ? "border-violet-400/25 bg-violet-400/[0.07]"
          : "border-white/5 bg-black/20"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-black text-zinc-200">{name}</span>
        <span className="text-xl">{color === "black" ? "♚" : "♔"}</span>
      </div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
        {you ? ui("You") : ui("Opponent")} · {color ?? "waiting"}
      </p>
    </div>
  );
}

export function MirrorMultiplayerLobby() {
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
    return username || user?.email?.split("@")[0]?.trim() || "Player";
  }, [profile?.username, user?.email]);

  async function createRoom() {
    if (!user) return setError("Sign in first.");
    setLoading("create");
    setError(null);

    const seed = createMirrorSeed();
    const setup = createInitialMirrorSetupState(seed);

    const { data, error: rpcError } = await supabase.rpc(
      "create_mirror_variant_room",
      {
        p_seed: seed,
        p_initial_state: { phase: "setup", setup },
        p_display_name: displayName,
        p_host_color: hostColor,
      },
    );

    setLoading(null);
    if (rpcError) return setError(rpcError.message);
    navigate(`/games/chess/variants/mirror/multiplayer/${String(data)}`);
  }

  async function joinRoom() {
    if (!user) return setError("Sign in first.");
    const code = normalizeCode(joinCode);
    if (code.length !== 6) return setError("Enter the 6-character room code.");

    setLoading("join");
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("join_variant_room", {
      p_code: code,
      p_expected_variant: "mirror",
      p_display_name: displayName,
    });

    setLoading(null);
    if (rpcError) return setError(rpcError.message);
    navigate(
      `/games/chess/variants/mirror/multiplayer/${String(data ?? code)}`,
    );
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ChessPageHeader className="mb-7 rounded-3xl border border-violet-400/15 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30" description={<> {ui("The seeded piece bag is shared · White and Black alternate placements")} </>}>

        </ChessPageHeader>

        {!user ? (
          <Panel title={ui("Sign in required")}>
            <p className="text-sm text-zinc-400">{ui("Multiplayer rooms use your existing Supabase account.")}</p>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={ui("Create room")} subtitle={ui("Choose which side you control")}>
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
                    {color === "white" ? ui("White") : ui("Black")}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-violet-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "create" ? ui("Creating...") : ui("Create Mirror Room")}
              </button>
            </Panel>

            <Panel title={ui("Join room")} subtitle={ui("You receive the opposite side")}>
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeCode(event.target.value))
                }
                onKeyDown={(event) => event.key === "Enter" && void joinRoom()}
                placeholder={ui("ABC123")}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition focus:border-violet-400/40"
              />
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-3 w-full rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-5 py-3 font-black text-violet-200 transition hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "join" ? ui("Joining...") : ui("Join Mirror Room")}
              </button>
            </Panel>
          </div>
        )}

        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </div>
    </main>
  );
}

export function MirrorMultiplayerGame() {
  useUiLanguage();
  const { roomCode } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lastSeenMoveCountRef = useRef(0);
  const lastVersionRef = useRef<number | null>(null);

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === user?.id) ?? null,
    [players, user?.id],
  );
  const opponent = useMemo(
    () => players.find((player) => player.user_id !== user?.id) ?? null,
    [players, user?.id],
  );
  const myColor = myPlayer?.chosen_color ?? null;
  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  const mirrorState = useMemo(() => readMirrorState(gameState), [gameState]);
  const phase = mirrorState?.phase ?? "setup";
  const setupState = mirrorState?.setup ?? null;

  const currentPiece = setupState ? getCurrentMirrorPiece(setupState) : null;
  const setupTurnColor = setupState ? sideToColor(setupState.turn) : null;
  const setupSquares = setupState ? getMirrorSetupSquares(setupState.turn) : [];
  const availableSquares = setupState
    ? getAvailableMirrorSquares(setupState, setupState.turn)
    : [];
  const setupBoard = useMemo(
    () => (setupState ? mirrorSetupToBoard(setupState) : new Chess().board()),
    [setupState],
  );

  const historyRows = useMemo(() => {
    if (!gameState?.initial_fen) return [];
    return buildHistory(gameState.initial_fen, gameState.moves);
  }, [gameState?.initial_fen, gameState?.moves]);

  const liveGame = useMemo(() => {
    if (!gameState?.fen) return null;
    try {
      return new Chess(gameState.fen, { skipValidation: true });
    } catch {
      return null;
    }
  }, [gameState?.fen]);

  const previewGame = useMemo(() => {
    if (historyPreviewPly === null || !gameState?.initial_fen) return null;
    if (historyPreviewPly === 0) {
      return new Chess(gameState.initial_fen, { skipValidation: true });
    }
    const row = historyRows[historyPreviewPly - 1];
    return row ? new Chess(row.fenAfter, { skipValidation: true }) : null;
  }, [gameState?.initial_fen, historyPreviewPly, historyRows]);

  const displayedGame = previewGame ?? liveGame;
  const board =
    phase === "setup"
      ? setupBoard
      : (displayedGame?.board() ?? new Chess().board());
  const checkedKingSquare =
    phase === "playing" && displayedGame
      ? findCheckedKing(displayedGame)
      : null;

  const displayedLastMove = useMemo(() => {
    if (phase !== "playing") return null;
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
    phase,
  ]);

  const undoPending = Boolean(gameState?.undo_requested_by);
  const isMyTurn =
    phase === "playing" &&
    Boolean(myColor) &&
    liveGame?.turn() === colorToSide(myColor!);
  const canMove =
    room?.status === "playing" &&
    gameState?.status === "playing" &&
    phase === "playing" &&
    isMyTurn &&
    !moving &&
    actionLoading === null &&
    !pendingPromotion &&
    historyPreviewPly === null &&
    !undoPending;

  const lastHistoryMove = historyRows[historyRows.length - 1] ?? null;
  const lastMoverColor = lastHistoryMove
    ? sideToColor(lastHistoryMove.color)
    : null;
  const alreadyRequestedUndo =
    Boolean(user?.id) &&
    gameState?.undo_last_requested_by === user?.id &&
    gameState?.undo_last_requested_version === gameState?.version;
  const canRequestUndo =
    phase === "playing" &&
    gameState?.status === "playing" &&
    gameState.moves.length > 0 &&
    myColor !== null &&
    lastMoverColor === myColor &&
    !undoPending &&
    !alreadyRequestedUndo &&
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
  const opponentRematchReady =
    opponent?.chosen_color === "white"
      ? Boolean(gameState?.white_rematch_ready)
      : opponent?.chosen_color === "black"
        ? Boolean(gameState?.black_rematch_ready)
        : false;

  const applyAuthoritativeGame = useCallback((raw: VariantGame) => {
    const updated = normalizeGame(raw);
    const nextMoveCount = updated.moves.length;

    if (updated.initial_fen && nextMoveCount > lastSeenMoveCountRef.current) {
      playLatestMoveSound(updated.initial_fen, updated.moves);
    }

    if (nextMoveCount < lastSeenMoveCountRef.current) {
      setHistoryPreviewPly(null);
    }

    if (
      lastVersionRef.current !== null &&
      updated.version !== lastVersionRef.current &&
      (updated.state as Partial<MirrorPublicState>)?.phase === "setup"
    ) {
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
    }

    lastSeenMoveCountRef.current = nextMoveCount;
    lastVersionRef.current = updated.version;
    setGameState(updated);
  }, []);

  const loadRoom = useCallback(
    async (silent = false) => {
      if (!roomCode || !user) return;
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const { data: roomData, error: roomError } = await supabase
        .from("variant_rooms")
        .select("id, code, host_id, variant, max_players, status, created_at")
        .eq("code", roomCode.toUpperCase())
        .eq("variant", "mirror")
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
        room_id, variant, seed, initial_fen, fen, moves, state, status,
        winner, end_reason, version, last_move_from, last_move_to,
        white_rematch_ready, black_rematch_ready, next_seed, next_initial_fen,
        next_state, undo_requested_by, undo_requested_version,
        undo_previous_fen, undo_previous_last_from, undo_previous_last_to,
        undo_last_requested_by, undo_last_requested_version
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
    [applyAuthoritativeGame, roomCode, user],
  );

  useEffect(() => {
    void loadRoom(false);
  }, [loadRoom]);

  useEffect(() => {
    if (!room) return;
    const roomId = room.id;

    const gameChannel = supabase
      .channel(`mirror-game-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_games",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => applyAuthoritativeGame(payload.new as VariantGame),
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`mirror-room-${roomId}`)
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
        (payload) => setRoom(payload.new as VariantRoom),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(gameChannel);
      void supabase.removeChannel(roomChannel);
    };
  }, [applyAuthoritativeGame, room?.id]);

  useEffect(() => {
    if (!room) return;
    const interval = window.setInterval(() => {
      if (!moving && actionLoading === null) void loadRoom(true);
    }, 1500);
    return () => window.clearInterval(interval);
  }, [actionLoading, loadRoom, moving, room?.id]);

  useEffect(() => {
    if (
      phase === "setup" &&
      setupState?.complete &&
      gameState?.status === "playing" &&
      actionLoading === null &&
      gameState.initial_fen === null
    ) {
      void finalizeSetup(setupState, gameState.version);
    }
    // Finalization is idempotently protected by the authoritative version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, setupState?.complete, gameState?.version, gameState?.initial_fen]);

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  async function placeMirrorPiece(row: number, column: number) {
    if (
      !room ||
      !gameState ||
      !setupState ||
      phase !== "setup" ||
      gameState.status !== "playing" ||
      actionLoading ||
      setupState.complete ||
      !myColor ||
      colorToSide(myColor) !== setupState.turn
    ) {
      return;
    }

    const square = getSquareName(row, column);
    if (!availableSquares.includes(square)) return;

    const result = applyMirrorSetupAction(setupState, {
      type: "PLACE_DRAWN_PIECE",
      side: setupState.turn,
      square,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    const previous = gameState;
    const nextState: MirrorPublicState = {
      phase: "setup",
      setup: result.state,
    };
    const optimistic: VariantGame = {
      ...gameState,
      state: nextState as unknown as Record<string, unknown>,
      version: gameState.version + 1,
    };

    setGameState(optimistic);
    setActionLoading("setup");
    setError(null);
    if (currentPiece) playPieceSelectSound(currentPiece);

    const { error: setupError } = await supabase.rpc(
      "play_mirror_setup_action",
      {
        p_room_id: room.id,
        p_new_state: nextState,
        p_expected_version: previous.version,
      },
    );

    setActionLoading(null);

    if (setupError) {
      setGameState(previous);
      setError(setupError.message);
      await loadRoom(true);
      return;
    }

    if (result.state.complete) {
      await finalizeSetup(result.state, previous.version + 1);
    }
  }

  async function finalizeSetup(
    setup: MirrorSetupState,
    expectedVersion: number,
  ) {
    if (!room || actionLoading === "finalize") return;

    const validation = isMirrorStartPositionValid(setup);
    if (!validation.ok) {
      setError(validation.error ?? "Invalid mirrored formation.");
      return;
    }

    let initialFen: string;
    try {
      initialFen = buildMirrorStartFen(setup);
    } catch {
      setError("Could not build the mirrored starting position.");
      return;
    }

    setActionLoading("finalize");
    setError(null);
    const { error: finalizeError } = await supabase.rpc(
      "finalize_mirror_setup",
      {
        p_room_id: room.id,
        p_initial_fen: initialFen,
        p_expected_version: expectedVersion,
      },
    );
    setActionLoading(null);

    if (finalizeError) {
      // Both clients may notice the completed setup at almost the same time.
      // A version-change error usually means the other browser finalized first.
      await loadRoom(true);
      if (!finalizeError.message.toLowerCase().includes("changed")) {
        setError(finalizeError.message);
      }
    } else {
      await loadRoom(true);
    }
  }

  async function submitMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (
      !room ||
      !gameState ||
      !gameState.initial_fen ||
      !gameState.fen ||
      !canMove
    )
      return;

    const localGame = new Chess(gameState.fen, { skipValidation: true });
    let move;
    try {
      move = localGame.move({ from, to, promotion });
    } catch {
      setError("Illegal move.");
      return;
    }
    if (!move) return;

    const nextMoves = [...gameState.moves, move.san];
    const nextRows = buildHistory(gameState.initial_fen, nextMoves);
    const outcome = getMirrorOutcome(
      localGame,
      nextRows,
      gameState.initial_fen,
    );
    const previous = gameState;
    const optimistic: VariantGame = {
      ...gameState,
      fen: localGame.fen(),
      moves: nextMoves,
      version: gameState.version + 1,
      last_move_from: move.from,
      last_move_to: move.to,
      status: outcome.finished ? "finished" : "playing",
      winner: outcome.finished ? outcome.winner : null,
      end_reason: outcome.finished ? outcome.reason : null,
      undo_requested_by: null,
      undo_requested_version: null,
    };

    setGameState(optimistic);
    lastSeenMoveCountRef.current = nextMoves.length;
    clearSelection();
    setPendingPromotion(null);
    setMoving(true);
    setError(null);
    if (move.captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);

    const { error: moveError } = await supabase.rpc("play_variant_chess_move", {
      p_room_id: room.id,
      p_expected_variant: "mirror",
      p_from: move.from,
      p_to: move.to,
      p_move_san: move.san,
      p_new_fen: localGame.fen(),
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
      await loadRoom(true);
    }
  }

  function handleGameSquareClick(row: number, column: number) {
    if (!canMove || !liveGame || !myColor) return;
    const square = getSquareName(row, column);
    const piece = liveGame.get(square);

    if (!selectedSquare) {
      if (!piece || piece.color !== colorToSide(myColor)) return;
      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((candidate) => candidate.to as Square));
      playPieceSelectSound(piece.type);
      return;
    }

    if (piece && piece.color === colorToSide(myColor)) {
      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((candidate) => candidate.to as Square));
      playPieceSelectSound(piece.type);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const movingPiece = liveGame.get(selectedSquare);
    if (movingPiece?.type === "p" && (square[1] === "8" || square[1] === "1")) {
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
    if (undoError) setError(undoError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function respondUndo(accept: boolean) {
    if (!room || !gameState || !opponentUndoRequest || actionLoading) return;
    setActionLoading("undo-response");
    setError(null);
    const { error: undoError } = await supabase.rpc("respond_variant_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });
    if (undoError) setError(undoError.message);
    if (accept) {
      setHistoryPreviewPly(null);
      clearSelection();
      setPendingPromotion(null);
    }
    await loadRoom(true);
    setActionLoading(null);
  }

  async function resign() {
    if (
      !room ||
      gameState?.status !== "playing" ||
      actionLoading ||
      undoPending
    )
      return;
    setActionLoading("resign");
    setError(null);
    const { error: resignError } = await supabase.rpc("resign_variant_game", {
      p_room_id: room.id,
      p_expected_variant: "mirror",
    });
    if (resignError) setError(resignError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function requestRematch() {
    if (
      !room ||
      !gameState ||
      gameState.status !== "finished" ||
      myRematchReady ||
      actionLoading
    )
      return;
    const seed = createMirrorSeed();
    const setup = createInitialMirrorSetupState(seed);
    setActionLoading("rematch");
    setError(null);
    const { error: rematchError } = await supabase.rpc(
      "request_mirror_rematch",
      {
        p_room_id: room.id,
        p_next_seed: seed,
        p_next_state: { phase: "setup", setup },
      },
    );
    if (rematchError) setError(rematchError.message);
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
      // Optional convenience.
    }
  }

  if (!user) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />{ui("Sign in required.")}</main>
    );
  }

  if (loading) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-400">
      <ChessPageHeader className="mb-4" />{ui("Loading Mirror room...")}</main>
    );
  }

  if (!room || !gameState || !setupState) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
        <p>{ui("Mirror room unavailable.")}</p>
        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </main>
    );
  }

  const placementCount = setupState.placements.length;
  const pairsLeft = Math.max(0, setupState.bag.length - placementCount);
  const mySetupTurn =
    myColor !== null && colorToSide(myColor) === setupState.turn;

  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <ChessPageHeader className="mb-6 flex flex-col gap-4 rounded-3xl border border-violet-400/10 bg-zinc-900/55 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between" description={<> {phase === "setup" ? `${setupTurnColor === "white" ? "White" : "Black"} places the next seeded piece` : `${liveGame?.turn() === "w" ? "White" : "Black"} to move`} </>}>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyRoomCode()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs font-black text-zinc-300"
            >{ui("Room")}{room.code} {copied ? "✓" : ""}
            </button>
            <Link
              to="/games/chess/variants/mirror/multiplayer"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:bg-white/10"
            >{ui("Lobby")}</Link>
          </div>
        </ChessPageHeader>

        {phase === "setup" && (
          <section className="mb-6 grid gap-3 rounded-3xl border border-violet-400/10 bg-violet-400/[0.03] px-5 py-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-xs text-zinc-400">
              <b className="text-violet-200">{ui("🎲 Seeded piece")}</b>
              <br />{ui("Both browsers use the exact same 16-piece bag.")}</div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-xs text-zinc-400">
              <b className="text-violet-200">{ui("◈ Mirrored placement")}</b>
              <br />{ui("Every placement appears automatically for the opposite army.")}</div>
            <div className="rounded-2xl border border-white/5 bg-black/20 p-3 text-xs text-zinc-400">
              <b className="text-violet-200">{ui("↔ Alternating setup")}</b>
              <br />{ui("White and Black take turns choosing a square.")}</div>
          </section>
        )}

        <main className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel
                title={ui("Players")}
                subtitle={
                  players.length < 2 ? "Waiting for opponent..." : "Connected"
                }
              >
                <div className="space-y-2">
                  {players.map((player) => (
                    <PlayerCard
                      key={player.user_id}
                      name={player.display_name}
                      color={player.chosen_color}
                      active={
                        phase === "setup"
                          ? player.chosen_color === setupTurnColor
                          : player.chosen_color ===
                            (liveGame?.turn() === "w" ? "white" : "black")
                      }
                      you={player.user_id === user.id}
                    />
                  ))}
                </div>
              </Panel>

              {phase === "setup" ? (
                <Panel
                  title={ui("Mirror Setup")}
                  subtitle={ui("Alternating random construction")}
                >
                  <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.06] p-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">{ui("Next piece")}</p>
                    {currentPiece ? (
                      <>
                        <div className="mt-3 text-6xl leading-none">
                          {setupState.turn === "w" ? whiteSymbols[currentPiece] : blackSymbols[currentPiece]}
                        </div>
                        <p className="mt-3 font-black text-white">
                          {pieceNames[currentPiece]}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {mySetupTurn ? ui("Your placement turn") : ui("Opponent is placing")}
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 font-black text-emerald-200">{ui("Formation complete")}</p>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{ui("Placed")}</p>
                      <p className="mt-1 text-xl font-black">
                        {placementCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                      <p className="text-[9px] uppercase tracking-wider text-zinc-600">{ui("Pairs left")}</p>
                      <p className="mt-1 text-xl font-black">{pairsLeft}</p>
                    </div>
                  </div>

                  {setupState.complete && !gameState.initial_fen && (
                    <button
                      type="button"
                      disabled={actionLoading !== null}
                      onClick={() =>
                        void finalizeSetup(setupState, gameState.version)
                      }
                      className="mt-3 w-full rounded-xl bg-violet-300 px-3 py-3 text-sm font-black text-zinc-950 hover:bg-violet-200 disabled:opacity-40"
                    >{ui("▶ Start Match")}</button>
                  )}
                </Panel>
              ) : (
                <Panel title={ui("Game Controls")} subtitle={ui("Online Mirror match")}>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!canRequestUndo}
                      onClick={() => void requestUndo()}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-35"
                    >{ui("↶ Undo")}</button>
                    <button
                      type="button"
                      disabled={
                        gameState.status !== "playing" ||
                        actionLoading !== null ||
                        undoPending
                      }
                      onClick={() => void resign()}
                      className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-bold text-red-200 disabled:opacity-35"
                    >{ui("Resign")}</button>
                  </div>
                </Panel>
              )}

              {gameState.undo_requested_by && phase === "playing" && (
                <Panel
                  title={ui("Undo request")}
                  subtitle={
                    myUndoRequest
                      ? "Waiting for opponent"
                      : "Opponent wants to undo the latest move"
                  }
                >
                  {opponentUndoRequest ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void respondUndo(true)}
                        className="rounded-xl bg-emerald-300 px-3 py-2.5 font-black text-zinc-950"
                      >{ui("Accept")}</button>
                      <button
                        onClick={() => void respondUndo(false)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-black text-zinc-300"
                      >{ui("Decline")}</button>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">{ui("Request sent.")}</p>
                  )}
                </Panel>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {gameState.status === "finished" && (
                <div className="mb-3 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">{ui("Game Over")}</p>
                  <p className="mt-1 text-lg font-black text-white">
                    {resultLabel(gameState)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={myRematchReady || actionLoading !== null}
                      onClick={() => void requestRematch()}
                      className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-40"
                    >
                      {myRematchReady ? ui("Rematch requested") : ui("Play Again")}
                    </button>
                    {opponentRematchReady && (
                      <span className="rounded-xl bg-white/5 px-3 py-2 text-xs text-zinc-400">{ui("Opponent ready")}</span>
                    )}
                  </div>
                </div>
              )}

              {historyPreviewPly !== null && phase === "playing" && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">{ui("History Preview")}</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {historyPreviewPly === 0 ? ui("Initial mirrored position") : `${historyRows[historyPreviewPly - 1]?.moveNumber}${historyRows[historyPreviewPly - 1]?.color === "w" ? "." : "..."} ${historyRows[historyPreviewPly - 1]?.san ?? ""}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setHistoryPreviewPly(null)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold"
                  >{ui("Back to Live Board")}</button>
                </div>
              )}

              <div className="relative">
                <Board
                  board={board}
                  selectedSquare={
                    phase === "playing" && historyPreviewPly === null
                      ? selectedSquare
                      : null
                  }
                  legalMoves={
                    phase === "playing" && historyPreviewPly === null
                      ? legalMoves
                      : []
                  }
                  lastMove={displayedLastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={
                    phase === "setup"
                      ? (row, column) => void placeMirrorPiece(row, column)
                      : historyPreviewPly !== null
                        ? () => {}
                        : handleGameSquareClick
                  }
                  mirrorSetupSquares={phase === "setup" ? setupSquares : []}
                  mirrorAvailableSquares={
                    phase === "setup" && mySetupTurn ? availableSquares : []
                  }
                  mirrorPreviewSquares={[]}
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

                {pendingPromotion && historyPreviewPly === null && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[4px]">
                    <div className="w-full max-w-sm rounded-3xl border border-violet-400/20 bg-zinc-900/95 p-4 shadow-2xl">
                      <p className="mb-3 text-center text-sm font-black text-violet-200">{ui("Choose promotion")}</p>
                      <PromotionBar onPromote={promotePawn} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel
                title={phase === "setup" ? "Shared Piece Bag" : "Move History"}
                subtitle={
                  phase === "setup"
                    ? `Seed ${setupState.seed}`
                    : `${historyRows.length} plies · click to preview`
                }
              >
                {phase === "setup" ? (
                  <div className="grid grid-cols-8 gap-1">
                    {setupState.bag.map((piece, index) => (
                      <div
                        key={`${piece}-${index}`}
                        className={`flex aspect-square items-center justify-center rounded-lg border text-lg ${
                          index < setupState.drawIndex
                            ? "border-white/5 bg-black/20 text-zinc-700"
                            : index === setupState.drawIndex
                              ? "border-violet-400/30 bg-violet-400/10 text-violet-100"
                              : "border-white/5 bg-white/[0.03] text-zinc-400"
                        }`}
                      >
                        {whiteSymbols[piece]}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="max-h-[520px] overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                    <button
                      type="button"
                      onClick={() => setHistoryPreviewPly(0)}
                      className={`w-full border-b border-white/5 px-3 py-2 text-left text-xs font-bold ${historyPreviewPly === 0 ? "bg-violet-400/10 text-violet-200" : "text-zinc-500 hover:bg-white/5"}`}
                    >{ui("Start · Mirrored position")}</button>
                    {historyRows.length === 0 ? (
                      <p className="px-3 py-6 text-center text-xs text-zinc-700">{ui("No moves yet")}</p>
                    ) : (
                      historyRows.map((row) => (
                        <button
                          key={row.ply}
                          type="button"
                          onClick={() => setHistoryPreviewPly(row.ply)}
                          className={`flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left last:border-0 ${historyPreviewPly === row.ply ? "bg-violet-400/10" : "hover:bg-white/5"}`}
                        >
                          <span className="w-10 text-[10px] text-zinc-600">
                            {row.moveNumber}
                            {row.color === "w" ? "." : "..."}
                          </span>
                          <span className="font-mono text-xs font-black text-zinc-200">
                            {row.san}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </Panel>

              <Panel
                title={ui("Mirror Status")}
                subtitle={
                  phase === "setup"
                    ? "One placement creates two pieces"
                    : "Symmetric origin · normal chess play"
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">{ui("Placed pairs")}</p>
                    <p className="mt-1 text-xl font-black">{placementCount}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-3">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">{ui("Seed")}</p>
                    <p className="mt-1 truncate font-mono text-xs font-black">
                      {setupState.seed}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-zinc-500">{ui("The King is restricted to the back rank. Other pieces can use either setup rank, matching the current Mirror rules.")}</p>
              </Panel>
            </div>
          </aside>
        </main>

        {players.length < 2 && (
          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm font-semibold text-amber-100">{ui("Waiting for a second player. Share room code")}{" "}
            <span className="font-mono font-black">{room.code}</span>.
          </div>
        )}
        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </div>
    </div>
  );
}
