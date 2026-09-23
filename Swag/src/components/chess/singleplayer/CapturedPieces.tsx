import "./ChessBoard.css";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

type CapturedPiecesProps = {
  capturedWhite: PieceType[];
  capturedBlack: PieceType[];
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

export default function CapturedPieces({
  capturedWhite,
  capturedBlack,
}: CapturedPiecesProps) {
  return (
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
  );
}
