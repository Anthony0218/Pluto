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
  const [game] = useState(() => new Chess());
  const [selectedState, setSelectedState] = useState<boolean>(false);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const [position, setPosition] = useState(game.fen());

  const board = game.board();
  let illegal = false;

  function getSquareName(row: number, column: number): Square {
    const files = "abcdefgh";
    const rank = 8 - row;

    return `${files[column]}${rank}` as Square;
  }

  function handleSquareClick(row: number, column: number) {
    setSelectedState(true);
    const square = getSquareName(row, column);

    // First click: select a piece
    if (selectedSquare === null) {
      const piece = game.get(square);

      if (piece) {
        setSelectedSquare(square);
      }

      return;
    }

    try {
      game.move({
        from: selectedSquare,
        to: square,
        promotion: "q",
      });

      setPosition(game.fen());
    } catch {
      console.log("Illegal move");
      illegal = true;
    }

    setSelectedSquare(null);
  }

  return (
    <div>
      {illegal && <div>This </div>}
      <div className="chess-board justify/content">
        {board.map((row, rowIndex) =>
          row.map((piece, columnIndex) => {
            const square = getSquareName(rowIndex, columnIndex);

            const isLight = (rowIndex + columnIndex) % 2 === 0;

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
                } ${isSelected ? "selected" : ""}`}
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
