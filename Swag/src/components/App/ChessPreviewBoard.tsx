import { Chess, type Square } from "chess.js";

const pieces: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

type Props = {
  fen: string;
  selected?: Square | null;
  lastMove?: [Square, Square] | null;
  onSquareClick?: (square: Square) => void;
  label: string;
};

export default function ChessPreviewBoard({ fen, selected, lastMove, onSquareClick, label }: Props) {
  const board = new Chess(fen).board();
  return (
    <div className="chess-preview-board grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-xl border border-amber-200/20 shadow-[0_16px_40px_rgba(0,0,0,.35)] [container-type:inline-size]" role="group" aria-label={label}>
      {board.flatMap((rank, row) => rank.map((piece, col) => {
        const square = `${"abcdefgh"[col]}${8 - row}` as Square;
        const light = (row + col) % 2 === 0;
        const marked = selected === square || lastMove?.includes(square);
        return (
          <button
            key={square}
            type="button"
            disabled={!onSquareClick}
            onClick={() => onSquareClick?.(square)}
            aria-label={`${piece ? `${piece.color === "w" ? "White" : "Black"} ${piece.type}` : "Empty"} ${square}`}
            aria-pressed={selected === square}
            className={`relative flex min-h-0 min-w-0 items-center justify-center text-[9cqi] leading-none transition-colors ${light ? "bg-[#e9d9b8]" : "bg-[#8b6b52]"} ${marked ? "ring-4 ring-inset ring-amber-400/70" : ""} ${onSquareClick ? "cursor-pointer hover:brightness-110 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-amber-300" : "cursor-default"}`}
          >
            {piece && <span className={piece.color === "w" ? "text-[#fffaf0] [text-shadow:0_2px_2px_#422d20,0_0_3px_#422d20]" : "text-[#211b1b] [text-shadow:0_1px_1px_#f7e4be]"}>{pieces[`${piece.color}${piece.type}`]}</span>}
            {col === 0 && <span className={`absolute left-0.5 top-0.5 text-[8px] font-bold ${light ? "text-[#755b44]" : "text-[#f3e4ca]"}`}>{8 - row}</span>}
            {row === 7 && <span className={`absolute bottom-0.5 right-1 text-[8px] font-bold ${light ? "text-[#755b44]" : "text-[#f3e4ca]"}`}>{"abcdefgh"[col]}</span>}
          </button>
        );
      }))}
    </div>
  );
}
