import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Chess, type Square } from "chess.js";

import Board from "../Board";
import PromotionBar from "../PromotionBar";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { getSquareName, type PieceType } from "../../utils/chessUtils";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../../utils/sound";
import {
  COLLAPSE_KING_MAX_LIVES,
  COLLAPSE_MAX_DELAY_MOVES,
  COLLAPSE_MIN_DELAY_MOVES,
  COLLAPSE_WARNING_MOVES,
  advanceCollapseAfterMove,
  cloneCollapseLives,
  cloneCollapseState,
  collapseCoreReached,
  collapseEdgeLabel,
  createCollapseSeed,
  createInitialCollapseLives,
  createInitialCollapseState,
  filterMovesForCollapse,
  findCollapseKingSquare,
  getCollapseChessOutcome,
  isSquarePlayableForCollapse,
  isThreefoldCollapse,
  type CollapseDestroyedPiece,
  type CollapseKingLives,
  type CollapseKingRelocation,
  type CollapseMode,
  type CollapseOutcome,
  type CollapseSide,
  type CollapseState,
} from "../../games/chess/variants/chessCollapse";

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

type FinishedGame = {
  outcome: Exclude<CollapseOutcome, null>;
  reason: "checkmate" | "draw" | "lives" | "trapped" | "resignation";
} | null;

type CollapseRecord = {
  ply: number;
  moveNumber: number;
  color: CollapseSide;
  san: string;
  piece: PieceType;
  from: Square;
  to: Square;
  captured?: PieceType;
  fenBefore: string;
  fenAfter: string;
  collapseAfter: CollapseState;
  livesAfter: CollapseKingLives;
  kingHits: CollapseSide[];
  trappedKings: CollapseSide[];
  relocatedKings: CollapseKingRelocation[];
  destroyedPieces: CollapseDestroyedPiece[];
};

type CollapseStoredState = {
  collapse: CollapseState;
  lives: CollapseKingLives;
  records: CollapseRecord[];
};

type VariantGame = {
  room_id: string;
  variant: "collapse";
  seed: number;
  initial_fen: string;
  fen: string;
  moves: string[];
  state: CollapseStoredState;
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

const START_FEN = new Chess().fen();

function createInitialStoredState(
  seed = createCollapseSeed(),
  mode: CollapseMode = "squares",
): CollapseStoredState {
  return {
    collapse: createInitialCollapseState(seed, mode),
    lives: createInitialCollapseLives(),
    records: [],
  };
}

function normalizeState(value: unknown, seed: number): CollapseStoredState {
  const fallback = createInitialStoredState(seed);
  if (!value || typeof value !== "object") return fallback;

  const raw = value as Partial<CollapseStoredState>;
  const collapse = raw.collapse as CollapseState | undefined;
  const lives = raw.lives as CollapseKingLives | undefined;

  return {
    collapse:
      collapse && typeof collapse === "object" && collapse.bounds
        ? cloneCollapseState(collapse)
        : fallback.collapse,
    lives:
      lives && typeof lives.w === "number" && typeof lives.b === "number"
        ? cloneCollapseLives(lives)
        : fallback.lives,
    records: Array.isArray(raw.records)
      ? (raw.records as CollapseRecord[])
      : [],
  };
}

function resultFromDb(game: VariantGame): FinishedGame {
  if (game.status !== "finished" || !game.winner) return null;
  const reason =
    game.end_reason === "checkmate" ||
    game.end_reason === "lives" ||
    game.end_reason === "trapped" ||
    game.end_reason === "resignation"
      ? game.end_reason
      : "draw";
  return { outcome: game.winner, reason };
}

function sideFromColor(color: PlayerColor): CollapseSide {
  return color === "white" ? "w" : "b";
}

function normalFinish(
  game: Chess,
  collapse: CollapseState,
  previousRecords: CollapseRecord[],
): FinishedGame {
  const outcome = getCollapseChessOutcome(
    game,
    collapse.bounds,
    collapse.collapsedSquares,
  );
  if (outcome) {
    return {
      outcome,
      reason: outcome === "draw" ? "draw" : "checkmate",
    };
  }

  const previousFens = [
    START_FEN,
    ...previousRecords.map((entry) => entry.fenAfter),
  ];
  if (isThreefoldCollapse(previousFens, game.fen())) {
    return { outcome: "draw", reason: "draw" };
  }

  return null;
}

function stateBeforeLastMove(state: CollapseStoredState) {
  if (state.records.length === 0) return null;
  const previousRecords = state.records.slice(0, -1);

  if (previousRecords.length === 0) {
    return {
      fen: START_FEN,
      state: createInitialStoredState(
        state.collapse.seed,
        state.collapse.mode ?? "rows",
      ),
      lastFrom: null as string | null,
      lastTo: null as string | null,
    };
  }

  const previous = previousRecords[previousRecords.length - 1];
  return {
    fen: previous.fenAfter,
    state: {
      collapse: cloneCollapseState(previous.collapseAfter),
      lives: cloneCollapseLives(previous.livesAfter),
      records: previousRecords,
    },
    lastFrom: previous.from,
    lastTo: previous.to,
  };
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/5 bg-zinc-900/75 p-4 shadow-xl shadow-black/20">
      <h2 className="font-black text-zinc-100">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function CollapseMultiplayerLobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [displayName, setDisplayName] = useState(
    (profile as { username?: string | null } | null)?.username ?? "Player",
  );
  const [hostColor, setHostColor] = useState<PlayerColor>("white");
  const [collapseMode, setCollapseMode] = useState<CollapseMode>("squares");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (!user || busy) return;
    setBusy("create");
    setError(null);

    const seed = createCollapseSeed();
    const initialState = createInitialStoredState(seed, collapseMode);
    const { data, error: rpcError } = await supabase.rpc(
      "create_collapse_variant_room",
      {
        p_seed: seed,
        p_initial_state: initialState,
        p_display_name: displayName.trim() || "Player",
        p_host_color: hostColor,
      },
    );

    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(
      `/games/chess/variants/collapse/multiplayer/${String(data).toUpperCase()}`,
    );
  }

  async function joinRoom() {
    if (!user || busy || !joinCode.trim()) return;
    setBusy("join");
    setError(null);
    const code = joinCode.trim().toUpperCase();

    const { error: rpcError } = await supabase.rpc(
      "join_collapse_variant_room",
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

    navigate(`/games/chess/variants/collapse/multiplayer/${code}`);
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-red-400/15 bg-zinc-900/80 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-3xl">
              ⚠
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
                Multiplayer Variant
              </p>
              <h1 className="mt-1 text-3xl font-black">Chess Collapse</h1>
              <p className="mt-1 text-sm text-zinc-500">
                The same battlefield collapses for both players.
              </p>
            </div>
          </div>

          <label className="mt-8 block text-xs font-black uppercase tracking-wider text-zinc-500">
            Display name
          </label>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-red-400/40"
          />

          {error && (
            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <h2 className="font-black">Create room</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Choose your starting color.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["white", "black"] as PlayerColor[]).map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setHostColor(color)}
                    className={`rounded-xl border px-3 py-3 text-sm font-black ${hostColor === color ? "border-red-300/30 bg-red-400/15 text-red-100" : "border-white/10 bg-white/5 text-zinc-400"}`}
                  >
                    {color === "white" ? "♔ White" : "♚ Black"}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                Collapse mode
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ["squares", "Standard Squares"],
                    ["rows", "Classic Rows"],
                  ] as const
                ).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCollapseMode(mode)}
                    className={`rounded-xl border px-3 py-2.5 text-xs font-black ${
                      collapseMode === mode
                        ? "border-red-300/30 bg-red-400/15 text-red-100"
                        : "border-white/10 bg-white/5 text-zinc-500"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={createRoom}
                disabled={busy !== null}
                className="mt-4 w-full rounded-xl bg-red-400 px-4 py-3 font-black text-red-950 disabled:opacity-50"
              >
                {busy === "create" ? "Creating..." : "Create Collapse room"}
              </button>
            </section>

            <section className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <h2 className="font-black">Join room</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Enter the room code from the other player.
              </p>
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(event.target.value.toUpperCase())
                }
                placeholder="ROOM CODE"
                className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-red-400/40"
              />
              <button
                type="button"
                onClick={joinRoom}
                disabled={busy !== null || !joinCode.trim()}
                className="mt-4 w-full rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 font-black text-red-200 disabled:opacity-50"
              >
                {busy === "join" ? "Joining..." : "Join room"}
              </button>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

export function CollapseMultiplayerGame() {
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
  const lastSeenVersionRef = useRef<number | null>(null);

  const me = players.find((player) => player.user_id === user?.id) ?? null;
  const opponent =
    players.find((player) => player.user_id !== user?.id) ?? null;
  const myColor = me?.chosen_color ?? null;
  const mySide = myColor ? sideFromColor(myColor) : null;
  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  const state = useMemo(
    () =>
      gameState
        ? normalizeState(gameState.state, Number(gameState.seed))
        : null,
    [gameState],
  );

  const liveGame = useMemo(
    () =>
      gameState?.fen
        ? new Chess(gameState.fen, { skipValidation: true })
        : new Chess(),
    [gameState?.fen],
  );

  const previewRecord =
    historyPreviewPly !== null && state
      ? (state.records[historyPreviewPly - 1] ?? null)
      : null;

  const displayedGame = useMemo(
    () =>
      previewRecord
        ? new Chess(previewRecord.fenAfter, { skipValidation: true })
        : liveGame,
    [previewRecord, liveGame],
  );
  const displayedCollapse = previewRecord?.collapseAfter ?? state?.collapse;
  const displayedLives = previewRecord?.livesAfter ?? state?.lives;
  const displayedLastMove = previewRecord
    ? { from: previewRecord.from, to: previewRecord.to }
    : gameState?.last_move_from && gameState.last_move_to
      ? {
          from: gameState.last_move_from as Square,
          to: gameState.last_move_to as Square,
        }
      : null;

  const finished = gameState ? resultFromDb(gameState) : null;

  const loadAll = useCallback(async () => {
    if (!user || !roomCode) return;

    const { data: roomData, error: roomError } = await supabase
      .from("variant_rooms")
      .select("id, code, host_id, variant, status")
      .eq("code", roomCode.toUpperCase())
      .eq("variant", "collapse")
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
          `room_id, variant, seed, initial_fen, fen, moves, state, status, winner, end_reason, version, last_move_from, last_move_to, white_rematch_ready, black_rematch_ready, undo_requested_by, undo_requested_version, undo_last_requested_by, undo_last_requested_version`,
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
    lastSeenVersionRef.current = Number((gameData as VariantGame).version);
  }, [roomCode, user]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`collapse:${room.id}`)
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
          lastSeenVersionRef.current = Number(next.version);
          setGameState(next);
          setHistoryPreviewPly(null);
          setSelectedSquare(null);
          setLegalMoves([]);
          setPromotion(null);
          setMoving(false);
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
        () => {
          void loadAll();
        },
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
          `room_id, variant, seed, initial_fen, fen, moves, state, status, winner, end_reason, version, last_move_from, last_move_to, white_rematch_ready, black_rematch_ready, undo_requested_by, undo_requested_version, undo_last_requested_by, undo_last_requested_version`,
        )
        .eq("room_id", room.id)
        .single();

      if (!data) return;
      const next = data as VariantGame;
      if (
        lastSeenVersionRef.current !== Number(next.version) ||
        next.undo_requested_by !== gameState?.undo_requested_by ||
        next.white_rematch_ready !== gameState?.white_rematch_ready ||
        next.black_rematch_ready !== gameState?.black_rematch_ready ||
        next.status !== gameState?.status
      ) {
        lastSeenVersionRef.current = Number(next.version);
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

  function selectPiece(square: Square) {
    if (!state || !mySide || liveGame.turn() !== mySide) return;
    if (!isSquarePlayableForCollapse(square, state.collapse)) return;
    const piece = liveGame.get(square);
    if (!piece || piece.color !== mySide) {
      clearSelection();
      return;
    }

    const moves = filterMovesForCollapse(
      liveGame
        .moves({ square, verbose: true })
        .map((move) => ({ to: move.to as Square })),
      state.collapse.bounds,
      state.collapse.collapsedSquares,
    );
    setSelectedSquare(square);
    setLegalMoves(moves.map((move) => move.to));
    playPieceSelectSound(piece.type);
  }

  async function commitMove(
    from: Square,
    to: Square,
    promotionPiece?: PromotionPiece,
  ) {
    if (
      !room ||
      !gameState ||
      !state ||
      !mySide ||
      moving ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      finished ||
      liveGame.turn() !== mySide ||
      !isSquarePlayableForCollapse(to, state.collapse)
    )
      return;

    const beforeFen = liveGame.fen();
    const nextGame = new Chess(beforeFen, { skipValidation: true });
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
    if (!move) return;

    const nextPly = state.records.length + 1;
    let nextCollapse = cloneCollapseState(state.collapse);
    let nextLives = cloneCollapseLives(state.lives);
    let kingHits: CollapseSide[] = [];
    let trappedKings: CollapseSide[] = [];
    let relocatedKings: CollapseKingRelocation[] = [];
    let destroyedPieces: CollapseDestroyedPiece[] = [];

    // Match Hotseat exactly: mate/draw is checked BEFORE a collapse can rescue it.
    let finish = normalFinish(nextGame, nextCollapse, state.records);

    if (!finish) {
      const collapseResult = advanceCollapseAfterMove(
        nextGame,
        nextCollapse,
        nextLives,
        nextPly,
      );
      nextCollapse = collapseResult.state;
      nextLives = collapseResult.lives;
      kingHits = collapseResult.kingHits;
      trappedKings = collapseResult.trappedKings;
      relocatedKings = collapseResult.relocatedKings;
      destroyedPieces = collapseResult.destroyedPieces;

      if (collapseResult.outcome) {
        finish = {
          outcome: collapseResult.outcome,
          reason: trappedKings.length > 0 ? "trapped" : "lives",
        };
      } else {
        finish = normalFinish(nextGame, nextCollapse, state.records);
      }
    }

    const record: CollapseRecord = {
      ply: nextPly,
      moveNumber: Math.floor((nextPly - 1) / 2) + 1,
      color: move.color as CollapseSide,
      san: move.san,
      piece: move.piece as PieceType,
      from: move.from as Square,
      to: move.to as Square,
      captured: move.captured as PieceType | undefined,
      fenBefore: beforeFen,
      fenAfter: nextGame.fen(),
      collapseAfter: cloneCollapseState(nextCollapse),
      livesAfter: cloneCollapseLives(nextLives),
      kingHits,
      trappedKings,
      relocatedKings,
      destroyedPieces,
    };

    const nextState: CollapseStoredState = {
      collapse: nextCollapse,
      lives: nextLives,
      records: [...state.records, record],
    };

    const winner = finish?.outcome ?? null;
    const endReason = finish?.reason ?? null;

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
            status: finish ? "finished" : current.status,
            winner,
            end_reason: endReason,
            last_move_from: move.from,
            last_move_to: move.to,
            version: current.version + 1,
          }
        : current,
    );

    if (move.captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);

    const { error: rpcError } = await supabase.rpc("play_collapse_move", {
      p_room_id: room.id,
      p_expected_version: gameState.version,
      p_new_fen: nextGame.fen(),
      p_san: move.san,
      p_new_state: nextState,
      p_from: move.from,
      p_to: move.to,
      p_winner: winner,
      p_end_reason: endReason,
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
      !state ||
      !mySide ||
      moving ||
      historyPreviewPly !== null ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== mySide
    )
      return;

    const square = getSquareName(row, column);
    if (!isSquarePlayableForCollapse(square, state.collapse)) {
      clearSelection();
      return;
    }

    if (!selectedSquare) {
      selectPiece(square);
      return;
    }

    if (square === selectedSquare) {
      clearSelection();
      return;
    }

    const clickedPiece = liveGame.get(square);
    if (clickedPiece?.color === mySide) {
      selectPiece(square);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const selectedPiece = liveGame.get(selectedSquare);
    const promotes =
      selectedPiece?.type === "p" &&
      ((selectedPiece.color === "w" && square[1] === "8") ||
        (selectedPiece.color === "b" && square[1] === "1"));

    if (promotes) {
      setPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }

    void commitMove(selectedSquare, square);
  }

  async function requestUndo() {
    if (
      !room ||
      !gameState ||
      !state ||
      state.records.length === 0 ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      actionBusy
    )
      return;
    const previous = stateBeforeLastMove(state);
    if (!previous) return;

    setActionBusy("undo");
    setError(null);
    const { error: rpcError } = await supabase.rpc("request_collapse_undo", {
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
    setError(null);
    const { error: rpcError } = await supabase.rpc("respond_collapse_undo", {
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
    setError(null);
    const { error: rpcError } = await supabase.rpc("resign_collapse_game", {
      p_room_id: room.id,
    });
    setActionBusy(null);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function requestRematch() {
    if (!room || gameState?.status !== "finished" || actionBusy) return;
    const seed = createCollapseSeed();
    const nextState = createInitialStoredState(
      seed,
      state?.collapse.mode ?? "squares",
    );
    setActionBusy("rematch");
    setError(null);
    const { error: rpcError } = await supabase.rpc("request_collapse_rematch", {
      p_room_id: room.id,
      p_next_seed: seed,
      p_next_state: nextState,
    });
    setActionBusy(null);
    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  if (
    !room ||
    !gameState ||
    !state ||
    !me ||
    !displayedCollapse ||
    !displayedLives
  ) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="font-black">Loading Collapse room…</p>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
      </main>
    );
  }

  const canMove =
    gameState.status === "playing" &&
    mySide === liveGame.turn() &&
    !gameState.undo_requested_by &&
    !moving;

  const checkedKingSquare = displayedGame.isCheck()
    ? findCollapseKingSquare(displayedGame, displayedGame.turn())
    : null;

  const collapseDestroyedCount = state.records.reduce(
    (sum, entry) => sum + entry.destroyedPieces.length,
    0,
  );
  const whiteHits = state.records.reduce(
    (sum, entry) => sum + entry.kingHits.filter((side) => side === "w").length,
    0,
  );
  const blackHits = state.records.reduce(
    (sum, entry) => sum + entry.kingHits.filter((side) => side === "b").length,
    0,
  );

  const myRematchReady =
    myColor === "white"
      ? Boolean(gameState.white_rematch_ready)
      : Boolean(gameState.black_rematch_ready);
  const opponentRematchReady =
    myColor === "white"
      ? Boolean(gameState.black_rematch_ready)
      : Boolean(gameState.white_rematch_ready);

  const statusText = collapseCoreReached(displayedCollapse.bounds)
    ? "Central core reached"
    : displayedCollapse.warningEdge
      ? `${collapseEdgeLabel(displayedCollapse.warningEdge)} collapses in ${displayedCollapse.warningMovesRemaining}`
      : `Next warning in ${displayedCollapse.movesUntilWarning}`;

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-red-400/10 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-3xl">
              ⚠
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
                Multiplayer Variant
              </p>
              <h1 className="text-2xl font-black">Chess Collapse</h1>
              <p className="text-sm text-zinc-500">
                Room <span className="font-mono">{room.code}</span>
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm">
            {gameState.status === "waiting"
              ? "Waiting for opponent…"
              : gameState.status === "finished"
                ? "Game finished"
                : canMove
                  ? "Your turn"
                  : "Opponent's turn"}
          </div>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="space-y-4">
            <Panel title="Players">
              <div className="space-y-2 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="font-black">
                    {me.display_name} · {myColor}
                  </p>
                  <p className="text-xs text-zinc-500">You</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="font-black">
                    {opponent
                      ? `${opponent.display_name} · ${opponent.chosen_color}`
                      : "Waiting…"}
                  </p>
                  <p className="text-xs text-zinc-500">Opponent</p>
                </div>
              </div>
            </Panel>

            <Panel title="Actions">
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={requestUndo}
                  disabled={
                    gameState.status !== "playing" ||
                    state.records.length === 0 ||
                    Boolean(gameState.undo_requested_by) ||
                    Boolean(actionBusy)
                  }
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black disabled:opacity-40"
                >
                  ↶ Request Undo
                </button>
                <button
                  type="button"
                  onClick={resign}
                  disabled={
                    gameState.status !== "playing" || Boolean(actionBusy)
                  }
                  className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-black text-red-300 disabled:opacity-40"
                >
                  Resign
                </button>
                <Link
                  to="/games/chess/variants/collapse/multiplayer"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm font-black text-zinc-300"
                >
                  Leave room
                </Link>
              </div>
            </Panel>

            <Panel title="Move History">
              <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
                {state.records.length === 0 ? (
                  <p className="px-4 py-7 text-center text-xs text-zinc-600">
                    No moves yet
                  </p>
                ) : (
                  state.records.map((record) => (
                    <button
                      key={record.ply}
                      type="button"
                      onClick={() => {
                        setHistoryPreviewPly(record.ply);
                        clearSelection();
                        setPromotion(null);
                      }}
                      className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs last:border-0 ${historyPreviewPly === record.ply ? "bg-red-400/10 text-red-200" : "text-zinc-400 hover:bg-white/5"}`}
                    >
                      <span>
                        {record.moveNumber}
                        {record.color === "w" ? "." : "..."} {record.san}
                      </span>
                      <span>
                        {record.collapseAfter.lastImpactSquares.length > 0
                          ? "💥"
                          : ""}
                        {record.kingHits.length > 0 ? "♥−" : ""}
                        {record.trappedKings.length > 0 ? "☠" : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </Panel>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreviewPly !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-300">
                    History Preview
                  </p>
                  <p className="text-sm text-zinc-400">
                    Position after move {historyPreviewPly}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryPreviewPly(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black"
                >
                  Back to live board
                </button>
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
                  historyPreviewPly !== null || !canMove
                    ? () => {}
                    : handleSquareClick
                }
                collapseWarningSquares={displayedCollapse.warningSquares}
                collapsedSquares={displayedCollapse.collapsedSquares}
                collapseImpactSquares={displayedCollapse.lastImpactSquares}
                orientation={orientation}
              />
              {players.length < 2 && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/70 p-4 backdrop-blur-[3px]">
                  <button
                    type="button"
                    onClick={() => void copyRoomCode()}
                    className="w-full max-w-lg rounded-[30px] border border-white/15 bg-zinc-900/95 px-8 py-8 text-center shadow-2xl shadow-black/60 transition hover:border-amber-300/35 hover:bg-zinc-900 active:scale-[0.99]"
                    title="Copy room code"
                  >
                    <div className="text-4xl">🌐</div>

                    <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-amber-300">
                      Waiting for players
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-white">
                      {players.length}/2 players connected
                    </h2>

                    <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                      Share this room code. The game starts automatically when
                      everyone has joined.
                    </p>

                    <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-5 py-5">
                      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">
                        Room Code
                      </p>

                      <p className="mt-2 break-all font-mono text-4xl font-black tracking-[0.16em] text-amber-200 sm:text-5xl">
                        {room.code}
                      </p>
                    </div>

                    <p className="mt-4 text-xs font-bold text-zinc-400">
                      {copied
                        ? "✓ Copied to clipboard"
                        : "Click this box to copy the code"}
                    </p>
                  </button>
                </div>
              )}

              {finished && historyPreviewPly === null && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/80 p-6 backdrop-blur-sm">
                  <div className="max-w-sm rounded-3xl border border-red-300/20 bg-zinc-900 p-6 text-center shadow-2xl">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-red-300">
                      Game Over
                    </p>
                    <h2 className="mt-3 text-3xl font-black">
                      {finished.outcome === "draw"
                        ? "Draw"
                        : finished.outcome === myColor
                          ? "You win"
                          : "You lose"}
                    </h2>
                    <p className="mt-3 text-sm text-zinc-500">
                      {finished.reason === "trapped"
                        ? "A king was trapped by the collapsing edge."
                        : finished.reason === "lives"
                          ? "A king ran out of Collapse lives."
                          : finished.reason === "resignation"
                            ? "The game ended by resignation."
                            : finished.reason === "checkmate"
                              ? "Checkmate."
                              : "Draw."}
                    </p>
                    <button
                      type="button"
                      onClick={requestRematch}
                      disabled={myRematchReady || Boolean(actionBusy)}
                      className="mt-5 w-full rounded-xl bg-red-400 px-4 py-3 font-black text-red-950 disabled:opacity-50"
                    >
                      {myRematchReady ? "Waiting for opponent…" : "Play again"}
                    </button>
                    {opponentRematchReady && !myRematchReady && (
                      <p className="mt-3 text-xs text-emerald-300">
                        Opponent wants a rematch.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <Panel title="Collapse Status">
              <div className="rounded-2xl border border-red-300/15 bg-red-400/[0.05] p-4">
                <p className="text-xs font-black text-red-200">{statusText}</p>
                {displayedCollapse.warningEdge && (
                  <p className="mt-2 text-[10px] leading-4 text-zinc-500">
                    The cracked edge disappears after {COLLAPSE_WARNING_MOVES}{" "}
                    completed moves.
                  </p>
                )}
              </div>
            </Panel>

            <Panel title="King Lives">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-sm font-black">White</p>
                  <p className="mt-1 text-xl">
                    {"♥".repeat(displayedLives.w)}
                    {"♡".repeat(
                      Math.max(0, COLLAPSE_KING_MAX_LIVES - displayedLives.w),
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-sm font-black">Black</p>
                  <p className="mt-1 text-xl">
                    {"♥".repeat(displayedLives.b)}
                    {"♡".repeat(
                      Math.max(0, COLLAPSE_KING_MAX_LIVES - displayedLives.b),
                    )}
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Collapse Stats">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-xl font-black text-red-300">
                    {state.collapse.collapseCount}
                  </p>
                  <p className="text-[9px] text-zinc-600">Collapses</p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-xl font-black text-red-300">
                    {collapseDestroyedCount}
                  </p>
                  <p className="text-[9px] text-zinc-600">Pieces lost</p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-xl font-black text-red-300">{whiteHits}</p>
                  <p className="text-[9px] text-zinc-600">White hits</p>
                </div>
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-xl font-black text-red-300">{blackHits}</p>
                  <p className="text-[9px] text-zinc-600">Black hits</p>
                </div>
              </div>
            </Panel>

            <Panel title="Rules">
              <div className="space-y-2 text-xs leading-5 text-zinc-400">
                <p>
                  ⚠ A seeded random outer edge is warned every{" "}
                  {COLLAPSE_MIN_DELAY_MOVES}–{COLLAPSE_MAX_DELAY_MOVES}{" "}
                  completed moves.
                </p>
                <p>
                  4 The warning lasts {COLLAPSE_WARNING_MOVES} completed moves.
                </p>
                <p>💥 Pieces still on the edge are destroyed.</p>
                <p>
                  ♥ A hit king loses one of {COLLAPSE_KING_MAX_LIVES} Collapse
                  lives and must escape one king step.
                </p>
                <p>☠ No legal adjacent escape means immediate elimination.</p>
                <p>▣ Collapse stops at the central c3–f6 core.</p>
              </div>
            </Panel>
          </aside>
        </div>

        {gameState.undo_requested_by && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-6 shadow-2xl">
              {gameState.undo_requested_by === user?.id ? (
                <>
                  <h2 className="text-xl font-black">Undo requested</h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Waiting for your opponent to accept or decline.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black">Opponent requests Undo</h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Accepting restores the board bounds, warning timer, king
                    lives, destroyed pieces and relocation state from before the
                    latest move.
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void respondUndo(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => void respondUndo(true)}
                      className="rounded-xl bg-red-400 px-4 py-3 font-black text-red-950"
                    >
                      Accept
                    </button>
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
