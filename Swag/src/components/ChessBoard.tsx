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
    <div className="min-h-screen bg-zinc-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        {/* HEADER */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-3xl text-sky-300 ring-1 ring-sky-500/20">
              ♞
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Schach
              </h1>

              <p className="mt-0.5 text-sm text-slate-400">
                Spielen, analysieren und verbessern.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {moveRating && (
              <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 shadow-sm">
                {moveRating}
              </div>
            )}

            {bestMove && (
              <div className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm text-sky-300">
                Bester Zug:
                <span className="ml-1 font-semibold text-sky-200">
                  {bestMove}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* MAIN LAYOUT */}
        <main className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
          {/* =========================================================
            LEFT SIDEBAR
        ========================================================= */}
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* SAVED GAMES */}
              <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/90 shadow-lg shadow-black/15">
                <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Gespeicherte Partien
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {savedGames.length}{" "}
                      {savedGames.length === 1 ? "Partie" : "Partien"}
                    </p>
                  </div>

                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/60 text-sm text-sky-300">
                    {savedGames.length}
                  </div>
                </div>

                <div className="max-h-80 space-y-1 overflow-y-auto p-2">
                  {savedGames.length === 0 && (
                    <div className="py-8 text-center">
                      <div className="mb-2 text-3xl text-slate-600">♟</div>

                      <p className="text-sm text-slate-400">
                        Noch keine gespeicherten Partien
                      </p>
                    </div>
                  )}

                  {savedGames.map((savedGame) => (
                    <div
                      key={savedGame.id}
                      className="
                      group flex items-center gap-3
                      rounded-xl p-3
                      transition-all duration-200
                      hover:translate-x-0.5
                      hover:bg-slate-700/70
                    "
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {savedGame.name || "Unbenannte Partie"}
                        </p>

                        <p className="mt-1 truncate text-xs text-slate-400">
                          <span className="text-amber-100">♔</span>{" "}
                          {savedGame.white_player || "Weiß"}
                          <span className="mx-1.5 text-slate-600">vs</span>
                          <span className="text-sky-400">♚</span>{" "}
                          {savedGame.black_player || "Schwarz"}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-500">
                          {new Date(savedGame.created_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => loadSpecificGame(savedGame.id)}
                          className="
                          flex h-8 w-8 items-center justify-center
                          rounded-lg
                          border border-slate-600
                          bg-slate-700
                          transition
                          hover:border-sky-500/50
                          hover:bg-slate-600
                        "
                          title="Partie laden"
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
                          className="
                          flex h-8 w-8 items-center justify-center
                          rounded-lg
                          border border-slate-600
                          bg-slate-700
                          transition
                          hover:border-red-500/50
                          hover:bg-red-950/60
                        "
                          title="Partie löschen"
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

              {/* CAPTURED PIECES */}
              <section className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4 shadow-lg shadow-black/15">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Geschlagene Figuren
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Materialübersicht
                    </p>
                  </div>

                  <span
                    className={`
                    rounded-lg px-2.5 py-1
                    text-xs font-semibold
                    ${
                      materialDifference > 0
                        ? "bg-amber-100/10 text-amber-200"
                        : materialDifference < 0
                          ? "bg-sky-500/10 text-sky-300"
                          : "bg-slate-900/60 text-slate-400"
                    }
                  `}
                  >
                    {materialDifference > 0 && `Weiß +${materialDifference}`}

                    {materialDifference < 0 &&
                      `Schwarz +${Math.abs(materialDifference)}`}

                    {materialDifference === 0 && "Ausgeglichen"}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-900/50 p-3">
                  <CapturedPieces
                    capturedBlack={capturedBlack}
                    capturedWhite={capturedWhite}
                  />
                </div>
              </section>

              {/* MOVE HISTORY */}
              <section className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4 shadow-lg shadow-black/15">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Zugverlauf
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Verlauf der Partie
                    </p>
                  </div>

                  <span className="rounded-lg bg-slate-900/60 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {moveHistory.length}
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl bg-slate-900/50 p-2">
                  <MoveHistory moves={moveHistory} />
                </div>
              </section>
            </div>
          </aside>

          {/* =========================================================
            CENTER
        ========================================================= */}
          <section className="min-w-0">
            <div className="mx-auto max-w-[820px]">
              {/* GAME STATUS */}
              <div
                className="
                mb-3
                rounded-xl
                border border-slate-700
                bg-slate-800/90
                px-4 py-2.5
                shadow-md shadow-black/10
              "
              >
                <GameStatus
                  illegal={illegal}
                  whiteCheckCounter={whiteCheckCounter}
                  blackCheckCounter={blackCheckCounter}
                  gameOver={gameOver}
                  gameOverReason={gameOverReason}
                  winner={winner}
                />
              </div>

              {/* EVALUATION */}
              <div
                className="
                mb-3 flex items-center gap-3
                rounded-xl
                border border-slate-800
                bg-slate-900/70
                px-3 py-2
              "
              >
                <span className="w-11 text-right text-xs font-semibold text-slate-300">
                  {evaluation !== null
                    ? evaluation > 0
                      ? `+${evaluation.toFixed(1)}`
                      : evaluation.toFixed(1)
                    : "0.0"}
                </span>

                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-950">
                  <div
                    className="
                    absolute inset-y-0 left-0
                    rounded-full
                    bg-sky-400
                    transition-all duration-300
                  "
                    style={{
                      width: `${getEvaluationPercentage()}%`,
                    }}
                  />
                </div>

                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                  Bewertung
                </span>
              </div>

              {/* PROMOTION */}
              {promotionSquare && promotionFrom && (
                <div className="mb-3 rounded-xl border border-slate-700 bg-slate-800 p-3 shadow-xl">
                  <PromotionBar onPromote={promotePawn} />
                </div>
              )}

              {/* BOARD */}
              <div
                className="
                overflow-hidden
                rounded-2xl
                border border-slate-600
                bg-gradient-to-b
                from-slate-700
                to-slate-800
                p-3
                shadow-2xl shadow-black/40
                ring-1 ring-white/5
              "
              >
                <Board
                  board={board}
                  selectedSquare={selectedSquare}
                  legalMoves={legalMoves}
                  lastMove={lastMove}
                  checkedKingSquare={checkedKingSquare}
                  onSquareClick={handleSquareClick}
                />
              </div>

              {/* MOBILE MATERIAL */}
              <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/90 px-4 py-3 xl:hidden">
                <span className="text-sm text-slate-400">Material</span>

                <span className="text-sm font-semibold text-slate-100">
                  {materialDifference > 0 && `Weiß +${materialDifference}`}

                  {materialDifference < 0 &&
                    `Schwarz +${Math.abs(materialDifference)}`}

                  {materialDifference === 0 && "Ausgeglichen"}
                </span>
              </div>
            </div>
          </section>

          {/* =========================================================
            RIGHT SIDEBAR
        ========================================================= */}
          <aside className="min-w-0">
            <div className="space-y-4 xl:sticky xl:top-6">
              {/* GAME CONTROLS FIRST */}
              <section className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4 shadow-lg shadow-black/15">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-sky-400 shadow-sm shadow-sky-400" />

                    <h2 className="font-semibold text-slate-100">
                      Spielsteuerung
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-slate-400">
                    Spieler, Partie und Aktionen
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

              {/* PIECE VALUES */}
              <section className="rounded-2xl border border-slate-700 bg-slate-800/90 p-4 shadow-lg shadow-black/15">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Figurenwerte
                    </h2>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Standardwerte
                    </p>
                  </div>

                  <span className="text-xs text-slate-500">Material</span>
                </div>

                <div className="space-y-1">
                  {pieceValueList.map((piece) => (
                    <div
                      key={piece.type}
                      className="
                      flex items-center justify-between
                      rounded-lg
                      px-2.5 py-1.5
                      transition-colors
                      hover:bg-slate-700/70
                    "
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center text-xl text-amber-100">
                          {piece.symbol}
                        </span>

                        <span className="text-sm text-slate-300">
                          {piece.name}
                        </span>
                      </div>

                      <span
                        className="
                        rounded-md
                        bg-slate-900/70
                        px-2 py-0.5
                        text-xs font-semibold
                        text-sky-300
                      "
                      >
                        {pieceValues[piece.type]}
                      </span>
                    </div>
                  ))}
                </div>

                {/* MATERIAL ADVANTAGE */}
                <div className="mt-4 border-t border-slate-700 pt-4">
                  <div className="flex items-center justify-between rounded-xl bg-slate-900/60 px-3 py-3">
                    <span className="text-sm text-slate-400">Vorteil</span>

                    <span
                      className={`
                      text-sm font-semibold
                      ${
                        materialDifference > 0
                          ? "text-amber-200"
                          : materialDifference < 0
                            ? "text-sky-300"
                            : "text-slate-300"
                      }
                    `}
                    >
                      {materialDifference > 0 && `Weiß +${materialDifference}`}

                      {materialDifference < 0 &&
                        `Schwarz +${Math.abs(materialDifference)}`}

                      {materialDifference === 0 && "Ausgeglichen"}
                    </span>
                  </div>
                </div>
              </section>

              {/* SMALL ANALYSIS CARD */}
              {(evaluation !== null || bestMove) && (
                <section className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-lg text-sky-300">
                      ♙
                    </div>

                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">
                        Analyse
                      </h2>

                      <p className="text-[11px] text-slate-400">Stockfish</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {evaluation !== null && (
                      <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2">
                        <span className="text-xs text-slate-400">
                          Bewertung
                        </span>

                        <span className="text-sm font-semibold text-sky-300">
                          {evaluation > 0
                            ? `+${evaluation.toFixed(1)}`
                            : evaluation.toFixed(1)}
                        </span>
                      </div>
                    )}

                    {bestMove && (
                      <div className="flex items-center justify-between rounded-lg bg-slate-900/50 px-3 py-2">
                        <span className="text-xs text-slate-400">
                          Bester Zug
                        </span>

                        <span className="text-sm font-semibold text-slate-100">
                          {bestMove}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
