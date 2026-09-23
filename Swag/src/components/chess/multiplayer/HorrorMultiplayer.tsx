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
  HOT_SQUARE_INTERVAL_PLIES,
  createHorrorSeed,
  createInitialHorrorState,
  getActiveHotSquares,
  hasAnyHorrorLegalMove,
  horrorMoveTouchesFire,
  isHorrorMoveAllowed,
  isThreefoldFromHorrorRecords,
  legalHorrorMovesForSquare,
  removeHorrorPieceNow,
  resolveHorrorAfterMove,
  type HorrorMoveRecord,
  type HorrorPieceType,
  type HorrorState,
} from "../../../games/chess/variants/horrorChess";

type PlayerColor = "white" | "black";
type ChessSide = "w" | "b";
type PromotionPiece = "q" | "r" | "b" | "n";

type VariantRoom = {
  id: string;
  code: string;
  host_id: string;
  variant: "horror";
  status: "waiting" | "playing" | "finished";
};

type VariantRoomPlayer = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: PlayerColor;
};

type HorrorStoredState = {
  seed: number;
  horror: HorrorState;
  records: HorrorMoveRecord[];
};

type VariantGame = {
  room_id: string;
  variant: "horror";
  seed: number;
  initial_fen: string;
  fen: string;
  moves: string[];
  state: HorrorStoredState;
  status: "waiting" | "playing" | "finished";
  winner: PlayerColor | "draw" | null;
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

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function playerColorToSide(color: PlayerColor): ChessSide {
  return color === "white" ? "w" : "b";
}

function initialStoredState(seed: number): HorrorStoredState {
  const game = new Chess(START_FEN);
  return {
    seed,
    horror: createInitialHorrorState(game, seed),
    records: [],
  };
}

function normalizeStoredState(value: unknown, seed: number): HorrorStoredState {
  const fallback = initialStoredState(seed);
  if (!value || typeof value !== "object") return fallback;

  const raw = value as Partial<HorrorStoredState>;

  return {
    seed: typeof raw.seed === "number" ? raw.seed : seed,
    horror:
      raw.horror && typeof raw.horror === "object"
        ? (raw.horror as HorrorState)
        : fallback.horror,
    records: Array.isArray(raw.records)
      ? (raw.records as HorrorMoveRecord[])
      : [],
  };
}

function previousSnapshot(state: HorrorStoredState): {
  fen: string;
  state: HorrorStoredState;
  lastFrom: string | null;
  lastTo: string | null;
} | null {
  if (state.records.length === 0) return null;

  const nextRecords = state.records.slice(0, -1);

  if (nextRecords.length === 0) {
    return {
      fen: START_FEN,
      state: initialStoredState(state.seed),
      lastFrom: null,
      lastTo: null,
    };
  }

  const previous = nextRecords[nextRecords.length - 1];

  return {
    fen: previous.fenAfter,
    state: {
      seed: state.seed,
      horror: previous.stateAfter,
      records: nextRecords,
    },
    lastFrom: previous.from,
    lastTo: previous.to,
  };
}

function getCheckedKingSquare(game: Chess): Square | null {
  if (!game.isCheck()) return null;

  const kingColor = game.turn();
  const board = game.board();

  for (let row = 0; row < board.length; row += 1) {
    for (let column = 0; column < board[row].length; column += 1) {
      const piece = board[row][column];
      if (piece?.type === "k" && piece.color === kingColor) {
        return getSquareName(row, column);
      }
    }
  }

  return null;
}

function knightDirectlyAttacksEnemyKing(
  game: Chess,
  knightSquare: Square,
  moverColor: ChessSide,
): boolean {
  const files = "abcdefgh";
  const knightFile = files.indexOf(knightSquare[0]);
  const knightRank = Number(knightSquare[1]);
  const enemyColor: ChessSide = moverColor === "w" ? "b" : "w";

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const square = getSquareName(row, column);
      const piece = game.get(square);

      if (piece?.type !== "k" || piece.color !== enemyColor) continue;

      const kingFile = files.indexOf(square[0]);
      const kingRank = Number(square[1]);
      const df = Math.abs(knightFile - kingFile);
      const dr = Math.abs(knightRank - kingRank);

      return (df === 1 && dr === 2) || (df === 2 && dr === 1);
    }
  }

  return false;
}

function nonKingPieceType(
  piece: "p" | "n" | "b" | "r" | "q" | "k",
): HorrorPieceType | null {
  return piece === "k" ? null : piece;
}

function determineOutcome(
  game: Chess,
  records: HorrorMoveRecord[],
  state: HorrorState,
): {
  winner: PlayerColor | "draw" | null;
  reason: string | null;
} {
  const hasVariantMove = hasAnyHorrorLegalMove({
    game,
    state,
    nextPly: records.length + 1,
  });

  if (game.isCheckmate() || (!hasVariantMove && game.isCheck())) {
    return {
      winner: game.turn() === "w" ? "black" : "white",
      reason: "checkmate",
    };
  }

  if (game.isStalemate() || !hasVariantMove) {
    return { winner: "draw", reason: "stalemate" };
  }

  if (game.isInsufficientMaterial()) {
    return { winner: "draw", reason: "insufficient" };
  }

  if (game.isDrawByFiftyMoves()) {
    return { winner: "draw", reason: "fifty" };
  }

  if (isThreefoldFromHorrorRecords(records, game.fen())) {
    return { winner: "draw", reason: "repetition" };
  }

  return { winner: null, reason: null };
}

function eventIcons(record: HorrorMoveRecord): string {
  const icons: string[] = [];

  if (record.event.infectionsAdded.length > 0) icons.push("☣");
  if (record.event.becameCursed || record.event.curseTriggered) icons.push("☠");
  if (record.event.fireTriggered || record.event.hotSpawned.length > 0)
    icons.push("🔥");
  if (record.event.frozenSquare) icons.push("❄");
  if (record.event.deaths.length > 0) icons.push("†");

  return icons.join(" ");
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/5 bg-zinc-900/80 p-4 shadow-xl shadow-black/20">
      <h2 className="font-black text-zinc-100">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function HazardStat({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-lg">{icon}</span>
        <span className="font-black text-rose-200">{value}</span>
      </div>
      <p className="mt-1 text-[10px] text-zinc-600">{label}</p>
    </div>
  );
}

/* =========================================================
   LOBBY
   ========================================================= */

export function HorrorMultiplayerLobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [displayName, setDisplayName] = useState(
    (profile as { username?: string | null } | null)?.username ?? "Player",
  );
  const [hostColor, setHostColor] = useState<PlayerColor>("white");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    if (!user || busy) return;

    setBusy("create");
    setError(null);

    const seed = createHorrorSeed();
    const state = initialStoredState(seed);

    const { data, error: rpcError } = await supabase.rpc(
      "create_horror_variant_room",
      {
        p_seed: seed,
        p_initial_state: state,
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
      `/games/chess/variants/horror/multiplayer/${String(data).toUpperCase()}`,
    );
  }

  async function joinRoom() {
    if (!user || busy || !joinCode.trim()) return;

    setBusy("join");
    setError(null);

    const code = joinCode.trim().toUpperCase();

    const { error: rpcError } = await supabase.rpc("join_horror_variant_room", {
      p_code: code,
      p_display_name: displayName.trim() || "Player",
    });

    setBusy(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    navigate(`/games/chess/variants/horror/multiplayer/${code}`);
  }

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-zinc-100">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-[32px] border border-rose-400/15 bg-zinc-900/85 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-3xl">
              ☠
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-rose-400">
                Multiplayer Variant
              </p>
              <h1 className="mt-1 text-3xl font-black">Horror Chess</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Infection, curses, fire and freezing are synchronized.
              </p>
            </div>
          </div>

          <label className="mt-8 block text-xs font-black uppercase tracking-wider text-zinc-500">
            Display name
          </label>

          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 outline-none focus:border-rose-400/40"
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
                    className={`rounded-xl border px-3 py-3 text-sm font-black ${
                      hostColor === color
                        ? "border-rose-300/30 bg-rose-400/15 text-rose-100"
                        : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {color === "white" ? "♔ White" : "♚ Black"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={createRoom}
                disabled={busy !== null}
                className="mt-4 w-full rounded-xl bg-rose-400 px-4 py-3 font-black text-rose-950 disabled:opacity-50"
              >
                {busy === "create" ? "Creating..." : "Create Horror room"}
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
                className="mt-4 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-rose-400/40"
              />

              <button
                type="button"
                onClick={joinRoom}
                disabled={busy !== null || !joinCode.trim()}
                className="mt-4 w-full rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 font-black text-rose-200 disabled:opacity-50"
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

/* =========================================================
   GAME
   ========================================================= */

export function HorrorMultiplayerGame() {
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
  const mySide = myColor ? playerColorToSide(myColor) : null;
  const orientation: "white" | "black" =
    myColor === "black" ? "black" : "white";

  const storedState = useMemo(
    () =>
      gameState
        ? normalizeStoredState(gameState.state, Number(gameState.seed))
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
    historyPreviewPly !== null && storedState
      ? (storedState.records[historyPreviewPly - 1] ?? null)
      : null;

  const displayedGame = useMemo(
    () =>
      previewRecord
        ? new Chess(previewRecord.fenAfter, { skipValidation: true })
        : liveGame,
    [previewRecord, liveGame],
  );

  const displayedState =
    previewRecord?.stateAfter ?? storedState?.horror ?? null;

  const displayedRecord =
    previewRecord ??
    storedState?.records[storedState.records.length - 1] ??
    null;

  const displayedLastMove = previewRecord
    ? { from: previewRecord.from, to: previewRecord.to }
    : gameState?.last_move_from && gameState.last_move_to
      ? {
          from: gameState.last_move_from as Square,
          to: gameState.last_move_to as Square,
        }
      : null;

  const displayedHotSquares =
    displayedState && previewRecord
      ? displayedState.hotSquares.map((item) => item.square)
      : displayedState && storedState
        ? getActiveHotSquares(displayedState, storedState.records.length + 1)
        : [];

  const frozenSquares = displayedState?.frozen
    ? [displayedState.frozen.square]
    : [];

  const doomedSquares = displayedState?.doomed.map((item) => item.square) ?? [];

  const graveSquares = displayedRecord
    ? [...new Set(displayedRecord.event.deaths.map((death) => death.square))]
    : [];

  const checkedKingSquare = getCheckedKingSquare(displayedGame);

  const loadAll = useCallback(async () => {
    if (!user || !roomCode) return;

    const { data: roomData, error: roomError } = await supabase
      .from("variant_rooms")
      .select("id, code, host_id, variant, status")
      .eq("code", roomCode.toUpperCase())
      .eq("variant", "horror")
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
        playerError?.message ??
          gameError?.message ??
          "Game could not be loaded.",
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
      .channel(`horror:${room.id}`)
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

  async function commitMove(
    from: Square,
    to: Square,
    promotionPiece?: PromotionPiece,
  ) {
    if (
      !room ||
      !gameState ||
      !storedState ||
      !mySide ||
      moving ||
      historyPreviewPly !== null ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== mySide
    ) {
      return;
    }

    const nextPly = storedState.records.length + 1;

    if (
      !isHorrorMoveAllowed({
        game: liveGame,
        state: storedState.horror,
        from,
        to,
        nextPly,
      })
    ) {
      setError("That move is forbidden by the current Horror effect.");
      clearSelection();
      return;
    }

    const nextGame = new Chess(liveGame.fen(), { skipValidation: true });
    const destinationPiece = nextGame.get(to);

    const moveTouchesFire = horrorMoveTouchesFire({
      state: storedState.horror,
      from,
      to,
      ply: nextPly,
    });

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

    const captured: HorrorPieceType | undefined =
      move.captured === "p" ||
      move.captured === "n" ||
      move.captured === "b" ||
      move.captured === "r" ||
      move.captured === "q"
        ? move.captured
        : undefined;

    const promotedTo: PromotionPiece | undefined =
      move.promotion === "q" ||
      move.promotion === "r" ||
      move.promotion === "b" ||
      move.promotion === "n"
        ? move.promotion
        : undefined;

    let capturedSquare: Square | null = null;

    if (captured) {
      capturedSquare = destinationPiece
        ? move.to
        : (`${move.to[0]}${move.from[1]}` as Square);
    }

    const knightDirectCheck =
      move.piece === "n" &&
      knightDirectlyAttacksEnemyKing(nextGame, move.to, move.color);

    const result = resolveHorrorAfterMove({
      previousState: storedState.horror,
      gameAfterMove: nextGame,
      seed: storedState.seed,
      ply: nextPly,
      move: {
        color: move.color,
        piece: move.piece,
        from: move.from,
        to: move.to,
        captured,
        capturedSquare,
        promotion: promotedTo,
        isCastle: move.isKingsideCastle() || move.isQueensideCastle(),
        isKingsideCastle: move.isKingsideCastle(),
        knightDirectCheck,
      },
    });

    // Keep the same fire safety net as the current Horror hotseat page.
    if (moveTouchesFire && move.piece !== "k") {
      const survivor = nextGame.get(move.to);

      if (survivor && survivor.color === move.color) {
        const pawnDoubleStep =
          move.piece === "p" &&
          Math.abs(Number(move.to[1]) - Number(move.from[1])) === 2;

        removeHorrorPieceNow(nextGame, move.to, {
          clearEnPassant: pawnDoubleStep,
        });

        result.state.infectedSquares = result.state.infectedSquares.filter(
          (square) => square !== move.to,
        );

        result.state.cursedSquares = result.state.cursedSquares.filter(
          (square) => square !== move.to,
        );

        result.state.doomed = result.state.doomed.filter(
          (item) => item.square !== move.to,
        );

        const alreadyRecorded = result.event.deaths.some(
          (death) =>
            death.square === move.to &&
            (death.reason === "fire" || death.reason === "curse+fire"),
        );

        if (!alreadyRecorded) {
          const vanishedPiece = nonKingPieceType(move.piece);

          result.state.fireTriggers += 1;
          result.state.deaths += 1;
          result.event.fireTriggered = true;

          if (vanishedPiece) {
            result.event.deaths.push({
              square: move.to,
              reason: "fire",
              piece: vanishedPiece,
            });
          }
        }
      }
    }

    const resolvedSan = nextGame.isCheck()
      ? move.san
      : move.san.replace(/[+#]+$/, "");

    const record: HorrorMoveRecord = {
      ply: nextPly,
      moveNumber: Math.ceil(nextPly / 2),
      color: move.color,
      san: resolvedSan,
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured,
      promotion: promotedTo,
      fenAfter: nextGame.fen(),
      stateAfter: result.state,
      event: result.event,
    };

    const nextRecords = [...storedState.records, record];

    const nextStoredState: HorrorStoredState = {
      seed: storedState.seed,
      horror: result.state,
      records: nextRecords,
    };

    const outcome = determineOutcome(nextGame, nextRecords, result.state);

    setMoving(true);
    setError(null);
    clearSelection();
    setPromotion(null);

    // Optimistic post-Horror position.
    setGameState((current) =>
      current
        ? {
            ...current,
            fen: nextGame.fen(),
            moves: [...(current.moves ?? []), resolvedSan],
            state: nextStoredState,
            status: outcome.winner ? "finished" : "playing",
            winner: outcome.winner,
            end_reason: outcome.reason,
            last_move_from: move.from,
            last_move_to: move.to,
            version: current.version + 1,
          }
        : current,
    );

    if (captured) {
      playPieceCaptureSound(move.piece);
    } else {
      playPieceMoveSound(move.piece);
    }

    const { error: rpcError } = await supabase.rpc("play_horror_move", {
      p_room_id: room.id,
      p_expected_version: gameState.version,
      p_new_fen: nextGame.fen(),
      p_san: resolvedSan,
      p_new_state: nextStoredState,
      p_from: move.from,
      p_to: move.to,
      p_winner: outcome.winner,
      p_end_reason: outcome.reason,
    });

    setMoving(false);

    if (rpcError) {
      setError(rpcError.message);
      await loadAll();
    }
  }

  function handleSquareClick(row: number, column: number) {
    if (
      !gameState ||
      !storedState ||
      !mySide ||
      moving ||
      historyPreviewPly !== null ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      liveGame.turn() !== mySide
    ) {
      return;
    }

    const square = getSquareName(row, column);

    if (!selectedSquare) {
      const piece = liveGame.get(square);
      if (!piece || piece.color !== mySide) return;

      setSelectedSquare(square);
      playPieceSelectSound(piece.type);

      setLegalMoves(
        legalHorrorMovesForSquare({
          game: liveGame,
          state: storedState.horror,
          square,
          nextPly: storedState.records.length + 1,
        }),
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

      if (clicked?.color === mySide) {
        setSelectedSquare(square);
        playPieceSelectSound(clicked.type);

        setLegalMoves(
          legalHorrorMovesForSquare({
            game: liveGame,
            state: storedState.horror,
            square,
            nextPly: storedState.records.length + 1,
          }),
        );
      } else {
        clearSelection();
      }

      return;
    }

    void commitMove(selectedSquare, square);
  }

  async function requestUndo() {
    if (
      !room ||
      !gameState ||
      !storedState ||
      storedState.records.length === 0 ||
      gameState.status !== "playing" ||
      gameState.undo_requested_by ||
      actionBusy
    ) {
      return;
    }

    const previous = previousSnapshot(storedState);
    if (!previous) return;

    setActionBusy("undo");
    setError(null);

    const { error: rpcError } = await supabase.rpc("request_horror_undo", {
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

    const { error: rpcError } = await supabase.rpc("respond_horror_undo", {
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

    const { error: rpcError } = await supabase.rpc("resign_horror_game", {
      p_room_id: room.id,
    });

    setActionBusy(null);

    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  async function requestRematch() {
    if (!room || gameState?.status !== "finished" || actionBusy) return;

    const seed = createHorrorSeed();
    const nextState = initialStoredState(seed);

    setActionBusy("rematch");
    setError(null);

    const { error: rpcError } = await supabase.rpc("request_horror_rematch", {
      p_room_id: room.id,
      p_next_seed: seed,
      p_next_state: nextState,
    });

    setActionBusy(null);

    if (rpcError) setError(rpcError.message);
    await loadAll();
  }

  if (!room || !gameState || !storedState || !displayedState || !me) {
    return (
      <main className="min-h-screen bg-transparent p-8 text-zinc-100">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-zinc-900 p-6">
          <p className="font-black">Loading Horror room…</p>
          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
      </main>
    );
  }

  const myRematchReady =
    myColor === "white"
      ? Boolean(gameState.white_rematch_ready)
      : Boolean(gameState.black_rematch_ready);

  const opponentRematchReady =
    myColor === "white"
      ? Boolean(gameState.black_rematch_ready)
      : Boolean(gameState.white_rematch_ready);

  const canMove =
    gameState.status === "playing" &&
    liveGame.turn() === mySide &&
    !gameState.undo_requested_by &&
    !moving;

  const fireRemainder = storedState.records.length % HOT_SQUARE_INTERVAL_PLIES;

  const pliesUntilFire =
    fireRemainder === 0
      ? HOT_SQUARE_INTERVAL_PLIES
      : HOT_SQUARE_INTERVAL_PLIES - fireRemainder;

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1460px]">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl border border-rose-400/10 bg-zinc-900/75 px-5 py-4 shadow-xl shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-3xl">
              ☠
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-rose-400">
                Multiplayer Variant
              </p>
              <h1 className="text-2xl font-black">Horror Chess</h1>
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
                    storedState.records.length === 0 ||
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
                  to="/games/chess/variants/horror/multiplayer"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-sm font-black text-zinc-300"
                >
                  Leave room
                </Link>
              </div>
            </Panel>

            <Panel title="Move History">
              <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
                {storedState.records.length === 0 ? (
                  <p className="px-4 py-7 text-center text-xs text-zinc-600">
                    No moves yet
                  </p>
                ) : (
                  storedState.records.map((record) => (
                    <button
                      key={record.ply}
                      type="button"
                      onClick={() => {
                        setHistoryPreviewPly(record.ply);
                        clearSelection();
                        setPromotion(null);
                      }}
                      className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs last:border-0 ${
                        historyPreviewPly === record.ply
                          ? "bg-rose-400/10 text-rose-200"
                          : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      <span>
                        {record.moveNumber}
                        {record.color === "w" ? "." : "..."} {record.san}
                      </span>
                      <span>{eventIcons(record)}</span>
                    </button>
                  ))
                )}
              </div>
            </Panel>
          </aside>

          <section className="mx-auto w-full max-w-[820px] min-w-0">
            {historyPreviewPly !== null && (
              <div className="mb-3 flex items-center justify-between rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-rose-300">
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

            {displayedRecord &&
              (displayedRecord.event.infectionsAdded.length > 0 ||
                displayedRecord.event.becameCursed ||
                displayedRecord.event.curseTriggered ||
                displayedRecord.event.fireTriggered ||
                displayedRecord.event.hotSpawned.length > 0 ||
                displayedRecord.event.frozenSquare ||
                displayedRecord.event.deaths.length > 0) && (
                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                  {displayedRecord.event.infectionsAdded.length > 0 && (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">
                      ☣ Infection spread
                    </span>
                  )}

                  {(displayedRecord.event.becameCursed ||
                    displayedRecord.event.curseTriggered) && (
                    <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-violet-200">
                      ☠ Curse triggered
                    </span>
                  )}

                  {(displayedRecord.event.fireTriggered ||
                    displayedRecord.event.hotSpawned.length > 0) && (
                    <span className="rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1.5 text-orange-200">
                      🔥 Fire
                    </span>
                  )}

                  {displayedRecord.event.frozenSquare && (
                    <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-sky-200">
                      ❄ Frozen {displayedRecord.event.frozenSquare}
                    </span>
                  )}

                  {displayedRecord.event.deaths.length > 0 && (
                    <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-rose-200">
                      † {displayedRecord.event.deaths.length} vanished
                    </span>
                  )}
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
                infectedSquares={displayedState.infectedSquares}
                cursedSquares={displayedState.cursedSquares}
                hotSquares={displayedHotSquares}
                frozenSquares={frozenSquares}
                doomedSquares={doomedSquares}
                graveSquares={graveSquares}
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

              {gameState.status === "finished" &&
                historyPreviewPly === null && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center rounded-[28px] bg-zinc-950/80 p-6 backdrop-blur-sm">
                    <div className="max-w-sm rounded-3xl border border-rose-300/20 bg-zinc-900 p-6 text-center shadow-2xl">
                      <p className="text-xs font-black uppercase tracking-[0.25em] text-rose-300">
                        Game Over
                      </p>

                      <h2 className="mt-3 text-3xl font-black">
                        {gameState.winner === "draw"
                          ? "Draw"
                          : gameState.winner === myColor
                            ? "You win"
                            : "You lose"}
                      </h2>

                      <p className="mt-3 text-sm text-zinc-500">
                        {gameState.end_reason ?? "Game finished"}
                      </p>

                      <button
                        type="button"
                        onClick={requestRematch}
                        disabled={myRematchReady || Boolean(actionBusy)}
                        className="mt-5 w-full rounded-xl bg-rose-400 px-4 py-3 font-black text-rose-950 disabled:opacity-50"
                      >
                        {myRematchReady
                          ? "Waiting for opponent…"
                          : "Play again"}
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
            <Panel title="Horror Status">
              <div className="grid grid-cols-2 gap-2">
                <HazardStat
                  icon="☣"
                  label="Infected"
                  value={displayedState.infectedSquares.length}
                />
                <HazardStat
                  icon="☠"
                  label="Cursed"
                  value={displayedState.cursedSquares.length}
                />
                <HazardStat
                  icon="🔥"
                  label="Burning"
                  value={displayedHotSquares.length}
                />
                <HazardStat
                  icon="⚠"
                  label="Doomed"
                  value={displayedState.doomed.length}
                />
              </div>

              <div className="mt-3 rounded-xl border border-white/5 bg-black/20 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Frozen piece</span>
                  <span className="font-mono font-black text-sky-200">
                    {displayedState.frozen?.square ?? "—"}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Next fire wave</span>
                  <span className="font-black text-orange-200">
                    {pliesUntilFire} plies
                  </span>
                </div>
              </div>
            </Panel>

            <Panel title="Horror Stats">
              <div className="grid grid-cols-2 gap-2">
                <HazardStat
                  icon="†"
                  label="Deaths"
                  value={storedState.horror.deaths}
                />
                <HazardStat
                  icon="☠"
                  label="Curse triggers"
                  value={storedState.horror.curseTriggers}
                />
                <HazardStat
                  icon="🔥"
                  label="Fire triggers"
                  value={storedState.horror.fireTriggers}
                />
                <HazardStat
                  icon="❄"
                  label="Freeze triggers"
                  value={storedState.horror.freezeTriggers}
                />
              </div>
            </Panel>

            <Panel title="Rules">
              <div className="space-y-2 text-xs leading-5 text-zinc-400">
                <p>
                  ☣ Infected pieces can spread infection to adjacent pieces.
                </p>
                <p>☠ Capturing a cursed piece can doom the capturer.</p>
                <p>🔥 New burning squares appear every 8 plies.</p>
                <p>🔥 Non-Kings that land on or cross fire vanish.</p>
                <p>
                  ♔ Kings may not enter or cross active fire or cursed squares.
                </p>
                <p>
                  ❄ A direct Knight check freezes a random enemy non-King piece
                  for its next turn.
                </p>
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
                    Waiting for your opponent.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-black">Opponent requests Undo</h2>
                  <p className="mt-2 text-sm text-zinc-500">
                    Accepting restores the complete pre-move Horror position,
                    including infection, curses, fire, frozen pieces and doomed
                    pieces.
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
                      className="rounded-xl bg-rose-400 px-4 py-3 font-black text-rose-950"
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
