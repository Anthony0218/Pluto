import "./ChessBoard.css";
import { type Square } from "chess.js";
import { getSquareName } from "../utils/chessUtils";
import type { PieceType } from "../utils/chessUtils";

type CapturedPiecesProps = {
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
};

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
  isInCheck: boolean;
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
  isInCheck,
  onSquareClick,
}: BoardProps) {
  return (
    <div className="chess-board">
      {board.map((row, rowIndex) =>
        row.map((piece, columnIndex) => {
          const isCheckedKing = isInCheck && piece?.type === "k";

          const square = getSquareName(rowIndex, columnIndex);
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
              {symbol}
            </button>
          );
        }),
      )}
    </div>
  );
}
