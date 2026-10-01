import { ui, useUiLanguage } from "@/i18n/ui";

/** Chess Coach switch: show the engine's top move on the board every turn (see useAutoBestMove). */
export default function AutoBestMoveToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  useUiLanguage();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`mt-2 flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-amber-300 ${
        enabled ? "border-amber-400/30 bg-amber-400/[0.07]" : "border-white/10 bg-black/20 hover:border-amber-400/25"
      }`}
    >
      <span className="min-w-0">
        <span className={`block text-xs font-bold ${enabled ? "text-amber-200" : "text-zinc-200"}`}>{ui("Auto-show best move")}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500">{ui("Puts the engine's top move on the board every turn")}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 ${
          enabled ? "border-amber-300/40 bg-amber-400" : "border-white/10 bg-zinc-700"
        }`}
      >
        <span
          className={`absolute left-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 ${
            enabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
