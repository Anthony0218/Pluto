import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Square } from "chess.js";

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

type TwoPlayerColor = "white" | "black";
type FogSide = "w" | "b";
type PromotionPiece = "q" | "r" | "b" | "n";
type MaskedPiece = {
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: "w" | "b";
};
type MaskedBoard = Array<Array<MaskedPiece | null>>;

type PlayerView = {
  room_id: string;
  user_id: string;
  seat: number;
  display_name: string;
  chosen_color: TwoPlayerColor | null;
};

type HistoryView = {
  ply: number;
  moveNumber: number;
  color: FogSide;
  label: string;
  captured: PieceType | null;
  promotion: PromotionPiece | null;
  gaveCheck: boolean;
  board: MaskedBoard;
  fogSquares: Square[];
  visibleSquares: Square[];
  checkedKingSquare: Square | null;
  lastMove: { from: Square; to: Square } | null;
};

type PositionView = {
  board: MaskedBoard;
  fogSquares: Square[];
  visibleSquares: Square[];
  checkedKingSquare: Square | null;
  lastMove: { from: Square; to: Square } | null;
};

type FogSnapshot = {
  room: {
    id: string;
    code: string;
    status: "waiting" | "playing" | "finished";
  };
  players: PlayerView[];
  myColor: TwoPlayerColor;
  seed: number;
  version: number;
  status: "waiting" | "playing" | "finished";
  winner: "white" | "black" | "draw" | null;
  endReason: string | null;
  turn: FogSide;
  board: MaskedBoard;
  fogSquares: Square[];
  visibleSquares: Square[];
  legalMoves: Record<string, Square[]>;
  checkedKingSquare: Square | null;
  lastMove: { from: Square; to: Square } | null;
  history: HistoryView[];
  initialView: PositionView;
  undo: {
    requestedBy: string | null;
    requestedVersion: number | null;
    canRequest: boolean;
    mine: boolean;
    opponent: boolean;
  };
  rematch: {
    whiteReady: boolean;
    blackReady: boolean;
  };
};

type FogFunctionResponse =
  | { ok: true; snapshot?: FogSnapshot; code?: string }
  | { ok: false; error: string };

type ActionLoading =
  | "undo-request"
  | "undo-response"
  | "resign"
  | "rematch"
  | null;

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
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function chessColor(color: TwoPlayerColor): FogSide {
  return color === "white" ? "w" : "b";
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

async function callFogFunction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke<FogFunctionResponse>(
    "fog-multiplayer",
    { body },
  );

  if (error) throw new Error(error.message);
  if (!data || !data.ok) {
    throw new Error(
      data && "error" in data ? data.error : "Fog server request failed",
    );
  }
  return data;
}

function pieceAt(board: MaskedBoard, square: Square): MaskedPiece | null {
  const column = "abcdefgh".indexOf(square[0]);
  const row = 8 - Number(square[1]);
  return board[row]?.[column] ?? null;
}

function optimisticMoveBoard(board: MaskedBoard, from: Square, to: Square) {
  const next = board.map((row) =>
    row.map((piece) => (piece ? { ...piece } : null)),
  );
  const fromColumn = "abcdefgh".indexOf(from[0]);
  const fromRow = 8 - Number(from[1]);
  const toColumn = "abcdefgh".indexOf(to[0]);
  const toRow = 8 - Number(to[1]);
  next[toRow][toColumn] = next[fromRow][fromColumn];
  next[fromRow][fromColumn] = null;
  return next;
}

function resultText(snapshot: FogSnapshot) {
  if (snapshot.winner === "draw") {
    return `Draw · ${snapshot.endReason ?? "Game over"}`;
  }
  if (snapshot.winner === "white") {
    return `White wins · ${snapshot.endReason ?? "Game over"}`;
  }
  if (snapshot.winner === "black") {
    return `Black wins · ${snapshot.endReason ?? "Game over"}`;
  }
  return snapshot.endReason ?? "Game over";
}

export function FogOfWarMultiplayerLobby() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [hostColor, setHostColor] = useState<TwoPlayerColor>("white");
  const [randomStart, setRandomStart] = useState(true);
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
    try {
      const result = await callFogFunction({
        action: "create",
        hostColor,
        randomStart,
        displayName,
      });
      navigate(
        `/games/chess/variants/fog-of-war/multiplayer/${String(result.code)}`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not create room.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function joinRoom() {
    if (!user) return setError("Sign in first.");
    const code = normalizeCode(joinCode);
    if (code.length !== 6) return setError("Enter the 6-character room code.");

    setLoading("join");
    setError(null);
    try {
      const result = await callFogFunction({
        action: "join",
        roomCode: code,
        displayName,
      });
      navigate(
        `/games/chess/variants/fog-of-war/multiplayer/${String(result.code ?? code)}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join room.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0c3445_0%,#111116_38%,#08080b_100%)] px-4 py-8 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 rounded-3xl border border-sky-400/15 bg-zinc-900/65 p-6 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-3xl">
              🌫
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-300">
                Fog of War Chess · Multiplayer
              </p>
              <h1 className="mt-1 text-3xl font-black text-white">
                Your opponent cannot inspect what the fog hides.
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                The real board stays on the server. Each browser receives only
                its own masked view.
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
                        ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    {color === "white" ? "♔" : "♚"}{" "}
                    {color === "white" ? "White" : "Black"}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500">
                  Starting position
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRandomStart(false)}
                    className={`rounded-xl border px-4 py-3 font-black transition ${
                      !randomStart
                        ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    ♜ Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => setRandomStart(true)}
                    className={`rounded-xl border px-4 py-3 font-black transition ${
                      randomStart
                        ? "border-violet-400/30 bg-violet-400/10 text-violet-200"
                        : "border-white/10 bg-black/20 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    🎲 Random
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-sky-300/10 bg-sky-400/[0.05] p-3 text-xs leading-5 text-zinc-400">
                Hidden pieces, the true FEN and full move history never enter
                either player's browser.
              </div>
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void createRoom()}
                className="mt-5 w-full rounded-xl bg-sky-300 px-5 py-3 font-black text-zinc-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "create" ? "Creating..." : "Create Fog Room"}
              </button>
            </Panel>

            <Panel title="Join room" subtitle="You receive the opposite side">
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(normalizeCode(event.target.value))
                }
                onKeyDown={(event) => event.key === "Enter" && void joinRoom()}
                placeholder="ABC123"
                maxLength={6}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-center font-mono text-2xl font-black uppercase tracking-[0.3em] text-white outline-none transition placeholder:text-zinc-700 focus:border-sky-400/40"
              />
              <button
                type="button"
                disabled={loading !== null}
                onClick={() => void joinRoom()}
                className="mt-3 w-full rounded-xl border border-sky-400/20 bg-sky-400/[0.07] px-5 py-3 font-black text-sky-200 transition hover:bg-sky-400/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading === "join" ? "Joining..." : "Join Fog Room"}
              </button>
            </Panel>
          </div>
        )}

        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </main>
  );
}

export function FogOfWarMultiplayerGame() {
  const { roomCode } = useParams();
  const { user } = useAuth();

  const [snapshot, setSnapshot] = useState<FogSnapshot | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: Square;
    to: Square;
  } | null>(null);
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [optimisticBoard, setOptimisticBoard] = useState<MaskedBoard | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState(false);
  const [actionLoading, setActionLoading] = useState<ActionLoading>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const lastHistoryLengthRef = useRef(0);

  const loadSnapshot = useCallback(
    async (silent = true) => {
      if (!roomCode || !user) return;
      if (!silent) setLoading(true);

      try {
        const result = await callFogFunction({
          action: "snapshot",
          roomCode,
        });
        if (!result.snapshot) throw new Error("Fog snapshot is missing.");

        const next = result.snapshot;
        if (next.history.length > lastHistoryLengthRef.current) {
          const latest = next.history.at(-1);
          if (latest?.captured) {
            playPieceCaptureSound("p");
          } else if (latest && latest.color === chessColor(next.myColor)) {
            const ownLast = latest.lastMove?.to
              ? pieceAt(latest.board, latest.lastMove.to)
              : null;
            if (ownLast) playPieceMoveSound(ownLast.type);
          }
        }

        lastHistoryLengthRef.current = next.history.length;
        setSnapshot(next);
        setOptimisticBoard(null);
        setError(null);
      } catch (cause) {
        if (!silent) {
          setError(
            cause instanceof Error ? cause.message : "Could not load room.",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [roomCode, user],
  );

  useEffect(() => {
    void loadSnapshot(false);
  }, [loadSnapshot]);

  useEffect(() => {
    if (!snapshot?.room.id) return;
    const roomId = snapshot.room.id;

    const channel = supabase
      .channel(`fog-event-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fog_multiplayer_events",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          if (!moving && actionLoading === null) void loadSnapshot(true);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [actionLoading, loadSnapshot, moving, snapshot?.room.id]);

  useEffect(() => {
    if (!snapshot?.room.id) return;
    const interval = window.setInterval(() => {
      if (!moving && actionLoading === null) void loadSnapshot(true);
    }, 1500);
    return () => window.clearInterval(interval);
  }, [actionLoading, loadSnapshot, moving, snapshot?.room.id]);

  const preview = useMemo(() => {
    if (!snapshot || historyPreviewPly === null) return null;
    if (historyPreviewPly === 0) return snapshot.initialView;
    return (
      snapshot.history.find((entry) => entry.ply === historyPreviewPly) ?? null
    );
  }, [historyPreviewPly, snapshot]);

  const displayedBoard =
    preview?.board ?? optimisticBoard ?? snapshot?.board ?? [];
  const displayedFogSquares = preview?.fogSquares ?? snapshot?.fogSquares ?? [];
  const displayedLastMove = preview?.lastMove ?? snapshot?.lastMove ?? null;
  const displayedCheckedKing =
    preview?.checkedKingSquare ?? snapshot?.checkedKingSquare ?? null;

  const orientation: "white" | "black" =
    snapshot?.myColor === "black" ? "black" : "white";
  const mySide = snapshot ? chessColor(snapshot.myColor) : null;
  const canMove = Boolean(
    snapshot &&
    snapshot.status === "playing" &&
    snapshot.turn === mySide &&
    !snapshot.undo.requestedBy &&
    historyPreviewPly === null &&
    !moving &&
    actionLoading === null,
  );

  const legalMoves = selectedSquare
    ? (snapshot?.legalMoves[selectedSquare] ?? [])
    : [];

  const capturedWhite = useMemo(
    () =>
      (snapshot?.history ?? [])
        .filter((entry) => entry.color === "b" && entry.captured)
        .map((entry) => entry.captured as PieceType),
    [snapshot?.history],
  );
  const capturedBlack = useMemo(
    () =>
      (snapshot?.history ?? [])
        .filter((entry) => entry.color === "w" && entry.captured)
        .map((entry) => entry.captured as PieceType),
    [snapshot?.history],
  );
  const whiteMaterial = capturedBlack.reduce(
    (sum, piece) => sum + (pieceValues[piece] ?? 0),
    0,
  );
  const blackMaterial = capturedWhite.reduce(
    (sum, piece) => sum + (pieceValues[piece] ?? 0),
    0,
  );

  function clearSelection() {
    setSelectedSquare(null);
  }

  function handleSquareClick(row: number, column: number) {
    if (!snapshot || !canMove || historyPreviewPly !== null) return;
    const square = getSquareName(row, column);
    const piece = pieceAt(snapshot.board, square);

    if (!selectedSquare) {
      if (!piece || piece.color !== mySide) return;
      if (!(snapshot.legalMoves[square]?.length > 0)) return;
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      return;
    }

    if (piece && piece.color === mySide) {
      if (!(snapshot.legalMoves[square]?.length > 0)) return;
      setSelectedSquare(square);
      playPieceSelectSound(piece.type);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const movingPiece = pieceAt(snapshot.board, selectedSquare);
    if (movingPiece?.type === "p" && (square[1] === "8" || square[1] === "1")) {
      setPendingPromotion({ from: selectedSquare, to: square });
      clearSelection();
      return;
    }

    void submitMove(selectedSquare, square);
  }

  async function submitMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ) {
    if (!snapshot || !roomCode || !canMove) return;

    const movingPiece = pieceAt(snapshot.board, from);
    const target = pieceAt(snapshot.board, to);
    const previous = snapshot;

    setOptimisticBoard(optimisticMoveBoard(snapshot.board, from, to));
    setMoving(true);
    setError(null);
    clearSelection();
    setPendingPromotion(null);

    if (movingPiece) {
      if (target) playPieceCaptureSound(movingPiece.type);
      else playPieceMoveSound(movingPiece.type);
    }

    try {
      const result = await callFogFunction({
        action: "move",
        roomCode,
        from,
        to,
        promotion,
        expectedVersion: previous.version,
      });
      if (!result.snapshot) throw new Error("Fog snapshot is missing.");
      lastHistoryLengthRef.current = result.snapshot.history.length;
      setSnapshot(result.snapshot);
      setOptimisticBoard(null);
    } catch (cause) {
      setOptimisticBoard(null);
      setSnapshot(previous);
      setError(cause instanceof Error ? cause.message : "Move failed.");
      await loadSnapshot(true);
    } finally {
      setMoving(false);
    }
  }

  async function promotePawn(piece: PromotionPiece) {
    if (!pendingPromotion) return;
    await submitMove(pendingPromotion.from, pendingPromotion.to, piece);
  }

  async function doAction(
    action: Exclude<ActionLoading, null>,
    body: Record<string, unknown>,
  ) {
    if (!roomCode || actionLoading) return;
    setActionLoading(action);
    setError(null);
    try {
      const result = await callFogFunction({
        action: body.action,
        roomCode,
        ...body,
      });
      if (result.snapshot) {
        lastHistoryLengthRef.current = result.snapshot.history.length;
        setSnapshot(result.snapshot);
        setHistoryPreviewPly(null);
        setOptimisticBoard(null);
        clearSelection();
        setPendingPromotion(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed.");
      await loadSnapshot(true);
    } finally {
      setActionLoading(null);
    }
  }

  async function copyRoomCode() {
    if (!snapshot?.room.code || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(snapshot.room.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard is only a convenience.
    }
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
        Sign in to open this room.
      </main>
    );
  }

  if (loading || !snapshot) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Loading Fog of War room…
      </main>
    );
  }

  const myReady =
    snapshot.myColor === "white"
      ? snapshot.rematch.whiteReady
      : snapshot.rematch.blackReady;
  const opponentReady =
    snapshot.myColor === "white"
      ? snapshot.rematch.blackReady
      : snapshot.rematch.whiteReady;
  const materialDiff = whiteMaterial - blackMaterial;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#0c3445_0%,#111116_38%,#08080b_100%)] px-4 py-6 text-zinc-100 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-4 rounded-3xl border border-sky-400/10 bg-zinc-900/55 px-5 py-4 shadow-xl shadow-black/20 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-3xl">
              🌫
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-sky-300">
                Fog of War Chess · Multiplayer
              </p>
              <h1 className="mt-0.5 text-2xl font-black text-white">
                You cannot see everything
              </h1>
              <p className="mt-0.5 text-sm text-zinc-500">
                Private server-side fog ·{" "}
                {snapshot.myColor === "white" ? "White" : "Black"} view
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyRoomCode()}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-xs font-black tracking-widest text-zinc-300"
            >
              {copied ? "COPIED" : snapshot.room.code}
            </button>
            <span className="rounded-full border border-sky-400/15 bg-sky-400/[0.06] px-3 py-1.5 text-xs font-bold text-sky-200">
              {snapshot.status === "waiting"
                ? "Waiting for opponent"
                : snapshot.status === "finished"
                  ? "Game over"
                  : snapshot.turn === "w"
                    ? "White to move"
                    : "Black to move"}
            </span>
          </div>
        </header>

        <section className="mb-6 grid gap-3 rounded-3xl border border-sky-400/10 bg-sky-400/[0.03] px-5 py-4 md:grid-cols-3">
          <RuleStrip
            icon="♙"
            title="Own army"
            detail="Your own pieces are always visible"
          />
          <RuleStrip
            icon="◌"
            title="Reachable squares"
            detail="Attacked and legal squares reveal the fog"
          />
          <RuleStrip
            icon="?"
            title="Hidden enemy"
            detail="The real enemy position remains server-side"
          />
        </section>

        {snapshot.status === "finished" && (
          <div className="mb-5 rounded-2xl border border-sky-400/20 bg-sky-400/[0.07] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-widest text-sky-300">
              Game Over
            </p>
            <p className="mt-1 font-black text-white">{resultText(snapshot)}</p>
          </div>
        )}

        {snapshot.undo.opponent && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">
                Undo request
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Your opponent wants to undo the latest move.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() =>
                  void doAction("undo-response", {
                    action: "undo-respond",
                    accept: true,
                  })
                }
                className="rounded-xl bg-emerald-300 px-4 py-2 text-xs font-black text-zinc-950 disabled:opacity-40"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={actionLoading !== null}
                onClick={() =>
                  void doAction("undo-response", {
                    action: "undo-respond",
                    accept: false,
                  })
                }
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-zinc-300 disabled:opacity-40"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              <Panel title="Players" subtitle="Private Fog room">
                <div className="space-y-2">
                  {snapshot.players.map((player) => (
                    <div
                      key={player.user_id}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2.5"
                    >
                      <span className="truncate text-sm font-bold text-zinc-200">
                        {player.user_id === user.id
                          ? `${player.display_name} · You`
                          : player.display_name}
                      </span>
                      <span className="text-xl">
                        {player.chosen_color === "white" ? "♔" : "♚"}
                      </span>
                    </div>
                  ))}
                </div>
                {snapshot.status === "waiting" && (
                  <p className="mt-3 rounded-xl border border-sky-400/10 bg-sky-400/[0.04] px-3 py-3 text-xs text-zinc-500">
                    Share room code{" "}
                    <span className="font-mono font-black text-sky-200">
                      {snapshot.room.code}
                    </span>{" "}
                    with your opponent.
                  </p>
                )}
              </Panel>

              <Panel
                title="Game Controls"
                subtitle="Negotiated multiplayer actions"
              >
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={
                      !snapshot.undo.canRequest ||
                      actionLoading !== null ||
                      moving
                    }
                    onClick={() =>
                      void doAction("undo-request", { action: "undo-request" })
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↶ Undo
                  </button>
                  <button
                    type="button"
                    disabled={
                      snapshot.status !== "playing" ||
                      actionLoading !== null ||
                      moving ||
                      Boolean(snapshot.undo.requestedBy)
                    }
                    onClick={() =>
                      void doAction("resign", { action: "resign" })
                    }
                    className="rounded-xl border border-red-400/15 bg-red-400/[0.05] px-3 py-2.5 text-sm font-bold text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Flag Resign
                  </button>
                </div>

                {snapshot.undo.mine && (
                  <p className="mt-3 rounded-xl border border-amber-300/10 bg-amber-300/[0.04] px-3 py-2 text-xs text-amber-200">
                    Waiting for your opponent to answer the undo request…
                  </p>
                )}

                {snapshot.status === "finished" && (
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={myReady || actionLoading !== null}
                      onClick={() =>
                        void doAction("rematch", { action: "rematch" })
                      }
                      className="w-full rounded-xl bg-sky-300 px-4 py-3 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {myReady ? "Rematch requested" : "Play Again"}
                    </button>
                    {opponentReady && !myReady && (
                      <p className="mt-2 text-center text-xs font-bold text-emerald-300">
                        Opponent is ready for a rematch.
                      </p>
                    )}
                  </div>
                )}
              </Panel>

              <Panel title="Captured Pieces" subtitle="Material overview">
                <div className="mb-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-400">
                  {materialDiff > 0
                    ? `White +${materialDiff}`
                    : materialDiff < 0
                      ? `Black +${Math.abs(materialDiff)}`
                      : "Material equal"}
                </div>
                <CapturedPieces
                  capturedBlack={capturedBlack}
                  capturedWhite={capturedWhite}
                />
              </Panel>

              <Panel
                title="Move History"
                subtitle="Click a move for your historical fog view"
              >
                <button
                  type="button"
                  onClick={() => {
                    setHistoryPreviewPly(0);
                    clearSelection();
                  }}
                  className={`mb-2 w-full rounded-xl border px-3 py-2 text-left text-xs font-bold transition ${
                    historyPreviewPly === 0
                      ? "border-sky-400/20 bg-sky-400/[0.08] text-sky-200"
                      : "border-white/5 bg-black/20 text-zinc-500 hover:bg-white/5"
                  }`}
                >
                  Start · Initial position
                </button>
                <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                  {snapshot.history.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-zinc-600">
                      No moves yet
                    </div>
                  ) : (
                    snapshot.history.map((entry) => (
                      <button
                        key={entry.ply}
                        type="button"
                        onClick={() => {
                          setHistoryPreviewPly(entry.ply);
                          clearSelection();
                        }}
                        className={`flex w-full items-center gap-2 border-b border-white/5 px-3 py-2.5 text-left last:border-0 hover:bg-white/5 ${
                          historyPreviewPly === entry.ply
                            ? "bg-sky-400/[0.08]"
                            : ""
                        }`}
                      >
                        <span className="w-10 text-[10px] text-zinc-600">
                          {entry.moveNumber}
                          {entry.color === "w" ? "." : "..."}
                        </span>
                        <span
                          className={`font-mono text-xs font-black ${entry.label === "Hidden move" ? "text-zinc-600" : "text-zinc-200"}`}
                        >
                          {entry.label}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {historyPreviewPly !== null && (
                <div className="mb-3 flex items-center justify-between rounded-xl border border-sky-400/20 bg-sky-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-sky-300">
                      History Preview
                    </p>
                    <p className="mt-1 text-sm font-bold text-white">
                      {historyPreviewPly === 0
                        ? "Initial position"
                        : (snapshot.history.find(
                            (entry) => entry.ply === historyPreviewPly,
                          )?.label ?? "Historical position")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold"
                  >
                    Back to Live Board
                  </button>
                </div>
              )}

              <div className="relative">
                <Board
                  board={displayedBoard}
                  selectedSquare={
                    historyPreviewPly === null ? selectedSquare : null
                  }
                  legalMoves={historyPreviewPly === null ? legalMoves : []}
                  lastMove={displayedLastMove}
                  checkedKingSquare={displayedCheckedKing}
                  onSquareClick={
                    historyPreviewPly !== null || !canMove
                      ? () => {}
                      : handleSquareClick
                  }
                  fogSquares={displayedFogSquares}
                  orientation={orientation}
                />
                {snapshot.players.length < 2 && (
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
                        {snapshot.players.length}/2 players connected
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
                          {snapshot.room.code}
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

                {pendingPromotion && historyPreviewPly === null && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[4px]">
                    <div className="w-full max-w-md rounded-3xl border border-sky-400/20 bg-zinc-900/95 p-5 shadow-2xl shadow-black/60">
                      <p className="mb-4 text-center text-xs font-black uppercase tracking-[0.24em] text-sky-300">
                        Choose promotion
                      </p>
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
                title="Fog Status"
                subtitle={`${snapshot.myColor === "white" ? "White" : "Black"}'s private vision`}
              >
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    label="Visible"
                    value={
                      preview?.visibleSquares.length ??
                      snapshot.visibleSquares.length
                    }
                  />
                  <StatCard
                    label="Hidden"
                    value={
                      64 -
                      (preview?.visibleSquares.length ??
                        snapshot.visibleSquares.length)
                    }
                  />
                </div>
                <div className="mt-3 rounded-xl border border-violet-400/10 bg-violet-400/[0.04] px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">
                    Random Start
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Same formation for both sides
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-zinc-700">
                    Seed {snapshot.seed}
                  </p>
                </div>
              </Panel>

              <Panel
                title="Fog Stats"
                subtitle="Only information your side is allowed to know"
              >
                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    label="Captures"
                    value={
                      snapshot.history.filter((entry) => entry.captured).length
                    }
                  />
                  <StatCard
                    label="Checks"
                    value={
                      snapshot.history.filter((entry) => entry.gaveCheck).length
                    }
                  />
                  <StatCard label="Moves" value={snapshot.history.length} />
                  <StatCard
                    label="Visible now"
                    value={snapshot.visibleSquares.length}
                  />
                </div>
              </Panel>

              <Panel
                title="Privacy"
                subtitle="Why this multiplayer mode is different"
              >
                <div className="space-y-2 text-xs leading-5 text-zinc-500">
                  <p className="rounded-xl border border-sky-400/10 bg-sky-400/[0.04] px-3 py-2">
                    The browser never receives the full FEN.
                  </p>
                  <p className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                    Opponent history entries remain “Hidden move” and historical
                    previews are re-masked for your color.
                  </p>
                </div>
              </Panel>
            </div>
          </aside>
        </div>

        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </main>
  );
}

function CapturedPieces({
  capturedBlack,
  capturedWhite,
}: {
  capturedBlack: PieceType[];
  capturedWhite: PieceType[];
}) {
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
    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
        Black
      </p>
      {render(capturedBlack, "b")}
      <div className="mt-3 border-t border-white/5 pt-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          White
        </p>
        {render(capturedWhite, "w")}
      </div>
    </div>
  );
}

function RuleStrip({
  icon,
  title,
  detail,
}: {
  icon: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-400/10 text-lg font-black text-sky-200">
        {icon}
      </span>
      <div>
        <p className="text-xs font-black text-zinc-200">{title}</p>
        <p className="mt-1 text-[10px] leading-4 text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-3">
      <p className="text-xl font-black text-zinc-100">{value}</p>
      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>
    </div>
  );
}
