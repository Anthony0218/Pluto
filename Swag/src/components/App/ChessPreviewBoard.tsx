import { Chess, type Square } from "chess.js";
import type { DragEvent } from "react";

const pieces: Record<string, string> = {
  wk: "♔", wq: "♕", wr: "♖", wb: "♗", wn: "♘", wp: "♙",
  bk: "♚", bq: "♛", br: "♜", bb: "♝", bn: "♞", bp: "♟",
};

type Props = {
  fen: string;
  selected?: Square | null;
  lastMove?: [Square, Square] | null;
  legalSquares?: Square[];
  wrongSquare?: Square | null;
  wrongFrom?: Square | null;
  correctSquare?: Square | null;
  correctFrom?: Square | null;
  animatedMove?: { from: Square; to: Square; atDestination: boolean } | null;
  onSquareClick?: (square: Square) => void;
  onMoveAttempt?: (from: Square, to: Square) => void;
  label: string;
};

export default function ChessPreviewBoard({ fen, selected, lastMove, legalSquares = [], wrongSquare, wrongFrom, correctSquare, correctFrom, animatedMove, onSquareClick, onMoveAttempt, label }: Props) {
  const position = new Chess(fen);
  const board = position.board();
  const movingPiece = animatedMove ? position.get(animatedMove.from) : null;
  const fromColumn = animatedMove ? "abcdefgh".indexOf(animatedMove.from[0]) : 0;
  const fromRow = animatedMove ? 8 - Number(animatedMove.from[1]) : 0;
  const toColumn = animatedMove ? "abcdefgh".indexOf(animatedMove.to[0]) : 0;
  const toRow = animatedMove ? 8 - Number(animatedMove.to[1]) : 0;
  function dropOnSquare(event: DragEvent<HTMLButtonElement>, to: Square) {
    event.preventDefault();
    const from = event.dataTransfer.getData("text/plain") as Square;
    if (from && from !== to) onMoveAttempt?.(from, to);
  }
  return (
    <div className="chess-preview-board relative grid aspect-square w-full grid-cols-8 grid-rows-8 overflow-hidden rounded-xl border border-amber-200/20 shadow-[0_16px_40px_rgba(0,0,0,.35)] [container-type:inline-size]" role="group" aria-label={label}>
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
            draggable={Boolean(onMoveAttempt && piece?.color === "w")}
            onDragStart={(event) => { event.dataTransfer.setData("text/plain", square); event.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(event) => { if (onMoveAttempt) event.preventDefault(); }}
            onDrop={(event) => dropOnSquare(event, square)}
            aria-label={`${piece ? `${piece.color === "w" ? "White" : "Black"} ${piece.type}` : "Empty"} ${square}`}
            aria-pressed={selected === square}
            data-wrong-from={wrongFrom === square || undefined}
            data-correct-from={correctFrom === square || undefined}
            data-wrong-to={wrongSquare === square || undefined}
            data-correct-to={correctSquare === square || undefined}
            className={`relative flex min-h-0 min-w-0 items-center justify-center text-[9cqi] leading-none transition-colors ${light ? "bg-[#e9d9b8]" : "bg-[#8b6b52]"} ${marked ? "ring-4 ring-inset ring-amber-400/70" : ""} ${correctSquare === square ? "z-10 ring-[3px] ring-inset ring-emerald-500" : ""} ${wrongSquare === square ? "z-10 ring-[3px] ring-inset ring-red-500" : ""} ${onSquareClick ? "cursor-pointer hover:brightness-110 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-amber-300" : "cursor-default"}`}
          >
            {piece && <span className={`${piece.color === "w" ? "text-[#fffaf0] [text-shadow:0_2px_2px_#422d20,0_0_3px_#422d20]" : "text-[#211b1b] [text-shadow:0_1px_1px_#f7e4be]"} ${animatedMove?.from === square ? "invisible" : ""}`}>{pieces[`${piece.color}${piece.type}`]}</span>}
            {wrongFrom === square && <span aria-hidden="true" className="pointer-events-none absolute inset-1 border-2 border-dashed border-red-600" />}
            {correctFrom === square && <span aria-hidden="true" className={`pointer-events-none absolute border-2 border-dashed border-emerald-600 ${wrongFrom === square ? "inset-2" : "inset-1"}`} />}
            {correctSquare === square && wrongSquare === square && <span aria-hidden="true" className="pointer-events-none absolute inset-1 border-2 border-emerald-600" />}
            {(wrongFrom === square || correctFrom === square) && <span className="sr-only">{wrongFrom === square ? "Attempted move starts here. " : ""}{correctFrom === square ? "Correct move starts here." : ""}</span>}
            {legalSquares.includes(square) && <span className={`pointer-events-none absolute inset-0 m-auto rounded-full bg-emerald-800/50 ${piece ? "h-[85%] w-[85%] border-4 border-emerald-700/70 bg-transparent" : "h-[25%] w-[25%]"}`} />}
            {wrongSquare === square && <span aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0.5 z-20 flex size-[20%] min-h-3 min-w-3 items-center justify-center rounded-full bg-red-600 text-[max(10px,2.8cqi)] font-black text-white shadow-sm">×</span>}
            {correctSquare === square && <span aria-hidden="true" className={`pointer-events-none absolute top-0.5 z-20 flex size-[20%] min-h-3 min-w-3 items-center justify-center rounded-full bg-emerald-600 text-[max(10px,2.8cqi)] font-black text-white shadow-sm ${wrongSquare === square ? "left-[25%]" : "left-0.5"}`}>✓</span>}
            {col === 0 && <span className={`absolute left-0.5 top-0.5 text-[8px] font-bold ${light ? "text-[#755b44]" : "text-[#f3e4ca]"}`}>{8 - row}</span>}
            {row === 7 && <span className={`absolute bottom-0.5 right-1 text-[8px] font-bold ${light ? "text-[#755b44]" : "text-[#f3e4ca]"}`}>{"abcdefgh"[col]}</span>}
          </button>
        );
      }))}
      {animatedMove && movingPiece && <span aria-hidden="true" className={`pointer-events-none absolute z-30 flex items-center justify-center text-[9cqi] leading-none transition-transform duration-300 ease-in-out ${movingPiece.color === "w" ? "text-[#fffaf0] [text-shadow:0_2px_2px_#422d20,0_0_3px_#422d20]" : "text-[#211b1b] [text-shadow:0_1px_1px_#f7e4be]"}`} style={{ left: `${fromColumn * 12.5}%`, top: `${fromRow * 12.5}%`, width: "12.5%", height: "12.5%", transform: animatedMove.atDestination ? `translate(${(toColumn - fromColumn) * 100}%, ${(toRow - fromRow) * 100}%)` : "translate(0, 0)" }}>{pieces[`${movingPiece.color}${movingPiece.type}`]}</span>}
    </div>
  );
}
