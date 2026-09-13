import "./ChessBoard.css";
import { type Square } from "chess.js";
import { getSquareName } from "../utils/chessUtils";

type BoardPiece = {
  type: "p" | "n" | "b" | "r" | "q" | "k";
  color: "w" | "b";
};

type BoardProps = {
  board: (BoardPiece | null)[][];
  selectedSquare: Square | null;
  legalMoves: Square[];
  lastMove: {
    from: Square;
    to: Square;
  } | null;
  checkedKingSquare: Square | null;
  onSquareClick: (row: number, column: number) => void;
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

export default function Board({
  board,
  selectedSquare,
  legalMoves,
  lastMove,
  checkedKingSquare,
  onSquareClick,
}: BoardProps) {
  return (
    <div className="chess-board">
      {board.map((row, rowIndex) =>
        row.map((piece, columnIndex) => {
          const square = getSquareName(rowIndex, columnIndex);

          const isCheckedKing =
            piece?.type === "k" && checkedKingSquare === square;

          const isLastMove =
            lastMove?.from === square || lastMove?.to === square;

          const isLegalMove = legalMoves.includes(square);
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
              } ${isSelected ? "selected" : ""} ${
                isCheckedKing ? "check" : ""
              } ${isLegalMove ? "legal-move" : ""} ${
                isLastMove ? "last-move" : ""
              }`}
              onClick={() => onSquareClick(rowIndex, columnIndex)}
            >
              {piece && (
                <span
                  className={`
                    select-none
                    transition-transform duration-150
                    hover:scale-105
                    ${
                      piece.color === "w"
                        ? "text-[#fff1c7] drop-shadow-[0_2px_2px_rgba(0,0,0,0.65)]"
                        : "text-sky-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.75)]"
                    }
                  `}
                >
                  {symbol}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
