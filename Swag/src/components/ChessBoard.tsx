import { useEffect, useState, useRef } from "react";
import { Chess, type Square } from "chess.js";
import "./ChessBoard.css";
import { supabase } from "../lib/supabase";

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

const pieceSymbols = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",

  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚",
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
    loadSavedGames();
  }, []);
  const stockfish = useRef<Worker | null>(null);
  const beforeMoveEvaluation = useRef<number | null>(null);
  const afterMoveEvaluation = useRef<number | null>(null);
  const playerMoveColor = useRef<"w" | "b" | null>(null);
  const analysisType = useRef<"before" | "after" | "position" | null>(null);
  const currentAnalysisFen = useRef<string | null>(null);
  const analysisId = useRef(0);

  useEffect(() => {
    analyzePosition(game.fen(), "before");
  }, []);

  useEffect(() => {
    const worker = new Worker("/stockfish/stockfish-18-lite-single.js");

    stockfish.current = worker;

    worker.onmessage = (event) => {
      const message = event.data as string;

      console.log("Stockfish:", message);

      if (message.startsWith("info") && message.includes("score cp")) {
        const match = message.match(/score cp (-?\d+)/);

        if (!match) {
          return;
        }

        const depthMatch = message.match(/depth (\d+)/);

        if (!depthMatch) {
          return;
        }

        const depth = Number(depthMatch[1]);

        if (depth < 15) {
          return;
        }

        const centipawns = Number(match[1]);
        const score = centipawns / 100;

        if (analysisType.current === "position") {
          setEvaluation(score);

          // This is the position immediately before
          // the player's move.
          beforeMoveEvaluation.current = score;
        }

        if (analysisType.current === "after") {
          afterMoveEvaluation.current = score;
          setEvaluation(score);
        }
      }

      if (message.startsWith("bestmove")) {
        const move = message.split(" ")[1];

        if (move) {
          setBestMove(move);
        }

        if (
          analysisType.current === "after" &&
          beforeMoveEvaluation.current !== null &&
          afterMoveEvaluation.current !== null &&
          playerMoveColor.current !== null
        ) {
          const rating = getMoveRating(
            beforeMoveEvaluation.current,
            afterMoveEvaluation.current,
            playerMoveColor.current,
          );

          console.log(
            "BEFORE:",
            beforeMoveEvaluation.current,
            "AFTER:",
            afterMoveEvaluation.current,
            "COLOR:",
            playerMoveColor.current,
            "RATING:",
            rating,
          );

          setMoveRating(rating);

          beforeMoveEvaluation.current = afterMoveEvaluation.current;
        }

        analysisType.current = null;
      }
    };

    worker.postMessage("uci");

    return () => {
      worker.terminate();
    };
  }, []);

  function analyzePosition(fen: string, type: "before" | "after" | "position") {
    if (!stockfish.current) {
      return;
    }

    analysisType.current = type;

    if (type === "before") {
      beforeMoveEvaluation.current = null;
    }

    if (type === "after") {
      afterMoveEvaluation.current = null;
    }

    stockfish.current.postMessage("stop");
    stockfish.current.postMessage(`position fen ${fen}`);
    stockfish.current.postMessage("go depth 15");
  }

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
    setEvaluation(null);
    setBestMove(null);
    setMoveRating(null);
    beforeMoveEvaluation.current = null;
    afterMoveEvaluation.current = null;
    playerMoveColor.current = null;
    analysisType.current = null;
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
    setEvaluation(null);
    setBestMove(null);
    setMoveRating(null);
    beforeMoveEvaluation.current = null;
    afterMoveEvaluation.current = null;
    playerMoveColor.current = null;
    analysisType.current = null;
  }
  function undoMove() {
    const move = game.undo();

    if (!move) {
      return;
    }

    // Stop the current Stockfish calculation
    stockfish.current?.postMessage("stop");

    // Reset Stockfish analysis state
    analysisType.current = "position";
    beforeMoveEvaluation.current = null;
    afterMoveEvaluation.current = null;
    playerMoveColor.current = null;

    // Clear the displayed analysis
    setMoveRating(null);
    setBestMove(null);
    setEvaluation(null);

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

      if (capturedPiece) {
        playSound("capture");
      } else {
        playSound("move");
      }

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
  function getReadableMove(move: string) {
    if (move.length < 4) {
      return move;
    }

    return `${move.slice(0, 2)}-${move.slice(2, 4)}`;
  }
  function getMoveRating(
    beforeEvaluation: number,
    afterEvaluation: number,
    playerColor: "w" | "b",
  ) {
    // Stockfish evaluation is from White's perspective.
    //
    // Before the move:
    //   White wants a higher number
    //   Black wants a lower number
    //
    // After the move the side to move changes, so we
    // must still compare from the player's perspective.

    const beforeForPlayer =
      playerColor === "w" ? beforeEvaluation : -beforeEvaluation;

    const afterForPlayer =
      playerColor === "w" ? -afterEvaluation : afterEvaluation;

    const evaluationLoss = beforeForPlayer - afterForPlayer;
    const evaluationChange =
      playerColor === "w"
        ? afterEvaluation - beforeEvaluation
        : beforeEvaluation - afterEvaluation;

    console.log({
      beforeEvaluation,
      afterEvaluation,
      playerColor,
      beforeForPlayer,
      afterForPlayer,
      evaluationLoss,
    });

    if (evaluationLoss <= 0.1) {
      return "Excellent";
    }

    if (evaluationLoss <= 0.3) {
      return "Good";
    }

    if (evaluationLoss <= 0.7) {
      return "Inaccuracy";
    }

    if (evaluationLoss <= 1.5) {
      return "Mistake";
    }

    return "Blunder";
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
  const [capturedWhite, setCapturedWhite] = useState<string[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<string[]>([]);
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

  const [evaluation, setEvaluation] = useState<number | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [moveRating, setMoveRating] = useState<string | null>(null);

  const [illegal, setIllegal] = useState(false);
  const [position, setPosition] = useState(game.fen());
  const [whiteCheckCounter, setWhiteCheckCounter] = useState<number>(0);
  const [blackCheckCounter, setBlackCheckCounter] = useState<number>(0);

  const [winner, setWinner] = useState<string>("w");

  const board = game.board();

  function getSquareName(row: number, column: number): Square {
    const files = "abcdefgh";
    const rank = 8 - row;

    return `${files[column]}${rank}` as Square;
  }

  function handleSquareClick(row: number, column: number) {
    if (gameOver) {
      return;
    }

    const square = getSquareName(row, column);

    if (selectedSquare === null) {
      const piece = game.get(square);

      if (piece) {
        setSelectedSquare(square);

        playerMoveColor.current = game.turn();

        setMoveRating(null);
        setBestMove(null);

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

      // Choose the basic move sound
      if (capturedPiece && move.piece == "p") {
        playSound("capture");
      } else if (!capturedPiece) {
        playSound("move");
      }
      if (move.piece == "k") {
        playSound("mbappe");
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
        playSound("castle");
      } else if (move.captured) {
        switch (move.piece) {
          case "p":
            playSound("pawn-capture");
            break;

          case "n":
            playSound("knight-capture");
            break;

          case "b":
            playSound("bishop-capture");
            break;

          case "r":
            playSound("sacrifices-the-rook");
            break;

          case "q":
            playSound("queen-capture");
            break;

          case "k":
            playSound("king");
            break;
        }
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

      <div className="chess-board">
        {board.map((row, rowIndex) =>
          row.map((piece, columnIndex) => {
            const square = getSquareName(rowIndex, columnIndex);
            const isLastMove =
              lastMove?.from === square || lastMove?.to === square;

            const isLegalMove = legalMoves.includes(square);
            const isLight = (rowIndex + columnIndex) % 2 === 0;
            const isCheckedKing =
              game.isCheck() &&
              piece?.type === "k" &&
              piece.color === game.turn();

            const isSelected = selectedSquare === square;

            let symbol = "";

            if (piece) {
              const key =
                `${piece.color}${piece.type}` as keyof typeof pieceSymbols;

              symbol = pieceSymbols[key];
            }

            return (
              <button
                key={square}
                className={`square ${
                  isLight ? "light" : "dark"
                } ${isSelected ? "selected" : ""} ${
                  isCheckedKing ? "check" : ""
                } ${isLegalMove ? "legal-move" : ""} ${
                  isLastMove ? "last-move" : ""
                }`}
                onClick={() => handleSquareClick(rowIndex, columnIndex)}
              >
                {symbol}
              </button>
            );
          }),
        )}
      </div>
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
        <div className="captured-pieces">
          <div>
            Captured White:
            {capturedWhite.map((piece, index) => (
              <span key={index}>
                {pieceSymbols[`w${piece}` as keyof typeof pieceSymbols]}
              </span>
            ))}
          </div>

          <div>
            Captured Black:
            {capturedBlack.map((piece, index) => (
              <span key={index}>
                {pieceSymbols[`b${piece}` as keyof typeof pieceSymbols]}
              </span>
            ))}
          </div>
        </div>
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
