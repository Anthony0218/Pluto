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
  DRAFT_BUDGET,
  DRAFT_PIECE_COSTS,
  applyDraftSetupAction,
  canConfirmDraftArmy,
  countDraftPieceType,
  countDraftPieces,
  draftPlacementsToBoard,
  getDraftKingSquares,
  getDraftRemainingPoints,
  getDraftSetupSquares,
  getDraftSpentPoints,
  randomizeDraftArmy,
  createIndependentRandomDraftSetup,
  validateDraftStartPosition,
  type DraftMoveRecord,
  type DraftPieceType,
  type DraftPlacement,
  type DraftSetupState,
  type DraftSide,
} from "@/games/chess/variants/draftChess";
import type {
  DraftPrivateSetup,
  TwoPlayerColor,
  VariantGame,
  VariantRoom,
  VariantRoomPlayer,
} from "@/games/chess/multiplayer/variantMultiplayerTypes";
import VariantRoomSetup from "./VariantRoomSetup";

type PromotionPiece = "q" | "r" | "b" | "n";
type SetupTool = DraftPieceType | "remove";
type ActionLoading =
  | "confirm"
  | "finalize"
  | "undo-request"
  | "undo-response"
  | "resign"
  | "rematch"
  | null;

type DraftPublicState = {
  phase?: "setup" | "ready" | "playing";
  round?: number;
  confirmed?: { w?: boolean; b?: boolean };
  setup?: DraftSetupState;
};

type HistoryRow = DraftMoveRecord;

const pieceNames: Record<DraftPieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
  k: "King",
};

const whiteSymbols: Record<DraftPieceType, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
  k: "♔",
};

const blackSymbols: Record<DraftPieceType, string> = {
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

function colorToSide(color: TwoPlayerColor): DraftSide {
  return color === "white" ? "w" : "b";
}

function sideToColor(side: DraftSide): TwoPlayerColor {
  return side === "w" ? "white" : "black";
}

function createEmptySetup(): DraftSetupState {
  return {
    placements: { w: [], b: [] },
    confirmed: { w: false, b: false },
  };
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
    undo_requested_by: raw.undo_requested_by ?? null,
    undo_requested_version: raw.undo_requested_version ?? null,
    undo_previous_fen: raw.undo_previous_fen ?? null,
    undo_previous_last_from: raw.undo_previous_last_from ?? null,
    undo_previous_last_to: raw.undo_previous_last_to ?? null,
    undo_last_requested_by: raw.undo_last_requested_by ?? null,
    undo_last_requested_version: raw.undo_last_requested_version ?? null,
  };
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
    return { finished: true, winner: "draw" as const, reason: "stalemate" };
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
    return { finished: true, winner: "draw" as const, reason: "draw" };
  }
  return { finished: false, winner: null, reason: null };
}

function buildHistory(initialFen: string, moves: string[]): HistoryRow[] {
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

function playLatestDraftMoveSound(initialFen: string, moves: string[]) {
  if (moves.length === 0) return;
  try {
    const replay = new Chess(initialFen);
    let latest: ReturnType<Chess["move"]> | null = null;
    for (const san of moves) latest = replay.move(san);
    if (!latest) return;
    if (latest.captured) playPieceCaptureSound(latest.piece);
    else playPieceMoveSound(latest.piece);
  } catch {
    // Sound feedback must never break multiplayer synchronization.
  }
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


function localSetupKey(roomId: string, userId: string, round: number) {
  return `draft-multiplayer:${roomId}:${userId}:round-${round}`;
}

function readLocalPlacements(key: string): DraftPlacement[] | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DraftPlacement[]) : null;
  } catch {
    return null;
  }
}

export function DraftMultiplayerLobby() {
  useUiLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
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

    const { data, error: rpcError } = await supabase.rpc(
      "create_draft_variant_room",
      {
        p_display_name: displayName,
        p_host_color: "black",
      },
    );

    setLoading(null);
    if (rpcError) return setError(rpcError.message);
    navigate(`/games/chess/variants/draft/multiplayer/${String(data)}`);
  }

  async function joinRoom() {
    if (!user) return setError("Sign in first.");
    const code = normalizeCode(joinCode);
    if (code.length !== 6) return setError("Enter the 6-character room code.");

    setLoading("join");
    setError(null);
    const { data, error: rpcError } = await supabase.rpc(
      "join_draft_variant_room",
      {
        p_code: code,
        p_display_name: displayName,
      },
    );
    setLoading(null);
    if (rpcError) return setError(rpcError.message);
    navigate(`/games/chess/variants/draft/multiplayer/${String(data ?? code)}`);
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <ChessPageHeader className="mb-7 rounded-3xl border border-emerald-400/15 bg-zinc-900/70 p-6 shadow-2xl shadow-black/30" description={<> {ui("39 points · separate hidden setups · reveal only when both armies are locked")} </>}>

        </ChessPageHeader>

        {!user ? (
          <Panel title={ui("Sign in required")}>
            <p className="text-sm text-zinc-400">{ui("Multiplayer rooms use your existing Supabase account.")}</p>
          </Panel>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel
              title={ui("Create room")}
              subtitle={ui("Colors are picked in the room")}
            >
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-emerald-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "create" ? ui("Creating...") : ui("Create Draft Room")}
              </button>
            </Panel>

            <Panel title={ui("Join room")} subtitle={ui("Pick your color in the room")}>
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeCode(event.target.value))
                }
                onKeyDown={(event) => event.key === "Enter" && void joinRoom()}
                placeholder={ui("ABC123")}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition focus:border-emerald-400/40"
              />
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-3 w-full rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-5 py-3 font-black text-emerald-200 transition hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "join" ? ui("Joining...") : ui("Join Draft Room")}
              </button>
            </Panel>
          </div>
        )}

        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </div>
    </main>
  );
}

export function DraftMultiplayerGame() {
  useUiLanguage();
  const { roomCode } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<VariantGame | null>(null);
  const [setupState, setSetupState] =
    useState<DraftSetupState>(createEmptySetup);
  const [setupTool, setSetupTool] = useState<SetupTool>("p");
  const [setupError, setSetupError] = useState<string | null>(null);

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
  const finalizeAttemptRef = useRef<number | null>(null);
  const lastSeenMoveCountRef = useRef(0);

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === user?.id) ?? null,
    [players, user?.id],
  );
  const opponent = useMemo(
    () => players.find((player) => player.user_id !== user?.id) ?? null,
    [players, user?.id],
  );
  const myColor =
    myPlayer?.chosen_color === "white" || myPlayer?.chosen_color === "black"
      ? myPlayer.chosen_color
      : null;
  const mySide = myColor ? colorToSide(myColor) : null;
  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  const publicState = (gameState?.state ?? {}) as DraftPublicState;
  const phase = publicState.phase ?? "setup";
  const round = publicState.round ?? 1;
  const publicConfirmed = {
    w: Boolean(publicState.confirmed?.w),
    b: Boolean(publicState.confirmed?.b),
  };

  const historyRows = useMemo(() => {
    if (!gameState?.initial_fen) return [];
    return buildHistory(gameState.initial_fen, gameState.moves);
  }, [gameState?.initial_fen, gameState?.moves]);

  const liveGame = useMemo(() => {
    if (!gameState?.fen) return new Chess();
    return new Chess(gameState.fen);
  }, [gameState?.fen]);

  const previewGame = useMemo(() => {
    if (historyPreviewPly === null || !gameState?.initial_fen) return null;
    if (historyPreviewPly === 0) return new Chess(gameState.initial_fen);
    const row = historyRows[historyPreviewPly - 1];
    return row ? new Chess(row.fenAfter) : null;
  }, [gameState?.initial_fen, historyPreviewPly, historyRows]);

  const displayedGame = previewGame ?? liveGame;
  const playingBoard = displayedGame.board();
  const setupBoard = useMemo(
    () =>
      mySide ? draftPlacementsToBoard(setupState, mySide) : new Chess().board(),
    [mySide, setupState],
  );

  const displayedLastMove = useMemo(() => {
    if (historyPreviewPly !== null) {
      if (historyPreviewPly === 0) return null;
      const row = historyRows[historyPreviewPly - 1];
      return row ? { from: row.from, to: row.to } : null;
    }
    if (gameState?.last_move_from && gameState.last_move_to) {
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

  const checkedKingSquare =
    phase === "playing" ? findCheckedKing(displayedGame) : null;
  const setupConfirmed = mySide ? publicConfirmed[mySide] : false;
  const opponentSide: DraftSide | null =
    mySide === "w" ? "b" : mySide === "b" ? "w" : null;
  const opponentConfirmed = opponentSide
    ? publicConfirmed[opponentSide]
    : false;
  const remainingPoints = mySide
    ? getDraftRemainingPoints(setupState, mySide)
    : DRAFT_BUDGET;
  const spentPoints = mySide ? getDraftSpentPoints(setupState, mySide) : 0;

  const checkedStartWasAutoReplaced = useMemo(() => {
    if (phase !== "playing" || !publicState.setup) return false;

    const originalValidation = validateDraftStartPosition(publicState.setup);

    return (
      !originalValidation.ok &&
      originalValidation.error ===
        "A King is already in check in the starting position."
    );
  }, [phase, publicState.setup]);

  const undoPending = Boolean(gameState?.undo_requested_by);
  const isMyTurn = Boolean(mySide) && liveGame.turn() === mySide;
  const canSubmitMove =
    phase === "playing" &&
    room?.status === "playing" &&
    gameState?.status === "playing" &&
    isMyTurn &&
    !moving &&
    actionLoading === null &&
    historyPreviewPly === null &&
    !undoPending;
  const canMove = canSubmitMove && !pendingPromotion;

  const lastMove = historyRows[historyRows.length - 1] ?? null;
  const lastMoverColor = lastMove ? sideToColor(lastMove.color) : null;
  const alreadyRequestedUndo =
    Boolean(user?.id) &&
    gameState?.undo_last_requested_by === user?.id &&
    gameState?.undo_last_requested_version === gameState?.version;
  const canRequestUndo =
    gameState?.status === "playing" &&
    myColor !== null &&
    lastMoverColor === myColor &&
    historyRows.length > 0 &&
    !undoPending &&
    !alreadyRequestedUndo &&
    actionLoading === null &&
    !moving;
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

  const applyGame = useCallback((raw: VariantGame) => {
    const next = normalizeGame(raw);
    const nextMoveCount = next.moves?.length ?? 0;
    if (next.initial_fen && nextMoveCount > lastSeenMoveCountRef.current) {
      playLatestDraftMoveSound(next.initial_fen, next.moves);
    }
    if (nextMoveCount < lastSeenMoveCountRef.current) {
      setHistoryPreviewPly(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
    }
    lastSeenMoveCountRef.current = nextMoveCount;
    setGameState(next);

    const state = (next.state ?? {}) as DraftPublicState;
    if (state.setup) setSetupState(state.setup);
    else {
      setSetupState((current) => ({
        ...current,
        confirmed: {
          w: Boolean(state.confirmed?.w),
          b: Boolean(state.confirmed?.b),
        },
      }));
    }
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
        .eq("variant", "draft")
        .single();

      if (roomError || !roomData) {
        if (!silent) setError("Draft room not found.");
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

      const loadedPlayers = playerData as VariantRoomPlayer[];
      const me = loadedPlayers.find((player) => player.user_id === user.id);
      if (!me) {
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
          white_rematch_ready, black_rematch_ready, next_seed,
          next_initial_fen, undo_requested_by, undo_requested_version,
          undo_previous_fen, undo_previous_last_from, undo_previous_last_to,
          undo_last_requested_by, undo_last_requested_version
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

      const loadedGame = normalizeGame(gameData as VariantGame);
      const state = (loadedGame.state ?? {}) as DraftPublicState;
      let nextSetup = state.setup ?? createEmptySetup();

      if (!state.setup) {
        const { data: privateData } = await supabase
          .from("variant_draft_private")
          .select("room_id, user_id, side, placements, confirmed, updated_at")
          .eq("room_id", loadedRoom.id)
          .eq("user_id", user.id)
          .maybeSingle();

        const side =
          me.chosen_color === "black" ? ("b" as DraftSide) : ("w" as DraftSide);
        const privateSetup = privateData as DraftPrivateSetup | null;
        let placements = (privateSetup?.placements ?? []) as DraftPlacement[];

        const setupRound = state.round ?? 1;
        const key = localSetupKey(loadedRoom.id, user.id, setupRound);
        const local =
          typeof window !== "undefined" ? readLocalPlacements(key) : null;
        if (!privateSetup?.confirmed && local && local.length > 0)
          placements = local;

        nextSetup = createEmptySetup();
        nextSetup.placements[side] = placements;
        nextSetup.confirmed = {
          w: Boolean(state.confirmed?.w),
          b: Boolean(state.confirmed?.b),
        };
      }

      setRoom(loadedRoom);
      setPlayers(loadedPlayers);
      setSetupState(nextSetup);
      applyGame(loadedGame);
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
      .channel(`draft-variant-game-${roomId}`)
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

    const playerChannel = supabase
      .channel(`draft-variant-players-${roomId}`)
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
      .subscribe();

    return () => {
      void supabase.removeChannel(gameChannel);
      void supabase.removeChannel(playerChannel);
    };
  }, [applyGame, loadRoom, room?.id]);

  useEffect(() => {
    if (!room) return;
    const id = window.setInterval(() => {
      if (!moving && actionLoading === null) void loadRoom(true);
    }, 1500);
    return () => window.clearInterval(id);
  }, [actionLoading, loadRoom, moving, room?.id]);

  useEffect(() => {
    if (!room || !user || !mySide || phase !== "setup" || setupConfirmed)
      return;
    const key = localSetupKey(room.id, user.id, round);
    window.localStorage.setItem(
      key,
      JSON.stringify(setupState.placements[mySide]),
    );
  }, [mySide, phase, room, round, setupConfirmed, setupState.placements, user]);

  useEffect(() => {
    if (!room || !gameState || phase !== "ready" || !publicState.setup) return;
    if (finalizeAttemptRef.current === gameState.version) return;
    finalizeAttemptRef.current = gameState.version;

    const validation = validateDraftStartPosition(publicState.setup);

    let fenToFinalize = validation.fen;

    if (!validation.ok || !validation.fen) {
      const startsInCheck =
        validation.error ===
        "A King is already in check in the starting position.";

      /*
       * Draft multiplayer uses the same emergency rule as local / AI:
       * ONLY an initial checked King triggers automatic replacement.
       *
       * Do not reopen the draft. Generate two independent legal random
       * armies and immediately finalize the match with that safe FEN.
       */
      if (startsInCheck) {
        const fallback = createIndependentRandomDraftSetup();
        fenToFinalize = fallback.fen;

        setError(null);
      } else {
        setError(
          validation.error ??
            "The two armies create an illegal starting position. Both armies were unlocked so you can adjust them.",
        );

        void supabase.rpc("reopen_draft_setup", {
          p_room_id: room.id,
          p_expected_version: gameState.version,
        });

        return;
      }
    }

    if (!fenToFinalize) return;

    setActionLoading("finalize");

    void (async () => {
      try {
        const { error: rpcError } = await supabase.rpc(
          "finalize_draft_variant_game",
          {
            p_room_id: room.id,
            p_expected_version: gameState.version,
            p_initial_fen: fenToFinalize,
          },
        );

        if (rpcError && !rpcError.message.includes("changed")) {
          setError(rpcError.message);
        }

        await loadRoom(true);
      } finally {
        setActionLoading(null);
      }
    })();
  }, [gameState, loadRoom, phase, publicState.setup, room]);

  function editSetup(square: Square) {
    if (!mySide || phase !== "setup" || setupConfirmed || actionLoading) return;

    const action =
      setupTool === "remove"
        ? ({ type: "REMOVE_PIECE", side: mySide, square } as const)
        : ({
            type: "PLACE_PIECE",
            side: mySide,
            square,
            piece: setupTool,
          } as const);

    const result = applyDraftSetupAction(setupState, action);
    if (result.error) return setSetupError(result.error);
    setSetupState(result.state);
    setSetupError(null);
  }

  function randomizeArmy() {
    if (!mySide || setupConfirmed) return;
    setSetupState((current) => randomizeDraftArmy(current, mySide));
    setSetupError(null);
  }

  function clearArmy() {
    if (!mySide || setupConfirmed) return;
    const result = applyDraftSetupAction(setupState, {
      type: "RESET_ARMY",
      side: mySide,
    });
    setSetupState(result.state);
    setSetupError(result.error);
  }

  async function confirmArmy() {
    if (!room || !mySide || setupConfirmed || actionLoading) return;
    const validation = canConfirmDraftArmy(setupState, mySide);
    if (!validation.ok) return setSetupError(validation.error);

    setActionLoading("confirm");
    setSetupError(null);
    const { error: rpcError } = await supabase.rpc("confirm_draft_army", {
      p_room_id: room.id,
      p_placements: setupState.placements[mySide],
    });
    if (rpcError) setSetupError(rpcError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  async function submitMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (!room || !gameState || !gameState.fen || !canSubmitMove) return;
    const local = new Chess(gameState.fen);
    let move;
    try {
      move = local.move({ from, to, promotion });
    } catch {
      return setError("Illegal move.");
    }
    if (!move) return;

    const outcome = getOutcome(local);
    const previous = gameState;
    const optimistic: VariantGame = {
      ...gameState,
      fen: local.fen(),
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

    setGameState(optimistic);
    lastSeenMoveCountRef.current = optimistic.moves.length;
    if (move.captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);
    clearSelection();
    setPendingPromotion(null);
    setMoving(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc("play_variant_chess_move", {
      p_room_id: room.id,
      p_expected_variant: "draft",
      p_from: move.from,
      p_to: move.to,
      p_move_san: move.san,
      p_new_fen: local.fen(),
      p_expected_version: previous.version,
      p_is_finished: outcome.finished,
      p_winner: outcome.winner,
      p_end_reason: outcome.reason,
    });

    setMoving(false);
    if (rpcError) {
      setGameState(previous);
      lastSeenMoveCountRef.current = previous.moves.length;
      setError(rpcError.message);
      await loadRoom(true);
    }
  }

  function handleGameSquare(row: number, column: number) {
    if (!canMove || !mySide) return;
    const square = getSquareName(row, column);
    const piece = liveGame.get(square);

    if (!selectedSquare) {
      if (!piece || piece.color !== mySide) return;
      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((move) => move.to));
      playPieceSelectSound(piece.type);
      return;
    }

    if (piece?.color === mySide) {
      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((move) => move.to));
      playPieceSelectSound(piece.type);
      return;
    }

    if (!legalMoves.includes(square)) return clearSelection();
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

  function undoSnapshot() {
    if (!gameState?.initial_fen || historyRows.length === 0) return null;
    const previous =
      historyRows.length >= 2 ? historyRows[historyRows.length - 2] : null;
    return {
      previousFen: previous?.fenAfter ?? gameState.initial_fen,
      previousLastFrom: previous?.from ?? null,
      previousLastTo: previous?.to ?? null,
    };
  }

  async function requestUndo() {
    if (!room || !gameState || !user || !canRequestUndo) return;
    const snapshot = undoSnapshot();
    if (!snapshot) return;
    setActionLoading("undo-request");
    const { error: rpcError } = await supabase.rpc("request_variant_undo", {
      p_room_id: room.id,
      p_previous_fen: snapshot.previousFen,
      p_previous_last_from: snapshot.previousLastFrom,
      p_previous_last_to: snapshot.previousLastTo,
    });
    if (rpcError) setError(rpcError.message);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function respondUndo(accept: boolean) {
    if (!room || !opponentUndoRequest || actionLoading) return;
    setActionLoading("undo-response");
    const { error: rpcError } = await supabase.rpc("respond_variant_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });
    if (rpcError) setError(rpcError.message);
    if (accept) setHistoryPreviewPly(null);
    await loadRoom(true);
    setActionLoading(null);
  }

  async function resign() {
    if (
      !room ||
      gameState?.status !== "playing" ||
      undoPending ||
      actionLoading
    )
      return;
    setActionLoading("resign");
    const { error: rpcError } = await supabase.rpc("resign_variant_game", {
      p_room_id: room.id,
      p_expected_variant: "draft",
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
    const { error: rpcError } = await supabase.rpc("request_draft_rematch", {
      p_room_id: room.id,
    });
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

  if (!user) return <SimplePage text={ui("Sign in to open this Draft room.")} />;
  if (loading && !gameState)
    return <SimplePage text={ui("Loading Draft multiplayer...")} />;
  if (!room || !gameState)
    return <SimplePage text={error ?? "Draft room unavailable."} />;

  const board = phase === "playing" ? playingBoard : setupBoard;
  const setupSquares = mySide ? getDraftSetupSquares(mySide) : [];
  const kingSquares =
    mySide && setupTool === "k" ? getDraftKingSquares(mySide) : [];
  const ownPieces = mySide ? countDraftPieces(setupState, mySide) : 0;

  if (room.status === "waiting") {
    return (
      <VariantRoomSetup
        roomId={room.id}
        variantName={"Draft Chess"}
        lobbyPath={"/games/chess/variants/draft/multiplayer"}
        onStarted={() => void loadRoom(true)}
      />
    );
  }

  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <ChessPageHeader className="mb-6 flex flex-col gap-4 rounded-3xl border border-emerald-400/15 bg-zinc-900/60 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between" description={<> {phase === "playing" ? `${liveGame.turn() === "w" ? "White" : "Black"} to move` : `Private setup · round ${round}`} </>}>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyCode()}
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs font-black text-zinc-300"
            >
              {copied ? ui("Copied") : `Room ${room.code}`}
            </button>
            <Link
              to="/games/chess/variants/draft/multiplayer"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-zinc-400 hover:bg-white/10"
            >{ui("Leave")}</Link>
          </div>
        </ChessPageHeader>

        {error && <ErrorBox>{ui(error)}</ErrorBox>}
        {setupError && <ErrorBox>{setupError}</ErrorBox>}

        {players.length < 2 && (
          <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">{ui("Waiting for the second player. Share room code")}<b>{room.code}</b>.
          </div>
        )}

        <main className="grid gap-6 chess-game-grid xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {phase !== "playing" ? (
                <Panel
                  title={ui("Army Builder")}
                  subtitle={
                    mySide === "w"
                      ? "Ranks 1–2 · King on rank 1"
                      : "Ranks 7–8 · King on rank 8"
                  }
                >
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <MiniStat label={ui("Points left")} value={remainingPoints} />
                    <MiniStat label={ui("Points spent")} value={spentPoints} />
                  </div>
                  <PiecePalette
                    side={mySide ?? "w"}
                    selected={setupTool}
                    remaining={remainingPoints}
                    disabled={setupConfirmed}
                    onSelect={setSetupTool}
                  />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={setupConfirmed}
                      onClick={clearArmy}
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-2.5 text-[11px] font-bold text-zinc-300 disabled:opacity-30"
                    >{ui("↺ Clear")}</button>
                    <button
                      type="button"
                      disabled={setupConfirmed}
                      onClick={randomizeArmy}
                      className="rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-2 py-2.5 text-[11px] font-black text-violet-200 disabled:opacity-30"
                    >{ui("🎲 Random")}</button>
                    <button
                      type="button"
                      disabled={
                        !mySide ||
                        setupConfirmed ||
                        !canConfirmDraftArmy(setupState, mySide ?? "w").ok ||
                        actionLoading !== null ||
                        players.length < 2
                      }
                      onClick={() => void confirmArmy()}
                      className="rounded-xl bg-emerald-300 px-2 py-2.5 text-[11px] font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-30"
                    >{ui("✓ Confirm")}</button>
                  </div>
                  {setupConfirmed && (
                    <p className="mt-4 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-3 text-xs font-bold text-emerald-200">{ui("Your army is locked.")}{" "}
                      {opponentConfirmed ? ui("Revealing both armies...") : ui("Waiting for the opponent.")}
                    </p>
                  )}
                </Panel>
              ) : (
                <>
                  {checkedStartWasAutoReplaced && (
                    <Panel
                      title={ui("⚠ Start position corrected")}
                      subtitle={ui("Automatic Draft safety rule")}
                    >
                      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.07] p-3">
                        <p className="text-xs font-black text-amber-100">{ui("A King was already in check in the revealed starting position.")}</p>
                        <p className="mt-2 text-xs leading-5 text-amber-200/80">{ui("Both drafted armies were therefore replaced automatically with two independent random legal armies before move 1.")}</p>
                      </div>
                    </Panel>
                  )}

                  <Panel
                    title={ui("Game Controls")}
                    subtitle={ui("Negotiated online actions")}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!canRequestUndo}
                        onClick={() => void requestUndo()}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
                      >{ui("↶ Undo")}</button>
                      <button
                        type="button"
                        disabled={gameState.status !== "playing" || undoPending}
                        onClick={() => void resign()}
                        className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-bold text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
                      >{ui("Resign")}</button>
                    </div>
                    {myUndoRequest && (
                      <p className="mt-3 text-xs text-amber-200">{ui("Undo request sent. Waiting for opponent.")}</p>
                    )}
                    {opponentUndoRequest && (
                      <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                        <p className="text-xs font-black text-amber-100">{ui("Opponent requests an undo.")}</p>
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
                      </div>
                    )}
                  </Panel>

                  <Panel
                    title={ui("Move History")}
                    subtitle={ui("Click a move to preview it on the board")}
                  >
                    <HistoryList
                      rows={historyRows}
                      selected={historyPreviewPly}
                      onSelect={setHistoryPreviewPly}
                    />
                  </Panel>
                </>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {historyPreviewPly !== null && phase === "playing" && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">{ui("History Preview")}</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {historyPreviewPly === 0 ? ui("Initial Draft position") : historyRows[historyPreviewPly - 1]?.san}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200"
                  >{ui("Back to Live Board")}</button>
                </div>
              )}

              {gameState.status === "finished" && (
                <VisibleGameResult
                  winner={gameState.winner}
                  playerColor={myColor}
                  reason={gameState.end_reason}
                  actions={
                    <button
                      disabled={myRematchReady}
                      onClick={() => void rematch()}
                      className="rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-40"
                    >
                      {myRematchReady ? ui("Rematch requested") : ui("Rematch")}
                    </button>
                  }
                />
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
                  lastMove={phase === "playing" ? displayedLastMove : null}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={
                    phase === "playing"
                      ? handleGameSquare
                      : (row, column) => editSetup(getSquareName(row, column))
                  }
                  draftSetupSquares={phase !== "playing" ? setupSquares : []}
                  draftKingSquares={phase !== "playing" ? kingSquares : []}
                  orientation={orientation}
                />
                {players.length < 2 && (
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
                  <PromotionBar onPromote={promotePawn} />
                )}

                {phase !== "playing" && setupConfirmed && (
                  <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl bg-zinc-950/45 p-6 backdrop-blur-[2px]">
                    <div className="max-w-sm rounded-3xl border border-emerald-400/20 bg-zinc-900/95 p-6 text-center shadow-2xl">
                      <div className="text-4xl">🛡</div>
                      <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-emerald-300">{ui("Army locked")}</p>
                      <p className="mt-2 text-sm text-zinc-400">
                        {opponentConfirmed ? ui("Both armies are ready. Starting game...") : ui("Your opponent still sees only their own setup.")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title={ui("Room")} subtitle={ui("Private Draft match")}>
                <InfoRow
                  label={ui("You")}
                  value={`${myPlayer?.display_name ?? "—"} · ${myColor ?? "—"}`}
                />
                <InfoRow
                  label={ui("Opponent")}
                  value={`${opponent?.display_name ?? "Waiting..."} · ${opponent?.chosen_color ?? "—"}`}
                />
                <InfoRow label={ui("Round")} value={String(round)} />
              </Panel>

              <Panel title={ui("Draft Status")} subtitle={ui("39-point budget")}>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat label={ui("Pieces")} value={ownPieces} />
                  <MiniStat
                    label={ui("King")}
                    value={
                      mySide ? countDraftPieceType(setupState, mySide, "k") : 0
                    }
                  />
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <StatusLine label={ui("Your army")} ready={setupConfirmed} />
                  <StatusLine label={ui("Opponent army")} ready={opponentConfirmed} />
                </div>
              </Panel>

              <Panel title={ui("Rules")} subtitle={ui("Draft Chess")}>
                <Rule text={ui("Each player privately builds an army with at most 39 points.")} />
                <Rule text={ui("The king must stay on the back rank. Your setup is hidden until both players confirm.")} />
                <Rule text={ui("After reveal, normal chess rules apply from the custom starting position.")} />
              </Panel>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function PiecePalette({
  side,
  selected,
  remaining,
  disabled,
  onSelect,
}: {
  side: DraftSide;
  selected: SetupTool;
  remaining: number;
  disabled: boolean;
  onSelect: (tool: SetupTool) => void;
}) {
  useUiLanguage();
  const pieces: DraftPieceType[] = ["p", "n", "b", "r", "q", "k"];
  return (
    <div className="grid grid-cols-2 gap-2">
      {pieces.map((piece) => {
        const cost = DRAFT_PIECE_COSTS[piece];
        const blocked = disabled || (piece !== "k" && cost > remaining);
        return (
          <button
            key={piece}
            type="button"
            disabled={blocked}
            onClick={() => onSelect(piece)}
            className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-30 ${
              selected === piece
                ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="text-2xl">
                {side === "w" ? whiteSymbols[piece] : blackSymbols[piece]}
              </span>
              <span className="text-[10px] font-black">
                {pieceNames[piece]}
              </span>
            </span>
            <span className="rounded-lg bg-black/20 px-1.5 py-1 text-[9px] font-black">
              {cost}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("remove")}
        className={`col-span-2 rounded-xl border px-3 py-2.5 text-xs font-black transition disabled:opacity-30 ${
          selected === "remove"
            ? "border-red-300/35 bg-red-400/10 text-red-200"
            : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10"
        }`}
      >{ui("✕ Remove")}</button>
    </div>
  );
}

function HistoryList({
  rows,
  selected,
  onSelect,
}: {
  rows: HistoryRow[];
  selected: number | null;
  onSelect: (ply: number | null) => void;
}) {
  useUiLanguage();
  return (
    <ChessMoveHistoryList
      listClassName="max-h-80 rounded-2xl border border-white/5 bg-black/20"
      selectedPly={selected}
      emptyLabel="No moves yet"
      leading={
        <button
          type="button"
          onClick={() => onSelect(0)}
          className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs ${selected === 0 ? "bg-blue-400/10" : "hover:bg-white/5"}`}
        >
          <span className="text-zinc-600">0</span>
          <span className="font-bold text-zinc-300">{ui("Initial Draft position")}</span>
        </button>
      }
      entries={rows.map((row) => ({
        ply: row.ply,
        side: row.color,
        moveNumber: row.moveNumber,
        content: (
          <>
            <span className="text-base leading-none">
              {row.color === "w" ? whiteSymbols[row.piece as DraftPieceType] : blackSymbols[row.piece as DraftPieceType]}
            </span>
            <span className="truncate font-mono text-xs font-bold text-zinc-200">{row.san}</span>
          </>
        ),
      }))}
      onSelect={onSelect}
    />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  useUiLanguage();
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/5 py-2 text-xs last:border-0">
      <span className="text-zinc-500">{ui(label)}</span>
      <span className="max-w-[180px] truncate font-black text-zinc-200">
        {value}
      </span>
    </div>
  );
}

function StatusLine({ label, ready }: { label: string; ready: boolean }) {
  useUiLanguage();
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
      <span className="text-zinc-500">{ui(label)}</span>
      <span
        className={
          ready ? "font-black text-emerald-300" : "font-bold text-zinc-600"
        }
      >
        {ready ? ui("Ready") : ui("Building")}
      </span>
    </div>
  );
}

function Rule({ text }: { text: string }) {
  useUiLanguage();
  return (
    <div className="mb-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-xs leading-5 text-zinc-400 last:mb-0">
      {ui(text)}
    </div>
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
