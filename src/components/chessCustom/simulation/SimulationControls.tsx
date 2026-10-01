import { ChevronsRight, Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import { PLAYBACK_SPEEDS, type GameSession } from "@/games/chess/custom/editor/useGameSession";
import { ui } from "@/i18n/ui";

const glassButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-200 transition hover:border-amber-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-amber-300";

/** Video-player style controls with a scrubbable move timeline. */
export default function SimulationControls({ session, speed, onSpeed, canAutoplay }: { session: GameSession; speed: number; onSpeed: (speed: number) => void; canAutoplay: boolean }) {
  const total = session.frames.length - 1;
  const canPlay = !session.atEnd || canAutoplay;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.09] bg-black/60 px-3 py-2 shadow-[0_20px_50px_rgba(0,0,0,.5)] backdrop-blur-xl">
      <button type="button" className={glassButton} aria-label={ui("Restart")} title={ui("Restart")} onClick={session.restart}>
        <RotateCcw size={16} />
      </button>
      <button type="button" className={glassButton} aria-label={ui("Previous move")} title={ui("Previous move (←)")} disabled={session.cursor === 0} onClick={session.back}>
        <StepBack size={16} />
      </button>
      <button
        type="button"
        aria-label={session.playing ? ui("Pause") : ui("Play")}
        title={session.playing ? ui("Pause (space)") : ui("Play (space)")}
        disabled={!canPlay && !session.playing}
        onClick={() => session.setPlaying(!session.playing)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-300 text-zinc-950 shadow-[0_0_24px_rgba(252,211,77,.35)] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {session.playing ? <Pause size={18} /> : <Play size={18} className="translate-x-[1px]" />}
      </button>
      <button type="button" className={glassButton} aria-label={ui("Next move")} title={ui("Next move (→)")} disabled={session.atEnd} onClick={session.forward}>
        <StepForward size={16} />
      </button>
      <button type="button" className={glassButton} aria-label={ui("Jump to latest move")} title={ui("Jump to latest move")} disabled={session.atEnd} onClick={session.toEnd}>
        <ChevronsRight size={16} />
      </button>
      <div className="flex min-w-[160px] flex-1 items-center gap-3 px-1">
        <input
          type="range"
          min={0}
          max={Math.max(0, total)}
          value={session.cursor}
          disabled={total === 0}
          onChange={(event) => session.jumpTo(Number(event.target.value))}
          aria-label={ui("Timeline")}
          className="h-1.5 flex-1 cursor-pointer accent-amber-300"
        />
        <span className="w-24 text-right font-mono text-[11px] text-zinc-400">
          {ui("Move")} {session.cursor}/{total}
        </span>
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        {ui("Speed")}
        <select value={speed} onChange={(event) => onSpeed(Number(event.target.value))} className="rounded-lg border border-white/10 bg-black/60 px-1.5 py-1 text-xs font-semibold text-zinc-100 outline-none">
          {PLAYBACK_SPEEDS.map((value) => (
            <option key={value} value={value} className="bg-zinc-900">
              {value}×
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
