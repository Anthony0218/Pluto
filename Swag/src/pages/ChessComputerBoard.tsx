import { useCallback, useEffect, useRef, useState } from "react";

import { Chess, type Square } from "chess.js";

import Board from "../components/Board";
import CapturedPieces from "../components/CapturedPieces";
import MoveHistory from "../components/MoveHistory";
import PromotionBar from "../components/PromotionBar";

import { getSquareName, type PieceType } from "../utils/chessUtils";

import { useStockfish } from "@/hooks/useStockfish";

type GameResult = {
  title: string;
  message: string;
  winner: "human" | "stockfish" | "draw";
};

type ChessComputerBoardProps = {
  playerColor: "white" | "black";
  skillLevel: number;
  onChangeSettings: () => void;
};

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

const pieceValueList = [
  { type: "p", symbol: "♙", name: "Pawn" },
  { type: "n", symbol: "♘", name: "Knight" },
  { type: "b", symbol: "♗", name: "Bishop" },
  { type: "r", symbol: "♖", name: "Rook" },
  { type: "q", symbol: "♕", name: "Queen" },
  { type: "k", symbol: "♔", name: "King" },
];

export default function ChessComputerBoard({
  playerColor,
  skillLevel,
  onChangeSettings,
}: ChessComputerBoardProps) {
  const [game] = useState(() => new Chess());

  /*
   * position exists mainly to trigger React renders after
   * chess.js mutates the Chess object.
   */
  const [position, setPosition] = useState(game.fen());

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);

  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);
  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);

  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);

  const { ready, thinking, setSkillLevel, getBestMove } = useStockfish();
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  const [showResignConfirm, setShowResignConfirm] = useState(false);

  /*
   * Important:
   * Stockfish might already be calculating when the
   * player resigns. This ref prevents that result from
   * being applied afterwards.
   */
  const gameEndedRef = useRef(false);

  const humanColor = playerColor === "white" ? "w" : "b";

  const computerColor = humanColor === "w" ? "b" : "w";

  const board = game.board();

  /*
   * Material score.
   */
  const whiteMaterial = capturedBlack.reduce(
    (total, piece) => total + (pieceValues[piece] ?? 0),
    0,
  );

  const blackMaterial = capturedWhite.reduce(
    (total, piece) => total + (pieceValues[piece] ?? 0),
    0,
  );

  const materialDifference = whiteMaterial - blackMaterial;

  /*
   * Find checked king so your existing Board component
   * can display the same check styling as Hotseat.
   */
  const checkedKingSquare: Square | null = game.isCheck()
    ? (() => {
        const kingColor = game.turn();

        for (let row = 0; row < board.length; row++) {
          for (let column = 0; column < board[row].length; column++) {
            const piece = board[row][column];

            if (piece?.type === "k" && piece.color === kingColor) {
              return getSquareName(row, column);
            }
          }
        }

        return null;
      })()
    : null;

  /*
   * Set Stockfish strength whenever it becomes ready
   * or difficulty changes.
   */
  useEffect(() => {
    if (!ready) {
      return;
    }

    setSkillLevel(skillLevel);
  }, [ready, skillLevel, setSkillLevel]);

  const makeComputerMove = useCallback(async () => {
    if (gameEndedRef.current) {
      return;
    }

    if (!ready) {
      return;
    }

    if (game.isGameOver()) {
      return;
    }

    if (game.turn() !== computerColor) {
      return;
    }

    const stockfishMove = await getBestMove(game.fen(), 600);
    if (gameEndedRef.current) {
      return;
    }

    if (!stockfishMove) {
      return;
    }

    try {
      const move = game.move({
        from: stockfishMove.from,
        to: stockfishMove.to,
        promotion: stockfishMove.promotion ?? "q",
      });

      setLastMove({
        from: move.from,
        to: move.to,
      });

      if (move.captured) {
        if (move.color === "w") {
          setCapturedBlack((pieces) => [...pieces, move.captured as PieceType]);
        } else {
          setCapturedWhite((pieces) => [...pieces, move.captured as PieceType]);
        }
      }

      setMoveHistory(game.history());

      setPosition(game.fen());
    } catch (error) {
      console.error("Invalid Stockfish move:", stockfishMove, error);
    }
  }, [ready, game, computerColor, getBestMove]);
  useEffect(() => {
    if (gameResult) {
      return;
    }

    if (!game.isGameOver()) {
      return;
    }

    if (game.isCheckmate()) {
      const humanLost = game.turn() === humanColor;

      finishGame({
        title: "Checkmate",
        message: humanLost ? "Stockfish wins." : "You defeated Stockfish.",
        winner: humanLost ? "stockfish" : "human",
      });

      return;
    }

    if (game.isStalemate()) {
      finishGame({
        title: "Draw",
        message: "The game ended in stalemate.",
        winner: "draw",
      });

      return;
    }

    if (game.isThreefoldRepetition()) {
      finishGame({
        title: "Draw",
        message: "Threefold repetition.",
        winner: "draw",
      });

      return;
    }

    if (game.isInsufficientMaterial()) {
      finishGame({
        title: "Draw",
        message: "Insufficient material.",
        winner: "draw",
      });

      return;
    }

    if (game.isDrawByFiftyMoves()) {
      finishGame({
        title: "Draw",
        message: "50-move rule.",
        winner: "draw",
      });

      return;
    }

    if (game.isDraw()) {
      finishGame({
        title: "Draw",
        message: "The game ended in a draw.",
        winner: "draw",
      });
    }
  }, [position, game, gameResult, humanColor]);
  /*
   * This also makes Stockfish automatically move first
   * when the human selects Black.
   */
  useEffect(() => {
    if (!ready || thinking) {
      return;
    }

    if (!game.isGameOver() && game.turn() === computerColor) {
      void makeComputerMove();
    }
  }, [ready, thinking, position, game, computerColor, makeComputerMove]);
  function resignGame() {
    finishGame({
      title: "You resigned",
      message: "Stockfish wins by resignation.",
      winner: "stockfish",
    });
  }
  function handleSquareClick(row: number, column: number) {
    if (!ready || thinking) {
      return;
    }
    if (gameEndedRef.current) {
      return;
    }

    if (promotionFrom && promotionSquare) {
      return;
    }

    if (game.isGameOver()) {
      return;
    }

    if (game.turn() !== humanColor) {
      return;
    }

    const square = getSquareName(row, column);

    const clickedPiece = game.get(square);

    /*
     * Select a piece.
     */
    if (selectedSquare === null) {
      if (!clickedPiece) {
        return;
      }

      if (clickedPiece.color !== humanColor) {
        return;
      }

      setSelectedSquare(square);

      const moves = game.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    /*
     * Clicking another own piece changes selection.
     */
    if (clickedPiece && clickedPiece.color === humanColor) {
      setSelectedSquare(square);

      const moves = game.moves({
        square,
        verbose: true,
      });

      setLegalMoves(moves.map((move) => move.to));

      return;
    }

    const selectedPiece = game.get(selectedSquare);

    if (
      selectedPiece?.type === "p" &&
      legalMoves.includes(square) &&
      (square[1] === "8" || square[1] === "1")
    ) {
      setPromotionFrom(selectedSquare);
      setPromotionSquare(square);

      setSelectedSquare(null);
      setLegalMoves([]);

      return;
    }
    try {
      const move = game.move({
        from: selectedSquare,
        to: square,
      });

      setLastMove({
        from: move.from,
        to: move.to,
      });

      if (move.captured) {
        if (move.color === "w") {
          setCapturedBlack((pieces) => [...pieces, move.captured as PieceType]);
        } else {
          setCapturedWhite((pieces) => [...pieces, move.captured as PieceType]);
        }
      }

      setMoveHistory(game.history());

      setSelectedSquare(null);
      setLegalMoves([]);

      setPosition(game.fen());
    } catch {
      /*
       * Illegal move.
       */
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }
  function finishGame(result: GameResult) {
    gameEndedRef.current = true;

    setGameResult(result);

    setSelectedSquare(null);
    setLegalMoves([]);

    setPromotionFrom(null);
    setPromotionSquare(null);

    setShowResignConfirm(false);
  }
  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare) {
      return;
    }

    try {
      const move = game.move({
        from: promotionFrom,
        to: promotionSquare,
        promotion: piece,
      });

      setLastMove({
        from: move.from,
        to: move.to,
      });

      if (move.captured) {
        if (move.color === "w") {
          setCapturedBlack((pieces) => [...pieces, move.captured as PieceType]);
        } else {
          setCapturedWhite((pieces) => [...pieces, move.captured as PieceType]);
        }
      }

      setMoveHistory(game.history());

      setPromotionFrom(null);
      setPromotionSquare(null);

      setSelectedSquare(null);
      setLegalMoves([]);

      /*
       * This changes position, which causes the existing
       * Stockfish effect to notice it is now the computer's turn.
       */
      setPosition(game.fen());
    } catch (error) {
      console.error("Promotion failed:", error);

      setPromotionFrom(null);
      setPromotionSquare(null);
    }
  }

  function restartGame() {
    gameEndedRef.current = false;

    game.reset();

    setGameResult(null);
    setShowResignConfirm(false);

    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);

    setPromotionFrom(null);
    setPromotionSquare(null);

    setCapturedWhite([]);
    setCapturedBlack([]);

    setMoveHistory([]);

    setPosition(game.fen());
  }

  function getGameStatus() {
    if (!ready) {
      return "Stockfish loading...";
    }

    if (game.isCheckmate()) {
      return game.turn() === humanColor
        ? "Checkmate — Stockfish wins"
        : "Checkmate — You win";
    }

    if (game.isStalemate()) {
      return "Draw — Stalemate";
    }

    if (game.isThreefoldRepetition()) {
      return "Draw — Threefold repetition";
    }

    if (game.isInsufficientMaterial()) {
      return "Draw — Insufficient material";
    }

    if (game.isDraw()) {
      return "Draw";
    }

    if (thinking) {
      return "Stockfish is thinking...";
    }

    if (game.isCheck()) {
      return game.turn() === humanColor
        ? "Your king is in check"
        : "Stockfish is in check";
    }

    return game.turn() === humanColor ? "Your turn" : "Stockfish's turn";
  }

  return (
    <div className="w-full">
      <main
        className="
          grid
          gap-6
          xl:grid-cols-[320px_minmax(0,1fr)_320px]
        "
      >
        {/* LEFT SIDEBAR */}

        <aside className="min-w-0">
          <div className="space-y-4 xl:sticky xl:top-6">
            {/* PLAYERS */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <h2 className="text-sm font-semibold text-zinc-200">Players</h2>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-zinc-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">You</span>

                    <span className="text-xl">
                      {humanColor === "w" ? "♔" : "♚"}
                    </span>
                  </div>

                  <p className="mt-1 font-semibold text-white">
                    {humanColor === "w" ? "White" : "Black"}
                  </p>
                </div>

                <div className="rounded-xl bg-zinc-950/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Computer</span>

                    <span className="text-xl">
                      {computerColor === "w" ? "♔" : "♚"}
                    </span>
                  </div>

                  <p className="mt-1 font-semibold text-white">Stockfish</p>
                </div>
              </div>
            </section>

            {/* CAPTURED PIECES */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Captured Pieces
                </h2>

                <span className="text-xs text-zinc-500">
                  {materialDifference > 0 && `White +${materialDifference}`}

                  {materialDifference < 0 &&
                    `Black +${Math.abs(materialDifference)}`}

                  {materialDifference === 0 && "Equal"}
                </span>
              </div>

              <CapturedPieces
                capturedBlack={capturedBlack}
                capturedWhite={capturedWhite}
              />
            </section>

            {/* MOVE HISTORY */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Move History
                </h2>

                <span className="text-xs text-zinc-500">
                  {moveHistory.length} moves
                </span>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <MoveHistory moves={moveHistory} />
              </div>
            </section>
          </div>
        </aside>

        {/* CENTER */}

        <section className="min-w-0">
          <div className="mx-auto max-w-[820px]">
            {/* STATUS */}

            <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span
                  className={
                    thinking
                      ? "font-semibold text-amber-300"
                      : game.turn() === humanColor
                        ? "font-semibold text-emerald-300"
                        : "font-semibold text-zinc-200"
                  }
                >
                  {getGameStatus()}
                </span>

                <span className="text-xs text-zinc-500">
                  Skill {skillLevel}
                </span>
              </div>
            </div>

            {promotionFrom && promotionSquare && (
              <div className="mb-3">
                <PromotionBar onPromote={promotePawn} />
              </div>
            )}

            {/* BOARD */}

            <div className="relative">
              <Board
                board={board}
                selectedSquare={selectedSquare}
                legalMoves={legalMoves}
                lastMove={lastMove}
                checkedKingSquare={checkedKingSquare}
                onSquareClick={handleSquareClick}
                orientation={playerColor}
              />
              {gameResult && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/75 p-6 backdrop-blur-sm">
                  <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900/95 p-8 text-center shadow-2xl">
                    <div className="text-5xl">
                      {gameResult.winner === "human"
                        ? "♔"
                        : gameResult.winner === "stockfish"
                          ? "♚"
                          : "½"}
                    </div>

                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-amber-400">
                      Game Over
                    </p>

                    <h2 className="mt-2 text-3xl font-black text-white">
                      {gameResult.title}
                    </h2>

                    <p className="mt-3 text-zinc-400">{gameResult.message}</p>

                    <button
                      type="button"
                      onClick={restartGame}
                      className="mt-7 w-full rounded-xl bg-amber-400 px-5 py-3 font-black text-zinc-950 transition hover:bg-amber-300"
                    >
                      Play Again
                    </button>

                    <button
                      type="button"
                      onClick={onChangeSettings}
                      className="mt-3 w-full rounded-xl bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20"
                    >
                      Change Settings
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT SIDEBAR */}

        <aside className="min-w-0">
          <div className="space-y-4 xl:sticky xl:top-6">
            {/* PIECE VALUES */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-200">
                  Piece Values
                </h2>

                <span className="text-xs text-zinc-600">Material</span>
              </div>

              <div className="space-y-1">
                {pieceValueList.map((piece) => (
                  <div
                    key={piece.type}
                    className="flex items-center justify-between rounded-xl px-3 py-2 transition-colors hover:bg-zinc-800/70"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center text-2xl text-zinc-200">
                        {piece.symbol}
                      </span>

                      <span className="text-sm text-zinc-300">
                        {piece.name}
                      </span>
                    </div>

                    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400">
                      {pieceValues[piece.type]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-zinc-800 pt-4">
                <div className="flex items-center justify-between rounded-xl bg-zinc-950/60 px-3 py-3">
                  <span className="text-sm text-zinc-500">Advantage</span>

                  <span className="text-sm font-semibold text-zinc-200">
                    {materialDifference > 0 && `White +${materialDifference}`}

                    {materialDifference < 0 &&
                      `Black +${Math.abs(materialDifference)}`}

                    {materialDifference === 0 && "Equal"}
                  </span>
                </div>
              </div>
            </section>

            {/* GAME CONTROLS */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-xl shadow-black/10">
              <h2 className="font-semibold text-white">Game Controls</h2>

              <p className="mt-1 text-xs text-zinc-500">
                Stockfish game settings
              </p>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-zinc-950/60 px-3 py-3">
                  <span className="text-sm text-zinc-500">Difficulty</span>

                  <span className="text-sm font-semibold text-white">
                    Skill {skillLevel}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-zinc-950/60 px-3 py-3">
                  <span className="text-sm text-zinc-500">Side</span>

                  <span className="text-sm font-semibold text-white">
                    {playerColor === "white" ? "White" : "Black"}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={thinking}
                  onClick={restartGame}
                  className="
                    w-full
                    rounded-xl
                    bg-white/10
                    px-4
                    py-3
                    text-sm
                    font-semibold
                    text-white
                    transition
                    hover:bg-white/20
                    disabled:cursor-not-allowed
                    disabled:opacity-40
                  "
                >
                  New Game
                </button>
                <button
                  type="button"
                  disabled={thinking || gameResult !== null}
                  onClick={() => setShowResignConfirm(true)}
                  className="
    w-full
    rounded-xl
    border
    border-red-500/20
    bg-red-500/10
    px-4
    py-3
    text-sm
    font-semibold
    text-red-300
    transition
    hover:bg-red-500/20
    disabled:opacity-40
  "
                >
                  Resign
                </button>
              </div>
            </section>
            {showResignConfirm && !gameResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
                <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-zinc-900 p-7 text-center shadow-2xl">
                  <div className="text-4xl">⚑</div>

                  <h2 className="mt-4 text-2xl font-black text-white">
                    Resign game?
                  </h2>

                  <p className="mt-2 text-sm text-zinc-400">
                    Stockfish will win the game.
                  </p>

                  <div className="mt-7 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowResignConfirm(false)}
                      className="rounded-xl bg-white/10 px-4 py-3 font-semibold text-white hover:bg-white/20"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      onClick={resignGame}
                      className="rounded-xl bg-red-500 px-4 py-3 font-bold text-white hover:bg-red-400"
                    >
                      Resign
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
