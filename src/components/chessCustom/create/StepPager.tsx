import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { adjacentSteps, stepLabel, stepNumber } from "@/games/chess/custom/library/navigation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { NextIcon, PreviousIcon } from "../icons/ChessCustomIcons";

/** Previous / Next at the bottom of every Create step. */
export default function StepPager() {
  useGameLanguage();
  const { step, goToStep } = useEditor();
  const { previous, next } = adjacentSteps(step);
  const card =
    "group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0d1014]/85 px-4 py-3 transition hover:border-amber-300/35 hover:bg-amber-300/[0.04] focus-visible:outline-2 focus-visible:outline-amber-300 sm:max-w-xs";
  return (
    <nav aria-label={ui("Step navigation")} className="mt-10 flex items-stretch gap-3 border-t border-white/[0.06] pt-5">
      {gameUi(previous ? (
        <button type="button" onClick={() => goToStep(previous)} className={card}>
          <PreviousIcon size={20} className="shrink-0 text-zinc-500 transition group-hover:-translate-x-0.5 group-hover:text-amber-300" />
          <span className="min-w-0 text-left">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{ui("Previous")}</span>
            <span className="block truncate text-sm font-semibold text-zinc-100">
              <span className="font-mono text-xs text-zinc-500">{gameUi(stepNumber(previous))}</span> {ui(stepLabel(previous))}
            </span>
          </span>
        </button>
      ) : (
        <span className="hidden flex-1 sm:block" />
      ))}
      {gameUi(next && (
        <button type="button" onClick={() => goToStep(next)} className={`${card} ml-auto justify-end border-amber-300/25 bg-amber-300/[0.06]`}>
          <span className="min-w-0 text-right">
            <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-amber-300/80">{ui("Next")}</span>
            <span className="block truncate text-sm font-semibold text-white">
              <span className="font-mono text-xs text-amber-300/70">{gameUi(stepNumber(next))}</span> {ui(stepLabel(next))}
            </span>
          </span>
          <NextIcon size={20} className="shrink-0 text-amber-300 transition group-hover:translate-x-0.5" />
        </button>
      ))}
    </nav>
  );
}
