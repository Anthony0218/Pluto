import { Orbit, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { Chess3DCameraPreset } from "@/games/chess/3d/chess3dAppearance";
import { ui } from "@/i18n/ui";

const PRESETS: { id: Chess3DCameraPreset; label: string; short: string }[] = [
  { id: "classic", label: "Isometric", short: "ISO" },
  { id: "top", label: "Top-down", short: "TOP" },
  { id: "white", label: "Player perspective", short: "P1" },
  { id: "black", label: "Opponent perspective", short: "P2" },
  { id: "low", label: "Low cinematic", short: "LOW" },
];

const button =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-1.5 text-[10px] font-black tracking-wider transition focus-visible:outline-2 focus-visible:outline-amber-300";

export default function CameraControls({
  preset,
  onPreset,
  onCommand,
  autoOrbit,
  onAutoOrbit,
}: {
  preset: Chess3DCameraPreset;
  onPreset: (preset: Chess3DCameraPreset) => void;
  onCommand: (kind: "zoomIn" | "zoomOut" | "reset") => void;
  autoOrbit: boolean;
  onAutoOrbit: (value: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-black/60 p-2 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur-xl" role="group" aria-label={ui("Camera controls")}>
      <p className="mb-1.5 px-1 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-500">{ui("Camera")}</p>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            title={ui(entry.label)}
            aria-label={ui(entry.label)}
            aria-pressed={preset === entry.id}
            onClick={() => onPreset(entry.id)}
            className={`${button} ${preset === entry.id ? "border-sky-400/60 bg-sky-400/15 text-sky-100" : "border-white/10 text-zinc-400 hover:text-white"}`}
          >
            {entry.short}
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-1">
        <button type="button" title={ui("Zoom in")} aria-label={ui("Zoom in")} onClick={() => onCommand("zoomIn")} className={`${button} border-white/10 text-zinc-300 hover:text-white`}>
          <ZoomIn size={14} />
        </button>
        <button type="button" title={ui("Zoom out")} aria-label={ui("Zoom out")} onClick={() => onCommand("zoomOut")} className={`${button} border-white/10 text-zinc-300 hover:text-white`}>
          <ZoomOut size={14} />
        </button>
        <button type="button" title={ui("Reset camera")} aria-label={ui("Reset camera")} onClick={() => onCommand("reset")} className={`${button} border-white/10 text-zinc-300 hover:text-white`}>
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          title={ui("Auto orbit")}
          aria-label={ui("Auto orbit")}
          aria-pressed={autoOrbit}
          onClick={() => onAutoOrbit(!autoOrbit)}
          className={`${button} ${autoOrbit ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/10 text-zinc-300 hover:text-white"}`}
        >
          <Orbit size={14} />
        </button>
      </div>
      <p className="mt-1.5 px-1 text-[10px] leading-4 text-zinc-600">{ui("Drag to orbit · right-drag to pan · scroll to zoom")}</p>
    </div>
  );
}
