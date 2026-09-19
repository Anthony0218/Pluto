import React from "react";


import {
  type Board,
  files,
  ranks,
  symbols,
} from "../utils/customChess";

type Props = {
  board: Board;
  boardSize: number;

  selectedSquare: string | null;

  hoveredSquare: string | null;

  selectedPieceMoves: string[];
  opponentMoves: Set<string>;

  onSquareClick: (
    square: string
  ) => void;

  onSquareHover: (
    square: string | null
  ) => void;

  onSquareRemove: (
    square: string
  ) => void;
};

export default function ChessBoard({
  board,
  boardSize,

  selectedSquare,
  hoveredSquare,

  selectedPieceMoves,
  opponentMoves,

  onSquareClick,
  onSquareHover,
  onSquareRemove,
}: Props) {
  return (
    <div
      style={{
        ...styles.board,
        width: boardSize,
        height: boardSize,
      }}
    >
      {ranks.map((rank) =>
        files.map(
          (file, fileIndex) => {
            const square =
              `${file}${rank}`;

            const piece =
              board[square];

            const isLight =
              (fileIndex + rank) %
                2 ===
              1;

            const isSelected =
              selectedSquare ===
              square;

            const isPieceMove =
              selectedPieceMoves.includes(
                square
              );

            const isOpponentMove =
              opponentMoves.has(
                square
              );

            const isHovered =
              hoveredSquare ===
              square;

            let boxShadow =
              "none";

            if (isPieceMove) {
              boxShadow =
                "inset 0 0 0 5px rgba(255,215,0,.9)";
            } else if (
              isOpponentMove
            ) {
              boxShadow =
                "inset 0 0 0 5px rgba(220,70,70,.75)";
            }

            if (isSelected) {
              boxShadow =
                "inset 0 0 0 5px #00aaff";
            }

            if (isHovered) {
              boxShadow =
                "inset 0 0 0 5px #4d6876";
            }

            return (
              <button
                key={square}
                type="button"
                onClick={() =>
                  onSquareClick(
                    square
                  )
                }
                onMouseEnter={() =>
                  onSquareHover(
                    square
                  )
                }
                onMouseLeave={() =>
                  onSquareHover(
                    null
                  )
                }
                onContextMenu={(event) => {
                  event.preventDefault();

                  onSquareRemove(
                    square
                  );
                }}
                style={{
                  ...styles.square,

                  backgroundColor:
                    isLight
                      ? "#f0d9b5"
                      : "#b58863",

                  boxShadow,
                }}
              >
                {piece && (
                  <span
                    style={
                      styles.piece
                    }
                  >
                    {
                      symbols[
                        piece.color
                      ][piece.type]
                    }
                  </span>
                )}

                {file === "a" && (
                  <span
                    style={
                      styles.rank
                    }
                  >
                    {rank}
                  </span>
                )}

                {rank === 1 && (
                  <span
                    style={
                      styles.file
                    }
                  >
                    {file}
                  </span>
                )}
              </button>
            );
          }
        )
      )}
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  board: {
    
    display: "grid",

    gridTemplateColumns:
      "repeat(8, 1fr)",

    gridTemplateRows:
      "repeat(8, 1fr)",

    flexShrink: 0,

    border: "4px solid #111",
  },

  square: {
    position: "relative",

    width: "100%",
    height: "100%",

    minWidth: 0,
    minHeight: 0,

    padding: 0,
    border: "none",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",

    cursor: "pointer",
  },

  piece: {
    fontSize:
      "clamp(30px, 6vw, 72px)",

    lineHeight: 1,

    fontFamily:
      '"Segoe UI Symbol", "Noto Sans Symbols 2", sans-serif',

    pointerEvents: "none",
  },

  rank: {
    position: "absolute",
    top: 3,
    left: 4,

    fontSize: 11,
    fontWeight: "bold",

    opacity: 0.6,
  },

  file: {
    position: "absolute",
    right: 4,
    bottom: 2,

    fontSize: 11,
    fontWeight: "bold",

    opacity: 0.6,
  },
};