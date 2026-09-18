import { useMemo, useState } from "react";

import { Chess, type Square } from "chess.js";

import Board from "./Board.tsx";
import PromotionBar from "./PromotionBar";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import {
  playPieceCaptureSound,
  playPieceMoveSound,
  playPieceSelectSound,
} from "../utils/sound.ts";

import { useDelayedBoardOrientation } from "@/hooks/useDelayedBoardOrientation.ts";

import {
  HOT_POTATO_MIN_FUSE_MOVES,
  HOT_POTATO_MAX_FUSE_MOVES,
  HOT_POTATO_RESPAWN_WAIT_MOVES,
  createInitialHotPotatoState,
  findKingSquare,
  getHotPotatoSquareAfterMove,
  getNormalChessOutcome,
  getRandomHotPotatoSquare,
  getRandomHotPotatoFuseMoves,
  isChessInCheck,
  resolveHotPotatoExplosion,
  type DestroyedPiece,
  type HotPotatoOutcome,
  type HotPotatoState,
} from "../games/chess/variants/HotPotato.ts";

/* =========================================================
   TYPES
   ========================================================= */

type PromotionPiece = "q" | "r" | "b" | "n";

type PendingPromotion = {
  from: Square;
  to: Square;
};

type FinishedGame = {
  outcome: Exclude<HotPotatoOutcome, null>;
  reason: "explosion" | "checkmate" | "draw";
} | null;

type HotPotatoHistoryEntry = {
  ply: number;
  moveNumber: number;
  color: "w" | "b";
  san: string;
  piece: PieceType;
  from: Square;
  to: Square;
  fenAfter: string;
  hotPotatoAfter: HotPotatoState;
  explosionSquaresAfter: Square[];
  blownUpKingSquaresAfter: Square[];
  potatoTransferred: boolean;
  destroyedPieces: DestroyedPiece[];
};

type UndoSnapshot = {
  fen: string;
  hotPotato: HotPotatoState;
  lastMove: { from: Square; to: Square } | null;
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
  history: HotPotatoHistoryEntry[];
  explosionCount: number;
  transferCount: number;
  destroyedPieceCount: number;
  blownUpKingSquares: Square[];
  finishedGame: FinishedGame;
};

/* =========================================================
   CONSTANTS
   ========================================================= */

const pieceValues: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/* =========================================================
   HELPERS
   ========================================================= */

function resultText(result: FinishedGame): string {
  if (!result) return "";

  if (result.outcome === "draw") {
    return result.reason === "explosion"
      ? "Both kings blown up! Draw."
      : "The game ended in a draw.";
  }

  const winner = result.outcome === "white" ? "White" : "Black";

  return result.reason === "explosion"
    ? `King blown up! ${winner} wins.`
    : `${winner} wins by checkmate.`;
}

function getHistoryPieceSymbol(color: "w" | "b", piece: PieceType) {
  const symbols: Record<"w" | "b", Record<PieceType, string>> = {
    w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
    b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
  };

  return symbols[color][piece];
}

function getBoardMaterialDifference(game: Chess) {
  let white = 0;
  let black = 0;

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) continue;

      const value = pieceValues[piece.type as PieceType];

      if (piece.color === "w") white += value;
      else black += value;
    }
  }

  return white - black;
}

function cloneHotPotato(state: HotPotatoState): HotPotatoState {
  return { ...state };
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function ChessHotPotatoBoard() {
  /* =======================================================
     CHESS GAME
     ======================================================= */

  const [game, setGame] = useState(() => new Chess());

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [pendingPromotion, setPendingPromotion] =
    useState<PendingPromotion | null>(null);

  const [finishedGame, setFinishedGame] = useState<FinishedGame>(null);

  /* =======================================================
     LOCAL PLAYERS
     ======================================================= */

  const [whitePlayer, setWhitePlayer] = useState("");
  const [blackPlayer, setBlackPlayer] = useState("");

  /* =======================================================
     HOT POTATO
     ======================================================= */

  const [hotPotato, setHotPotato] = useState<HotPotatoState>(() => {
    const initialGame = new Chess();
    return createInitialHotPotatoState(initialGame);
  });

  const [explosionSquares, setExplosionSquares] = useState<Square[]>([]);
  const [blownUpKingSquares, setBlownUpKingSquares] = useState<Square[]>([]);

  const [explosionCount, setExplosionCount] = useState(0);
  const [transferCount, setTransferCount] = useState(0);
  const [destroyedPieceCount, setDestroyedPieceCount] = useState(0);

  /* =======================================================
     HISTORY / UNDO
     ======================================================= */

  const [history, setHistory] = useState<HotPotatoHistoryEntry[]>([]);
  const [historyPreviewPly, setHistoryPreviewPly] = useState<number | null>(
    null,
  );
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);

  /* =======================================================
     BOARD ORIENTATION
     ======================================================= */

  const {
    orientation: liveBoardOrientation,
    flipPending,
    snapToSide,
  } = useDelayedBoardOrientation(game.turn(), 1500);

  /* =======================================================
     HISTORY PREVIEW
     ======================================================= */

  const historyPreview =
    historyPreviewPly !== null
      ? (history[historyPreviewPly - 1] ?? null)
      : null;

  const historyPreviewChess = useMemo(
    () => (historyPreview ? new Chess(historyPreview.fenAfter) : null),
    [historyPreview?.fenAfter],
  );

  const displayedGame = historyPreviewChess ?? game;
  const displayedBoard = displayedGame.board();

  const boardOrientation: "white" | "black" = historyPreviewChess
    ? historyPreviewChess.turn() === "w"
      ? "white"
      : "black"
    : liveBoardOrientation;

  const displayedLastMove = historyPreview
    ? { from: historyPreview.from, to: historyPreview.to }
    : lastMove;

  const displayedHotPotato = historyPreview
    ? historyPreview.hotPotatoAfter
    : hotPotato;

  const displayedExplosionSquares = historyPreview
    ? historyPreview.explosionSquaresAfter
    : explosionSquares;

  const displayedBlownUpKingSquares = historyPreview
    ? historyPreview.blownUpKingSquaresAfter
    : blownUpKingSquares;

  /* =======================================================
     CHECKED KING
     ======================================================= */

  const checkedKingSquare = useMemo(() => {
    if (!isChessInCheck(displayedGame)) return null;
    return findKingSquare(displayedGame, displayedGame.turn());
  }, [displayedGame]);

  /* =======================================================
     MATERIAL
     ======================================================= */

  const materialDifference = getBoardMaterialDifference(displayedGame);

  /* =======================================================
     BASIC UI HELPERS
     ======================================================= */

  function clearSelection() {
    setSelectedSquare(null);
    setLegalMoves([]);
  }

  function selectPiece(square: Square) {
    if (historyPreview || finishedGame || pendingPromotion || flipPending)
      return;

    const piece = game.get(square);

    if (!piece || piece.color !== game.turn()) {
      clearSelection();
      return;
    }

    const moves = game.moves({
      square,
      verbose: true,
    });

    setSelectedSquare(square);
    setLegalMoves(moves.map((move) => move.to as Square));

    playPieceSelectSound(piece.type);
  }

  function snapshotCurrentState(): UndoSnapshot {
    return {
      fen: game.fen(),
      hotPotato: cloneHotPotato(hotPotato),
      lastMove,
      capturedWhite: [...capturedWhite],
      capturedBlack: [...capturedBlack],
      history: [...history],
      explosionCount,
      transferCount,
      destroyedPieceCount,
      blownUpKingSquares: [...blownUpKingSquares],
      finishedGame,
    };
  }

  function getNormalFinish(nextGame: Chess): FinishedGame {
    const outcome = getNormalChessOutcome(nextGame);

    if (!outcome) return null;

    return {
      outcome,
      reason: nextGame.isCheckmate() ? "checkmate" : "draw",
    };
  }

  /* =======================================================
     MOVE EXECUTION
     ======================================================= */

  function makeMove(
    from: Square,
    to: Square,
    promotion?: PromotionPiece,
  ): boolean {
    if (finishedGame || historyPreview) return false;

    const nextGame = new Chess(game.fen());

    let move;

    try {
      move = nextGame.move({
        from,
        to,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      return false;
    }

    if (!move) return false;

    const beforeMove = snapshotCurrentState();

    let nextHotPotato = cloneHotPotato(hotPotato);
    let nextExplosionSquares: Square[] = [];
    let nextBlownUpKingSquares: Square[] = [];
    let variantFinish: FinishedGame = null;
    let destroyedPieces: DestroyedPiece[] = [];
    let potatoTransferred = false;

    /* -----------------------------------------------------
       ACTIVE HOT POTATO
       ----------------------------------------------------- */

    if (hotPotato.square) {
      const carrierBeforeMove = hotPotato.square;

      const carrierWasCaptured =
        carrierBeforeMove === move.to && carrierBeforeMove !== move.from;

      const enPassantCarrierWasCaptured =
        move.flags.includes("e") &&
        carrierBeforeMove === (`${move.to[0]}${move.from[1]}` as Square);

      potatoTransferred = carrierWasCaptured || enPassantCarrierWasCaptured;

      const movedPotatoSquare = getHotPotatoSquareAfterMove(hotPotato.square, {
        from: move.from as Square,
        to: move.to as Square,
        color: move.color,
        flags: move.flags,
      });

      const movesUntilExplosion = hotPotato.movesUntilExplosion - 1;

      if (movesUntilExplosion <= 0) {
        const explosion = resolveHotPotatoExplosion(
          nextGame,
          movedPotatoSquare,
        );

        nextExplosionSquares = explosion.explosionSquares;
        nextBlownUpKingSquares = explosion.blownUpKingSquares;
        destroyedPieces = explosion.destroyedPieces;

        nextHotPotato = {
          square: null,
          movesUntilExplosion: 0,
          fuseMovesTotal: 0,
          respawnMovesRemaining: HOT_POTATO_RESPAWN_WAIT_MOVES,
        };

        if (explosion.outcome) {
          variantFinish = {
            outcome: explosion.outcome,
            reason: "explosion",
          };
        }
      } else {
        nextHotPotato = {
          square: movedPotatoSquare,
          movesUntilExplosion,
          fuseMovesTotal: hotPotato.fuseMovesTotal,
          respawnMovesRemaining: 0,
        };
      }
    } else if (hotPotato.respawnMovesRemaining > 0) {
      /* -----------------------------------------------------
       FIVE-MOVE COOLDOWN AFTER EXPLOSION
       ----------------------------------------------------- */
      const respawnMovesRemaining = hotPotato.respawnMovesRemaining - 1;

      if (respawnMovesRemaining === 0) {
        const nextFuseMoves = getRandomHotPotatoFuseMoves();

        nextHotPotato = {
          square: getRandomHotPotatoSquare(nextGame),
          movesUntilExplosion: nextFuseMoves,
          fuseMovesTotal: nextFuseMoves,
          respawnMovesRemaining: 0,
        };
      } else {
        nextHotPotato = {
          square: null,
          movesUntilExplosion: 0,
          fuseMovesTotal: 0,
          respawnMovesRemaining,
        };
      }
    }

    /* -----------------------------------------------------
       STANDARD CHESS RESULT
       ----------------------------------------------------- */

    const normalFinish = variantFinish ? null : getNormalFinish(nextGame);

    /* -----------------------------------------------------
       SOUND / CAPTURES
       ----------------------------------------------------- */

    let nextCapturedWhite = [...capturedWhite];
    let nextCapturedBlack = [...capturedBlack];

    if (move.captured) {
      playPieceCaptureSound(move.piece);

      if (move.color === "w") {
        nextCapturedBlack = [...nextCapturedBlack, move.captured as PieceType];
      } else {
        nextCapturedWhite = [...nextCapturedWhite, move.captured as PieceType];
      }
    } else {
      playPieceMoveSound(move.piece);
    }

    /* -----------------------------------------------------
       HISTORY ENTRY
       ----------------------------------------------------- */

    const nextPly = history.length + 1;

    const nextHistoryEntry: HotPotatoHistoryEntry = {
      ply: nextPly,
      moveNumber: Math.floor((nextPly - 1) / 2) + 1,
      color: move.color,
      san: move.san,
      piece: move.piece as PieceType,
      from: move.from as Square,
      to: move.to as Square,
      fenAfter: nextGame.fen(),
      hotPotatoAfter: cloneHotPotato(nextHotPotato),
      explosionSquaresAfter: nextExplosionSquares,
      blownUpKingSquaresAfter: nextBlownUpKingSquares,
      potatoTransferred,
      destroyedPieces,
    };

    setUndoStack((stack) => [...stack, beforeMove]);
    setGame(nextGame);
    setHotPotato(nextHotPotato);
    setExplosionSquares(nextExplosionSquares);
    setBlownUpKingSquares(nextBlownUpKingSquares);
    setLastMove({
      from: move.from as Square,
      to: move.to as Square,
    });
    setCapturedWhite(nextCapturedWhite);
    setCapturedBlack(nextCapturedBlack);
    setHistory((rows) => [...rows, nextHistoryEntry]);

    if (potatoTransferred) {
      setTransferCount((count) => count + 1);
    }

    if (nextExplosionSquares.length > 0) {
      setExplosionCount((count) => count + 1);
      setDestroyedPieceCount((count) => count + destroyedPieces.length);
    }

    setPendingPromotion(null);
    clearSelection();

    if (variantFinish) {
      setFinishedGame(variantFinish);
    } else if (normalFinish) {
      setFinishedGame(normalFinish);
    }

    return true;
  }

  /* =======================================================
     BOARD CLICK
     ======================================================= */

  function handleSquareClick(row: number, column: number) {
    if (finishedGame || historyPreview || pendingPromotion || flipPending)
      return;

    const square = getSquareName(row, column);
    const clickedPiece = game.get(square);

    if (!selectedSquare) {
      selectPiece(square);
      return;
    }

    if (square === selectedSquare) {
      clearSelection();
      return;
    }

    if (clickedPiece?.color === game.turn()) {
      selectPiece(square);
      return;
    }

    if (!legalMoves.includes(square)) {
      clearSelection();
      return;
    }

    const selectedPiece = game.get(selectedSquare);

    const reachesPromotionRank =
      selectedPiece?.type === "p" &&
      ((selectedPiece.color === "w" && square[1] === "8") ||
        (selectedPiece.color === "b" && square[1] === "1"));

    if (reachesPromotionRank) {
      setPendingPromotion({
        from: selectedSquare,
        to: square,
      });

      clearSelection();
      return;
    }

    makeMove(selectedSquare, square);
  }

  /* =======================================================
     UNDO / RESTART
     ======================================================= */

  function undoMove() {
    const snapshot = undoStack[undoStack.length - 1];

    if (!snapshot) return;

    const restoredGame = new Chess(snapshot.fen);

    setGame(restoredGame);
    snapToSide(restoredGame.turn());

    setHotPotato(cloneHotPotato(snapshot.hotPotato));
    setLastMove(snapshot.lastMove);
    setCapturedWhite([...snapshot.capturedWhite]);
    setCapturedBlack([...snapshot.capturedBlack]);
    setHistory([...snapshot.history]);
    setExplosionCount(snapshot.explosionCount);
    setTransferCount(snapshot.transferCount);
    setDestroyedPieceCount(snapshot.destroyedPieceCount);
    setFinishedGame(snapshot.finishedGame);
    setBlownUpKingSquares([...snapshot.blownUpKingSquares]);

    setUndoStack((stack) => stack.slice(0, -1));
    setExplosionSquares([]);
    setHistoryPreviewPly(null);
    setPendingPromotion(null);
    clearSelection();
  }

  function restartGame() {
    const freshGame = new Chess();

    setGame(freshGame);
    snapToSide(freshGame.turn());

    setHotPotato(createInitialHotPotatoState(freshGame));
    setExplosionSquares([]);
    setBlownUpKingSquares([]);

    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setPendingPromotion(null);
    setFinishedGame(null);

    setCapturedWhite([]);
    setCapturedBlack([]);
    setHistory([]);
    setHistoryPreviewPly(null);
    setUndoStack([]);

    setExplosionCount(0);
    setTransferCount(0);
    setDestroyedPieceCount(0);
  }

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_top,#21170f_0%,#111111_38%,#090909_100%)]
        px-4
        py-6
        text-zinc-100
        sm:px-6
        lg:px-8
      "
    >
      <div className="mx-auto max-w-[1500px]">
        {/* =================================================
            HEADER
           ================================================= */}

        <header
          className="
            mb-7
            flex
            flex-col
            gap-4
            rounded-3xl
            border
            border-white/5
            bg-zinc-900/50
            px-5
            py-4
            shadow-xl
            shadow-black/20
            backdrop-blur-md
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div className="flex items-center gap-4">
            <div
              className="
                flex
                h-12
                w-12
                items-center
                justify-center
                rounded-2xl
                border
                border-orange-500/20
                bg-orange-400/10
                text-3xl
                shadow-inner
              "
              aria-hidden="true"
            >
              💣
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-orange-400">
                Chess Variant
              </p>

              <h1 className="mt-0.5 text-2xl font-black tracking-tight text-white">
                Chess Hot Potato
              </h1>

              <p className="mt-0.5 text-sm text-zinc-500">
                Pass the danger · random fuse {HOT_POTATO_MIN_FUSE_MOVES}–
                {HOT_POTATO_MAX_FUSE_MOVES} moves
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div
              className={`
                flex
                items-center
                gap-2
                rounded-full
                border
                px-3
                py-1.5
                text-xs
                font-bold

                ${
                  displayedHotPotato.square
                    ? "border-orange-400/20 bg-orange-400/[0.07] text-orange-200"
                    : "border-sky-400/20 bg-sky-400/[0.07] text-sky-200"
                }
              `}
            >
              <span aria-hidden="true">
                {displayedHotPotato.square ? "💣" : "❄"}
              </span>

              {displayedHotPotato.square
                ? `${displayedHotPotato.movesUntilExplosion} moves left`
                : `Respawn in ${displayedHotPotato.respawnMovesRemaining}`}
            </div>

            {!finishedGame && !historyPreview && (
              <div
                className="
                  flex
                  items-center
                  gap-2
                  rounded-full
                  border
                  border-white/10
                  bg-white/5
                  px-3
                  py-1.5
                  text-xs
                  font-bold
                  text-zinc-300
                "
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                {game.turn() === "w" ? "White to move" : "Black to move"}
              </div>
            )}
          </div>
        </header>

        {/* =================================================
            MAIN LAYOUT — SAME 300px / BOARD / 300px SHELL
            AS THREE LIVES
           ================================================= */}

        <main
          className="
            grid
            gap-6
            xl:grid-cols-[300px_minmax(0,1fr)_300px]
          "
        >
          {/* ===============================================
              LEFT SIDEBAR
             =============================================== */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* GAME CONTROLS */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]" />
                    <h2 className="font-bold text-zinc-100">Game Controls</h2>
                  </div>

                  <p className="mt-1.5 text-xs text-zinc-500">
                    Players, game and actions
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={undoMove}
                      disabled={undoStack.length === 0}
                      className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 text-xs font-black text-zinc-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      Undo
                    </button>

                    <button
                      type="button"
                      onClick={restartGame}
                      className="rounded-xl border border-orange-400/15 bg-orange-400/[0.07] px-3 py-2.5 text-xs font-black text-orange-200 transition hover:bg-orange-400/10"
                    >
                      New Game
                    </button>
                  </div>
                </div>
              </section>

              {/* CAPTURED PIECES */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      Captured Pieces
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Current board material
                    </p>
                  </div>

                  <span
                    className={`rounded-xl px-2.5 py-1 text-xs font-bold ${
                      materialDifference > 0
                        ? "bg-amber-400/10 text-amber-200"
                        : materialDifference < 0
                          ? "bg-white/10 text-zinc-300"
                          : "bg-white/5 text-zinc-500"
                    }`}
                  >
                    {materialDifference > 0 && `White +${materialDifference}`}
                    {materialDifference < 0 &&
                      `Black +${Math.abs(materialDifference)}`}
                    {materialDifference === 0 && "Equal"}
                  </span>
                </div>

                <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                  <CapturedPiecesGrid
                    capturedBlack={capturedBlack}
                    capturedWhite={capturedWhite}
                  />
                </div>
              </section>

              {/* MOVE HISTORY */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-zinc-100">
                      Move History
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">Game history</p>
                  </div>

                  <span className="rounded-xl bg-white/5 px-2.5 py-1 text-xs font-semibold text-zinc-400">
                    {history.length}
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto rounded-2xl border border-white/5 bg-black/20">
                  {history.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-zinc-600">
                      No moves yet
                    </div>
                  ) : (
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 z-10 bg-zinc-900">
                        <tr className="border-b border-white/5 text-left text-[9px] font-black uppercase tracking-wider text-zinc-600">
                          <th className="px-3 py-2">Move</th>
                          <th className="px-2 py-2">Side</th>
                          <th className="px-2 py-2">Played</th>
                        </tr>
                      </thead>

                      <tbody>
                        {history.map((move) => {
                          const selected = historyPreviewPly === move.ply;

                          return (
                            <tr
                              key={move.ply}
                              tabIndex={0}
                              onClick={() => setHistoryPreviewPly(move.ply)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  setHistoryPreviewPly(move.ply);
                                }
                              }}
                              className={`cursor-pointer border-b border-white/[0.04] transition last:border-b-0 ${
                                selected
                                  ? "bg-orange-400/[0.08]"
                                  : "hover:bg-white/[0.04]"
                              }`}
                            >
                              <td className="px-3 py-2.5 text-[10px] font-black text-zinc-500">
                                {move.moveNumber}
                                {move.color === "w" ? "." : "..."}
                              </td>

                              <td className="px-2 py-2.5 text-xs text-zinc-500">
                                {move.color === "w" ? "♔" : "♚"}
                              </td>

                              <td className="px-2 py-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-center text-lg leading-none">
                                    {getHistoryPieceSymbol(
                                      move.color,
                                      move.piece,
                                    )}
                                  </span>

                                  <span className="font-mono text-xs font-bold text-zinc-200">
                                    {move.san}
                                  </span>

                                  {move.potatoTransferred && (
                                    <span className="rounded-full bg-orange-400/10 px-1.5 py-0.5 text-[9px] font-black text-orange-300">
                                      💣↔
                                    </span>
                                  )}

                                  {move.explosionSquaresAfter.length > 0 && (
                                    <span
                                      className="text-xs"
                                      aria-label="Explosion"
                                    >
                                      💥
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          </aside>

          {/* ===============================================
              CENTER BOARD
             =============================================== */}

          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {finishedGame && !historyPreview && (
                <div className="mb-3 rounded-2xl border border-amber-500/20 bg-amber-400/[0.07] px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
                        Game Over
                      </p>
                      <p className="mt-1 font-black text-white">
                        {resultText(finishedGame)}
                      </p>
                    </div>

                    <span className="text-2xl" aria-hidden="true">
                      {finishedGame.reason === "explosion" ? "💥" : "♚"}
                    </span>
                  </div>
                </div>
              )}

              {pendingPromotion && !historyPreview && (
                <div className="mb-3 rounded-2xl border border-amber-500/20 bg-zinc-900/90 p-3 shadow-xl">
                  <PromotionBar
                    onPromote={(piece) =>
                      makeMove(
                        pendingPromotion.from,
                        pendingPromotion.to,
                        piece,
                      )
                    }
                  />
                </div>
              )}

              {historyPreview && (
                <div className="mb-3 flex items-center justify-between gap-4 rounded-xl border border-blue-400/20 bg-blue-400/[0.07] px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-300">
                      History Preview
                    </p>

                    <p className="mt-1 text-sm font-bold text-white">
                      Move {historyPreview.moveNumber}
                      {historyPreview.color === "w" ? "." : "..."}{" "}
                      {historyPreview.san}
                    </p>

                    <p className="mt-1 text-[10px] font-semibold text-zinc-500">
                      {historyPreview.hotPotatoAfter.square
                        ? `💣 ${historyPreview.hotPotatoAfter.movesUntilExplosion}`
                        : `Cooldown ${historyPreview.hotPotatoAfter.respawnMovesRemaining}`}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setHistoryPreviewPly(null)}
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-zinc-200 transition hover:bg-white/20"
                  >
                    Back to Live Board
                  </button>
                </div>
              )}

              <Board
                board={displayedBoard}
                selectedSquare={historyPreview ? null : selectedSquare}
                legalMoves={historyPreview ? [] : legalMoves}
                lastMove={displayedLastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={
                  historyPreview || flipPending ? () => {} : handleSquareClick
                }
                hotPotatoSquare={displayedHotPotato.square}
                hotPotatoMovesRemaining={displayedHotPotato.movesUntilExplosion}
                hotPotatoExplosionSquares={displayedExplosionSquares}
                hotPotatoBlownUpKingSquares={displayedBlownUpKingSquares}
                orientation={boardOrientation}
              />

              {/* MOBILE STATUS */}

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/75 px-4 py-3 xl:hidden">
                <span className="text-sm text-zinc-500">Hot Potato</span>
                <span className="text-sm font-bold text-zinc-200">
                  {displayedHotPotato.square
                    ? `💣 ${displayedHotPotato.movesUntilExplosion} moves · ${displayedHotPotato.square}`
                    : `Respawn in ${displayedHotPotato.respawnMovesRemaining}`}
                </span>
              </div>
            </div>
          </section>

          {/* ===============================================
              RIGHT SIDEBAR
             =============================================== */}

          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* HOT POTATO STATUS */}

              <section className="rounded-3xl border border-orange-400/15 bg-zinc-900/80 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      Hot Potato
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Pass it before the fuse reaches zero
                    </p>
                  </div>

                  <span className="text-2xl" aria-hidden="true">
                    💣
                  </span>
                </div>

                {displayedHotPotato.square ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-orange-300/15 bg-orange-400/[0.05] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                            Current carrier
                          </p>

                          <p className="mt-2 font-mono text-2xl font-black uppercase text-white">
                            {displayedHotPotato.square}
                          </p>
                        </div>

                        <span className="text-4xl font-black leading-none text-orange-200">
                          {displayedHotPotato.movesUntilExplosion}
                        </span>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/30">
                        <div
                          className="h-full rounded-full bg-orange-400 transition-all duration-300"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(
                                100,
                                (displayedHotPotato.movesUntilExplosion /
                                  Math.max(
                                    1,
                                    displayedHotPotato.fuseMovesTotal,
                                  )) *
                                  100,
                              ),
                            )}%`,
                          }}
                        />
                      </div>

                      <p className="mt-2 text-[10px] text-zinc-600">
                        This potato started with a{" "}
                        {displayedHotPotato.fuseMovesTotal}-move fuse
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-sky-300/15 bg-sky-400/[0.05] p-4">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      Cooling down
                    </p>

                    <div className="mt-2 flex items-end justify-between gap-3">
                      <p className="text-sm font-bold text-sky-200">
                        Next potato
                      </p>
                      <span className="text-4xl font-black leading-none text-sky-200">
                        {displayedHotPotato.respawnMovesRemaining}
                      </span>
                    </div>

                    <p className="mt-2 text-[10px] text-zinc-600">
                      A new random non-king carrier appears after the cooldown.
                    </p>
                  </div>
                )}
              </section>

              {/* HOT POTATO STATS */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-black text-zinc-100">
                      Hot Potato Stats
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Chaos from this match
                    </p>
                  </div>

                  <span className="rounded-full border border-orange-400/15 bg-orange-400/[0.07] px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-orange-300">
                    {history.length} plies
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <StatCard
                    icon="💥"
                    label="Explosions"
                    value={String(explosionCount)}
                  />
                  <StatCard
                    icon="↔"
                    label="Transfers"
                    value={String(transferCount)}
                  />
                  <StatCard
                    icon="☠"
                    label="Destroyed"
                    value={String(destroyedPieceCount)}
                  />
                  <StatCard
                    icon="⏳"
                    label="Fuse"
                    value={`${HOT_POTATO_MIN_FUSE_MOVES}–${HOT_POTATO_MAX_FUSE_MOVES}`}
                    detail="random moves"
                  />
                </div>
              </section>

              {/* RULES */}

              <section className="rounded-3xl border border-white/10 bg-zinc-900/75 p-4 shadow-xl shadow-black/20 backdrop-blur-md">
                <div className="mb-4">
                  <h2 className="text-sm font-bold text-zinc-100">Rules</h2>
                  <p className="mt-1 text-xs text-zinc-500">Chess Hot Potato</p>
                </div>

                <div className="space-y-2 text-xs leading-5 text-zinc-400">
                  <RuleLine
                    icon="💣"
                    text="A random non-king piece starts as the carrier."
                  />
                  <RuleLine
                    icon="🎲"
                    text={`Each new potato gets a random fuse from ${HOT_POTATO_MIN_FUSE_MOVES} to ${HOT_POTATO_MAX_FUSE_MOVES} completed player moves.`}
                  />
                  <RuleLine
                    icon="↔"
                    text="Capture the carrier and your capturing piece inherits it."
                  />
                  <RuleLine
                    icon="💥"
                    text="The carrier square and all 8 adjacent squares explode."
                  />
                  <RuleLine
                    icon="♔"
                    text="If exactly one king is in the blast radius, that player loses."
                  />
                  <RuleLine
                    icon="♔♚"
                    text="If both kings are in the radius, the game is a draw."
                  />
                  <RuleLine
                    icon="❄"
                    text="After an explosion, 5 moves pass before the next potato appears."
                  />
                </div>
              </section>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

/* =========================================================
   SMALL UI COMPONENTS
   ========================================================= */

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: string;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg" aria-hidden="true">
          {icon}
        </span>
        <span className="text-xl font-black text-white">{value}</span>
      </div>

      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-zinc-600">
        {label}
      </p>

      {detail && <p className="mt-0.5 text-[10px] text-zinc-700">{detail}</p>}
    </div>
  );
}

function RuleLine({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex gap-2 rounded-xl border border-white/[0.04] bg-black/15 px-3 py-2">
      <span className="w-7 shrink-0 text-center font-black text-orange-300">
        {icon}
      </span>
      <span>{text}</span>
    </div>
  );
}

function CapturedPiecesGrid({
  capturedBlack,
  capturedWhite,
}: {
  capturedBlack: PieceType[];
  capturedWhite: PieceType[];
}) {
  const whiteSymbols: Record<PieceType, string> = {
    p: "♙",
    n: "♘",
    b: "♗",
    r: "♖",
    q: "♕",
    k: "♔",
  };

  const blackSymbols: Record<PieceType, string> = {
    p: "♟",
    n: "♞",
    b: "♝",
    r: "♜",
    q: "♛",
    k: "♚",
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          White
        </span>
        <div className="flex min-h-7 flex-wrap gap-1 text-xl leading-none text-[#fff3d5]">
          {capturedWhite.length === 0 ? (
            <span className="text-xs text-zinc-700">—</span>
          ) : (
            capturedWhite.map((piece, index) => (
              <span key={`${piece}-${index}`}>{whiteSymbols[piece]}</span>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
          Black
        </span>
        <div className="flex min-h-7 flex-wrap gap-1 text-xl leading-none text-zinc-300">
          {capturedBlack.length === 0 ? (
            <span className="text-xs text-zinc-700">—</span>
          ) : (
            capturedBlack.map((piece, index) => (
              <span key={`${piece}-${index}`}>{blackSymbols[piece]}</span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
