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

import Board from "@/components/Board";
import PromotionBar from "@/components/PromotionBar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { getSquareName, type PieceType } from "@/utils/chessUtils";
import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "@/utils/sound";
import {
  TECTONIC_PLIES_PER_SHIFT,
  TECTONIC_QUADRANTS,
  advanceTectonicAfterNormalMove,
  applyTectonicShift,
  canSkipTectonicShift,
  cloneTectonicState,
  createInitialTectonicState,
  findTectonicKingSquare,
  getLegalTectonicQuadrants,
  getTectonicPostShiftPreviewGame,
  getTectonicPreviewGame,
  isLegalTectonicRotation,
  isTectonicLockedOut,
  isThreefoldTectonic,
  quadrantLabel,
  tectonicRepetitionKey,
  type TectonicQuadrant,
  type TectonicSide,
  type TectonicState,
} from "@/games/chess/variants/tectonicChess";
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

type Winner = "white" | "black" | "draw";
type FinishReason =
  | "checkmate"
  | "tectonic_lock"
  | "stalemate"
  | "insufficient"
  | "fifty"
  | "repetition";

type TectonicHistoryEntry = {
  action: number;
  kind: "move" | "shift";
  color: TectonicSide;
  notation: string;
  from: Square | null;
  to: Square | null;
  piece: PieceType | null;
  captured: PieceType | null;
  fenAfter: string;
  stateAfter: TectonicState;
  gaveCheck: boolean;
};

type TectonicStoredState = {
  tectonic: TectonicState;
  history: TectonicHistoryEntry[];
};

type TectonicVariantGame = VariantGame & {
  undo_previous_state?: Record<string, unknown> | null;
};

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

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function normalizeCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function colorToChess(color: TwoPlayerColor): TectonicSide {
  return color === "white" ? "w" : "b";
}

function chessToColor(color: TectonicSide): TwoPlayerColor {
  return color === "w" ? "white" : "black";
}

function normalizeTectonicState(value: unknown): TectonicState {
  const initial = createInitialTectonicState();
  if (!value || typeof value !== "object") return initial;

  const source = value as Partial<TectonicState>;
  const locked =
    source.lockedQuadrant === "A" ||
    source.lockedQuadrant === "B" ||
    source.lockedQuadrant === "C" ||
    source.lockedQuadrant === "D"
      ? source.lockedQuadrant
      : null;
  const last =
    source.lastShiftQuadrant === "A" ||
    source.lastShiftQuadrant === "B" ||
    source.lastShiftQuadrant === "C" ||
    source.lastShiftQuadrant === "D"
      ? source.lastShiftQuadrant
      : null;

  return {
    normalPliesSinceShift:
      typeof source.normalPliesSinceShift === "number"
        ? source.normalPliesSinceShift
        : 0,
    pendingShift: Boolean(source.pendingShift),
    shiftCount: typeof source.shiftCount === "number" ? source.shiftCount : 0,
    lockedQuadrant: locked,
    lastShiftQuadrant: last,
    lastShiftSquares: Array.isArray(source.lastShiftSquares)
      ? (source.lastShiftSquares.filter(
          (square): square is Square => typeof square === "string",
        ) as Square[])
      : [],
    skippedLastShift: Boolean(source.skippedLastShift),
  };
}

function normalizeHistory(value: unknown): TectonicHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry, index) => {
      const item = entry as Partial<TectonicHistoryEntry>;
      const kind = item.kind === "shift" ? "shift" : "move";
      const color: TectonicSide = item.color === "b" ? "b" : "w";

      return {
        action: typeof item.action === "number" ? item.action : index + 1,
        kind,
        color,
        notation: typeof item.notation === "string" ? item.notation : "?",
        from: typeof item.from === "string" ? (item.from as Square) : null,
        to: typeof item.to === "string" ? (item.to as Square) : null,
        piece: typeof item.piece === "string" ? (item.piece as PieceType) : null,
        captured:
          typeof item.captured === "string" ? (item.captured as PieceType) : null,
        fenAfter: typeof item.fenAfter === "string" ? item.fenAfter : START_FEN,
        stateAfter: normalizeTectonicState(item.stateAfter),
        gaveCheck: Boolean(item.gaveCheck),
      };
    });
}

function extractStoredState(game: VariantGame | null): TectonicStoredState {
  const state = game?.state ?? {};
  return {
    tectonic: normalizeTectonicState(state.tectonic),
    history: normalizeHistory(state.history),
  };
}

function serializeStoredState(
  tectonic: TectonicState,
  history: TectonicHistoryEntry[],
): Record<string, unknown> {
  return {
    tectonic: cloneTectonicState(tectonic),
    history: history.map((entry) => ({
      ...entry,
      stateAfter: cloneTectonicState(entry.stateAfter),
    })),
  };
}

function normalizeGame(raw: TectonicVariantGame): TectonicVariantGame {
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
    undo_previous_state: raw.undo_previous_state ?? null,
    undo_last_requested_by: raw.undo_last_requested_by ?? null,
    undo_last_requested_version: raw.undo_last_requested_version ?? null,
  };
}

function repetitionKeys(
  initialFen: string,
  history: TectonicHistoryEntry[],
): string[] {
  const initialGame = new Chess(initialFen, { skipValidation: true });
  const keys = [tectonicRepetitionKey(initialGame, createInitialTectonicState())];

  for (const entry of history) {
    try {
      const game = new Chess(entry.fenAfter, { skipValidation: true });
      keys.push(tectonicRepetitionKey(game, entry.stateAfter));
    } catch {
      // Keep malformed historical data from taking down the room UI.
    }
  }

  return keys;
}

function getOutcome(
  game: Chess,
  state: TectonicState,
  history: TectonicHistoryEntry[],
  initialFen: string,
): { finished: boolean; winner: Winner | null; reason: FinishReason | null } {
  const keys = repetitionKeys(initialFen, history);

  /*
   * Important Tectonic rule:
   * when a shift is pending, chess.js checkmate/stalemate does NOT end the
   * game because the current player gets a board rotation instead of a
   * normal chess move. Only a genuine Tectonic lock can end that phase.
   */
  if (state.pendingShift) {
    if (isTectonicLockedOut(game, state)) {
      return {
        finished: true,
        winner: game.turn() === "w" ? "black" : "white",
        reason: "tectonic_lock",
      };
    }

    if (isThreefoldTectonic(keys)) {
      return { finished: true, winner: "draw", reason: "repetition" };
    }

    return { finished: false, winner: null, reason: null };
  }

  if (game.isCheckmate()) {
    return {
      finished: true,
      winner: game.turn() === "w" ? "black" : "white",
      reason: "checkmate",
    };
  }

  if (game.isStalemate()) {
    return { finished: true, winner: "draw", reason: "stalemate" };
  }

  if (game.isInsufficientMaterial()) {
    return { finished: true, winner: "draw", reason: "insufficient" };
  }

  if (game.isDrawByFiftyMoves()) {
    return { finished: true, winner: "draw", reason: "fifty" };
  }

  if (isThreefoldTectonic(keys)) {
    return { finished: true, winner: "draw", reason: "repetition" };
  }

  return { finished: false, winner: null, reason: null };
}

function findCheckedKing(game: Chess): Square | null {
  if (!game.isCheck()) return null;
  return findTectonicKingSquare(game, game.turn());
}

function resultLabel(game: VariantGame) {
  const reason = game.end_reason ?? "Game over";
  if (game.winner === "draw") return `Draw · ${reason}`;
  if (game.winner === "white") return `White wins · ${reason}`;
  if (game.winner === "black") return `Black wins · ${reason}`;
  return reason;
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
    <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
      <div className="mb-4">
        <h2 className="text-sm font-black text-zinc-100">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.07] px-4 py-3 text-sm font-semibold text-red-200">
      {children}
    </div>
  );
}

function CapturedPieces({ rows }: { rows: TectonicHistoryEntry[] }) {
  const moveRows = rows.filter((row) => row.kind === "move");
  const capturedWhite = moveRows
    .filter((row) => row.color === "b" && row.captured)
    .map((row) => row.captured as PieceType);
  const capturedBlack = moveRows
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

  const render = (pieces: PieceType[], color: TectonicSide) => (
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
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          Black pieces captured
        </p>
        {render(capturedBlack, "b")}
        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
            White pieces captured
          </p>
          {render(capturedWhite, "w")}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-2 py-3 text-center">
      <p className="text-xl font-black text-violet-200">{value}</p>
      <p className="mt-1 text-[9px] font-bold leading-4 text-zinc-600">{label}</p>
    </div>
  );
}

function StatusMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-zinc-300">{value}</p>
    </div>
  );
}

function QuadrantOverlay({
  orientation,
  active,
  hovered,
  locked,
}: {
  orientation: "white" | "black";
  active: boolean;
  hovered: TectonicQuadrant | null;
  locked: TectonicQuadrant | null;
}) {
  const visual =
    orientation === "white"
      ? { topLeft: "A", topRight: "B", bottomLeft: "C", bottomRight: "D" }
      : { topLeft: "D", topRight: "C", bottomLeft: "B", bottomRight: "A" };

  const cells = [
    ["topLeft", "left-[25%] top-[25%]"],
    ["topRight", "left-[75%] top-[25%]"],
    ["bottomLeft", "left-[25%] top-[75%]"],
    ["bottomRight", "left-[75%] top-[75%]"],
  ] as const;

  return (
    <div className="pointer-events-none absolute inset-[2.5%] z-30 rounded-2xl">
      <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-violet-300/25" />
      <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-violet-300/25" />
      {cells.map(([key, position]) => {
        const quadrant = visual[key] as TectonicQuadrant;
        const isHovered = hovered === quadrant;
        const isLocked = locked === quadrant;

        return (
          <div
            key={key}
            className={`absolute ${position} -translate-x-1/2 -translate-y-1/2 rounded-lg border px-2 py-1 text-[10px] font-black transition ${
              active
                ? isHovered
                  ? "border-violet-200/60 bg-violet-400/35 text-white"
                  : isLocked
                    ? "border-zinc-500/20 bg-zinc-950/60 text-zinc-600"
                    : "border-violet-300/20 bg-zinc-950/45 text-violet-200"
                : "border-violet-300/10 bg-zinc-950/30 text-violet-300/45"
            }`}
          >
            {quadrant}
          </div>
        );
      })}
    </div>
  );
}

export function TectonicMultiplayerLobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [hostColor, setHostColor] = useState<TwoPlayerColor>("white");
  const [joinCode, setJoinCode] = useState("");
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
      "create_tectonic_variant_room",
      {
        p_display_name: displayName,
        p_host_color: hostColor,
      },
    );

    setLoading(null);
    if (rpcError) return setError(rpcError.message);

    navigate(`/games/chess/variants/tectonic/multiplayer/${String(data)}`);
  }

  async function joinRoom() {
    if (!user) return setError("Sign in first.");

    const code = normalizeCode(joinCode);
    if (code.length !== 6) return setError("Enter the 6-character room code.");

    setLoading("join");
    setError(null);

    const { data, error: rpcError } = await supabase.rpc("join_variant_room", {
      p_code: code,
      p_expected_variant: "tectonic",
      p_display_name: displayName,
    });

    setLoading(null);
    if (rpcError) return setError(rpcError.message);

    navigate(`/games/chess/variants/tectonic/multiplayer/${String(data ?? code)}`);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#2a1746_0%,#111116_40%,#08080b_100%)] px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 rounded-3xl border border-violet-400/15 bg-zinc-900/65 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-3xl">
              ↻
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">
                Tectonic Chess · Multiplayer
              </p>
              <h1 className="mt-1 text-3xl font-black text-white">
                Move pieces. Then move the board.
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Every four normal plies, the next player gets one synchronized Tectonic Shift.
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
            <Panel title="Create room" subtitle="Choose your side">
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
                    {color === "white" ? "♔" : "♚"} {color === "white" ? "White" : "Black"}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-violet-300/10 bg-violet-400/[0.05] p-3 text-xs leading-5 text-zinc-400">
                Normal moves and quadrant rotations are both authoritative multiplayer actions. Undo therefore rolls back exactly one action — including a shift.
              </div>

              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-violet-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "create" ? "Creating..." : "Create Tectonic Room"}
              </button>
            </Panel>

            <Panel title="Join room" subtitle="You receive the opposite side">
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(normalizeCode(event.target.value))}
                onKeyDown={(event) => event.key === "Enter" && void joinRoom()}
                placeholder="ABC123"
                maxLength={6}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-400/40"
              />
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-3 w-full rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-5 py-3 font-black text-violet-200 transition hover:bg-violet-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "join" ? "Joining..." : "Join Tectonic Room"}
              </button>
            </Panel>
          </div>
        )}

        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </main>
  );
}

export function TectonicMultiplayerGame() {
  const { roomCode } = useParams();
  const { user } = useAuth();

  const [room, setRoom] = useState<VariantRoom | null>(null);
  const [players, setPlayers] = useState<VariantRoomPlayer[]>([]);
  const [gameState, setGameState] = useState<TectonicVariantGame | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [historyPreviewIndex, setHistoryPreviewIndex] = useState<number | null>(null);
  const [hoveredQuadrant, setHoveredQuadrant] = useState<TectonicQuadrant | null>(null);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lastSeenActionCountRef = useRef(0);

  const myPlayer = useMemo(
    () => players.find((player) => player.user_id === user?.id) ?? null,
    [players, user?.id],
  );
  const opponent = useMemo(
    () => players.find((player) => player.user_id !== user?.id) ?? null,
    [players, user?.id],
  );
  const myColor = myPlayer?.chosen_color ?? null;
  const orientation: "white" | "black" = myColor === "black" ? "black" : "white";

  const initialFen = gameState?.initial_fen ?? START_FEN;
  const stored = useMemo(() => extractStoredState(gameState), [gameState]);
  const tectonic = stored.tectonic;
  const history = stored.history;

  const liveGame = useMemo(() => {
    try {
      return new Chess(gameState?.fen ?? initialFen, { skipValidation: true });
    } catch {
      return new Chess(initialFen, { skipValidation: true });
    }
  }, [gameState?.fen, initialFen]);

  const historyPreview =
    historyPreviewIndex === null ? null : (history[historyPreviewIndex] ?? null);

  const historyPreviewGame = useMemo(() => {
    if (historyPreviewIndex === null) return null;
    if (historyPreviewIndex === -1) {
      return new Chess(initialFen, { skipValidation: true });
    }
    return historyPreview
      ? new Chess(historyPreview.fenAfter, { skipValidation: true })
      : null;
  }, [historyPreview, historyPreviewIndex, initialFen]);

  const canHoverShift =
    tectonic.pendingShift &&
    historyPreviewIndex === null &&
    gameState?.status === "playing";

  const previewGame = useMemo(() => {
    if (
      !canHoverShift ||
      !hoveredQuadrant ||
      !isLegalTectonicRotation(liveGame, tectonic, hoveredQuadrant)
    ) {
      return null;
    }
    return getTectonicPreviewGame(liveGame, hoveredQuadrant);
  }, [canHoverShift, hoveredQuadrant, liveGame, tectonic]);

  const postShiftPreviewGame = useMemo(() => {
    if (!canHoverShift || !hoveredQuadrant) return null;
    return getTectonicPostShiftPreviewGame(liveGame, tectonic, hoveredQuadrant);
  }, [canHoverShift, hoveredQuadrant, liveGame, tectonic]);

  const displayedGame = historyPreviewGame ?? previewGame ?? liveGame;
  const board = displayedGame.board();
  const checkedKingSquare =
    previewGame && postShiftPreviewGame
      ? findCheckedKing(postShiftPreviewGame)
      : findCheckedKing(displayedGame);

  const displayedLastMove = useMemo(() => {
    if (historyPreviewIndex !== null) {
      if (historyPreviewIndex === -1 || !historyPreview) return null;
      return historyPreview.kind === "move" && historyPreview.from && historyPreview.to
        ? { from: historyPreview.from, to: historyPreview.to }
        : null;
    }

    if (gameState?.last_move_from && gameState?.last_move_to) {
      return {
        from: gameState.last_move_from as Square,
        to: gameState.last_move_to as Square,
      };
    }

    return null;
  }, [gameState?.last_move_from, gameState?.last_move_to, historyPreview, historyPreviewIndex]);

  const legalShiftQuadrants = useMemo(
    () =>
      tectonic.pendingShift
        ? getLegalTectonicQuadrants(liveGame, tectonic)
        : [],
    [liveGame, tectonic],
  );

  const myChessColor = myColor ? colorToChess(myColor) : null;
  const isMyTurn = Boolean(myChessColor) && liveGame.turn() === myChessColor;
  const undoPending = Boolean(gameState?.undo_requested_by);

  const canNormalMove =
    room?.status === "playing" &&
    gameState?.status === "playing" &&
    isMyTurn &&
    !tectonic.pendingShift &&
    !moving &&
    actionLoading === null &&
    !pendingPromotion &&
    historyPreviewIndex === null &&
    !undoPending;

  const canShift =
    room?.status === "playing" &&
    gameState?.status === "playing" &&
    isMyTurn &&
    tectonic.pendingShift &&
    !moving &&
    actionLoading === null &&
    historyPreviewIndex === null &&
    !undoPending;

  const latestAction = history.at(-1) ?? null;
  const latestActorColor = latestAction ? chessToColor(latestAction.color) : null;
  const alreadyRequestedUndo =
    Boolean(user?.id) &&
    gameState?.undo_last_requested_by === user?.id &&
    gameState?.undo_last_requested_version === gameState?.version;

  const canRequestUndo =
    gameState?.status === "playing" &&
    history.length > 0 &&
    myColor !== null &&
    latestActorColor === myColor &&
    !undoPending &&
    !alreadyRequestedUndo &&
    !moving &&
    actionLoading === null;

  const myUndoRequest =
    Boolean(user?.id) && gameState?.undo_requested_by === user?.id;
  const opponentUndoRequest = Boolean(gameState?.undo_requested_by) && !myUndoRequest;

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

  const shiftHistory = history.filter((entry) => entry.kind === "shift");
  const rotations = shiftHistory.filter((entry) => entry.notation !== "SKIP").length;
  const skips = shiftHistory.length - rotations;
  const checksByShift = shiftHistory.filter((entry) => entry.gaveCheck).length;
  const pliesUntilShift = tectonic.pendingShift
    ? 0
    : Math.max(0, TECTONIC_PLIES_PER_SHIFT - tectonic.normalPliesSinceShift);

  const applyAuthoritativeGame = useCallback((raw: TectonicVariantGame) => {
    const updated = normalizeGame(raw);
    const nextState = extractStoredState(updated);
    const nextCount = nextState.history.length;

    if (nextCount < lastSeenActionCountRef.current) {
      setHistoryPreviewIndex(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      setPendingPromotion(null);
      setHoveredQuadrant(null);
    }

    if (nextCount > lastSeenActionCountRef.current) {
      const latest = nextState.history.at(-1);
      if (latest?.kind === "move" && latest.piece) {
        if (latest.captured) playPieceCaptureSound(latest.piece);
        else playPieceMoveSound(latest.piece);
      }
    }

    lastSeenActionCountRef.current = nextCount;
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
        .eq("variant", "tectonic")
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
        .select(`
          room_id, variant, seed, initial_fen, fen, moves, state, status,
          winner, end_reason, version, last_move_from, last_move_to,
          white_rematch_ready, black_rematch_ready, next_seed, next_initial_fen,
          undo_requested_by, undo_requested_version, undo_previous_fen,
          undo_previous_last_from, undo_previous_last_to, undo_previous_state,
          undo_last_requested_by, undo_last_requested_version
        `)
        .eq("room_id", loadedRoom.id)
        .single();

      if (gameError || !gameData) {
        if (!silent) setError("Game could not be loaded.");
        setLoading(false);
        return;
      }

      setRoom(loadedRoom);
      setPlayers(loadedPlayers);

      const normalized = normalizeGame(gameData as TectonicVariantGame);
      if (!silent) {
        lastSeenActionCountRef.current = extractStoredState(normalized).history.length;
      }
      applyAuthoritativeGame(normalized);
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
      .channel(`tectonic-game-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "variant_games",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => applyAuthoritativeGame(payload.new as TectonicVariantGame),
      )
      .subscribe();

    const roomChannel = supabase
      .channel(`tectonic-room-${roomId}`)
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

  async function submitAction({
    kind,
    notation,
    nextGame,
    nextTectonic,
    nextHistory,
    from,
    to,
    outcome,
  }: {
    kind: "move" | "shift";
    notation: string;
    nextGame: Chess;
    nextTectonic: TectonicState;
    nextHistory: TectonicHistoryEntry[];
    from: Square | null;
    to: Square | null;
    outcome: ReturnType<typeof getOutcome>;
  }) {
    if (!room || !gameState) return;

    const previous = gameState;
    const nextMoves = [...gameState.moves, notation];
    const nextState = serializeStoredState(nextTectonic, nextHistory);

    const optimistic: TectonicVariantGame = {
      ...gameState,
      fen: nextGame.fen(),
      moves: nextMoves,
      state: nextState,
      version: gameState.version + 1,
      last_move_from: from,
      last_move_to: to,
      status: outcome.finished ? "finished" : "playing",
      winner: outcome.finished ? outcome.winner : null,
      end_reason: outcome.finished ? outcome.reason : null,
      undo_requested_by: null,
      undo_requested_version: null,
    };

    setGameState(optimistic);
    lastSeenActionCountRef.current = nextHistory.length;
    clearSelection();
    setPendingPromotion(null);
    setHoveredQuadrant(null);
    setMoving(true);
    setError(null);

    const { error: actionError } = await supabase.rpc("play_tectonic_action", {
      p_room_id: room.id,
      p_expected_version: previous.version,
      p_kind: kind,
      p_notation: notation,
      p_new_fen: nextGame.fen(),
      p_new_state: nextState,
      p_from: from,
      p_to: to,
      p_is_finished: outcome.finished,
      p_winner: outcome.winner,
      p_end_reason: outcome.reason,
    });

    setMoving(false);

    if (actionError) {
      setGameState(previous);
      lastSeenActionCountRef.current = extractStoredState(previous).history.length;
      setError(actionError.message);
      await loadRoom(true);
    }
  }

  async function submitNormalMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (!gameState || !canNormalMove) return;

    const nextGame = new Chess(liveGame.fen(), { skipValidation: true });
    let move: ReturnType<Chess["move"]>;

    try {
      move = nextGame.move({ from, to, promotion });
    } catch {
      setError("Illegal move.");
      return;
    }

    if (!move) return;

    const nextTectonic = advanceTectonicAfterNormalMove(tectonic);
    const entry: TectonicHistoryEntry = {
      action: history.length + 1,
      kind: "move",
      color: move.color,
      notation: move.san,
      from: move.from,
      to: move.to,
      piece: move.piece as PieceType,
      captured: (move.captured as PieceType | undefined) ?? null,
      fenAfter: nextGame.fen(),
      stateAfter: cloneTectonicState(nextTectonic),
      gaveCheck: nextGame.isCheck(),
    };
    const nextHistory = [...history, entry];
    const outcome = getOutcome(nextGame, nextTectonic, nextHistory, initialFen);

    if (move.captured) playPieceCaptureSound(move.piece);
    else playPieceMoveSound(move.piece);

    await submitAction({
      kind: "move",
      notation: move.san,
      nextGame,
      nextTectonic,
      nextHistory,
      from: move.from,
      to: move.to,
      outcome,
    });
  }

  async function submitShift(quadrant: TectonicQuadrant | null) {
    if (!canShift || !gameState) return;

    const shifter = liveGame.turn();
    const result = applyTectonicShift(liveGame, tectonic, quadrant);
    if (!result) return;

    const notation = quadrant === null ? "SKIP" : `↻${quadrant}`;
    const entry: TectonicHistoryEntry = {
      action: history.length + 1,
      kind: "shift",
      color: shifter,
      notation,
      from: null,
      to: null,
      piece: null,
      captured: null,
      fenAfter: result.game.fen(),
      stateAfter: cloneTectonicState(result.state),
      gaveCheck: result.game.isCheck(),
    };
    const nextHistory = [...history, entry];
    const outcome = getOutcome(result.game, result.state, nextHistory, initialFen);

    await submitAction({
      kind: "shift",
      notation,
      nextGame: result.game,
      nextTectonic: result.state,
      nextHistory,
      from: null,
      to: null,
      outcome,
    });
  }

  function handleSquareClick(row: number, column: number) {
    if (!canNormalMove || !myChessColor) return;

    const square = getSquareName(row, column);
    const piece = liveGame.get(square);

    if (!selectedSquare) {
      if (!piece || piece.color !== myChessColor) return;
      const moves = liveGame.moves({ square, verbose: true });
      setSelectedSquare(square);
      setLegalMoves(moves.map((candidate) => candidate.to as Square));
      playPieceSelectSound(piece.type);
      return;
    }

    if (piece && piece.color === myChessColor) {
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
    if (
      movingPiece?.type === "p" &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPendingPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }

    void submitNormalMove(selectedSquare, square);
  }

  async function promotePawn(piece: PromotionPiece) {
    if (!pendingPromotion) return;
    await submitNormalMove(pendingPromotion.from, pendingPromotion.to, piece);
  }

  function buildUndoSnapshot() {
    if (!gameState || history.length === 0) return null;

    const previousEntry = history.length >= 2 ? history[history.length - 2] : null;
    const previousTectonic = previousEntry?.stateAfter ?? createInitialTectonicState();
    const previousHistory = history.slice(0, -1);

    return {
      previousFen: previousEntry?.fenAfter ?? initialFen,
      previousState: serializeStoredState(previousTectonic, previousHistory),
      previousLastFrom:
        previousEntry?.kind === "move" ? previousEntry.from : null,
      previousLastTo:
        previousEntry?.kind === "move" ? previousEntry.to : null,
    };
  }

  async function requestUndo() {
    if (!room || !gameState || !canRequestUndo || !user) return;
    const snapshot = buildUndoSnapshot();
    if (!snapshot) return;

    setActionLoading("undo-request");
    setError(null);

    const { error: undoError } = await supabase.rpc("request_tectonic_undo", {
      p_room_id: room.id,
      p_previous_fen: snapshot.previousFen,
      p_previous_state: snapshot.previousState,
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

    const { error: undoError } = await supabase.rpc("respond_tectonic_undo", {
      p_room_id: room.id,
      p_accept: accept,
    });

    if (undoError) setError(undoError.message);

    if (accept) {
      setHistoryPreviewIndex(null);
      clearSelection();
      setPendingPromotion(null);
      setHoveredQuadrant(null);
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
      p_expected_variant: "tectonic",
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

    const { error: rematchError } = await supabase.rpc("request_tectonic_rematch", {
      p_room_id: room.id,
    });

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
      // Clipboard is optional.
    }
  }

  if (!user) {
    return <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">Sign in required.</main>;
  }

  if (loading) {
    return <main className="min-h-screen bg-zinc-950 p-8 text-zinc-400">Loading Tectonic room...</main>;
  }

  if (!room || !gameState) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        <p>Tectonic room unavailable.</p>
        {error && <ErrorBox>{error}</ErrorBox>}
      </main>
    );
  }

  const activeTurnColor = liveGame.turn() === "w" ? "white" : "black";
  const shifterName = liveGame.turn() === "w" ? "White" : "Black";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#291747_0%,#111116_40%,#08080b_100%)] px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-4 rounded-3xl border border-violet-400/10 bg-zinc-900/55 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-3xl">
              ↻
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-violet-300">
                Chess Variant · Multiplayer
              </p>
              <h1 className="mt-0.5 text-2xl font-black text-white">Tectonic Chess</h1>
              <p className="mt-0.5 text-sm text-zinc-500">Move pieces. Then move the board.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {gameState.status === "playing" && (
              <div className={`rounded-full border px-3 py-1.5 text-xs font-black ${
                tectonic.pendingShift
                  ? "border-violet-300/20 bg-violet-400/10 text-violet-200"
                  : "border-white/10 bg-white/5 text-zinc-300"
              }`}>
                {tectonic.pendingShift
                  ? `TECTONIC SHIFT · ${shifterName}`
                  : `${activeTurnColor === "white" ? "White" : "Black"} to move`}
              </div>
            )}
            <button
              type="button"
              onClick={() => void copyRoomCode()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs font-black text-zinc-300"
            >
              Room {room.code} {copied ? "✓" : ""}
            </button>
            <Link
              to="/games/chess/variants/tectonic/multiplayer"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-zinc-400 hover:bg-white/10"
            >
              Lobby
            </Link>
          </div>
        </header>

        {error && <ErrorBox>{error}</ErrorBox>}

        <main className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title="Players" subtitle={players.length < 2 ? "Waiting for opponent..." : "Connected"}>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div
                      key={player.user_id}
                      className={`rounded-2xl border p-3 ${
                        player.chosen_color === activeTurnColor && gameState.status === "playing"
                          ? "border-violet-400/25 bg-violet-400/[0.06]"
                          : "border-white/5 bg-black/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-zinc-200">{player.display_name}</span>
                        <span className="text-xl">{player.chosen_color === "black" ? "♚" : "♔"}</span>
                      </div>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
                        {player.user_id === user.id ? "You" : "Opponent"} · {player.chosen_color ?? "waiting"}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="Game Controls" subtitle="Players, game and actions">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!canRequestUndo}
                    onClick={() => void requestUndo()}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    ↶ Undo Action
                  </button>
                  <button
                    type="button"
                    disabled={gameState.status !== "playing" || actionLoading !== null || undoPending}
                    onClick={() => void resign()}
                    className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm font-bold text-red-200 disabled:opacity-35"
                  >
                    Resign
                  </button>
                </div>
              </Panel>

              {gameState.undo_requested_by && (
                <Panel
                  title="Undo request"
                  subtitle={myUndoRequest ? "Waiting for opponent" : "Opponent wants to undo the latest action"}
                >
                  {opponentUndoRequest ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void respondUndo(true)}
                        className="rounded-xl bg-emerald-300 px-3 py-2.5 font-black text-zinc-950"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondUndo(false)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 font-black text-zinc-300"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400">Request sent.</p>
                  )}
                </Panel>
              )}

              <Panel title="Action History" subtitle="Moves and board shifts">
                <div className="max-h-80 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryPreviewIndex(-1);
                      clearSelection();
                      setHoveredQuadrant(null);
                    }}
                    className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs ${
                      historyPreviewIndex === -1
                        ? "bg-violet-400/10 text-violet-200"
                        : "text-zinc-500 hover:bg-white/5"
                    }`}
                  >
                    <span>0 · Initial position</span>
                    <span>◎</span>
                  </button>
                  {history.map((entry, index) => (
                    <button
                      key={`${entry.action}-${entry.notation}`}
                      type="button"
                      onClick={() => {
                        setHistoryPreviewIndex(index);
                        clearSelection();
                        setHoveredQuadrant(null);
                      }}
                      className={`flex w-full items-center justify-between border-b border-white/5 px-3 py-2.5 text-left text-xs last:border-0 ${
                        historyPreviewIndex === index
                          ? "bg-violet-400/10 text-violet-200"
                          : "text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-6 text-[10px] text-zinc-600">{entry.action}</span>
                        <span>{entry.color === "w" ? "♙" : "♟"}</span>
                        <span>{entry.kind === "shift" ? "↻" : "·"}</span>
                      </span>
                      <span className="font-mono font-black">{entry.notation}</span>
                    </button>
                  ))}
                </div>
              </Panel>

              <Panel title="Captured Pieces" subtitle="Normal moves only">
                <CapturedPieces rows={history} />
              </Panel>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {gameState.status === "finished" && (
                <div className="mb-3 rounded-2xl border border-violet-400/20 bg-violet-400/[0.07] p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-violet-300">Game Over</p>
                  <p className="mt-1 text-lg font-black text-white">{resultLabel(gameState)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={myRematchReady || actionLoading !== null}
                      onClick={() => void requestRematch()}
                      className="rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-40"
                    >
                      {myRematchReady ? "Rematch requested" : "Play Again"}
                    </button>
                    {opponentRematchReady && (
                      <span className="rounded-xl bg-white/5 px-3 py-2 text-xs text-zinc-400">Opponent ready</span>
                    )}
                  </div>
                </div>
              )}

              {historyPreviewIndex !== null && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">History Preview</p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {historyPreviewIndex === -1
                        ? "Initial position"
                        : `${historyPreview?.kind === "shift" ? "Tectonic shift" : "Normal move"} · ${historyPreview?.notation ?? ""}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryPreviewIndex(null)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold"
                  >
                    Back to Live Board
                  </button>
                </div>
              )}

              {previewGame && hoveredQuadrant && historyPreviewIndex === null && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/20 bg-violet-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">Shift preview</p>
                    <p className="mt-1 text-sm font-bold text-white">↻ {quadrantLabel(hoveredQuadrant)}</p>
                  </div>
                  {postShiftPreviewGame?.isCheck() && (
                    <span className="rounded-full border border-red-400/20 bg-red-400/10 px-3 py-1.5 text-[10px] font-black text-red-300">
                      This shift gives check!
                    </span>
                  )}
                </div>
              )}

              {pendingPromotion && historyPreviewIndex === null && !tectonic.pendingShift && (
                <div className="mb-3">
                  <PromotionBar onPromote={promotePawn} />
                </div>
              )}

              <div className="relative">
                <Board
                  board={board}
                  selectedSquare={historyPreviewIndex !== null || previewGame ? null : selectedSquare}
                  legalMoves={historyPreviewIndex !== null || previewGame ? [] : legalMoves}
                  lastMove={displayedLastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={historyPreviewIndex !== null || previewGame || tectonic.pendingShift ? () => {} : handleSquareClick}
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
                      Share this room code. The game starts automatically when everyone has joined.
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
                      {copied ? "✓ Copied to clipboard" : "Click this box to copy the code"}
                    </p>
                  </button>
                </div>
              )}


                <QuadrantOverlay
                  orientation={orientation}
                  active={tectonic.pendingShift && historyPreviewIndex === null}
                  hovered={hoveredQuadrant}
                  locked={tectonic.lockedQuadrant}
                />
              </div>
            </div>
          </section>

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <section className="rounded-3xl border border-violet-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">Tectonic Status</h2>
                    <p className="mt-1 text-xs text-zinc-500">The board itself is a weapon</p>
                  </div>
                  <span className="text-2xl">↻</span>
                </div>

                {tectonic.pendingShift ? (
                  <div className="mt-4">
                    <div className="rounded-2xl border border-violet-300/20 bg-violet-400/[0.07] p-4 text-center">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">TECTONIC SHIFT</p>
                      <p className="mt-2 text-lg font-black text-white">{shifterName}</p>
                      <p className="mt-1 text-[10px] text-zinc-500">
                        {canShift ? "Choose one quadrant or skip" : "Waiting for the other player"}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {TECTONIC_QUADRANTS.map((quadrant) => {
                        const legal = legalShiftQuadrants.includes(quadrant);
                        const locked = tectonic.lockedQuadrant === quadrant;

                        return (
                          <button
                            key={quadrant}
                            type="button"
                            disabled={!canShift || !legal}
                            onMouseEnter={() => canShift && legal && setHoveredQuadrant(quadrant)}
                            onMouseLeave={() => setHoveredQuadrant(null)}
                            onFocus={() => canShift && legal && setHoveredQuadrant(quadrant)}
                            onBlur={() => setHoveredQuadrant(null)}
                            onClick={() => void submitShift(quadrant)}
                            className={`rounded-2xl border p-3 text-left transition ${
                              canShift && legal
                                ? hoveredQuadrant === quadrant
                                  ? "border-violet-300/40 bg-violet-400/20"
                                  : "border-violet-300/15 bg-violet-400/[0.07] hover:bg-violet-400/15"
                                : "border-white/5 bg-black/20 opacity-45"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl font-black text-white">{quadrant}</span>
                              <span className="text-lg">↻</span>
                            </div>
                            <p className="mt-2 text-[10px] font-bold text-zinc-500">{quadrantLabel(quadrant).slice(4)}</p>
                            <p className="mt-1 text-[9px] font-black uppercase tracking-wider text-zinc-600">
                              {locked ? "Locked" : legal ? "Rotate 90° clockwise" : "Illegal"}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={!canShift || !canSkipTectonicShift(liveGame, tectonic)}
                      onClick={() => void submitShift(null)}
                      className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:opacity-35"
                    >
                      Skip Shift
                    </button>

                    {liveGame.isCheck() && (
                      <p className="mt-2 text-[10px] leading-4 text-red-300/80">
                        Skip is illegal while your King is in check.
                      </p>
                    )}

                    {isTectonicLockedOut(liveGame, tectonic) && (
                      <div className="mt-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-3 text-xs font-black text-red-300">
                        Shift locked out — no legal quadrant can rotate the King to safety.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Normal plies until shift</p>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="text-sm font-bold text-zinc-300">{shifterName}</span>
                      <span className="text-4xl font-black leading-none text-violet-300">{pliesUntilShift}</span>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-violet-400 transition-all duration-300"
                        style={{ width: `${(tectonic.normalPliesSinceShift / TECTONIC_PLIES_PER_SHIFT) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <StatusMini label="Previous quadrant lock" value={tectonic.lockedQuadrant ?? "—"} />
                  <StatusMini
                    label="Last shift"
                    value={tectonic.skippedLastShift ? "Skipped" : (tectonic.lastShiftQuadrant ?? "—")}
                  />
                </div>
              </section>

              <Panel title="Shift Stats" subtitle="Tectonic actions">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Rotations" value={rotations} />
                  <Stat label="Skips" value={skips} />
                  <Stat label="Checks by shift" value={checksByShift} />
                </div>
              </Panel>

              <Panel title="Rules" subtitle="Tectonic Chess">
                <div className="space-y-2 text-xs leading-5 text-zinc-400">
                  <p>• Every 4 normal plies, the next side shifts instead of moving a piece.</p>
                  <p>• A shift rotates one 4×4 quadrant 90° clockwise.</p>
                  <p>• The previously used quadrant is locked for the next shift.</p>
                  <p>• Your shift may not leave your own King in check.</p>
                  <p>• A shift can itself give check or checkmate.</p>
                </div>
              </Panel>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
