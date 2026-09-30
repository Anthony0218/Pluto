import { ui, useUiLanguage } from "@/i18n/ui";
import { useChessSettings } from "../../../context/ChessSettingsContext";

/** Compact switch for the header of every hotseat page: animate the board flip between turns. */
export default function BoardAnimationToggle() {
  useUiLanguage();
  const { boardAnimationEnabled, setBoardAnimationEnabled } = useChessSettings();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={boardAnimationEnabled}
      title={ui("Animate board rotation")}
      onClick={() => setBoardAnimationEnabled((enabled) => !enabled)}
      className="chess-animation-control flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-zinc-200 transition hover:border-amber-300/50 focus-visible:outline-2 focus-visible:outline-amber-300"
    >
      <span className="whitespace-nowrap">{ui("Board animation")}</span>
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 ${
          boardAnimationEnabled ? "border-amber-300/40 bg-amber-400" : "border-white/10 bg-zinc-700"
        }`}
      >
        <span
          className={`absolute left-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow-md transition-transform duration-200 ${
            boardAnimationEnabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}
