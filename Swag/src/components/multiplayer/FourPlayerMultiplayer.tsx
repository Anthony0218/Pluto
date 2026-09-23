import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "@/utils/sound";
import {
  FOUR_PLAYER_ORDER,
  applyFourPlayerMove,
  cloneFourPlayerState,
  createInitialFourPlayerState,
  fourPlayerLabel,
  fourPlayerSquareName,
  getFourPlayerLegalMoves,
  isFourPlayerKingInCheck,
  isPlayableFourPlayerSquare,
  type FourPlayerColor,
  type FourPlayerPiece,
  type FourPlayerPieceType,
  type FourPlayerSquare,
  type FourPlayerState,
} from "@/games/chess/variants/fourPlayerChess";
import type {
  VariantGame,
  VariantRoom,
  FourPlayerVariantRoomPlayer,
} from "@/games/chess/multiplayer/variantMultiplayerTypes";

type ActionLoading =
  | "move"
  | "undo-request"
  | "undo-response"
  | "resign"
  | "rematch"
  | null;

const pieceSymbols: Record<FourPlayerPieceType, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

const playerStyles: Record<
  FourPlayerColor,
  { piece: string; text: string; soft: string; border: string; button: string }
> = {
  red: {
    piece: "text-red-400",
    text: "text-red-300",
    soft: "bg-red-400/10",
    border: "border-red-400/20",
    button: "border-red-400/30 bg-red-400/10 text-red-200",
  },
  blue: {
    piece: "text-sky-400",
    text: "text-sky-300",
    soft: "bg-sky-400/10",
    border: "border-sky-400/20",
    button: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  },
  yellow: {
    piece: "text-amber-300",
    text: "text-amber-200",
    soft: "bg-amber-300/10",
    border: "border-amber-300/20",
    button: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  },
  green: {
    piece: "text-emerald-400",
    text: "text-emerald-300",
    soft: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    button: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
};

function normalizeCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function sameSquare(a: FourPlayerSquare, b: FourPlayerSquare) {
  return a.row === b.row && a.column === b.column;
}

function moveNotation(state: FourPlayerState) {
  const move = state.lastMove;
  if (!move) return state.event ?? "Action";
  const capture = move.captured ? "×" : "–";
  const promotion = move.promoted ? "=Q" : "";
  return `${fourPlayerSquareName(move.from)}${capture}${fourPlayerSquareName(move.to)}${promotion}`;
}

function normalizeGame(raw: VariantGame): VariantGame {
  return {
    ...raw,
    moves: raw.moves ?? [],
    state: raw.state ?? {},
    state_history: Array.isArray(raw.state_history) ? raw.state_history : [],
    rematch_ready: Array.isArray(raw.rematch_ready) ? raw.rematch_ready : [],
    undo_votes: Array.isArray(raw.undo_votes) ? raw.undo_votes : [],
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
    last_action_user_id: raw.last_action_user_id ?? null,
    last_action_kind: raw.last_action_kind ?? null,
  };
}

function isFourPlayerState(value: unknown): value is FourPlayerState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<FourPlayerState>;
  return (
    Array.isArray(state.board) &&
    typeof state.turn === "string" &&
    Array.isArray(state.activePlayers) &&
    typeof state.moveCount === "number"
  );
}

function nextActiveAfter(color: FourPlayerColor, active: FourPlayerColor[]) {
  const start = FOUR_PLAYER_ORDER.indexOf(color);
  for (let step = 1; step <= FOUR_PLAYER_ORDER.length; step += 1) {
    const candidate =
      FOUR_PLAYER_ORDER[(start + step) % FOUR_PLAYER_ORDER.length];
    if (active.includes(candidate)) return candidate;
  }
  return active[0] ?? color;
}

function applyResignation(state: FourPlayerState, color: FourPlayerColor) {
  const next = cloneFourPlayerState(state);
  next.board = next.board.map((row) =>
    row.map((piece) => (piece?.color === color ? null : piece)),
  );
  next.activePlayers = next.activePlayers.filter((player) => player !== color);
  next.lastMove = null;
  next.event = `${fourPlayerLabel(color)} resigned and was eliminated.`;

  if (next.activePlayers.length === 1) {
    next.winner = next.activePlayers[0];
    next.turn = next.activePlayers[0];
  } else if (next.turn === color) {
    next.turn = nextActiveAfter(color, next.activePlayers);
  }

  return next;
}

function checkedKing(state: FourPlayerState): FourPlayerSquare | null {
  if (!isFourPlayerKingInCheck(state.board, state.turn)) return null;
  for (let row = 0; row < 14; row += 1) {
    for (let column = 0; column < 14; column += 1) {
      const piece = state.board[row]?.[column];
      if (piece?.color === state.turn && piece.type === "k")
        return { row, column };
    }
  }
  return null;
}

export function FourPlayerMultiplayerLobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [hostColor, setHostColor] = useState<FourPlayerColor>("red");
  const [joinColor, setJoinColor] = useState<FourPlayerColor>("blue");
  const [joinCode, setJoinCode] = useState("");
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
    const { data, error: rpcError } = await supabase.rpc(
      "create_four_player_variant_room",
      {
        p_initial_state: createInitialFourPlayerState(),
        p_display_name: displayName,
        p_host_color: hostColor,
      },
    );
    setLoading(null);
    if (rpcError) return setError(rpcError.message);
    navigate(`/games/chess/variants/4-players/multiplayer/${String(data)}`);
  }

  async function joinRoom() {
    if (!user) return setError("Sign in first.");
    const code = normalizeCode(joinCode);
    if (code.length !== 6) return setError("Enter the 6-character room code.");

    setLoading("join");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "join_four_player_variant_room",
      {
        p_code: code,
        p_display_name: displayName,
        p_color: joinColor,
      },
    );
    setLoading(null);
    if (rpcError) return setError(rpcError.message);
    navigate(
      `/games/chess/variants/4-players/multiplayer/${String(data ?? code)}`,
    );
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 rounded-3xl border border-cyan-400/15 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-3xl">
              ✣
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
                Four Player Chess · Multiplayer
              </p>
              <h1 className="mt-1 text-3xl font-black text-white">
                Four armies. Four browsers.
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Red → Blue → Yellow → Green · last player standing wins
              </p>
            </div>
          </div>
        </header>

        {!user ? (
          <Panel title="Sign in required">
            <p className="text-sm text-zinc-400">
              Multiplayer rooms use your existing Supabase account.
            </p>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Create room" subtitle="Pick any of the four armies">
              <ColorPicker value={hostColor} onChange={setHostColor} />
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-cyan-300 px-5 py-3 font-black text-zinc-950 hover:bg-cyan-200 disabled:opacity-40"
              >
                {loading === "create" ? "Creating..." : "Create 4-Player Room"}
              </button>
            </Panel>

            <Panel title="Join room" subtitle="Choose a free army color">
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeCode(event.target.value))
                }
                placeholder="ABC123"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none focus:border-cyan-400/40"
              />
              <div className="mt-4">
                <ColorPicker value={joinColor} onChange={setJoinColor} />
              </div>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-4 w-full rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07] px-5 py-3 font-black text-cyan-200 hover:bg-cyan-400/10 disabled:opacity-40"
              >
                {loading === "join" ? "Joining..." : "Join Room"}
              </button>
            </Panel>
          </div>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </main>
  );
}

export function FourPlayerMultiplayerGame() {
  const { roomCode } = useParams();
  const { user } = useAuth();
  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<FourPlayerVariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<FourPlayerSquare | null>(
    null,
  );
  const [historyPreviewIndex, setHistoryPreviewIndex] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const lastSeenActionCountRef = useRef(0);

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === user?.id) ?? null,
    [players, user?.id],
  );
  const myColor =
    myPlayer?.chosen_color &&
    FOUR_PLAYER_ORDER.includes(myPlayer.chosen_color as FourPlayerColor)
      ? (myPlayer.chosen_color as FourPlayerColor)
      : null;

  const liveState = useMemo(() => {
    return isFourPlayerState(gameState?.state)
      ? (gameState!.state as unknown as FourPlayerState)
      : createInitialFourPlayerState();
  }, [gameState?.state]);

  const stateHistory = useMemo(() => {
    return (gameState?.state_history ?? []).filter(
      isFourPlayerState,
    ) as FourPlayerState[];
  }, [gameState?.state_history]);

  const displayedState =
    historyPreviewIndex === null
      ? liveState
      : (stateHistory[historyPreviewIndex] ?? liveState);

  const legalMoves = useMemo(
    () =>
      selectedSquare ? getFourPlayerLegalMoves(liveState, selectedSquare) : [],
    [liveState, selectedSquare],
  );
  const checkedKingSquare = useMemo(
    () => checkedKing(displayedState),
    [displayedState],
  );

  const myActive = myColor ? liveState.activePlayers.includes(myColor) : false;
  const undoPending = Boolean(gameState?.undo_requested_by);
  const canMove =
    room?.status === "playing" &&
    gameState?.status === "playing" &&
    myColor !== null &&
    myActive &&
    liveState.turn === myColor &&
    actionLoading === null &&
    historyPreviewIndex === null &&
    !undoPending;

  const undoVotes = gameState?.undo_votes ?? [];
  const myUndoRequest =
    Boolean(user?.id) && gameState?.undo_requested_by === user?.id;
  const opponentUndoRequest =
    Boolean(gameState?.undo_requested_by) && !myUndoRequest;
  const alreadyVotedUndo = Boolean(user?.id) && undoVotes.includes(user!.id);
  const requiredUndoApprovals = Math.max(players.length - 1, 0);
  const alreadyRequestedThisVersion =
    Boolean(user?.id) &&
    gameState?.undo_last_requested_by === user?.id &&
    gameState?.undo_last_requested_version === gameState?.version;
  const canRequestUndo =
    gameState?.status === "playing" &&
    gameState.last_action_kind === "move" &&
    gameState.last_action_user_id === user?.id &&
    !undoPending &&
    !alreadyRequestedThisVersion &&
    actionLoading === null;

  const rematchReady = gameState?.rematch_ready ?? [];
  const myRematchReady = Boolean(user?.id) && rematchReady.includes(user!.id);

  const applyGame = useCallback((raw: VariantGame) => {
    const next = normalizeGame(raw);
    const count = next.moves.length;
    if (count < lastSeenActionCountRef.current) {
      setHistoryPreviewIndex(null);
      setSelectedSquare(null);
    }
    if (
      count > lastSeenActionCountRef.current &&
      isFourPlayerState(next.state)
    ) {
      const state = next.state as unknown as FourPlayerState;
      if (state.lastMove) {
        if (state.lastMove.captured)
          playPieceCaptureSound(state.lastMove.piece);
        else playPieceMoveSound(state.lastMove.piece);
      }
    }
    lastSeenActionCountRef.current = count;
    setGameState(next);
    if (next.undo_requested_by || next.status !== "playing")
      setSelectedSquare(null);
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
        .eq("variant", "four-player")
        .single();
      if (roomError || !roomData) {
        if (!silent) setError("Four Player room not found.");
        setLoading(false);
        return;
      }

      const loadedRoom = roomData as VariantRoom;
      const { data: playerData, error: playerError } = await supabase
        .from("variant_room_players")
        .select("room_id, user_id, seat, display_name, chosen_color")
        .eq("room_id", loadedRoom.id)
        .order("seat", { ascending: true });
      if (playerError || !playerData) {
        if (!silent)
          setError(playerError?.message ?? "Players could not be loaded.");
        setLoading(false);
        return;
      }
      const loadedPlayers = playerData as FourPlayerVariantRoomPlayer[];
      if (!loadedPlayers.some((player) => player.user_id === user.id)) {
        if (!silent) setError("You are not a player in this room.");
        setLoading(false);
        return;
      }

      const { data: gameData, error: gameError } = await supabase
        .from("variant_games")
        .select(
          `
          room_id, variant, seed, initial_fen, fen, moves, state, state_history,
          status, winner, end_reason, version, last_move_from, last_move_to,
          white_rematch_ready, black_rematch_ready, next_seed, next_initial_fen,
          rematch_ready, undo_requested_by, undo_requested_version,
          undo_previous_fen, undo_previous_last_from, undo_previous_last_to,
          undo_last_requested_by, undo_last_requested_version, undo_votes,
          last_action_user_id, last_action_kind
        `,
        )
        .eq("room_id", loadedRoom.id)
        .single();
      if (gameError || !gameData) {
        if (!silent)
          setError(gameError?.message ?? "Game could not be loaded.");
        setLoading(false);
        return;
      }

      setRoom(loadedRoom);
      setPlayers(loadedPlayers);
      applyGame(gameData as VariantGame);
      setLoading(false);
    },
    [applyGame, roomCode, user],
  );

  useEffect(() => {
    void loadRoom(false);
  }, [loadRoom]);

  useEffect(() => {
    if (!room) return;
    const roomId = room.id;
    const gameChannel = supabase
      .channel(`four-player-game-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_games",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => applyGame(payload.new as VariantGame),
      )
      .subscribe();
    const roomChannel = supabase
      .channel(`four-player-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "variant_room_players",
          filter: `room_id=eq.${roomId}`,
        },
        () => void loadRoom(true),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_rooms",
          filter: `id=eq.${roomId}`,
        },
        () => void loadRoom(true),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(gameChannel);
      void supabase.removeChannel(roomChannel);
    };
  }, [applyGame, loadRoom, room?.id]);

  useEffect(() => {
    if (!room) return;
    const id = window.setInterval(() => {
      if (actionLoading === null) void loadRoom(true);
    }, 1500);
    return () => window.clearInterval(id);
  }, [actionLoading, loadRoom, room?.id]);

  function clearSelection() {
    setSelectedSquare(null);
  }

  async function commitMove(from: FourPlayerSquare, to: FourPlayerSquare) {
    if (!room || !gameState || !canMove || !myColor) return;
    const previous = gameState;
    const nextState = applyFourPlayerMove(liveState, from, to);
    if (nextState === liveState || nextState.moveCount === liveState.moveCount)
      return;

    const notation = moveNotation(nextState);
    const optimistic: VariantGame = {
      ...gameState,
      state: nextState as unknown as Record<string, unknown>,
      state_history: [...(gameState.state_history ?? []), nextState],
      moves: [...gameState.moves, notation],
      version: gameState.version + 1,
      status: nextState.winner ? "finished" : "playing",
      winner: nextState.winner,
      end_reason: nextState.winner ? "last player standing" : null,
      last_action_user_id: user?.id ?? null,
      last_action_kind: "move",
    };

    setGameState(optimistic);
    lastSeenActionCountRef.current = optimistic.moves.length;
    if (nextState.lastMove?.captured)
      playPieceCaptureSound(nextState.lastMove.piece);
    else if (nextState.lastMove) playPieceMoveSound(nextState.lastMove.piece);
    clearSelection();
    setActionLoading("move");
    setError(null);

    const { error: rpcError } = await supabase.rpc("play_four_player_move", {
      p_room_id: room.id,
      p_from: from,
      p_to: to,
      p_notation: notation,
      p_new_state: nextState,
      p_expected_version: previous.version,
    });
    setActionLoading(null);

    if (rpcError) {
      setGameState(previous);
      lastSeenActionCountRef.current = previous.moves.length;
      setError(rpcError.message);
      await loadRoom(true);
    }
  }

  function selectOrMove(row: number, column: number) {
    if (!canMove || !myColor || !isPlayableFourPlayerSquare(row, column))
      return;
    const square = { row, column };
    const piece = liveState.board[row][column];

    if (!selectedSquare) {
      if (piece?.color !== myColor) return;
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      return;
    }

    if (piece?.color === myColor) {
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      return;
    }

    if (!legalMoves.some((target) => sameSquare(target, square))) {
      return clearSelection();
    }

    void commitMove(selectedSquare, square);
  }

  async function requestUndo() {
    if (!room || !canRequestUndo) return;
    setActionLoading("undo-request");
    setError(null);
    const { error: rpcError } = await supabase.rpc("request_four_player_undo", {
      p_room_id: room.id,
    });
    if (rpcError) setError(rpcError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function respondUndo(accept: boolean) {
    if (!room || !opponentUndoRequest || alreadyVotedUndo || actionLoading)
      return;
    setActionLoading("undo-response");
    const { error: rpcError } = await supabase.rpc("respond_four_player_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });
    if (rpcError) setError(rpcError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function resign() {
    if (
      !room ||
      !gameState ||
      !myColor ||
      !myActive ||
      undoPending ||
      actionLoading
    )
      return;
    const next = applyResignation(liveState, myColor);
    setActionLoading("resign");
    const { error: rpcError } = await supabase.rpc("resign_four_player_game", {
      p_room_id: room.id,
      p_new_state: next,
      p_action_label: `${fourPlayerLabel(myColor)} resigns`,
    });
    if (rpcError) setError(rpcError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function rematch() {
    if (
      !room ||
      gameState?.status !== "finished" ||
      myRematchReady ||
      actionLoading
    )
      return;
    setActionLoading("rematch");
    const { error: rpcError } = await supabase.rpc(
      "request_four_player_rematch",
      {
        p_room_id: room.id,
      },
    );
    if (rpcError) setError(rpcError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function copyCode() {
    if (!room?.code) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1000);
    } catch {
      // convenience only
    }
  }

  if (!user)
    return <SimplePage text="Sign in to open this Four Player room." />;
  if (loading && !gameState)
    return <SimplePage text="Loading Four Player multiplayer..." />;
  if (!room || !gameState)
    return <SimplePage text={error ?? "Four Player room unavailable."} />;

  const orderedPlayers = FOUR_PLAYER_ORDER.map((color) => ({
    color,
    player: players.find((player) => player.chosen_color === color) ?? null,
  }));

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1580px]">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-cyan-400/15 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10 text-3xl">
              ✣
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-300">
                Four Player Chess · Multiplayer
              </p>
              <h1 className="mt-1 text-2xl font-black text-white">
                Four armies. One battlefield.
              </h1>
              <p
                className={`mt-1 text-sm ${playerStyles[liveState.turn].text}`}
              >
                {fourPlayerLabel(liveState.turn)} to move
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs font-black text-zinc-300"
            >
              {copied ? "Copied" : `Room ${room.code}`}
            </button>
            <Link
              to="/games/chess/variants/4-players/multiplayer"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 hover:bg-white/10"
            >
              Leave
            </Link>
          </div>
        </header>

        {error && <ErrorBox>{error}</ErrorBox>}

        {players.length < 4 && (
          <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">
            Waiting for players: <b>{players.length}/4</b>. Share room code{" "}
            <b>{room.code}</b>.
          </div>
        )}

        <main className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title="Players" subtitle="Red → Blue → Yellow → Green">
                <div className="space-y-2">
                  {orderedPlayers.map(({ color, player }) => (
                    <div
                      key={color}
                      className={`flex items-center justify-between rounded-xl border ${playerStyles[color].border} ${playerStyles[color].soft} px-3 py-3`}
                    >
                      <div>
                        <p
                          className={`text-xs font-black ${playerStyles[color].text}`}
                        >
                          {fourPlayerLabel(color)}
                        </p>
                        <p className="mt-1 max-w-[150px] truncate text-[10px] text-zinc-500">
                          {player?.display_name ?? "Waiting..."}
                        </p>
                      </div>
                      <div className="text-right">
                        {myColor === color && (
                          <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black text-white">
                            YOU
                          </span>
                        )}
                        {!liveState.activePlayers.includes(color) && player && (
                          <span className="ml-1 rounded-full bg-red-400/10 px-2 py-1 text-[9px] font-black text-red-300">
                            OUT
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Game Controls" subtitle="Online actions">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canRequestUndo}
                    onClick={() => void requestUndo()}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ↶ Undo
                  </button>
                  <button
                    type="button"
                    disabled={
                      !myActive || gameState.status !== "playing" || undoPending
                    }
                    onClick={() => void resign()}
                    className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    Resign
                  </button>
                </div>
                {myUndoRequest && (
                  <p className="mt-3 text-xs text-amber-200">
                    Undo vote: {undoVotes.length}/{requiredUndoApprovals}{" "}
                    approvals.
                  </p>
                )}
                {opponentUndoRequest && (
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                    <p className="text-xs font-black text-amber-100">
                      Latest mover requests an undo.
                    </p>
                    {alreadyVotedUndo ? (
                      <p className="mt-2 text-xs text-zinc-400">
                        Your approval was recorded. Waiting for the other
                        players.
                      </p>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => void respondUndo(true)}
                          className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => void respondUndo(false)}
                          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-zinc-200"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-zinc-500">
                      {undoVotes.length}/{requiredUndoApprovals} approvals · all
                      other players must agree
                    </p>
                  </div>
                )}
              </Panel>

              <Panel
                title="Move History"
                subtitle="Click any action to preview the board locally"
              >
                <FourPlayerHistory
                  moves={gameState.moves}
                  history={stateHistory}
                  selected={historyPreviewIndex}
                  onSelect={setHistoryPreviewIndex}
                />
              </Panel>
            </div>
          </aside>

          <section className="mx-auto w-full max-w-[900px] min-w-0">
            {historyPreviewIndex !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                    History Preview
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {historyPreviewIndex === 0
                      ? "Initial position"
                      : (gameState.moves[historyPreviewIndex - 1] ??
                        `Action ${historyPreviewIndex}`)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryPreviewIndex(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200"
                >
                  Back to Live Board
                </button>
              </div>
            )}

            {displayedState.event && (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-bold text-zinc-400">
                {displayedState.event}
              </div>
            )}

            <div className="relative">
              <FourPlayerBoard
                state={displayedState}
                selectedSquare={
                  historyPreviewIndex === null ? selectedSquare : null
                }
                legalMoves={historyPreviewIndex === null ? legalMoves : []}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreviewIndex === null ? selectOrMove : () => {}
                }
              />

              {players.length < 4 && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/70 p-4 backdrop-blur-[3px]">
                  <button
                    type="button"
                    onClick={() => void copyCode()}
                    className="w-full max-w-lg rounded-[30px] border border-white/15 bg-zinc-900/95 px-8 py-8 text-center shadow-2xl shadow-black/60 transition hover:border-amber-300/35 hover:bg-zinc-900 active:scale-[0.99]"
                    title="Copy room code"
                  >
                    <div className="text-4xl">🌐</div>

                    <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-amber-300">
                      Waiting for players
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-white">
                      {players.length}/4 players connected
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

              {liveState.winner && historyPreviewIndex === null && (
                <div className="absolute inset-0 z-40 flex items-center justify-center rounded-[28px] bg-zinc-950/80 p-6 backdrop-blur-sm">
                  <div
                    className={`max-w-sm rounded-3xl border bg-zinc-900 p-6 text-center shadow-2xl ${playerStyles[liveState.winner].border}`}
                  >
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-500">
                      Last Player Standing
                    </p>
                    <h2
                      className={`mt-3 text-3xl font-black ${playerStyles[liveState.winner].text}`}
                    >
                      {fourPlayerLabel(liveState.winner)} wins
                    </h2>
                    <button
                      type="button"
                      disabled={myRematchReady}
                      onClick={() => void rematch()}
                      className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-40"
                    >
                      {myRematchReady ? "Rematch requested" : "Request rematch"}
                    </button>
                    <p className="mt-3 text-[10px] text-zinc-500">
                      {rematchReady.length}/{players.length} players ready
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title="Status" subtitle="Live custom-engine state">
                <InfoRow
                  label="Your army"
                  value={myColor ? fourPlayerLabel(myColor) : "—"}
                  valueClass={myColor ? playerStyles[myColor].text : undefined}
                />
                <InfoRow
                  label="Turn"
                  value={fourPlayerLabel(liveState.turn)}
                  valueClass={playerStyles[liveState.turn].text}
                />
                <InfoRow
                  label="Active armies"
                  value={String(liveState.activePlayers.length)}
                />
                <InfoRow
                  label="Actions"
                  value={String(gameState.moves.length)}
                />
              </Panel>

              <Panel title="Rules" subtitle="Four-way free-for-all">
                <Rule text="Turn order is Red → Blue → Yellow → Green, skipping eliminated armies." />
                <Rule text="No castling or en passant. Pawns promote automatically to queens on the opposite edge." />
                <Rule text="Checkmated or stalemated armies are eliminated. The last active player wins." />
              </Panel>

              <Panel title="Board" subtitle="14 × 14 cross">
                <p className="text-xs leading-6 text-zinc-500">
                  The four 3×3 corners are outside the board. Sliding pieces
                  cannot pass through them.
                </p>
              </Panel>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: FourPlayerColor;
  onChange: (color: FourPlayerColor) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {FOUR_PLAYER_ORDER.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={`rounded-xl border px-3 py-3 text-sm font-black transition ${value === color ? playerStyles[color].button : "border-white/10 bg-black/20 text-zinc-500 hover:bg-white/5"}`}
        >
          {fourPlayerLabel(color)}
        </button>
      ))}
    </div>
  );
}

function FourPlayerHistory({
  moves,
  history,
  selected,
  onSelect,
}: {
  moves: string[];
  history: FourPlayerState[];
  selected: number | null;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
      <button
        type="button"
        onClick={() => onSelect(0)}
        className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-xs ${selected === 0 ? "bg-blue-400/10" : "hover:bg-white/5"}`}
      >
        <span className="text-zinc-600">0</span>
        <span className="font-bold text-zinc-300">Initial position</span>
      </button>
      {moves.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-600">
          No actions yet
        </div>
      ) : (
        moves.map((notation, index) => {
          const snapshot = history[index + 1];
          const color = snapshot?.lastMove?.color;
          return (
            <button
              key={`${index}-${notation}`}
              type="button"
              onClick={() => onSelect(index + 1)}
              className={`flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-2.5 text-left last:border-0 ${selected === index + 1 ? "bg-blue-400/10" : "hover:bg-white/5"}`}
            >
              <span className="w-6 text-[10px] text-zinc-600">{index + 1}</span>
              <span
                className={`min-w-14 text-xs font-black ${color ? playerStyles[color].text : "text-zinc-500"}`}
              >
                {color ? fourPlayerLabel(color) : "Event"}
              </span>
              <span className="truncate font-mono text-xs text-zinc-300">
                {notation}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}

function FourPlayerBoard({
  state,
  selectedSquare,
  legalMoves,
  checkedKingSquare,
  onSquareClick,
}: {
  state: FourPlayerState;
  selectedSquare: FourPlayerSquare | null;
  legalMoves: FourPlayerSquare[];
  checkedKingSquare: FourPlayerSquare | null;
  onSquareClick: (row: number, column: number) => void;
}) {
  return (
    <div className="w-full rounded-[28px] border border-[#5f412d] bg-gradient-to-br from-[#493323] via-[#2d1e15] to-[#160e09] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:p-4">
      <div className="rounded-[18px] border border-black/40 bg-[#160e09] p-1.5 shadow-inner sm:p-2">
        <div
          className="grid aspect-square w-full overflow-hidden rounded-xl bg-zinc-950 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
          style={{
            gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
            gridTemplateRows: "repeat(14, minmax(0, 1fr))",
          }}
        >
          {Array.from({ length: 14 }, (_, row) =>
            Array.from({ length: 14 }, (_, column) => {
              if (!isPlayableFourPlayerSquare(row, column))
                return (
                  <div
                    key={`${row}-${column}`}
                    className="aspect-square bg-zinc-950"
                  />
                );
              const piece = state.board[row][column];
              const square = { row, column };
              const selected = Boolean(
                selectedSquare && sameSquare(selectedSquare, square),
              );
              const legal = legalMoves.some((target) =>
                sameSquare(target, square),
              );
              const last = Boolean(
                state.lastMove &&
                (sameSquare(state.lastMove.from, square) ||
                  sameSquare(state.lastMove.to, square)),
              );
              const checked = Boolean(
                checkedKingSquare && sameSquare(checkedKingSquare, square),
              );
              const light = (row + column) % 2 === 0;

              return (
                <button
                  key={`${row}-${column}`}
                  type="button"
                  aria-label={fourPlayerSquareName(square)}
                  onClick={() => onSquareClick(row, column)}
                  className={`group relative flex aspect-square items-center justify-center overflow-hidden border-0 p-0 transition ${light ? "bg-gradient-to-br from-[#ead7b7] to-[#d5b78b]" : "bg-gradient-to-br from-[#9a6746] to-[#724a31]"} ${selected ? "z-10 ring-4 ring-inset ring-fuchsia-300" : ""}`}
                >
                  {last && (
                    <span className="pointer-events-none absolute inset-0 z-[2] bg-yellow-300/25" />
                  )}
                  {checked && (
                    <span className="pointer-events-none absolute inset-0 z-[3] bg-[radial-gradient(circle,rgba(239,68,68,0.85)_0%,rgba(185,28,28,0.52)_45%,rgba(127,29,29,0.05)_80%)] shadow-[inset_0_0_20px_rgba(239,68,68,0.85)]" />
                  )}
                  {legal && !piece && (
                    <span className="pointer-events-none absolute z-[6] h-[26%] w-[26%] rounded-full bg-black/35" />
                  )}
                  {legal && piece && (
                    <span className="pointer-events-none absolute inset-[7%] z-[6] rounded-full border-[3px] border-black/30" />
                  )}
                  {piece && <FourPlayerPieceView piece={piece} />}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}

function FourPlayerPieceView({ piece }: { piece: FourPlayerPiece }) {
  return (
    <span
      className={`pointer-events-none relative z-10 flex h-full w-full select-none items-center justify-center font-serif text-[clamp(1.15rem,3.5vw,3.2rem)] leading-none drop-shadow-[0_3px_3px_rgba(0,0,0,0.75)] transition-transform duration-150 group-hover:scale-105 ${playerStyles[piece.color].piece}`}
    >
      {pieceSymbols[piece.type]}
    </span>
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
    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/15 backdrop-blur-md">
      <div className="mb-4">
        <h2 className="text-sm font-black text-zinc-100">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  valueClass = "text-zinc-200",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-xs last:border-0">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-black ${valueClass}`}>{value}</span>
    </div>
  );
}

function Rule({ text }: { text: string }) {
  return (
    <div className="mb-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs leading-5 text-zinc-400 last:mb-0">
      {text}
    </div>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">
      {children}
    </div>
  );
}

function SimplePage({ text }: { text: string }) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-900/70 p-6 text-center">
        {text}
      </div>
    </main>
  );
}
