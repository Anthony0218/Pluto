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
import { getSquareName, type PieceType } from "@/utils/chessUtils";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "@/utils/sound";
import {
  MUTATION_INTERVAL_PLIES,
  applyScheduledMutation,
  createMutationSeed,
  getPliesUntilNextMutation,
  isThreefoldFromRecords,
  type MutationEvent,
  type MutationMoveRecord,
  type MutationPieceType,
} from "@/games/chess/variants/mutationChess";
import type {
  TwoPlayerColor,
  VariantGame,
  VariantRoom,
  VariantRoomPlayer,
} from "@/games/chess/multiplayer/variantMultiplayerTypes";

type PromotionPiece = "q" | "r" | "b" | "n";
type ActionLoading =
  | "undo-request"
  | "undo-response"
  | "resign"
  | "rematch"
  | null;

const START_FEN = new Chess().fen();

const whiteSymbols: Record<string, string> = {
  p: "♙",
  n: "♘",
  b: "♗",
  r: "♖",
  q: "♕",
  k: "♔",
};

const blackSymbols: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
};

const pieceNames: Record<MutationPieceType, string> = {
  p: "Pawn",
  n: "Knight",
  b: "Bishop",
  r: "Rook",
  q: "Queen",
};

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function normalizeCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function colorToChess(color: TwoPlayerColor): "w" | "b" {
  return color === "white" ? "w" : "b";
}

function chessToColor(color: "w" | "b"): TwoPlayerColor {
  return color === "w" ? "white" : "black";
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

function isNormalEndingBeforeMutation(
  game: Chess,
  previousRecords: MutationMoveRecord[],
): boolean {
  return (
    game.isCheckmate() ||
    game.isStalemate() ||
    game.isInsufficientMaterial() ||
    game.isDrawByFiftyMoves() ||
    isThreefoldFromRecords(previousRecords, game.fen())
  );
}

function buildMutationHistory(
  initialFen: string,
  moves: string[],
  seed: number,
): MutationMoveRecord[] {
  const replay = new Chess(initialFen);
  const records: MutationMoveRecord[] = [];

  for (const san of moves) {
    try {
      const move = replay.move(san);
      const nextPly = records.length + 1;

      const captured =
        move.captured === "p" ||
        move.captured === "n" ||
        move.captured === "b" ||
        move.captured === "r" ||
        move.captured === "q"
          ? move.captured
          : undefined;

      const promotion =
        move.promotion === "q" ||
        move.promotion === "r" ||
        move.promotion === "b" ||
        move.promotion === "n"
          ? move.promotion
          : undefined;

      let mutation: MutationEvent | null = null;

      if (
        !isNormalEndingBeforeMutation(replay, records) &&
        nextPly % MUTATION_INTERVAL_PLIES === 0
      ) {
        mutation = applyScheduledMutation(
          replay,
          seed,
          Math.floor(nextPly / MUTATION_INTERVAL_PLIES),
          nextPly,
        );
      }

      records.push({
        ply: nextPly,
        moveNumber: Math.ceil(nextPly / 2),
        color: move.color,
        san: move.san,
        from: move.from,
        to: move.to,
        piece: move.piece,
        captured,
        promotion,
        fenAfter: replay.fen(),
        mutation,
      });
    } catch {
      break;
    }
  }

  return records;
}

function getOutcome(game: Chess, records: MutationMoveRecord[]) {
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
  if (isThreefoldFromRecords(records, game.fen())) {
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

function playLatestMoveSound(
  initialFen: string,
  moves: string[],
  seed: number,
) {
  const latest = buildMutationHistory(initialFen, moves, seed).at(-1);
  if (!latest) return;

  if (latest.captured) playPieceCaptureSound(latest.piece);
  else playPieceMoveSound(latest.piece);
}

function formatMutation(event: MutationEvent) {
  const color = event.color === "w" ? "White" : "Black";
  return `${color} ${pieceNames[event.fromType]} on ${event.square} → ${pieceNames[event.toType]}`;
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

function CapturedPieces({ rows }: { rows: MutationMoveRecord[] }) {
  useUiLanguage();
  const capturedWhite = rows
    .filter((row) => row.color === "b" && row.captured)
    .map((row) => row.captured as PieceType);
  const capturedBlack = rows
    .filter((row) => row.color === "w" && row.captured)
    .map((row) => row.captured as PieceType);

  const whiteMaterial = capturedBlack.reduce(
    (sum, piece) => sum + (pieceValues[piece] ?? 0),
    0,
  );
  const blackMaterial = capturedWhite.reduce(
    (sum, piece) => sum + (pieceValues[piece] ?? 0),
    0,
  );
  const diff = whiteMaterial - blackMaterial;

  const render = (pieces: PieceType[], color: "w" | "b") => (
    <div className="mt-2 flex min-h-8 flex-wrap gap-1">
      {pieces.length === 0 ? (
        <span className="text-xs text-zinc-700">—</span>
      ) : (
        pieces.map((piece, index) => (
          <span key={`${color}-${piece}-${index}`} className="text-2xl">
            {color === "w" ? whiteSymbols[piece] : blackSymbols[piece]}
          </span>
        ))
      )}
    </div>
  );

  return (
    <>
      <div className="mb-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-400">
        {diff > 0
          ? `White +${diff}`
          : diff < 0
            ? `Black +${Math.abs(diff)}`
            : "Material equal"}
      </div>
      <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{ui("Black pieces captured")}</p>
        {render(capturedBlack, "b")}
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">{ui("White pieces captured")}</p>
          {render(capturedWhite, "w")}
        </div>
      </div>
    </>
  );
}

export function MutationMultiplayerLobby() {
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

    const { data, error: rpcError } = await supabase.rpc(
      "create_mutation_variant_room",
      {
        p_seed: createMutationSeed(),
        p_display_name: displayName,
        p_host_color: hostColor,
      },
    );

    setLoading(null);
    if (rpcError) return setError(rpcError.message);

    navigate(`/games/chess/variants/mutation/multiplayer/${String(data)}`);
  }

  async function joinRoom() {
    if (!user) return setError("Sign in first.");

    const code = normalizeCode(joinCode);
    if (code.length !== 6) return setError("Enter the 6-character room code.");

    setLoading("join");
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("join_variant_room", {
      p_code: code,
      p_expected_variant: "mutation",
      p_display_name: displayName,
    });

    setLoading(null);
    if (rpcError) return setError(rpcError.message);

    navigate(
      `/games/chess/variants/mutation/multiplayer/${String(data ?? code)}`,
    );
  }

  return (
    <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 rounded-3xl border border-violet-400/15 bg-zinc-900/65 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-3xl">
              🧬
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">{ui("Mutation Chess · Multiplayer")}</p>
              <h1 className="mt-1 text-3xl font-black text-white">{ui("Every fifth full move can rewrite the board.")}</h1>
              <p className="mt-1 text-sm text-zinc-500">{ui("One shared seed makes every scheduled mutation identical for both players.")}</p>
            </div>
          </div>
        </header>

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
                    {color === "white" ? ui("White") : ui("Black")}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-violet-300/10 bg-violet-400/[0.05] p-3 text-xs leading-5 text-zinc-400">{ui("The room stores one mutation seed. Every 10 plies, both browsers derive the same legal mutation from that seed and the same board position.")}</div>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-violet-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "create" ? ui("Creating...") : ui("Create Mutation Room")}
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
                maxLength={6}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-400/40"
              />
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-3 w-full rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-5 py-3 font-black text-violet-200 transition hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "join" ? ui("Joining...") : ui("Join Mutation Room")}
              </button>
            </Panel>
          </div>
        )}

        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </div>
    </main>
  );
}

export function MutationMultiplayerGame() {
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
  const lastSeedRef = useRef<number | null>(null);

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

  const seed = gameState?.seed ?? 0;
  const initialFen = gameState?.initial_fen ?? START_FEN;

  const historyRows = useMemo(
    () => buildMutationHistory(initialFen, gameState?.moves ?? [], seed),
    [gameState?.moves, initialFen, seed],
  );

  const liveGame = useMemo(() => {
    try {
      return new Chess(gameState?.fen ?? initialFen);
    } catch {
      return new Chess(initialFen);
    }
  }, [gameState?.fen, initialFen]);

  const previewGame = useMemo(() => {
    if (historyPreviewPly === null) return null;
    if (historyPreviewPly === 0) return new Chess(initialFen);

    const row = historyRows[historyPreviewPly - 1];
    return row ? new Chess(row.fenAfter) : null;
  }, [historyPreviewPly, historyRows, initialFen]);

  const displayedGame = previewGame ?? liveGame;
  const board = displayedGame.board();
  const checkedKingSquare = findCheckedKing(displayedGame);

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

  const displayedRecord =
    historyPreviewPly === null
      ? (historyRows.at(-1) ?? null)
      : historyPreviewPly === 0
        ? null
        : (historyRows[historyPreviewPly - 1] ?? null);

  const mutationSquares: Square[] = displayedRecord?.mutation
    ? [displayedRecord.mutation.square]
    : [];

  const isMyTurn =
    Boolean(myColor) && liveGame.turn() === colorToChess(myColor!);
  const undoPending = Boolean(gameState?.undo_requested_by);

  const canMove =
    room?.status === "playing" &&
    gameState?.status === "playing" &&
    isMyTurn &&
    !moving &&
    actionLoading === null &&
    !pendingPromotion &&
    historyPreviewPly === null &&
    !undoPending;

  const lastHistoryMove = historyRows.at(-1) ?? null;
  const lastMoverColor = lastHistoryMove
    ? chessToColor(lastHistoryMove.color)
    : null;
  const alreadyRequestedUndo =
    Boolean(user?.id) &&
    gameState?.undo_last_requested_by === user?.id &&
    gameState?.undo_last_requested_version === gameState?.version;

  const canRequestUndo =
    gameState?.status === "playing" &&
    (gameState?.moves.length ?? 0) > 0 &&
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

  const mutations = useMemo(
    () => historyRows.filter((row) => row.mutation).map((row) => row.mutation!),
    [historyRows],
  );
  const lastMutation = mutations.at(-1) ?? null;
  const pliesUntilMutation = getPliesUntilNextMutation(historyRows.length);
  const fullMovesUntilMutation = Math.ceil(pliesUntilMutation / 2);
  const upgrades = mutations.filter((event) => event.valueDelta > 0).length;
  const downgrades = mutations.filter((event) => event.valueDelta < 0).length;
  const sidegrades = mutations.filter((event) => event.valueDelta === 0).length;

  const applyAuthoritativeGame = useCallback((raw: VariantGame) => {
    const updated = normalizeGame(raw);
    const nextMoveCount = updated.moves.length;
    const seedChanged =
      lastSeedRef.current !== null && updated.seed !== lastSeedRef.current;

    if (seedChanged || nextMoveCount < lastSeenMoveCountRef.current) {
      setHistoryPreviewPly(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
      if (seedChanged) lastSeenMoveCountRef.current = 0;
    }

    if (
      updated.initial_fen &&
      typeof updated.seed === "number" &&
      nextMoveCount > lastSeenMoveCountRef.current
    ) {
      playLatestMoveSound(updated.initial_fen, updated.moves, updated.seed);
    }

    lastSeenMoveCountRef.current = nextMoveCount;
    lastSeedRef.current = updated.seed;
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
        .eq("variant", "mutation")
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
          undo_requested_by, undo_requested_version, undo_previous_fen,
          undo_previous_last_from, undo_previous_last_to,
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
      .channel(`mutation-game-${roomId}`)
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
      .channel(`mutation-room-${roomId}`)
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

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  async function submitMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (!room || !gameState || !gameState.fen || !canMove) return;

    const localGame = new Chess(gameState.fen);
    let move: ReturnType<Chess["move"]>;

    try {
      move = localGame.move({ from, to, promotion });
    } catch {
      setError("Illegal move.");
      return;
    }

    if (!move) return;

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

    const nextPly = historyRows.length + 1;
    let mutation: MutationEvent | null = null;

    if (
      !isNormalEndingBeforeMutation(localGame, historyRows) &&
      nextPly % MUTATION_INTERVAL_PLIES === 0
    ) {
      mutation = applyScheduledMutation(
        localGame,
        seed,
        Math.floor(nextPly / MUTATION_INTERVAL_PLIES),
        nextPly,
      );
    }

    const record: MutationMoveRecord = {
      ply: nextPly,
      moveNumber: Math.ceil(nextPly / 2),
      color: move.color,
      san: move.san,
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured,
      promotion: promotedTo,
      fenAfter: localGame.fen(),
      mutation,
    };

    const nextRecords = [...historyRows, record];
    const nextMoves = [...gameState.moves, move.san];
    const outcome = getOutcome(localGame, nextRecords);
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
      p_expected_variant: "mutation",
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

  function handleSquareClick(row: number, column: number) {
    if (!canMove || !myColor) return;

    const square = getSquareName(row, column);
    const piece = liveGame.get(square);

    if (!selectedSquare) {
      if (!piece || piece.color !== colorToChess(myColor)) return;

      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((candidate) => candidate.to as Square));
      playPieceSelectSound(piece.type);
      return;
    }

    if (piece && piece.color === colorToChess(myColor)) {
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
    if (!room || !opponentUndoRequest || actionLoading) return;

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
    ) {
      return;
    }

    setActionLoading("resign");
    setError(null);

    const { error: resignError } = await supabase.rpc("resign_variant_game", {
      p_room_id: room.id,
      p_expected_variant: "mutation",
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
    ) {
      return;
    }

    setActionLoading("rematch");
    setError(null);

    const { error: rematchError } = await supabase.rpc(
      "request_variant_rematch",
      {
        p_room_id: room.id,
        p_next_seed: createMutationSeed(),
        p_next_initial_fen: START_FEN,
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
      // Clipboard is just a convenience.
    }
  }

  if (!user) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-100">{ui("Sign in required.")}</main>
    );
  }

  if (loading) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-400">{ui("Loading Mutation room...")}</main>
    );
  }

  if (!room || !gameState) {
    return (
      <main className="chess-variant-page min-h-[var(--app-height)] bg-transparent p-8 text-zinc-100">
        <p>{ui("Mutation room unavailable.")}</p>
        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </main>
    );
  }

  const activeTurnColor = liveGame.turn() === "w" ? "white" : "black";

  return (
    <div className="chess-variant-page min-h-[var(--app-height)] bg-transparent px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-4 rounded-3xl border border-violet-400/10 bg-zinc-900/50 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-3xl">
              🧬
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">{ui("Chess Variant · Multiplayer")}</p>
              <h1 className="mt-0.5 text-2xl font-black text-white">{ui("Mutation Chess")}</h1>
              <p className="mt-0.5 text-sm text-zinc-500">{ui("Every 5 full moves, one legal non-King piece changes.")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {gameState.status === "playing" && (
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-300">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
                {activeTurnColor === "white" ? ui("White") : ui("Black")}{ui("to move")}</div>
            )}
            <button
              type="button"
              onClick={() => void copyRoomCode()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs font-black text-zinc-300"
            >{ui("Room")}{room.code} {copied ? "✓" : ""}
            </button>
            <Link
              to="/games/chess/variants/mutation/multiplayer"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:bg-white/10"
            >{ui("Lobby")}</Link>
          </div>
        </header>

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
                    <div
                      key={player.user_id}
                      className={`rounded-2xl border p-3 ${
                        player.chosen_color === activeTurnColor &&
                        gameState.status === "playing"
                          ? "border-violet-400/25 bg-violet-400/[0.06]"
                          : "border-white/5 bg-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-zinc-200">
                          {player.display_name}
                        </span>
                        <span className="text-xl">
                          {player.chosen_color === "black" ? "♚" : "♔"}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                        {player.user_id === user.id ? ui("You") : ui("Opponent")} ·{" "}
                        {player.chosen_color ?? "waiting"}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title={ui("Game Controls")} subtitle={ui("Players, game and actions")}>
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

              {gameState.undo_requested_by && (
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
                        type="button"
                        onClick={() => void respondUndo(true)}
                        className="rounded-xl bg-emerald-300 px-3 py-2.5 font-black text-zinc-950"
                      >{ui("Accept")}</button>
                      <button
                        type="button"
                        onClick={() => void respondUndo(false)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-black text-zinc-300"
                      >{ui("Decline")}</button>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">{ui("Request sent.")}</p>
                  )}
                </Panel>
              )}

              <Panel title={ui("Captured Pieces")} subtitle={ui("Material overview")}>
                <CapturedPieces rows={historyRows} />
              </Panel>
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

              {historyPreviewPly !== null && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">{ui("History Preview")}</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {historyPreviewPly === 0 ? ui("Initial position") : `${historyRows[historyPreviewPly - 1]?.moveNumber}${
                            historyRows[historyPreviewPly - 1]?.color === "w"
                              ? "."
                              : "..."
                          } ${historyRows[historyPreviewPly - 1]?.san ?? ""}`}
                    </p>
                    {displayedRecord?.mutation && (
                      <p className="mt-1 text-xs font-bold text-fuchsia-300">
                        ✦ {formatMutation(displayedRecord.mutation)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold"
                  >{ui("Back to Live Board")}</button>
                </div>
              )}

              <div className="relative">
                <Board
                  board={board}
                  selectedSquare={
                    historyPreviewPly === null ? selectedSquare : null
                  }
                  legalMoves={historyPreviewPly === null ? legalMoves : []}
                  lastMove={displayedLastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={
                    historyPreviewPly !== null ? () => {} : handleSquareClick
                  }
                  mutationSquares={mutationSquares}
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
                title={ui("Mutation Status")}
                subtitle={ui("Shared deterministic chaos")}
              >
                <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.05] p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-violet-300">{ui("Next mutation")}</p>
                  <p className="mt-1 text-2xl font-black text-white">
                    {pliesUntilMutation}{" "}
                    <span className="text-sm text-zinc-500">{ui("plies")}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{ui("about")}{fullMovesUntilMutation}{ui(" full")}{" "}
                    {fullMovesUntilMutation === 1 ? ui("move") : ui("moves")}
                  </p>
                </div>

                <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-3">
                  <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">{ui("Last mutation")}</p>
                  {lastMutation ? (
                    <>
                      <p className="mt-2 text-xs font-black text-fuchsia-300">
                        ✦ {formatMutation(lastMutation)}
                      </p>
                      <p className="mt-1 text-[10px] text-zinc-600">{ui("Mutation #")}{lastMutation.mutationNumber}{ui(" · ply")}{" "}
                        {lastMutation.ply}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-600">{ui("No mutation yet")}</p>
                  )}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/5 bg-black/20 p-2 text-center">
                    <p className="text-lg font-black text-emerald-300">
                      {upgrades}
                    </p>
                    <p className="text-[8px] font-black uppercase text-zinc-600">{ui("Upgrades")}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-2 text-center">
                    <p className="text-lg font-black text-red-300">
                      {downgrades}
                    </p>
                    <p className="text-[8px] font-black uppercase text-zinc-600">{ui("Downgrades")}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/20 p-2 text-center">
                    <p className="text-lg font-black text-violet-300">
                      {sidegrades}
                    </p>
                    <p className="text-[8px] font-black uppercase text-zinc-600">{ui("Sidegrades")}</p>
                  </div>
                </div>

                <p className="mt-3 font-mono text-[10px] text-zinc-700">{ui("Mutation seed")}{seed}
                </p>
              </Panel>

              <Panel
                title={ui("Move History")}
                subtitle={`${historyRows.length} plies · click to preview`}
              >
                <div className="max-h-[470px] overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(0)}
                    className={`w-full border-b border-white/5 px-3 py-2 text-left text-xs font-bold ${
                      historyPreviewPly === 0
                        ? "bg-violet-400/10 text-violet-200"
                        : "text-zinc-500 hover:bg-white/5"
                    }`}
                  >{ui("Start · standard position")}</button>

                  {historyRows.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-zinc-700">{ui("No moves yet")}</p>
                  ) : (
                    historyRows.map((row) => (
                      <button
                        key={row.ply}
                        type="button"
                        onClick={() => setHistoryPreviewPly(row.ply)}
                        className={`w-full border-b border-white/5 px-3 py-2.5 text-left last:border-0 ${
                          historyPreviewPly === row.ply
                            ? "bg-violet-400/10"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-10 text-[10px] text-zinc-600">
                            {row.moveNumber}
                            {row.color === "w" ? "." : "..."}
                          </span>
                          <span className="font-mono text-xs font-black text-zinc-200">
                            {row.san}
                          </span>
                          {row.mutation && (
                            <span className="ml-auto rounded-full border border-fuchsia-400/20 bg-fuchsia-400/[0.08] px-2 py-0.5 text-[9px] font-black text-fuchsia-300">{ui("🧬 MUTATION")}</span>
                          )}
                        </div>
                        {row.mutation && (
                          <p className="mt-1 pl-[52px] text-[9px] text-zinc-600">
                            {pieceNames[row.mutation.fromType]} →{" "}
                            {pieceNames[row.mutation.toType]}{ui(" on")}{" "}
                            {row.mutation.square}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </aside>
        </main>

        {players.length < 2 && (
          <div className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3 text-sm font-semibold text-violet-100">{ui("Waiting for a second player. Share room code")}{" "}
            <span className="font-mono font-black">{room.code}</span>.
          </div>
        )}

        {error && <ErrorBox>{ui(error)}</ErrorBox>}
      </div>
    </div>
  );
}
