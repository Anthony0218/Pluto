import { gameUi, useGameLanguage } from "../../i18n/gameUi.ts";
import { ArrowUpRight, Eraser } from "lucide-react";
import type { ReactNode } from "react";
import type { SquareBrush } from "@/games/chess/custom/editor/movementBrush";
import { ui } from "@/i18n/ui";

const BRUSHES: { id: SquareBrush; label: string; hint: string; swatch: ReactNode }[] = [
  { id: "both", label: "Move + capture", hint: "The piece may move to or capture on this square.", swatch: <span className="h-3.5 w-3.5 rounded-sm bg-purple-500/80" /> },
  { id: "move", label: "Move only", hint: "The piece may move here but never captures here.", swatch: <span className="h-3.5 w-3.5 rounded-sm bg-sky-400/80" /> },
  { id: "capture", label: "Capture only", hint: "The piece may only land here by capturing.", swatch: <span className="h-3.5 w-3.5 rounded-sm bg-red-500/80" /> },
  { id: "firstMove", label: "First move only", hint: "A move allowed only while the piece has never moved (like a pawn's double step).", swatch: <span className="rounded-sm bg-amber-300/90 px-0.5 text-[8px] font-black leading-[14px] text-zinc-950">{gameUi("1st")}</span> },
  { id: "clearFirstMove", label: "Remove first move", hint: "Turns a first-move square back into a normal move square.", swatch: <span className="rounded-sm border border-amber-300/80 px-0.5 text-[8px] font-black leading-[12px] text-amber-200 line-through">{gameUi("1st")}</span> },
  { id: "line", label: "Slide line", hint: "Click any square to add or remove a sliding ray in that direction (like a rook or bishop).", swatch: <ArrowUpRight size={14} className="text-emerald-300" /> },
  { id: "erase", label: "Erase square", hint: "Removes the square (or the slide ray through it).", swatch: <Eraser size={14} className="text-zinc-300" /> },
];

/** Square brushes: pick one, then click squares on the movement grid. */
export default function MovementBrushPalette({ value, onChange }: { value: SquareBrush; onChange: (brush: SquareBrush) => void }) {
  useGameLanguage();
  const active = BRUSHES.find((brush) => brush.id === value);
  return (
    <div>
      <div role="radiogroup" aria-label={ui("Square brush")} className="flex flex-wrap gap-1.5">
        {BRUSHES.map((brush) => (
          <button
            key={brush.id}
            type="button"
            role="radio"
            aria-checked={value === brush.id}
            title={ui(brush.hint)}
            onClick={() => onChange(brush.id)}
            className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${value === brush.id ? "border-sky-400/60 bg-sky-400/15 text-sky-50" : "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/20"}`}
          >
            <span className="flex h-4 min-w-4 items-center justify-center">{gameUi(brush.swatch)}</span>
            {ui(brush.label)}
          </button>
        ))}
      </div>
      {active && <p className="mt-2 text-xs leading-5 text-zinc-500" aria-live="polite">{ui(active.hint)}</p>}
    </div>
  );
}
