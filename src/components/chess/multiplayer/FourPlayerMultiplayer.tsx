import { recordCreatedGameInvite } from "@/components/social/GameInviteDelivery";
import { useInviteAutoCreate } from "@/hooks/useInviteAutoCreate";
import { useInviteAutoJoin } from "@/hooks/useInviteAutoJoin";
import VisibleGameResult from "@/components/chess/VisibleGameResult";
import InviteFriendButton from "@/components/chess/InviteFriendButton";
import RoomSlots from "@/components/social/RoomSlots";
import ChessMoveHistoryList from "../ChessMoveHistoryList";
import FourPlayerThemedPiece from "../FourPlayerThemedPiece";
import { boardColors, useChessSettings } from "@/context/ChessSettingsContext";
import { FOUR_PLAYER_HISTORY_SIDES } from "../moveHistorySides";
import ChessPageHeader from "@/components/chess/ChessPageHeader";
import { ui, useUiLanguage } from "@/i18n/ui";
import { chooseFourPlayerAiMove } from "@/games/chess/ai/fourPlayerAi";
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

const playerStyles: Record<
  FourPlayerColor,
  { text: string; soft: string; border: string; button: string }
> = {
  red: {
    text: "text-red-300",
    soft: "bg-red-400/10",
    border: "border-red-400/20",
    button: "border-red-400/30 bg-red-400/10 text-red-200",
  },
  blue: {
    text: "text-sky-300",
    soft: "bg-sky-400/10",
    border: "border-sky-400/20",
    button: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  },
  yellow: {
    text: "text-amber-200",
    soft: "bg-amber-300/10",
    border: "border-amber-300/20",
    button: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  },
  green: {
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
  if (move.castle) return move.castle === "king" ? "O-O" : "O-O-O";
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
  useUiLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [hostColor, setHostColor] = useState<FourPlayerColor>("red");
  const [joinColor, setJoinColor] = useState<FourPlayerColor>("blue");
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(window.location.search).get("code")?.toUpperCase() ?? "");
  useInviteAutoJoin(() => joinRoom());
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const username =
      typeof profile?.username === "string" ? profile.username.trim() : "";
    if (username) return username;
    return user?.email?.split("@")[0]?.trim() || "Player";
  }, [profile?.username, user?.email]);

  useInviteAutoCreate(() => createRoom());

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
    navigate(recordCreatedGameInvite(`/games/chess/variants/4-players/multiplayer/${String(data)}`));
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
    <main className="chess-variant-page min-h-[var(--app-height)] overflow-y-auto bg-transparent px-4 py-8 pb-12 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <ChessPageHeader className="mb-7 rounded-3xl border border-cyan-400/15 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30" description={<> {ui("Red → Blue → Yellow → Green · last player standing wins")} </>}>

        </ChessPageHeader>

        {!user ? (
          <Panel title={ui("Sign in required")}>
            <p className="text-sm text-zinc-400">{ui("Multiplayer rooms use your existing Supabase account.")}</p>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title={ui("Create room")} subtitle={ui("Pick any of the four armies")}>
              <ColorPicker value={hostColor} onChange={setHostColor} />
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-cyan-300 px-5 py-3 font-black text-zinc-950 hover:bg-cyan-200 disabled:opacity-40"
              >
                {loading === "create" ? ui("Creating...") : ui("Create 4-Player Room")}
              </button>
            </Panel>

            <Panel title={ui("Join room")} subtitle={ui("Choose a free army color")}>
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeCode(event.target.value))
                }
                placeholder={ui("ABC123")}
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
                {loading === "join" ? ui("Joining...") : ui("Join Room")}
              </button>
            </Panel>
          </div>
        )}
        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </div>
    </main>
  );
}

export function FourPlayerMultiplayerGame() {
  useUiLanguage();
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
  const [selectedBotColors, setSelectedBotColors] = useState<FourPlayerColor[]>(
    [],
  );
  const lastSeenActionCountRef = useRef(0);
  const latestGameVersionRef = useRef(-1);
  const loadedRoomIdRef = useRef<string | null>(null);

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

  const botColors = room?.bot_colors ?? [];
  const plannedBotColors = selectedBotColors.filter(
    (color) => !players.some((player) => player.chosen_color === color),
  );
  const unassignedHumanSlots = FOUR_PLAYER_ORDER.filter(
    (color) =>
      !players.some((player) => player.chosen_color === color) &&
      !plannedBotColors.includes(color),
  );
  const mixedGame = botColors.length > 0;
  const filledSeats = players.length + botColors.length;
  const botTurn = !!room && room.host_id === user?.id && botColors.includes(liveState.turn) && room.status === "playing" && gameState?.status === "playing" && !gameState.undo_requested_by && actionLoading === null;
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
    (mixedGame ? gameState.bot_undo_snapshot?.user_id === user?.id : gameState.last_action_kind === "move" && gameState.last_action_user_id === user?.id) &&
    !undoPending &&
    !alreadyRequestedThisVersion &&
    actionLoading === null;

  const rematchReady = gameState?.rematch_ready ?? [];
  const myRematchReady = Boolean(user?.id) && rematchReady.includes(user!.id);

  const applyGame = useCallback((raw: VariantGame) => {
    const next = normalizeGame(raw);
    // Polling and Realtime can resolve out of order. Never replace a newer
    // board (including an optimistic move) with an older server snapshot.
    if (next.version < latestGameVersionRef.current) return;
    latestGameVersionRef.current = next.version;
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
        .select("id, code, host_id, variant, max_players, bot_colors, status, created_at")
        .eq("code", roomCode.toUpperCase())
        .eq("variant", "four-player")
        .single();
      if (roomError || !roomData) {
        if (!silent) setError("Four Player room not found.");
        setLoading(false);
        return;
      }

      const loadedRoom = roomData as VariantRoom;
      if (loadedRoom.id !== loadedRoomIdRef.current) {
        loadedRoomIdRef.current = loadedRoom.id;
        latestGameVersionRef.current = -1;
        lastSeenActionCountRef.current = 0;
      }
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
          last_action_user_id, last_action_kind, bot_undo_snapshot
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

  const botAttemptKey = useRef<string | null>(null);
  useEffect(() => {
    if (!botTurn || !gameState || !room) return;
    const attemptKey = `${room.id}:${gameState.version}`;
    if (botAttemptKey.current === attemptKey) return;
    const timer = window.setTimeout(() => {
      const move = chooseFourPlayerAiMove(liveState, "casual");
      if (!move) return;
      // A rejected move must not be retried until the server publishes a new
      // version. Otherwise the polling refresh would repeatedly send the same
      // stale request and flood the console with 400 responses.
      botAttemptKey.current = attemptKey;
      void commitMove(move.from, move.to, true);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [botTurn, gameState?.version, liveState, room?.id]);

  async function startWithBots(colors = plannedBotColors) {
    if (!room || room.host_id !== user?.id || actionLoading) return;
    setActionLoading("move"); setError(null);
    const { error } = await supabase.rpc("start_four_player_with_bots", { p_room_id: room.id, p_bot_colors: colors });
    if (error) setError(error.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  function setBotSlot(color: FourPlayerColor, isBot: boolean) {
    if (players.some((player) => player.chosen_color === color)) return;
    setSelectedBotColors((current) =>
      isBot
        ? current.includes(color) ? current : [...current, color]
        : current.filter((candidate) => candidate !== color),
    );
  }

  function clearSelection() {
    setSelectedSquare(null);
  }

  async function commitMove(from: FourPlayerSquare, to: FourPlayerSquare, bot = false) {
    if (!room || !gameState || (bot ? !botTurn : !canMove) || !myColor) return;
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
    latestGameVersionRef.current = optimistic.version;
    lastSeenActionCountRef.current = optimistic.moves.length;
    if (nextState.lastMove?.captured)
      playPieceCaptureSound(nextState.lastMove.piece);
    else if (nextState.lastMove) playPieceMoveSound(nextState.lastMove.piece);
    clearSelection();
    setActionLoading("move");
    setError(null);

    const { error: rpcError } = await supabase.rpc(mixedGame ? "play_four_player_mixed_move" : "play_four_player_move", {
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
    const { error: rpcError } = await supabase.rpc(mixedGame ? "four_player_mixed_action" : "request_four_player_undo", {
      p_room_id: room.id,
      ...(mixedGame ? { p_action: "undo-request" } : {}),
    });
    if (rpcError) setError(rpcError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function respondUndo(accept: boolean) {
    if (!room || !opponentUndoRequest || alreadyVotedUndo || actionLoading)
      return;
    setActionLoading("undo-response");
    const { error: rpcError } = await supabase.rpc(mixedGame ? "four_player_mixed_action" : "respond_four_player_undo", {
      p_room_id: room.id,
      ...(mixedGame ? { p_action: "undo-response" } : {}),
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
    const { error: rpcError } = await supabase.rpc(mixedGame ? "four_player_mixed_action" : "resign_four_player_game", {
      p_room_id: room.id,
      ...(mixedGame ? { p_action: "resign", p_state: next } : { p_new_state: next, p_action_label: `${fourPlayerLabel(myColor)} resigns` }),
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
      mixedGame ? "four_player_mixed_action" : "request_four_player_rematch",
      {
        p_room_id: room.id,
        ...(mixedGame ? { p_action: "rematch" } : {}),
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
    return <SimplePage text={ui("Sign in to open this Four Player room.")} />;
  if (loading && !gameState)
    return <SimplePage text={ui("Loading Four Player multiplayer...")} />;
  if (!room || !gameState)
    return <SimplePage text={error ?? "Four Player room unavailable."} />;

  const orderedPlayers = FOUR_PLAYER_ORDER.map((color) => ({
    color,
    player: players.find((player) => player.chosen_color === color) ?? (botColors.includes(color) ? { user_id: `bot-${color}`, display_name: `${fourPlayerLabel(color)} AI`, chosen_color: color } : null),
  }));

  // Do not place the invite UI over the 14×14 board. The board surface is
  // deliberately viewport-bound on desktop, so a large code card can be
  // clipped on short displays. This dedicated waiting screen scrolls normally.
  if (room.status === "waiting" && filledSeats < 4) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] overflow-y-auto bg-transparent px-4 py-6 pb-12 text-zinc-100 sm:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <ChessPageHeader className="mb-6 flex flex-col gap-4 rounded-3xl border border-cyan-400/15 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between" description={<> {ui("The game starts when all four armies are filled.")} </>}>

            <Link to="/games/chess/variants/4-players/multiplayer" className="self-start rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 hover:bg-white/10 sm:self-auto">{ui("Leave")}</Link>
          </ChessPageHeader>

          {error && <ErrorBox>{ui(error)}</ErrorBox>}

          <section className="rounded-3xl border border-amber-300/25 bg-zinc-900/80 p-5 text-center shadow-2xl shadow-black/25 sm:p-8">
            <div className="text-4xl">🌐</div>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-amber-300">{ui("Waiting for players")}</p>
            <h2 className="mt-2 text-3xl font-black text-white">{filledSeats}{ui("/4 players connected")}</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-400">{ui("Share this room code. The game starts automatically when everyone has joined.")}</p>
            <button type="button" onClick={() => void copyCode()} className="mx-auto mt-6 block w-full max-w-xl rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-5 py-5 transition hover:border-amber-200/50 hover:bg-amber-300/[0.1]" title={ui("Copy room code")}>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-500">{ui("Room Code")}</p>
              <p className="mt-2 break-all font-mono text-4xl font-black tracking-[0.16em] text-amber-200 sm:text-5xl">{room.code}</p>
              <p className="mt-4 text-xs font-bold text-zinc-400">{copied ? ui("✓ Copied to clipboard") : ui("Click this box to copy the code")}</p>
            </button>
          </section>

          <section className="mt-5 rounded-3xl border border-white/10 bg-zinc-900/75 p-5 shadow-xl shadow-black/15 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-black text-white">{ui("Players")}</h2><p className="mt-1 text-xs text-zinc-500">{ui("Red → Blue → Yellow → Green")}</p></div><span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-black text-cyan-100">{filledSeats}/4</span></div>
            <div className="grid gap-3 sm:grid-cols-2">
              {orderedPlayers.map(({ color, player }) => {
                const isBot = plannedBotColors.includes(color);
                const isHost = room.host_id === user?.id;
                return <div key={color} className={`rounded-xl border ${playerStyles[color].border} ${playerStyles[color].soft} px-4 py-3`}><div className="flex items-center justify-between gap-3"><div><p className={`text-xs font-black ${playerStyles[color].text}`}>{fourPlayerLabel(color)}</p><p className="mt-1 text-xs text-zinc-400">{player?.display_name ?? (isBot ? ui("AI bot") : ui("Waiting for player"))}</p></div>{myColor === color && <span className="rounded-full bg-white/10 px-2 py-1 text-[9px] font-black text-white">{ui("YOU")}</span>}</div>{isHost && !player && <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setBotSlot(color, false)} aria-pressed={!isBot} className={`rounded-lg px-2 py-2 text-[10px] font-black ${!isBot ? "bg-cyan-300 text-zinc-950" : "bg-white/5 text-zinc-400"}`}>{ui("Player")}</button><button type="button" onClick={() => setBotSlot(color, true)} aria-pressed={isBot} className={`rounded-lg px-2 py-2 text-[10px] font-black ${isBot ? "bg-amber-300 text-zinc-950" : "bg-white/5 text-zinc-400"}`}>{ui("AI bot")}</button></div>}{!player && !isBot && <InviteFriendButton />}</div>;
              })}
            </div>
          </section>

          {room.host_id === user?.id && <section className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-400/5 p-5 text-center"><p className="text-sm text-zinc-300">{unassignedHumanSlots.length ? ui("Choose AI for each open slot you do not want a person to fill.") : ui("Every slot is assigned. Start when you are ready.")}</p><button type="button" disabled={actionLoading !== null || unassignedHumanSlots.length > 0} onClick={() => void startWithBots()} className="mt-4 rounded-xl bg-amber-300 px-5 py-3 font-bold text-zinc-950 disabled:opacity-50">{actionLoading ? ui("Starting...") : ui("Start assigned game")}</button></section>}
        </div>
      </main>
    );
  }

  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1780px]">
        <ChessPageHeader className="mb-6 flex flex-col gap-4 rounded-3xl border border-cyan-400/15 bg-zinc-900/70 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between" description={<> {fourPlayerLabel(liveState.turn)}{ui("to move")} </>}>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs font-black text-zinc-300"
            >
              {copied ? ui("Copied") : `Room ${room.code}`}
            </button>
            <Link
              to="/games/chess/variants/4-players/multiplayer"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 hover:bg-white/10"
            >{ui("Leave")}</Link>
          </div>
        </ChessPageHeader>

        {error && <ErrorBox>{ui(error)}</ErrorBox>}

        {mixedGame && <p className="mb-3 text-sm text-amber-200">{ui("Bots: ")}{botColors.map(fourPlayerLabel).join(", ")}{ui(" · The host keeps this room open to run bot turns.")}</p>}
        {filledSeats < 4 && (
          <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">{ui("Waiting for players:")}<b>{filledSeats}/4</b>{ui(". Share room code")}{" "}
            <b>{room.code}</b>.
          </div>
        )}

        <main className="grid gap-5 chess-game-grid four-player-game-grid xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title={ui("Game Controls")} subtitle={ui("Online actions")}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canRequestUndo}
                    onClick={() => void requestUndo()}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
                  >{ui("↶ Undo")}</button>
                  <button
                    type="button"
                    disabled={
                      !myActive || gameState.status !== "playing" || undoPending
                    }
                    onClick={() => void resign()}
                    className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                  >{ui("Resign")}</button>
                </div>
                {myUndoRequest && (
                  <p className="mt-3 text-xs text-amber-200">{ui("Undo vote:")}{undoVotes.length}/{requiredUndoApprovals}{" "}{ui("approvals.")}</p>
                )}
                {opponentUndoRequest && (
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                    <p className="text-xs font-black text-amber-100">{ui("Latest mover requests an undo.")}</p>
                    {alreadyVotedUndo ? (
                      <p className="mt-2 text-xs text-zinc-400">{ui("Your approval was recorded. Waiting for the other players.")}</p>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => void respondUndo(true)}
                          className="rounded-lg bg-emerald-300 px-3 py-2 text-xs font-black text-zinc-950"
                        >{ui("Accept")}</button>
                        <button
                          onClick={() => void respondUndo(false)}
                          className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-zinc-200"
                        >{ui("Decline")}</button>
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-zinc-500">
                      {undoVotes.length}/{requiredUndoApprovals}{ui("approvals · all other players must agree")}</p>
                  </div>
                )}
              </Panel>

              <Panel
                title={ui("Move History")}
                subtitle={ui("Click any action to preview the board locally")}
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

          <section className="mx-auto w-full min-w-0">
            {historyPreviewIndex !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">{ui("History Preview")}</p>
                  <p className="mt-1 text-sm font-bold text-white">
                    {historyPreviewIndex === 0 ? ui("Initial position") : (gameState.moves[historyPreviewIndex - 1] ??
                        `Action ${historyPreviewIndex}`)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryPreviewIndex(null)}
                  className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200"
                >{ui("Back to Live Board")}</button>
              </div>
            )}

            {displayedState.event && (
              <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-xs font-bold text-zinc-400">
                {displayedState.event}
              </div>
            )}

            {liveState.winner && historyPreviewIndex === null && (
              <VisibleGameResult
                winner={liveState.winner}
                playerColor={myColor}
                reason="last player standing"
                actions={
                  <button
                    type="button"
                    disabled={myRematchReady}
                    onClick={() => void rematch()}
                    className="mt-5 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-40"
                  >
                    {myRematchReady ? ui("Rematch requested") : ui("Request rematch")}
                  </button>
                }
              />
            )}

            <div className="relative">
              <FourPlayerBoard
                state={displayedState}
                viewerColor={myColor ?? "red"}
                myColor={myColor}
                players={orderedPlayers}
                selectedSquare={
                  historyPreviewIndex === null ? selectedSquare : null
                }
                legalMoves={historyPreviewIndex === null ? legalMoves : []}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreviewIndex === null ? selectOrMove : () => {}
                }
              />

              {filledSeats < 4 && (
                <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/70 p-4 backdrop-blur-[3px]">
                  <button
                    type="button"
                    onClick={() => void copyCode()}
                    className="w-full max-w-lg rounded-[30px] border border-white/15 bg-zinc-900/95 px-8 py-8 text-center shadow-2xl shadow-black/60 transition hover:border-amber-300/35 hover:bg-zinc-900 active:scale-[0.99]"
                    title={ui("Copy room code")}
                  >
                    <div className="text-4xl">🌐</div>

                    <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-amber-300">{ui("Waiting for players")}</p>

                    <h2 className="mt-2 text-2xl font-black text-white">
                      {filledSeats}{ui("/4 players connected")}</h2>

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
                    <RoomSlots total={4} names={orderedPlayers.map(({ player }) => player?.display_name)} labels={orderedPlayers.map(({ color }) => fourPlayerLabel(color))} overlay />
                </div>
              )}


            </div>
          </section>

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
  useUiLanguage();
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
  onSelect: (index: number | null) => void;
}) {
  useUiLanguage();
  return (
    <ChessMoveHistoryList
      sides={FOUR_PLAYER_HISTORY_SIDES}
      listClassName="max-h-80 rounded-xl border border-white/5 bg-black/20"
      selectedPly={selected}
      emptyLabel="No actions yet"
      leading={
        <button
          type="button"
          onClick={() => onSelect(0)}
          className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-xs ${selected === 0 ? "bg-blue-400/10" : "hover:bg-white/5"}`}
        >
          <span className="text-zinc-600">0</span>
          <span className="font-bold text-zinc-300">{ui("Initial position")}</span>
        </button>
      }
      entries={moves.map((notation, index) => {
        const color = history[index + 1]?.lastMove?.color ?? null;
        return {
          ply: index + 1,
          side: color,
          title: notation,
          content: color ? (
            <span className="truncate font-mono text-[10px] font-bold text-zinc-300">{notation}</span>
          ) : (
            <span className="truncate text-xs text-zinc-400">
              <span className="font-black text-zinc-500">{ui("Event")}</span> · {notation}
            </span>
          ),
        };
      })}
      onSelect={onSelect}
    />
  );
}

function FourPlayerBoard({
  state,
  viewerColor,
  myColor,
  players,
  selectedSquare,
  legalMoves,
  checkedKingSquare,
  onSquareClick,
}: {
  state: FourPlayerState;
  viewerColor: FourPlayerColor;
  myColor: FourPlayerColor | null;
  players: Array<{
    color: FourPlayerColor;
    player: { display_name: string } | null;
  }>;
  selectedSquare: FourPlayerSquare | null;
  legalMoves: FourPlayerSquare[];
  checkedKingSquare: FourPlayerSquare | null;
  onSquareClick: (row: number, column: number) => void;
}) {
  useUiLanguage();
  const { boardTheme } = useChessSettings();
  const colors = boardColors[boardTheme];

  // The game state always uses Red's board coordinates. Convert the displayed
  // square back to those coordinates so each player sees their army at bottom.
  function boardSquareForViewer(row: number, column: number): FourPlayerSquare {
    switch (viewerColor) {
      case "yellow":
        return { row: 13 - row, column: 13 - column };
      case "blue":
        return { row: column, column: 13 - row };
      case "green":
        return { row: 13 - column, column: row };
      case "red":
        return { row, column };
    }
  }

  const playerByColor = new Map(players.map(({ color, player }) => [color, player]));
  const cornerSlots = [
    { row: 0, column: 0 },
    { row: 0, column: 11 },
    { row: 11, column: 0 },
    { row: 11, column: 11 },
  ].map((slot) => {
    const original = boardSquareForViewer(slot.row, slot.column);
    const color: FourPlayerColor = original.row < 3
      ? (original.column < 3 ? "yellow" : "green")
      : (original.column < 3 ? "blue" : "red");
    return { ...slot, color };
  });

  return (
    <div className="w-full rounded-[28px] border p-2 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:p-3" style={{ borderColor: colors.frame, backgroundColor: colors.frame }}>
      <div className="rounded-[18px] border border-black/40 p-1 shadow-inner sm:p-1.5" style={{ backgroundColor: colors.frame }}>
        <div
          className="grid aspect-square w-full overflow-hidden rounded-xl bg-zinc-950 shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
          style={{
            gridTemplateColumns: "repeat(14, minmax(0, 1fr))",
            gridTemplateRows: "repeat(14, minmax(0, 1fr))",
          }}
        >
          {cornerSlots.map((slot) => {
            const player = playerByColor.get(slot.color);
            return (
              <div
                key={slot.color}
                style={{
                  gridColumn: `${slot.column + 1} / span 3`,
                  gridRow: `${slot.row + 1} / span 3`,
                }}
                className={`relative z-10 flex min-w-0 flex-col justify-between overflow-hidden border p-1.5 shadow-inner sm:p-2.5 ${playerStyles[slot.color].border} ${playerStyles[slot.color].soft} ${state.activePlayers.includes(slot.color) ? "" : "opacity-40"} ${!state.winner && state.turn === slot.color ? "ring-2 ring-inset ring-white/80" : ""}`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className={`text-[8px] font-black uppercase tracking-[0.14em] sm:text-[10px] ${playerStyles[slot.color].text}`}>
                    {fourPlayerLabel(slot.color)}
                  </span>
                  {!state.winner && state.turn === slot.color && <span className="rounded bg-white/20 px-1 text-[7px] font-black text-white sm:text-[9px]">{ui("Turn")}</span>}
                </div>
                <span className="truncate text-[9px] font-bold text-zinc-100 sm:text-xs">
                  {!state.activePlayers.includes(slot.color) ? ui("OUT") : (player?.display_name ?? ui("Waiting..."))}
                </span>
                {myColor === slot.color && (
                  <span className="absolute bottom-1 right-1 rounded bg-white/15 px-1 py-0.5 text-[7px] font-black text-white sm:bottom-2 sm:right-2 sm:text-[8px]">
                    {ui("YOU")}
                  </span>
                )}
              </div>
            );
          })}
          {Array.from({ length: 14 }, (_, row) =>
            Array.from({ length: 14 }, (_, column) => {
              const square = boardSquareForViewer(row, column);
              if (!isPlayableFourPlayerSquare(square.row, square.column))
                return null;
              const piece = state.board[square.row][square.column];
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
              const light = (square.row + square.column) % 2 === 0;

              return (
                <button
                  key={`${row}-${column}`}
                  type="button"
                  aria-label={fourPlayerSquareName(square)}
                  onClick={() => onSquareClick(square.row, square.column)}
                  className={`group relative flex aspect-square items-center justify-center overflow-hidden border-0 p-0 transition ${selected ? "z-10 ring-4 ring-inset ring-fuchsia-300" : ""}`}
                  style={{ backgroundColor: light ? colors.light : colors.dark }}
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
                  {piece && <FourPlayerThemedPiece piece={piece} />}
                </button>
              );
            }),
          )}
        </div>
      </div>
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

function ErrorBox({ children }: { children: ReactNode }) {
  useUiLanguage();
  return (
    <div className="mb-5 mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">
      {children}
    </div>
  );
}

function SimplePage({ text }: { text: string }) {
  useUiLanguage();
  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-zinc-950 px-4 py-8 text-zinc-100">
      <ChessPageHeader className="mb-4" />
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-900/70 p-6 text-center">
        {ui(text)}
      </div>
    </main>
  );
}
