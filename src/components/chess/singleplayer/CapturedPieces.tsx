import { gameUi } from "../../../i18n/gameUi.ts";
import { ui, useUiLanguage } from "@/i18n/ui";
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
  useUiLanguage();
  return (
    <div className="captured-pieces">
      <div>{ui("Captured White:")}{capturedWhite.map((piece, index) => (
          <span key={index}>
            {gameUi(pieceSymbols[`w${piece}` as keyof typeof pieceSymbols])}
          </span>
        ))}
      </div>

      <div>{ui("Captured Black:")}{capturedBlack.map((piece, index) => (
          <span key={index}>
            {gameUi(pieceSymbols[`b${piece}` as keyof typeof pieceSymbols])}
          </span>
        ))}
      </div>
    </div>
  );
}
