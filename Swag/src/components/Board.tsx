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
  orientation?: "white" | "black";
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
  orientation = "white",
}: BoardProps) {
  return (
    /*
     * OUTER WOODEN FRAME
     */
    <div
      className="
        w-full
        rounded-[28px]
        border
        border-[#5f412d]
        bg-gradient-to-br
        from-[#493323]
        via-[#2d1e15]
        to-[#160e09]
        p-3
        shadow-[0_30px_80px_rgba(0,0,0,0.55)]
        sm:p-4
      "
    >
      {/* Inner frame */}
      <div
        className="
          rounded-[18px]
          border
          border-black/40
          bg-[#160e09]
          p-1.5
          shadow-inner
          sm:p-2
        "
      >
        {/* Chess board */}
        <div
          className="
            grid
            aspect-square
            w-full
            grid-cols-8
            grid-rows-8
            overflow-hidden
            rounded-xl
            shadow-[0_12px_30px_rgba(0,0,0,0.45)]
          "
        >
          {board.map((_, displayRow) =>
            board[displayRow].map((_, displayColumn) => {
              /*
               * Actual chess.js coordinates.
               *
               * The displayed position changes when
               * playing as Black, while the real
               * chess coordinates remain correct.
               */
              const row = orientation === "white" ? displayRow : 7 - displayRow;

              const column =
                orientation === "white" ? displayColumn : 7 - displayColumn;

              const piece = board[row][column];

              const square = getSquareName(row, column);

              const isLight = (row + column) % 2 === 0;

              const isSelected = selectedSquare === square;

              const isLegalMove = legalMoves.includes(square);

              const isLastMove =
                lastMove?.from === square || lastMove?.to === square;

              const isCheckedKing =
                piece?.type === "k" && checkedKingSquare === square;

              let symbol = "";

              if (piece) {
                const key =
                  `${piece.color}${piece.type}` as keyof typeof pieceSymbols;

                symbol = pieceSymbols[key];
              }

              const file = square[0];
              const rank = square[1];

              return (
                <button
                  key={square}
                  type="button"
                  aria-label={square}
                  onClick={() => onSquareClick(row, column)}
                  className={`
                      group
                      relative
                      flex
                      aspect-square
                      items-center
                      justify-center
                      overflow-hidden
                      border-0
                      p-0
                      transition-[filter,box-shadow]
                      duration-150
                      focus:outline-none

                      ${
                        isLight
                          ? `
                            bg-gradient-to-br
                            from-[#ead7b7]
                            to-[#d5b78b]
                          `
                          : `
                            bg-gradient-to-br
                            from-[#9a6746]
                            to-[#724a31]
                          `
                      }

                      ${
                        isSelected
                          ? `
                            z-10
                            ring-4
                            ring-inset
                            ring-amber-300
                          `
                          : ""
                      }

                      hover:brightness-105
                    `}
                >
                  {/* =========================
                        LAST MOVE HIGHLIGHT
                       ========================= */}

                  {isLastMove && (
                    <span
                      className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]
                          bg-yellow-300/25
                        "
                    />
                  )}

                  {/* =========================
                        CHECK GLOW
                       ========================= */}

                  {isCheckedKing && (
                    <span
                      className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[3]
                          bg-[radial-gradient(circle,rgba(239,68,68,0.85)_0%,rgba(185,28,28,0.52)_45%,rgba(127,29,29,0.05)_80%)]
                          shadow-[inset_0_0_20px_rgba(239,68,68,0.85)]
                        "
                    />
                  )}

                  {/* =========================
                        EMPTY LEGAL MOVE
                       ========================= */}

                  {isLegalMove && !piece && (
                    <span
                      className="
                            pointer-events-none
                            absolute
                            z-[6]
                            h-[22%]
                            w-[22%]
                            rounded-full
                            bg-black/30
                            shadow-sm
                          "
                    />
                  )}

                  {/* =========================
                        LEGAL CAPTURE
                       ========================= */}

                  {isLegalMove && piece && (
                    <span
                      className="
                            pointer-events-none
                            absolute
                            inset-[7%]
                            z-[6]
                            rounded-full
                            border-[clamp(3px,0.5vw,6px)]
                            border-black/25
                          "
                    />
                  )}

                  {/* =========================
                        PIECE
                       ========================= */}

                  {piece && (
                    <span
                      className={`
                          pointer-events-none
                          relative
                          z-10
                          select-none

                          font-serif
                          text-[clamp(2.4rem,6vw,5.2rem)]
                          leading-none

                          transition-transform
                          duration-150

                          group-hover:scale-[1.06]

                          ${
                            piece.color === "w"
                              ? `
                                text-[#fff3d5]
                                [text-shadow:0_1px_0_#ffffff,0_2px_2px_rgba(0,0,0,0.75),0_5px_8px_rgba(0,0,0,0.45)]
                              `
                              : `
                                text-[#1b1b1b]
                                [text-shadow:0_1px_0_rgba(255,255,255,0.35),0_3px_3px_rgba(0,0,0,0.65),0_5px_8px_rgba(0,0,0,0.45)]
                              `
                          }
                        `}
                    >
                      {symbol}
                    </span>
                  )}

                  {/* =========================
                        FILE COORDINATE
                        a b c d e f g h
                       ========================= */}

                  {displayRow === 7 && (
                    <span
                      className={`
                          pointer-events-none
                          absolute
                          bottom-1
                          right-1.5
                          z-20
                          text-[clamp(8px,1vw,12px)]
                          font-black

                          ${isLight ? "text-[#66452f]/70" : "text-[#f1ddbe]/70"}
                        `}
                    >
                      {file}
                    </span>
                  )}

                  {/* =========================
                        RANK COORDINATE
                        1 2 3 4 5 6 7 8
                       ========================= */}

                  {displayColumn === 0 && (
                    <span
                      className={`
                          pointer-events-none
                          absolute
                          left-1.5
                          top-1
                          z-20
                          text-[clamp(8px,1vw,12px)]
                          font-black

                          ${isLight ? "text-[#66452f]/70" : "text-[#f1ddbe]/70"}
                        `}
                    >
                      {rank}
                    </span>
                  )}
                </button>
              );
            }),
          )}
        </div>
      </div>
    </div>
  );
}
