import { useState } from "react";
import { Chess, type Square } from "chess.js";
import "./ChessBoard.css";

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
  setIsCheckmate(false);
  setWinner("w");
  setGameOver(false);
  setGameOverReason("");



}
function undoMove() {
  const move = game.undo();

  if (!move) {
    return;
  }

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
}


  function playSound(sound: string) {
  const audio = new Audio(`/sounds/${sound}.mp3`);
  audio.play().catch(() => {
   
  });
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



  
  const [game] = useState(() => new Chess());
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{
  from: Square;
  to: Square;
} | null>(null);


  const [selectedState, setSelectedState] = useState<boolean>(false);
  const [isCheckmate, setIsCheckmate] = useState<boolean>(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [capturedWhite, setCapturedWhite] = useState<string[]>([]);
  const [capturedBlack, setCapturedBlack] = useState<string[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const whiteMaterial = capturedBlack.reduce(
  (total, piece) => total + pieceValues[piece],
  0
);

const blackMaterial = capturedWhite.reduce(
  (total, piece) => total + pieceValues[piece],
  0
);
const materialDifference = whiteMaterial - blackMaterial;
const [promotionSquare, setPromotionSquare] = useState<Square | null>(null);
const [promotionFrom, setPromotionFrom] = useState<Square | null>(null);
const [gameOver, setGameOver] = useState(false);
const [gameOverReason, setGameOverReason] = useState("");


  const [illegal, setIllegal] = useState(false);
  const [position, setPosition] = useState(game.fen());
  const [whiteCheckCounter, setWhiteCheckCounter] = useState<number>(0);
  const [blackCheckCounter, setBlackCheckCounter] = useState<number>(0);
  const checkedSide = game.isCheck() ? game.turn() : null;

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

  setSelectedState(true);
  const square = getSquareName(row, column);

  if (selectedSquare === null) {
  const piece = game.get(square);

  if (piece) {
    setSelectedSquare(square);

    const moves = game.moves({
      square,
      verbose: true,
    });
    

    setLegalMoves(moves.map((move) => move.to));
    
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

checkGameOver();

  setIllegal(false);
  if (capturedPiece) {
  
} 

  // Choose the basic move sound
  if (capturedPiece && move.piece == "p") {
    playSound("capture");
  } else if(!capturedPiece) {
    playSound("move");
  }
  if (move.piece == "k") {
    playSound("mbappe");
  }

  if (game.isCheckmate()) {
    setIsCheckmate(true);
    if (game.turn() === "w") {
  setWinner("black");
} else {
  setWinner("white");
}

  playSound("checkmate");
} else if (game.isCheck()) {
  playSound("check");
} else if (move.isKingsideCastle() || move.isQueensideCastle()) {
  playSound("castle");
}
  else if (move.captured){
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


  setPosition(game.fen());


}} catch {
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
        <span className="piece-symbol">
          {piece.symbol}
        </span>

        <span>
          {piece.name}: {pieceValues[piece.type]}
        </span>
      </div>
    ))}
  </div>
  

{promotionSquare && promotionFrom && (
  <div className="promotion-menu">
    <h3>Promote pawn</h3>

    <button onClick={() => promotePawn("q")}>
      ♕
    </button>

    <button onClick={() => promotePawn("r")}>
      ♖
    </button>

    <button onClick={() => promotePawn("b")}>
      ♗
    </button>

    <button onClick={() => promotePawn("n")}>
      ♘
    </button>
  </div>
)}
      <div className="chess-board">
        {board.map((row, rowIndex) =>
          row.map((piece, columnIndex) => {
            const square = getSquareName(rowIndex, columnIndex);
            const isLastMove =
  lastMove?.from === square ||
  lastMove?.to === square;

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
          <div className = "error">
      {illegal && <div>This is an illegal move! </div>}
      <div>white: {whiteCheckCounter}, black: {blackCheckCounter}</div>
      {gameOver && (
  <div className="game-over">
    {gameOverReason === "Checkmate" ? (
      <span>{winner} has won by checkmate!</span>
    ) : (
      <span>Game drawn: {gameOverReason}</span>
    )}
  </div>
)}

   <button onClick={undoMove}>
  Undo
</button>

<button onClick={restartGame}>
  Restart Game
</button>
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
  {materialDifference > 0 && (
    <span>White +{materialDifference}</span>
  )}

  {materialDifference < 0 && (
    <span>Black +{Math.abs(materialDifference)}</span>
  )}

  {materialDifference === 0 && (
    <span>Equal</span>
  )}
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
          <span className="move-number">
            {index + 1}.
          </span>

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
    }
  )}
</div>

</div>

    
    </div>
  );
}
