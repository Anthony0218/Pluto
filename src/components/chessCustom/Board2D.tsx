import { memo, type DragEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { isLightSquare, squareName } from "@/games/chess/custom/engine/board";
import type { BoardCell, BoardDefinition, Coord, GameVariant } from "@/games/chess/custom/engine/types";
import { TILE_STYLES, type BoardVisualTheme } from "@/games/chess/custom/themes";
import { coordKey, DRAG_MIME } from "@/games/chess/custom/editor/editorUtils";
import PieceToken from "./PieceToken";

export type CellHighlight = "selected" | "move" | "capture" | "special" | "illegal" | "lastFrom" | "lastTo" | "check" | "target";

export interface Board2DPiece {
  key: string;
  type: string;
  team: string;
  x: number;
  y: number;
}

interface Props {
  board: BoardDefinition;
  variant: GameVariant;
  theme: BoardVisualTheme;
  pieces?: Board2DPiece[];
  highlights?: Map<string, CellHighlight>;
  /** Editors show missing cells as dashed outlines so they can be re-enabled. */
  showDisabled?: boolean;
  showCoords?: boolean;
  flipped?: boolean;
  label: string;
  onCellClick?: (coord: Coord, event: MouseEvent) => void;
  onCellContextMenu?: (coord: Coord) => void;
  onCellPointerDown?: (coord: Coord, event: PointerEvent) => void;
  onCellPointerEnter?: (coord: Coord, event: PointerEvent) => void;
  onDropPayload?: (coord: Coord, payload: string, event: DragEvent) => void;
  onPieceDragStart?: (piece: Board2DPiece, event: DragEvent) => void;
  cellBadge?: (cell: BoardCell) => ReactNode;
}

const highlightClass: Record<CellHighlight, string> = {
  selected: "shadow-[inset_0_0_0_3px_rgba(252,211,77,.95)]",
  move: "",
  capture: "",
  special: "",
  illegal: "",
  lastFrom: "after:absolute after:inset-0 after:bg-amber-300/20",
  lastTo: "after:absolute after:inset-0 after:bg-amber-300/30",
  check: "after:absolute after:inset-0 after:bg-[radial-gradient(circle,rgba(239,68,68,.8),transparent_70%)]",
  target: "shadow-[inset_0_0_0_3px_rgba(56,189,248,.9)]",
};

function Marker({ kind }: { kind: CellHighlight }) {
  if (kind === "move") return <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[28%] w-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400/80 shadow-[0_0_12px_rgba(56,189,248,.9)]" />;
  if (kind === "capture") return <span className="pointer-events-none absolute inset-[6%] z-20 rounded-full border-[3px] border-red-500/85 shadow-[0_0_14px_rgba(239,68,68,.7)]" />;
  if (kind === "special") return <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[32%] w-[32%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm bg-amber-300/85 shadow-[0_0_14px_rgba(252,211,77,.9)]" />;
  if (kind === "illegal") return <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-[min(2.2vw,14px)] font-black text-zinc-900/45">×</span>;
  return null;
}

/** Generic 2D board for editors and quick tests. y = 0 is White's side (bottom). */
function Board2D({
  board,
  variant,
  theme,
  pieces = [],
  highlights,
  showDisabled = false,
  showCoords = true,
  flipped = false,
  label,
  onCellClick,
  onCellContextMenu,
  onCellPointerDown,
  onCellPointerEnter,
  onDropPayload,
  onPieceDragStart,
  cellBadge,
}: Props) {
  const byCell = new Map(pieces.map((piece) => [coordKey(piece), piece]));
  const rows = Array.from({ length: board.height }, (_, index) => (flipped ? index : board.height - 1 - index));
  const columns = Array.from({ length: board.width }, (_, index) => (flipped ? board.width - 1 - index : index));

  return (
    <div
      role="grid"
      aria-label={label}
      className="grid w-full select-none overflow-hidden rounded-xl p-[1.5%] shadow-[0_24px_60px_rgba(0,0,0,.45)]"
      style={{ gridTemplateColumns: `repeat(${board.width}, minmax(0, 1fr))`, background: theme.frame, boxShadow: `inset 0 0 0 1px ${theme.trim}55, 0 24px 60px rgba(0,0,0,.45)` }}
    >
      {rows.map((y) =>
        columns.map((x) => {
          const cell = board.cells[y * board.width + x];
          const key = `${x},${y}`;
          const piece = byCell.get(key);
          const highlight = highlights?.get(key);
          const tile = TILE_STYLES[cell.tile];
          const def = piece ? variant.pieces.find((entry) => entry.id === piece.type) : undefined;
          const team = piece ? variant.teams.find((entry) => entry.id === piece.team) : undefined;
          const name = squareName(cell);
          const showFile = showCoords && y === rows[rows.length - 1];
          const showRank = showCoords && x === columns[0];

          if (!cell.enabled && !showDisabled) {
            return <div key={key} role="gridcell" aria-label={`${name}: not part of the board`} className="aspect-square" />;
          }

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              aria-label={`${name}${cell.enabled ? "" : " (disabled)"}${cell.tile !== "normal" ? `, ${tile.label} tile` : ""}${def ? `, ${team?.name ?? ""} ${def.name}` : ""}`}
              onClick={(event) => onCellClick?.(cell, event)}
              onContextMenu={(event) => {
                if (!onCellContextMenu) return;
                event.preventDefault();
                onCellContextMenu(cell);
              }}
              onPointerDown={(event) => onCellPointerDown?.(cell, event)}
              onPointerEnter={(event) => onCellPointerEnter?.(cell, event)}
              onDragOver={onDropPayload ? (event) => event.preventDefault() : undefined}
              onDrop={
                onDropPayload
                  ? (event) => {
                      event.preventDefault();
                      const payload = event.dataTransfer.getData(DRAG_MIME);
                      if (payload) onDropPayload(cell, payload, event);
                    }
                  : undefined
              }
              className={`relative aspect-square outline-none transition-[filter] hover:brightness-110 focus-visible:z-30 focus-visible:shadow-[inset_0_0_0_2px_#38bdf8] ${highlight ? highlightClass[highlight] : ""} ${
                cell.enabled ? "" : "bg-transparent! shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)] [background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.05)_0_4px,transparent_4px_9px)]!"
              }`}
              style={{ background: isLightSquare(cell) ? theme.light : theme.dark }}
            >
              {cell.enabled && cell.tile !== "normal" && (
                <span
                  className="pointer-events-none absolute inset-0 flex items-start justify-end p-[6%] text-[min(1.6vw,11px)] font-bold leading-none"
                  style={{
                    background: cell.tile === "blocked" ? `repeating-linear-gradient(45deg, ${tile.color}f0 0 5px, #292524f0 5px 10px)` : `radial-gradient(circle, ${tile.color}55 0%, ${tile.color}25 65%, ${tile.color}10 100%)`,
                    boxShadow: `inset 0 0 0 2px ${tile.color}aa`,
                    color: tile.color,
                    textShadow: "0 1px 2px rgba(0,0,0,.7)",
                  }}
                >
                  {cell.tile === "oneWay" && cell.direction ? (
                    <span style={{ transform: `rotate(${Math.atan2(-cell.direction.y, cell.direction.x)}rad)` }}>{tile.glyph}</span>
                  ) : (
                    tile.glyph
                  )}
                </span>
              )}
              {cellBadge?.(cell)}
              {piece && (
                <span
                  draggable={Boolean(onPieceDragStart)}
                  onDragStart={onPieceDragStart ? (event) => onPieceDragStart(piece, event) : undefined}
                  className={`absolute inset-[6%] z-10 flex items-center justify-center ${onPieceDragStart ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  <PieceToken def={def} team={team} />
                </span>
              )}
              {highlight && <Marker kind={highlight} />}
              {showFile && <span className="pointer-events-none absolute bottom-[3%] right-[6%] text-[min(1.4vw,9px)] font-bold opacity-60" style={{ color: isLightSquare(cell) ? theme.dark : theme.light }}>{name[0]}</span>}
              {showRank && <span className="pointer-events-none absolute left-[5%] top-[3%] text-[min(1.4vw,9px)] font-bold opacity-60" style={{ color: isLightSquare(cell) ? theme.dark : theme.light }}>{y + 1}</span>}
            </button>
          );
        }),
      )}
    </div>
  );
}

export default memo(Board2D);
