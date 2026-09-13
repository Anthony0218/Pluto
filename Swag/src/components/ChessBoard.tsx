import { useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";

import { supabase } from "../lib/supabase";
import { getSquareName, getReadableMove } from "../utils/chessUtils";
import { useStockfish } from "../hooks/useStockfish.ts";
import Board from "./Board.tsx";
import CapturedPieces from "./CapturedPieces.tsx";
import type { PieceType } from "../utils/chessUtils.ts";
import {
  playPieceSelectSound,
  playPieceMoveSound,
  playPieceCaptureSound,
  playRandomSound,
} from "../utils/sound.ts";
import PromotionBar from "./PromotionBar";
import GameControls from "./GameControls.tsx";
import MoveHistory from "./MoveHistory.tsx";
import GameStatus from "./GameStatus.tsx";
import { useAuth } from "../context/AuthContext";
import playButton from "../assets/trash-button.svg";
import loadButton from "../assets/load-button.svg";

type SavedGame = {
  id: string;
  user_id: string;
  created_at: string;
  name: string | null;
  white_player: string | null;
  black_player: string | null;
  fen: string;
  moves: string[];
  white_check_counter: number;
  black_check_counter: number;
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

type ChessBoardProps = {
  onlineGameId?: string;
};

export default function ChessBoard({ onlineGameId }: ChessBoardProps) {
  const { user, profile } = useAuth();
  const [playerColor, setPlayerColor] = useState<"w" | "b" | null>(null);
  useEffect(() => {
    if (!onlineGameId || !user) {
      return;
    }

    async function loadOnlineGame() {
      const { data, error } = await supabase
        .from("online_games")
        .select("white_player, black_player, fen, moves, status")
        .eq("id", onlineGameId)
        .single();

      if (error) {
        console.error("Error loading online game:", error);
        return;
      }

      if (data.white_player === user?.id) {
        setPlayerColor("w");
      } else if (data.black_player === user?.id) {
        setPlayerColor("b");
      }

      game.reset();

      for (const move of data.moves ?? []) {
        game.move(move);
      }

      setPosition(game.fen());
      setMoveHistory(game.history());
    }

    loadOnlineGame();
  }, [onlineGameId, user]);

  useEffect(() => {
    if (user) {
      loadSavedGames();
    }
  }, [user]);

  const {
    evaluation,
    bestMove,
    moveRating,
    analyzePosition,
    setPlayerMoveColor,
    clearMoveAnalysis,
    resetAnalysis,
  } = useStockfish();

  useEffect(() => {
    analyzePosition(game.fen(), "position");
  }, []);

  useEffect(() => {
    analyzePosition(game.fen(), "before");
  }, []);

  async function saveGame() {
    if (!user) {
      console.error("You must be logged in to save a game.");
      return;
    }

    const gameData = {
      user_id: user?.id,
      name: gameName || "Unnamed Game",
      white_player: whitePlayer || profile?.username || "White",
      black_player: blackPlayer || "Black",
      fen: game.fen(),
      moves: game.history(),
      white_check_counter: whiteCheckCounter,
      black_check_counter: blackCheckCounter,
    };

    if (currentGameId) {
      // UPDATE existing game
      const { data, error } = await supabase
        .from("games")
        .update(gameData)
        .eq("id", currentGameId)
        .select()
        .single();

      if (error) {
        console.error("Error updating game:", error);
        return;
      }

      console.log("Game updated:", data);
    } else {
      // INSERT new game
      const { data, error } = await supabase
        .from("games")
        .insert(gameData)
        .select()
        .single();

      if (error) {
        console.error("Error saving game:", error);
        return;
      }

      console.log("Game created:", data);

      setCurrentGameId(data.id);
    }

    await loadSavedGames();
  }
  function rebuildCapturedPieces() {
    const whiteCaptured: PieceType[] = [];
    const blackCaptured: PieceType[] = [];

    for (const move of game.history({ verbose: true })) {
      if (move.captured) {
        if (move.color === "w") {
          blackCaptured.push(move.captured as PieceType);
        } else {
          whiteCaptured.push(move.captured as PieceType);
        }
      }
    }

    setCapturedWhite(whiteCaptured);
    setCapturedBlack(blackCaptured);
  }

  async function loadSpecificGame(id: string) {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error loading game:", error);
      return;
    }
    if (!data) {
      return;
    }
    game.reset();

    for (const move of data.moves) {
      game.move(move);
    }
    setGameName(data.name ?? "");
    setWhitePlayer(data.white_player ?? "");
    setBlackPlayer(data.black_player ?? "");
    setCurrentGameId(data.id);
    setWhiteCheckCounter(data.white_check_counter ?? 0);
    setBlackCheckCounter(data.black_check_counter ?? 0);
    setPosition(game.fen());
    setMoveHistory(game.history());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setIllegal(false);
    resetAnalysis();

    analyzePosition(game.fen(), "position");
  }
  async function sendMove(moveHistory: string[]) {
    // update Supabase
  }

  async function loadSavedGames() {
    if (!user) {
      return;
    }

    const { data, error } = await supabase
      .from("games")
      .select(
        "id, created_at, name, white_player, black_player, fen, moves, white_check_counter, black_check_counter, user_id",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading saved games:", error);
      return;
    }

    setSavedGames(data ?? []);
    rebuildCapturedPieces();
  }

  function restartGame() {
    game.reset();

    setPosition(game.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setIllegal(false);
    setCapturedWhite([]);
    setCapturedBlack([]);
    setMoveHistory([]);
    setPromotionFrom(null);
    setPromotionSquare(null);
    setWinner("w");
    setGameOver(false);
    setGameOverReason("");
    setWhiteCheckCounter(0);
    setBlackCheckCounter(0);
    setCurrentGameId(null);
    resetAnalysis();
    setGameName("");
    setWhitePlayer("");
    setBlackPlayer("");
  }
  function undoMove() {
    const move = game.undo();

    if (!move) {
      return;
    }

    resetAnalysis();

    setPosition(game.fen());
    setSelectedSquare(null);
    setLegalMoves([]);
    setMoveHistory(game.history());

    const history = game.history({ verbose: true });

    if (history.length === 0) {
      setLastMove(null);
    } else {
      const previousMove = history[history.length - 1];

      setLastMove({
        from: previousMove.from,
        to: previousMove.to,
      });
    }
    checkGameOver();
    analyzePosition(game.fen(), "position");
  }

  async function deleteGame(id: string) {
    const { data, error } = await supabase
      .from("games")
      .delete()
      .eq("id", id)
      .select();

    if (error) {
      console.error("Error deleting game:", error);
      return;
    }

    setSavedGames((games) => games.filter((game) => game.id !== id));
  }

  function playSound(sound: string) {
    const audio = new Audio(`/sounds/${sound}.mp3`);
    audio.play().catch(() => {});
  }
  function promotePawn(piece: "q" | "r" | "b" | "n") {
    if (!promotionFrom || !promotionSquare) {
      return;
    }

    try {
      const capturedPiece = game.get(promotionSquare);

      const move = game.move({
        from: promotionFrom,
        to: promotionSquare,
        promotion: piece,
      });

      setLastMove({
        from: move.from,
        to: move.to,
      });

      setMoveHistory(game.history());
      setPosition(game.fen());

      setPromotionFrom(null);
      setPromotionSquare(null);
    } catch {
      console.log("Invalid promotion");
    }
  }
  function checkGameOver() {
    if (game.isCheckmate()) {
      setGameOver(true);
      setGameOverReason("Checkmate");

      if (game.turn() === "w") {
        setWinner("black");
      } else {
        setWinner("white");
      }

      playSound("checkmate");
      return;
    }

    if (game.isStalemate()) {
      setGameOver(true);
      setGameOverReason("Stalemate");
      playSound("draw");
      return;
    }

    if (game.isThreefoldRepetition()) {
      setGameOver(true);
      setGameOverReason("Threefold repetition");
      playSound("draw");
      return;
    }

    if (game.isInsufficientMaterial()) {
      setGameOver(true);
      setGameOverReason("Insufficient material");
      playSound("draw");
      return;
    }

    if (game.isDrawByFiftyMoves()) {
      setGameOver(true);
      setGameOverReason("50-move rule");
      playSound("draw");
      return;
    }
  }

  function getEvaluationPercentage() {
    if (evaluation === null) {
      return 50;
    }

    // Convert the evaluation into a percentage.
    // Clamp it so the bar never goes completely beyond the board.
    const percentage = 50 + evaluation * 10;

    return Math.max(5, Math.min(95, percentage));
  }

  const [game] = useState(() => new Chess());
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{
    from: Square;
    to: Square;
  } | null>(null);

  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [gameName, setGameName] = useState("");

  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [capturedWhite, setCapturedWhite] = useState<PieceType[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<PieceType[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const whiteMaterial = capturedBlack.reduce(
    (total, piece) => total + pieceValues[piece],
    0,
  );

  const blackMaterial = capturedWhite.reduce(
    (total, piece) => total + pieceValues[piece],
    0,
  );
  const materialDifference = whiteMaterial - blackMaterial;
  const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
  const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameOverReason, setGameOverReason] = useState("");
  const [whitePlayer, setWhitePlayer] = useState("");
  const [blackPlayer, setBlackPlayer] = useState("");

  const [illegal, setIllegal] = useState(false);
  const [position, setPosition] = useState(game.fen());
  const [whiteCheckCounter, setWhiteCheckCounter] = useState<number>(0);
  const [blackCheckCounter, setBlackCheckCounter] = useState<number>(0);

  const [winner, setWinner] = useState<string>("w");

  const board = game.board();

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

  function handleSquareClick(row: number, column: number) {
    if (gameOver) {
      return;
    }
    if (onlineGameId && playerColor) {
      if (game.turn() !== playerColor) {
        return;
      }
    }

    const square = getSquareName(row, column);

    if (selectedSquare === null) {
      const piece = game.get(square);

      if (piece) {
        setSelectedSquare(square);

        playPieceSelectSound(piece.type);

        setPlayerMoveColor(game.turn());
        clearMoveAnalysis();

        const moves = game.moves({
          square,
          verbose: true,
        });

        setLegalMoves(moves.map((move) => move.to));

        analyzePosition(game.fen(), "position");
      }

      return;
    }

    try {
      const selectedPiece = game.get(selectedSquare);

      if (
        selectedPiece?.type === "p" &&
        legalMoves.includes(square) &&
        (square[1] === "8" || square[1] === "1")
      ) {
        setPromotionFrom(selectedSquare);
        setPromotionSquare(square);
        setSelectedSquare(null);
        return;
      }

      const capturedPiece = game.get(square);

      const move = game.move({
        from: selectedSquare,
        to: square,
      });
      setLastMove({
        from: move.from,
        to: move.to,
      });

      if (move.captured) {
        playPieceCaptureSound(move.piece);
      } else {
        playPieceMoveSound(move.piece);
      }

      setMoveHistory(game.history());

      if (move.captured) {
        if (move.color === "w") {
          setCapturedBlack((pieces) => [...pieces, move.captured!]);
        } else {
          setCapturedWhite((pieces) => [...pieces, move.captured!]);
        }
      }

      setIllegal(false);
      if (capturedPiece) {
      }
      if (game.isCheckmate()) {
        if (game.turn() === "w") {
          setWinner("black");
        } else {
          setWinner("white");
        }

        playSound("checkmate");
      } else if (game.isCheck()) {
        if (game.turn() === "w") {
          setWhiteCheckCounter((counter) => counter + 1);
        } else {
          setBlackCheckCounter((counter) => counter + 1);
        }
        playSound("check");
      } else if (move.isKingsideCastle() || move.isQueensideCastle()) {
        playRandomSound(["castle-1", "castle-2"]);
      }
      setPosition(game.fen());
      analyzePosition(game.fen(), "after");
    } catch {
      console.log("Illegal move");
      setIllegal(true);
      playSound("illegal");
      setLegalMoves([]);
      setSelectedSquare(null);
    }
    setLegalMoves([]);
    setSelectedSquare(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Chess
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              Play, analyse and review your games
            </p>
          </div>

          <div className="flex items-center gap-2">
            {moveRating && (
              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300">
                {moveRating}
              </div>
            )}

            {bestMove && (
              <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300">
                Best: <span className="font-medium text-white">{bestMove}</span>
              </div>
            )}
          </div>
        </header>

        {/* Main layout */}
        <main className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          {/* LEFT SIDEBAR */}
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* Saved Games */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70">
                <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-200">
                      Saved Games
                    </h2>

                    <p className="mt-0.5 text-xs text-zinc-500">
                      {savedGames.length}{" "}
                      {savedGames.length === 1 ? "game" : "games"}
                    </p>
                  </div>
                </div>

                <div className="max-h-80 space-y-1 overflow-y-auto p-2">
                  {savedGames.length === 0 && (
                    <div className="py-8 text-center">
                      <p className="text-sm text-zinc-500">
                        No saved games yet
                      </p>
                    </div>
                  )}

                  {savedGames.map((savedGame) => (
                    <div
                      key={savedGame.id}
                      className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-zinc-800/70"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">
                          {savedGame.name || "Unnamed Game"}
                        </p>

                        <p className="mt-1 truncate text-xs text-zinc-500">
                          ♔ {savedGame.white_player || "White"}
                          <span className="mx-1.5 text-zinc-700">vs</span>♚{" "}
                          {savedGame.black_player || "Black"}
                        </p>

                        <p className="mt-1 text-[11px] text-zinc-600">
                          {new Date(savedGame.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => loadSpecificGame(savedGame.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 transition hover:bg-zinc-700"
                          title="Load game"
                        >
                          <img
                            src={loadButton}
                            alt="Load"
                            className="h-4 w-4"
                          />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteGame(savedGame.id)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 transition hover:border-red-900 hover:bg-red-950/60"
                          title="Delete game"
                        >
                          <img
                            src={playButton}
                            alt="Delete"
                            className="h-4 w-4"
                          />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Captured Pieces */}
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

              {/* Move History */}
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
              {/* Game Status */}
              <div className="mb-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                <GameStatus
                  illegal={illegal}
                  whiteCheckCounter={whiteCheckCounter}
                  blackCheckCounter={blackCheckCounter}
                  gameOver={gameOver}
                  gameOverReason={gameOverReason}
                  winner={winner}
                />
              </div>

              {/* Evaluation */}
              <div className="mb-3 flex items-center gap-3">
                <span className="w-10 text-right text-xs font-medium text-zinc-500">
                  {evaluation !== null
                    ? evaluation > 0
                      ? `+${evaluation.toFixed(1)}`
                      : evaluation.toFixed(1)
                    : "0.0"}
                </span>

                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="absolute inset-y-0 left-0 bg-zinc-200 transition-all duration-300"
                    style={{ width: `${getEvaluationPercentage()}%` }}
                  />
                </div>
              </div>

              {/* Promotion */}
              {promotionSquare && promotionFrom && (
                <div className="mb-3">
                  <PromotionBar onPromote={promotePawn} />
                </div>
              )}

              {/* Board */}
              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl shadow-black/30 sm:p-3">
                <Board
                  board={board}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  lastMove={lastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={handleSquareClick}
                />
              </div>
            </div>
          </section>

          {/* RIGHT SIDEBAR */}
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* Piece Values */}
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

              {/* Game Controls */}
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-xl shadow-black/10">
                <div className="mb-4">
                  <h2 className="font-semibold text-white">Game Controls</h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    Players, game name and actions
                  </p>
                </div>

                <GameControls
                  gameName={gameName}
                  whitePlayer={whitePlayer}
                  blackPlayer={blackPlayer}
                  onGameNameChange={setGameName}
                  onWhitePlayerChange={setWhitePlayer}
                  onBlackPlayerChange={setBlackPlayer}
                  onUndo={undoMove}
                  onRestart={restartGame}
                  onSave={saveGame}
                />
              </section>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
