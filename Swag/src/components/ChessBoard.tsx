import { useEffect, useState } from "react";
import { Chess, type Square } from "chess.js";
import "./ChessBoard.css";
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

type SavedGame = {
  id: string;
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

export default function ChessBoard() {
  useEffect(() => {
    analyzePosition(game.fen(), "position");
  }, []);

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
    analyzePosition(game.fen(), "before");
  }, []);

  async function saveGame() {
    const gameData = {
      name: gameName || "Unnamed Game",
      white_player: whitePlayer || "White",
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

  async function loadSavedGames() {
    const { data, error } = await supabase
      .from("games")
      .select(
        "id, created_at, name, white_player, black_player, fen, moves, white_check_counter, black_check_counter",
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading saved games:", error);
      return;
    }
    setWhitePlayer("");
    setBlackPlayer("");
    setSavedGames(data ?? []);
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
      checkGameOver();
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

  function handleSquareClick(row: number, column: number) {
    if (gameOver) {
      return;
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
    <div className="box">
      <div className="piece-values">
        <h3>Piece Value</h3>

        {pieceValueList.map((piece) => (
          <div className="piece-value" key={piece.type}>
            <span className="piece-symbol">{piece.symbol}</span>

            <span>
              {piece.name}: {pieceValues[piece.type]}
            </span>
          </div>
        ))}
      </div>

      {promotionSquare && promotionFrom && (
        <div className="promotion-menu">
          <h3>Promote pawn</h3>

          <button onClick={() => promotePawn("q")}>♕</button>

          <button onClick={() => promotePawn("r")}>♖</button>

          <button onClick={() => promotePawn("b")}>♗</button>

          <button onClick={() => promotePawn("n")}>♘</button>
        </div>
      )}
      <div className="board-area">
        <div className="evaluation-bar">
          <div
            className="evaluation-white"
            style={{
              height: `${getEvaluationPercentage()}%`,
            }}
          />

          <div className="evaluation-black" />
        </div>
      </div>
      <Board
        board={board}
        selectedSquare={selectedSquare}
        legalMoves={legalMoves}
        lastMove={lastMove}
        isInCheck={game.isCheck()}
        onSquareClick={handleSquareClick}
      />

      <div className="sidebar">
        <div className="controls">
          <div className="error">
            {illegal && <div>This is an illegal move! </div>}
            <div>
              white: {whiteCheckCounter}, black: {blackCheckCounter}
            </div>
            {gameOver && (
              <div className="game-over">
                {gameOverReason === "Checkmate" ? (
                  <span>{winner} has won by checkmate!</span>
                ) : (
                  <span>Game drawn: {gameOverReason}</span>
                )}
              </div>
            )}

            {moveRating && (
              <div className={`move-rating ${moveRating.toLowerCase()}`}>
                <strong>Move:</strong> {moveRating}
              </div>
            )}

            <div className="stockfish-analysis">
              <div>
                <strong>Stockfish:</strong>{" "}
                {evaluation === null
                  ? "Calculating..."
                  : evaluation > 0
                    ? `+${evaluation.toFixed(2)}`
                    : evaluation.toFixed(2)}
              </div>

              <div>
                <strong>Best move:</strong>{" "}
                {bestMove ? getReadableMove(bestMove) : "Calculating..."}
              </div>
            </div>

            <button onClick={undoMove}>Undo</button>

            <button onClick={restartGame}>Restart Game</button>
            <div className="game-info">
              <input
                type="text"
                placeholder="Game name"
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
              />

              <input
                type="text"
                placeholder="White player"
                value={whitePlayer}
                onChange={(event) => setWhitePlayer(event.target.value)}
              />

              <input
                type="text"
                placeholder="Black player"
                value={blackPlayer}
                onChange={(event) => setBlackPlayer(event.target.value)}
              />

              <button onClick={saveGame}>Save Game</button>
            </div>
          </div>
        </div>
        <CapturedPieces
          capturedBlack={capturedBlack}
          capturedWhite={capturedWhite}
        />
        <div className="material-advantage">
          {materialDifference > 0 && <span>White +{materialDifference}</span>}

          {materialDifference < 0 && (
            <span>Black +{Math.abs(materialDifference)}</span>
          )}

          {materialDifference === 0 && <span>Equal</span>}
        </div>
        <div className="saved-games">
          <h3>Saved Games</h3>

          {savedGames.map((savedGame) => (
            <div className="saved-game" key={savedGame.id}>
              <div>
                <strong>{savedGame.name || "Unnamed Game"}</strong>

                <div>♔ {savedGame.white_player || "White"}</div>

                <div>♚ {savedGame.black_player || "Black"}</div>

                <small>{new Date(savedGame.created_at).toLocaleString()}</small>
              </div>

              <button onClick={() => loadSpecificGame(savedGame.id)}>
                Load
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Delete this game?")) {
                    deleteGame(savedGame.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <div className="move-history">
          <h3>Moves</h3>

          {Array.from(
            { length: Math.ceil(moveHistory.length / 2) },
            (_, index) => {
              const whiteMove = moveHistory[index * 2];
              const blackMove = moveHistory[index * 2 + 1];

              return (
                <div className="move-row" key={index}>
                  <span className="move-number">{index + 1}.</span>

                  <span
                    className={
                      index * 2 === moveHistory.length - 1
                        ? "current-move"
                        : "white-move"
                    }
                  >
                    {whiteMove}
                  </span>

                  <span
                    className={
                      index * 2 + 1 === moveHistory.length - 1
                        ? "current-move"
                        : "black-move"
                    }
                  >
                    {blackMove ?? ""}
                  </span>
                </div>
              );
            },
          )}
        </div>
      </div>
    </div>
  );
}
