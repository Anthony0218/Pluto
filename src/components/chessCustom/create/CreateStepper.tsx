import { gameUi, useGameLanguage } from "../../../i18n/gameUi.ts";
import { useEffect, useRef } from "react";
import { CREATE_STEPS, stepNumber, type CreateStep } from "@/games/chess/custom/library/navigation";
import { useEditor } from "@/games/chess/custom/editor/editorContext";
import { ui } from "@/i18n/ui";
import { STEP_ICONS } from "../icons/stepIcons";
import ValidationPanel from "../ValidationPanel";

/**
 * The numbered Create steps. The order is a suggestion: every step can be
 * opened directly. Desktop shows a sidebar; phones a horizontal step strip.
 */
export default function CreateStepper() {
  useGameLanguage();
  const { step, goToStep, issues, variant } = useEditor();
  const strip = useRef<HTMLDivElement>(null);
  const problems = (id: CreateStep) => issues.filter((issue) => issue.section === id && issue.severity !== "info").length;
  const counts: Partial<Record<CreateStep, number>> = {
    teams: variant.teams.length,
    pieces: variant.pieces.length,
    events: variant.events.length,
    victory: variant.victoryConditions.filter((condition) => condition.enabled).length,
    position: variant.setup.pieces.length,
  };

  // Keep the current step visible in the phone strip.
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>("[aria-current=step]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [step]);

  const badge = (id: CreateStep) => {
    const count = problems(id);
    if (count) return <span title={gameUi(`${count} ${ui("issue(s)")}`)} className="rounded-full bg-amber-300/15 px-1.5 text-[10px] font-bold text-amber-200">{gameUi(count)}</span>;
    return counts[id] !== undefined ? <span className="text-[10px] font-semibold text-zinc-600">{gameUi(counts[id])}</span> : null;
  };

  return (
    <>
      <nav aria-label={ui("Create steps")} className="sticky top-0 z-30 -mx-4 border-b border-white/[0.06] bg-[#07090b]/95 px-4 py-2 backdrop-blur lg:hidden">
        <div ref={strip} className="overflow-x-auto [scrollbar-width:none]">
          <ol className="flex w-max gap-1.5">
            {CREATE_STEPS.map(({ id, label }) => {
              const Icon = STEP_ICONS[id];
              const active = step === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => goToStep(id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/50" : "text-zinc-400 hover:bg-white/[0.05] hover:text-white"}`}
                  >
                    <span className={`font-mono text-[10px] ${active ? "text-amber-300" : "text-zinc-600"}`}>{gameUi(stepNumber(id))}</span>
                    <Icon size={15} />
                    {ui(label)}
                    {problems(id) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-label={ui("has issues")} />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <aside className="sticky top-4 hidden max-h-[calc(var(--app-height)-32px)] flex-col gap-4 overflow-y-auto pb-6 lg:flex">
        <nav aria-label={ui("Create steps")} data-guide="create-steps">
          <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.28em] text-zinc-600">{ui("Create")}</p>
          <ol className="relative space-y-0.5">
            <span aria-hidden="true" className="absolute bottom-5 left-[29px] top-5 w-px bg-gradient-to-b from-amber-300/25 via-white/[0.08] to-sky-400/25" />
            {CREATE_STEPS.map(({ id, label, hint }) => {
              const Icon = STEP_ICONS[id];
              const active = step === id;
              return (
                <li key={id} className="relative">
                  <button
                    type="button"
                    aria-current={active ? "step" : undefined}
                    onClick={() => goToStep(id)}
                    className={`group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-amber-300 ${
                      active ? "bg-gradient-to-r from-amber-300/15 to-transparent text-amber-50 shadow-[inset_2px_0_0_#fcd34d]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                    }`}
                  >
                    <span
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-[#0b0d10] transition ${
                        active ? "border-amber-300/60 text-amber-200 shadow-[0_0_16px_rgba(252,211,77,.25)]" : "border-white/10 text-zinc-500 group-hover:border-white/20 group-hover:text-zinc-300"
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`font-mono text-[11px] font-bold ${active ? "text-amber-300" : "text-zinc-600"}`}>{gameUi(stepNumber(id))}</span>
                        <span className={`truncate text-sm ${active ? "font-bold" : "font-medium"}`}>{ui(label)}</span>
                      </span>
                      <span className="block truncate text-[11px] text-zinc-600">{ui(hint)}</span>
                    </span>
                    {gameUi(badge(id))}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <ValidationPanel compact />
      </aside>
    </>
  );
}
