import React from "react";
import {
  type Piece,
  symbols,
} from "../utils/customChess";

type Props = {
  piece: Piece;
};

export default function PiecePreview({
  piece,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width="120"
        height="120"
      >
        <text
          x="50"
          y="72"
          textAnchor="middle"
          fontSize="72"
          fontFamily="Segoe UI Symbol"
        >
          {symbols[piece.color][piece.type]}
        </text>
      </svg>

      <strong>
        {piece.color} {piece.type}
      </strong>
    </div>
  );
}