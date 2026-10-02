import { useRef, useState, type PointerEvent } from "react";
import { Eraser, FlipHorizontal2, PaintBucket, Pencil, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";
import { PixelAvatarImage } from "./ProfileAvatarPicker";
import {
  blankPixelGrid,
  decodePixelAvatar,
  encodePixelAvatar,
  floodFill,
  PIXEL_PALETTE,
  PIXEL_SIZE,
  starterPixelGrid,
  type PixelGrid,
} from "./pixelAvatar";

type Tool = "pencil" | "eraser" | "fill";

/** Grid cells on the straight line between two cells, excluding the start. */
function cellsBetween(from: number, to: number) {
  const x0 = from % PIXEL_SIZE, y0 = Math.floor(from / PIXEL_SIZE);
  const x1 = to % PIXEL_SIZE, y1 = Math.floor(to / PIXEL_SIZE);
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const cells: number[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const x = Math.round(x0 + ((x1 - x0) * step) / steps);
    const y = Math.round(y0 + ((y1 - y0) * step) / steps);
    cells.push(y * PIXEL_SIZE + x);
  }
  return cells;
}

const tools: { id: Tool; label: string; Icon: typeof Pencil }[] = [
  { id: "pencil", label: "Pencil", Icon: Pencil },
  { id: "eraser", label: "Eraser", Icon: Eraser },
  { id: "fill", label: "Fill", Icon: PaintBucket },
];

const toolButton = (active: boolean) =>
  `inline-flex h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition focus-visible:outline-2 focus-visible:outline-amber-300 ${
    active ? "border-amber-300 bg-amber-300/15 text-amber-100" : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
  }`;

/** Draw a 16×16 avatar pixel by pixel. No uploads: the drawing is the avatar. */
export default function PixelAvatarEditor({ initialAvatarId, saving, onSave, onCancel }: {
  initialAvatarId?: string | null;
  saving?: boolean;
  onSave: (avatarId: string) => void;
  onCancel: () => void;
}) {
  useUiLanguage();
  const [grid, setGrid] = useState<PixelGrid>(() => decodePixelAvatar(initialAvatarId ?? "") ?? starterPixelGrid());
  const [history, setHistory] = useState<PixelGrid[]>([]);
  const [color, setColor] = useState(12);
  const [tool, setTool] = useState<Tool>("pencil");
  const [mirror, setMirror] = useState(false);
  const lastCell = useRef<number | null>(null);

  function commit(next: PixelGrid) {
    setHistory((current) => [...current.slice(-49), grid]);
    setGrid(next);
  }

  function paintCell(current: PixelGrid, cell: number) {
    const value = tool === "eraser" ? 0 : color;
    const targets = [cell];
    if (mirror) {
      const x = cell % PIXEL_SIZE;
      const y = Math.floor(cell / PIXEL_SIZE);
      targets.push(y * PIXEL_SIZE + (PIXEL_SIZE - 1 - x));
    }
    if (targets.every((index) => current[index] === value)) return current;
    const next = [...current];
    for (const index of targets) next[index] = value;
    return next;
  }

  function cellFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * PIXEL_SIZE);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * PIXEL_SIZE);
    if (x < 0 || y < 0 || x >= PIXEL_SIZE || y >= PIXEL_SIZE) return null;
    return y * PIXEL_SIZE + x;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const cell = cellFromPointer(event);
    if (cell === null) return;
    event.preventDefault();
    if (tool === "fill") {
      commit(floodFill(grid, cell, color));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    lastCell.current = cell;
    commit(paintCell(grid, cell));
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const from = lastCell.current;
    if (from === null) return;
    const cell = cellFromPointer(event);
    if (cell === null || cell === from) return;
    lastCell.current = cell;
    // Fast strokes skip cells between pointer events; fill the gap.
    const path = cellsBetween(from, cell);
    setGrid((current) => path.reduce(paintCell, current));
  }

  function stopPainting() {
    lastCell.current = null;
  }

  function undo() {
    if (!history.length) return;
    setGrid(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_200px]">
      <div>
        <div
          role="img"
          aria-label={ui("Pixel avatar canvas")}
          className="relative mx-auto aspect-square w-full max-w-[420px] touch-none select-none overflow-hidden rounded-2xl border-2 border-white/15 bg-[#0f172a]"
          style={{ cursor: tool === "fill" ? "cell" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={stopPainting}
          onPointerCancel={stopPainting}
          onLostPointerCapture={stopPainting}
        >
          <PixelAvatarImage pixels={grid} className="pointer-events-none absolute inset-0 h-full w-full" />
          {/* Grid lines */}
          <svg viewBox={`0 0 ${PIXEL_SIZE} ${PIXEL_SIZE}`} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {Array.from({ length: PIXEL_SIZE - 1 }, (_, index) => index + 1).map((line) => (
              <g key={line} stroke="rgba(255,255,255,.08)" strokeWidth="0.04">
                <line x1={line} y1={0} x2={line} y2={PIXEL_SIZE} />
                <line x1={0} y1={line} x2={PIXEL_SIZE} y2={line} />
              </g>
            ))}
            {mirror && <line x1={PIXEL_SIZE / 2} y1={0} x2={PIXEL_SIZE / 2} y2={PIXEL_SIZE} stroke="rgba(252,211,77,.55)" strokeWidth="0.08" strokeDasharray="0.3 0.25" />}
          </svg>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Preview")}</p>
          <div className="mt-2 flex items-end gap-3">
            <PixelAvatarImage pixels={grid} className="h-16 w-16 rounded-2xl border border-white/10" />
            <PixelAvatarImage pixels={grid} className="h-9 w-9 rounded-full border border-white/10" />
          </div>
        </div>

        <fieldset>
          <legend className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Colors")}</legend>
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {PIXEL_PALETTE.map((swatch, index) => (
              <button
                key={swatch}
                type="button"
                aria-label={`${ui("Color")} ${index + 1}`}
                aria-pressed={color === index && tool !== "eraser"}
                onClick={() => { setColor(index); if (tool === "eraser") setTool("pencil"); }}
                className={`aspect-square rounded-md border-2 focus-visible:outline-2 focus-visible:outline-amber-300 ${color === index && tool !== "eraser" ? "border-amber-300 scale-110" : "border-white/15"}`}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          {tools.map(({ id, label, Icon }) => (
            <button key={id} type="button" aria-pressed={tool === id} onClick={() => setTool(id)} className={toolButton(tool === id)}>
              <Icon size={15} aria-hidden="true" />{ui(label)}
            </button>
          ))}
          <button type="button" aria-pressed={mirror} onClick={() => setMirror((value) => !value)} className={toolButton(mirror)}>
            <FlipHorizontal2 size={15} aria-hidden="true" />{ui("Mirror")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={undo} disabled={!history.length} className={`${toolButton(false)} disabled:opacity-40`}><Undo2 size={15} aria-hidden="true" />{ui("Undo")}</button>
          <button type="button" onClick={() => commit(starterPixelGrid())} className={toolButton(false)}><RotateCcw size={15} aria-hidden="true" />{ui("Template")}</button>
          <button type="button" onClick={() => commit(blankPixelGrid())} className={toolButton(false)}><Trash2 size={15} aria-hidden="true" />{ui("Clear")}</button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-black text-zinc-300 hover:bg-white/10">{ui("Cancel")}</button>
          <button type="button" disabled={saving} onClick={() => onSave(encodePixelAvatar(grid))} className="rounded-xl bg-amber-400 px-3 py-2.5 text-sm font-black text-amber-950 hover:bg-amber-300 disabled:opacity-50">{saving ? ui("Saving...") : ui("Save avatar")}</button>
        </div>
      </div>
    </div>
  );
}
