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

  /*
   * Variant-only square markers.
   * Optional so Classic / AI / Multiplayer do not need to pass anything.
   */
  heartSquares?: Square[];

  /*
   * Mutation Chess uses the same native square rendering path,
   * so its highlight never drifts from the chess board.
   */
  mutationSquares?: Square[];

  /*
   * Capitalism Chess bounty targets.
   * Rendered natively inside the real square, just like last-move
   * and variant highlights.
   */
  bountySquares?: Square[];

  /*
   * Capitalism Chess shop spawn points.
   * All home-rook squares are marked; currently usable empty squares
   * receive the stronger marker.
   */
  shopSpawnSquares?: Square[];
  availableShopSpawnSquares?: Square[];

  /*
   * King Journey mission destinations.
   * Kept separate so White and Black targets are visually distinct.
   */
  whiteMissionTargetSquares?: Square[];
  blackMissionTargetSquares?: Square[];

  orientation?: "white" | "black";

  /*
   * Allows smaller pieces on boards
   * such as Game Review without
   * changing the normal game board.
   */
  pieceScale?: number;
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
  heartSquares = [],
  mutationSquares = [],
  bountySquares = [],
  shopSpawnSquares = [],
  availableShopSpawnSquares = [],
  whiteMissionTargetSquares = [],
  blackMissionTargetSquares = [],
  orientation = "white",
  pieceScale = 1,
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

              const isHeartSquare = heartSquares.includes(square);

              const isMutationSquare = mutationSquares.includes(square);

              const isBountySquare = bountySquares.includes(square);

              const isShopSpawnSquare = shopSpawnSquares.includes(square);

              const isAvailableShopSpawnSquare =
                availableShopSpawnSquares.includes(square);

              const isWhiteMissionTargetSquare =
                whiteMissionTargetSquares.includes(square);

              const isBlackMissionTargetSquare =
                blackMissionTargetSquares.includes(square);

              const isAnyMissionTargetSquare =
                isWhiteMissionTargetSquare || isBlackMissionTargetSquare;

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
                      THREE LIVES HEART SQUARE
                      Rendered INSIDE the real board square,
                      so it can never drift or offset.
                     ========================= */}

                  {isHeartSquare && (
                    <>
                      <span
                        className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]
                          bg-red-400/25
                          shadow-[inset_0_0_24px_rgba(248,113,113,0.28)]
                        "
                      />

                      <span
                        className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[8]
                          flex
                          items-center
                          justify-center
                          select-none
                          font-serif
                          text-[clamp(2.8rem,7vw,6rem)]
                          font-black
                          leading-none
                          text-red-400
                          drop-shadow-[0_0_12px_rgba(248,113,113,0.95)]
                        "
                      >
                        <span className="animate-pulse leading-none">♥</span>
                      </span>
                    </>
                  )}

                  {/* =========================
                      MUTATION SQUARE
                     ========================= */}

                  {isMutationSquare && (
                    <>
                      <span
                        className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]
                          bg-violet-400/25
                          shadow-[inset_0_0_26px_rgba(167,139,250,0.35)]
                        "
                      />

                      <span
                        className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[8]
                          flex
                          items-center
                          justify-center
                          select-none
                          text-[clamp(2.4rem,6vw,5rem)]
                          font-black
                          leading-none
                          text-violet-200/55
                          drop-shadow-[0_0_12px_rgba(167,139,250,0.95)]
                        "
                      >
                        ✦
                      </span>
                    </>
                  )}

                  {/* =========================
                      CAPITALISM BOUNTY TARGET
                     ========================= */}

                  {isBountySquare && (
                    <>
                      <span
                        className="
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]
                          bg-amber-300/20
                          shadow-[inset_0_0_24px_rgba(251,191,36,0.22)]
                        "
                      />

                      <span
                        className="
                          pointer-events-none
                          absolute
                          right-1.5
                          top-1.5
                          z-[18]
                          flex
                          h-5
                          min-w-5
                          items-center
                          justify-center
                          rounded-full
                          border
                          border-amber-100/50
                          bg-amber-300
                          px-1
                          text-[9px]
                          font-black
                          leading-none
                          text-amber-950
                          shadow-[0_2px_8px_rgba(0,0,0,0.4)]
                        "
                      >
                        $
                      </span>
                    </>
                  )}

                  {/* =========================
                      CAPITALISM SHOP SPAWN POINT
                     ========================= */}

                  {isShopSpawnSquare && (
                    <>
                      <span
                        className={`
                          pointer-events-none
                          absolute
                          inset-0
                          z-[2]

                          ${
                            isAvailableShopSpawnSquare
                              ? "bg-emerald-300/18 shadow-[inset_0_0_22px_rgba(52,211,153,0.26)]"
                              : "bg-cyan-300/[0.06]"
                          }
                        `}
                      />

                      <span
                        className={`
                          pointer-events-none
                          absolute
                          bottom-1.5
                          left-1.5
                          z-[18]
                          flex
                          h-5
                          w-5
                          items-center
                          justify-center
                          rounded-full
                          border
                          text-[11px]
                          font-black
                          leading-none
                          shadow-[0_2px_8px_rgba(0,0,0,0.35)]

                          ${
                            isAvailableShopSpawnSquare
                              ? "border-emerald-100/60 bg-emerald-300 text-emerald-950"
                              : "border-cyan-100/20 bg-cyan-900/70 text-cyan-200/55"
                          }
                        `}
                      >
                        +
                      </span>
                    </>
                  )}

                  {/* =========================
                      KING JOURNEY TARGET
                     ========================= */}

                  {isAnyMissionTargetSquare && (
                    <>
                      <span
                        className={`
                          pointer-events-none
                          absolute
                          inset-0
                          z-[4]

                          ${
                            isWhiteMissionTargetSquare &&
                            isBlackMissionTargetSquare
                              ? "bg-[linear-gradient(135deg,rgba(186,230,253,0.26)_0%,rgba(186,230,253,0.26)_50%,rgba(196,181,253,0.26)_50%,rgba(196,181,253,0.26)_100%)] shadow-[inset_0_0_30px_rgba(167,139,250,0.28)]"
                              : isWhiteMissionTargetSquare
                                ? "bg-sky-200/25 shadow-[inset_0_0_28px_rgba(186,230,253,0.38)]"
                                : "bg-violet-300/22 shadow-[inset_0_0_28px_rgba(196,181,253,0.36)]"
                          }
                        `}
                      />

                      <span
                        className={`
                          pointer-events-none
                          absolute
                          left-1/2
                          top-1/2
                          z-[19]
                          flex
                          -translate-x-1/2
                          -translate-y-1/2
                          items-center
                          justify-center
                          rounded-full
                          border
                          font-black
                          leading-none
                          shadow-[0_2px_12px_rgba(0,0,0,0.45)]

                          ${
                            isWhiteMissionTargetSquare &&
                            isBlackMissionTargetSquare
                              ? "h-9 min-w-12 border-white/50 bg-zinc-900/90 px-1.5 text-[15px] text-white"
                              : isWhiteMissionTargetSquare
                                ? "h-9 w-9 border-sky-50/70 bg-sky-100/95 text-xl text-sky-950"
                                : "h-9 w-9 border-violet-100/70 bg-violet-300/95 text-xl text-violet-950"
                          }
                        `}
                      >
                        {isWhiteMissionTargetSquare &&
                        isBlackMissionTargetSquare
                          ? "♔♚"
                          : isWhiteMissionTargetSquare
                            ? "♔"
                            : "♚"}
                      </span>

                      <span
                        className={`
                          pointer-events-none
                          absolute
                          bottom-1
                          right-1
                          z-[19]
                          text-[10px]
                          font-black
                          leading-none

                          ${
                            isWhiteMissionTargetSquare &&
                            isBlackMissionTargetSquare
                              ? "text-white"
                              : isWhiteMissionTargetSquare
                                ? "text-sky-50"
                                : "text-violet-100"
                          }
                        `}
                      >
                        ★
                      </span>
                    </>
                  )}

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
                    /*
                     * Outer wrapper controls only
                     * the overall piece size.
                     *
                     * The inner span keeps the
                     * existing hover animation.
                     */
                    <span
                      className="
                        pointer-events-none
                        relative
                        z-10
                        flex
                        h-full
                        w-full
                        items-center
                        justify-center
                      "
                      style={{
                        transform: `scale(${pieceScale})`,
                        transformOrigin: "center",
                      }}
                    >
                      <span
                        className={`
                          pointer-events-none
                          relative
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
