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

export default function ChessBoard() {
  function playSound(sound: string) {
  const audio = new Audio(`/sounds/${sound}.mp3`);
  audio.play().catch(() => {
   
  });
}

  
  const [game] = useState(() => new Chess());
  const [selectedState, setSelectedState] = useState<boolean>(false);
  const [isCheckmate, setIsCheckmate] = useState<boolean>(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
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
  setSelectedState(true);
  const square = getSquareName(row, column);

  if (selectedSquare === null) {
    const piece = game.get(square);

    if (piece) {
      setSelectedSquare(square);
    }

    return;
  }
try {
  const capturedPiece = game.get(square);

  const move = game.move({
    from: selectedSquare,
    to: square,
    promotion: "q",
  });

  setIllegal(false);
  if (capturedPiece) {
  
} 

  // Choose the basic move sound
  if (capturedPiece && move.piece == "p") {
    playSound("capture");
  } else if(!capturedPiece) {
    playSound("move");
  }

  if (game.isCheckmate()) {
    setIsCheckmate(true);
    if(checkedSide == "w") {
      setWinner("black")
    }else {
      setWinner("white")
    }
  playSound("checkmate");
} else if (game.isCheck()) {
  playSound("check");
} else {
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
      playSound("rook-capture");
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
}

setSelectedSquare(null);

}


  return (
    <div className = "error">
      {illegal && <div>This is an illegal move! </div>}
      <div>white: {whiteCheckCounter}, black: {blackCheckCounter}</div>
      {isCheckmate && <div>{winner} has won!</div> }
      <div className="chess-board justify/content">
        {board.map((row, rowIndex) =>
          row.map((piece, columnIndex) => {
            const square = getSquareName(rowIndex, columnIndex);

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
}`}

                onClick={() => handleSquareClick(rowIndex, columnIndex)}
              >
                {symbol}
              </button>
            );
          }),
        )}
      </div>
      <p>Position: {position}</p>
    </div>
  );
}
