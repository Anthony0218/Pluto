import { Chess, type Square } from "chess.js";
import { Shield } from "lucide-react";
import { useId, type DragEvent } from "react";
import type { BoardAnnotations } from "../chess/singleplayer/boardAnnotations";
import { ReviewQualityIcon } from "../chess/singleplayer/ReviewQualityBadge";
import { qualityColor } from "../chess/singleplayer/reviewQualityVisuals";

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
  /** Game Review marks, arrows and badges (replaces the last-move ring). */
  annotations?: BoardAnnotations | null;
  label: string;
};

const squareCenter = (square: Square) => ({ x: (square.charCodeAt(0) - 96.5) * 100, y: (8.5 - Number(square[1])) * 100 });

export default function ChessPreviewBoard({ fen, selected, lastMove, legalSquares = [], wrongSquare, wrongFrom, correctSquare, correctFrom, animatedMove, onSquareClick, onMoveAttempt, annotations, label }: Props) {
  const arrowId = `preview-arrow-${useId().replace(/:/g, "")}`;
  const arrows = (annotations?.arrows ?? []).map((arrow) => {
    const from = squareCenter(arrow.from);
    const to = squareCenter(arrow.to);
    // Stop short of the square centre so the arrow head does not cover the piece.
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { ...arrow, x1: from.x, y1: from.y, x2: to.x - ((to.x - from.x) / length) * 22, y2: to.y - ((to.y - from.y) / length) * 22 };
  });
  const position = new Chess(fen);
  const board = position.board();
  const checkedKing = position.inCheck() ? position.findPiece({ type: "k", color: position.turn() })[0] : null;
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
        const marked = selected === square || (!annotations && lastMove?.includes(square));
        const marks = annotations?.marks?.filter((mark) => mark.square === square) ?? [];
        const badges = annotations?.badges?.filter((badge) => badge.square === square) ?? [];
        const icon = annotations?.icon?.square === square ? annotations.icon : null;
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
            {piece && <span className={`relative z-[6] ${piece.color === "w" ? "text-[#fffaf0] [text-shadow:0_2px_2px_#422d20,0_0_3px_#422d20]" : "text-[#211b1b] [text-shadow:0_1px_1px_#f7e4be]"} ${animatedMove?.from === square ? "invisible" : ""}`}>{pieces[`${piece.color}${piece.type}`]}</span>}
            {marks.map((mark, index) => mark.kind === "outline"
              ? <span key={index} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[7]" style={{ opacity: mark.opacity, boxShadow: `inset 0 0 0 3px ${mark.color}, inset 0 0 12px ${mark.color}66` }} />
              : <span key={index} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[7] grid place-items-center" style={{ opacity: mark.opacity }}><span className="size-[30%] rounded-full border-2 border-dashed" style={{ borderColor: mark.color, background: `${mark.color}1f` }} /></span>)}
            {icon && <span aria-hidden="true" className="pointer-events-none absolute right-0.5 top-0.5 z-[8] grid size-[34%] place-items-center rounded-full border border-white/35 bg-[#06131e]" style={{ color: qualityColor(icon.quality), boxShadow: `0 0 8px ${qualityColor(icon.quality)}aa` }}><ReviewQualityIcon quality={icon.quality} size={11} /></span>}
            {checkedKing === square && <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-[7]" style={{ boxShadow: "inset 0 0 0 3px #ef4444, inset 0 0 14px #ef4444aa" }} />}
            {badges.map((badge, index) => (
              // Top-left, opposite the quality icon in the top-right.
              <span key={index} aria-hidden="true" className="pointer-events-none absolute left-0.5 top-0.5 z-[8] grid size-[34%] place-items-center rounded-full border border-white/35 bg-[#06131e]" style={{ color: badge.color, boxShadow: `0 0 8px ${badge.color}aa` }}><Shield size={11} strokeWidth={2.5} /></span>
            ))}
            {wrongFrom === square && <span aria-hidden="true" className="pointer-events-none absolute inset-1 border-2 border-dashed border-red-600" />}
            {correctFrom === square && <span aria-hidden="true" className={`pointer-events-none absolute border-2 border-dashed border-emerald-600 ${wrongFrom === square ? "inset-2" : "inset-1"}`} />}
            {correctSquare === square && wrongSquare === square && <span aria-hidden="true" className="pointer-events-none absolute inset-1 border-2 border-emerald-600" />}
            {(wrongFrom === square || correctFrom === square) && <span className="sr-only">{wrongFrom === square ? "Attempted move starts here. " : ""}{correctFrom === square ? "Correct move starts here." : ""}</span>}
            {legalSquares.includes(square) && <span className={`pointer-events-none absolute inset-0 m-auto rounded-full bg-emerald-800/50 ${piece ? "h-[85%] w-[85%] border-4 border-emerald-700/70 bg-transparent" : "h-[25%] w-[25%]"}`} />}
            {wrongSquare === square && <span aria-hidden="true" className="pointer-events-none absolute bottom-0.5 right-0.5 z-20 flex size-[20%] min-h-3 min-w-3 items-center justify-center rounded-full bg-red-600 text-[max(10px,2.8cqi)] font-black text-white shadow-sm">×</span>}
            {correctSquare === square && <span aria-hidden="true" className={`pointer-events-none absolute right-0.5 top-0.5 z-20 flex size-[20%] min-h-3 min-w-3 items-center justify-center rounded-full bg-emerald-600 text-[max(10px,2.8cqi)] font-black text-white shadow-sm`}>✓</span>}
            {col === 0 && <span className={`absolute left-0.5 top-0.5 text-[8px] font-bold ${light ? "text-[#755b44]" : "text-[#f3e4ca]"}`}>{8 - row}</span>}
            {row === 7 && <span className={`absolute bottom-0.5 right-1 text-[8px] font-bold ${light ? "text-[#755b44]" : "text-[#f3e4ca]"}`}>{"abcdefgh"[col]}</span>}
          </button>
        );
      }))}
      {arrows.length > 0 && (
        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full" viewBox="0 0 800 800" aria-hidden="true">
          <defs>
            {arrows.map((arrow, index) => <marker key={index} id={`${arrowId}-${index}`} markerWidth="4" markerHeight="4" refX="1.5" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4 Z" fill={arrow.color} /></marker>)}
          </defs>
          {arrows.map((arrow, index) => <line key={index} x1={arrow.x1} y1={arrow.y1} x2={arrow.x2} y2={arrow.y2} stroke={arrow.color} strokeWidth="10" strokeLinecap="round" markerEnd={`url(#${arrowId}-${index})`} opacity={arrow.opacity} />)}
        </svg>
      )}
      {animatedMove && movingPiece && <span aria-hidden="true" className={`pointer-events-none absolute z-30 flex items-center justify-center text-[9cqi] leading-none transition-transform duration-300 ease-in-out ${movingPiece.color === "w" ? "text-[#fffaf0] [text-shadow:0_2px_2px_#422d20,0_0_3px_#422d20]" : "text-[#211b1b] [text-shadow:0_1px_1px_#f7e4be]"}`} style={{ left: `${fromColumn * 12.5}%`, top: `${fromRow * 12.5}%`, width: "12.5%", height: "12.5%", transform: animatedMove.atDestination ? `translate(${(toColumn - fromColumn) * 100}%, ${(toRow - fromRow) * 100}%)` : "translate(0, 0)" }}>{pieces[`${movingPiece.color}${movingPiece.type}`]}</span>}
    </div>
  );
}
