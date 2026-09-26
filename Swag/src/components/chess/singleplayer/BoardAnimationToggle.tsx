import { ui, useUiLanguage } from "@/i18n/ui";
import { useChessSettings } from "../../../context/ChessSettingsContext";

export default function BoardAnimationToggle() {
  useUiLanguage();
  const { boardAnimationEnabled, setBoardAnimationEnabled } =
    useChessSettings();

  return (
    <div
      className="
      chess-animation-control
      flex
      items-center
      justify-between
      gap-3
      rounded-xl
      border
      border-white/10
      bg-black/20
      px-3
      py-2.5
    "
    >
      <div className="min-w-0">
        <p className="text-xs font-bold text-zinc-200">{ui("Board animation")}</p>

        <p className="mt-0.5 text-[10px] text-zinc-500">{ui("Animate board rotation")}</p>
      </div>

      <button
        type="button"
        onClick={() => setBoardAnimationEnabled((enabled) => !enabled)}
        aria-label={ui("Animate board rotation")}
        aria-pressed={boardAnimationEnabled}
        className={`
          relative
          h-7
          w-12
          shrink-0
          rounded-full
          border
          transition-colors
          duration-200

          ${
            boardAnimationEnabled
              ? "border-amber-300/40 bg-amber-400"
              : "border-white/10 bg-zinc-700"
          }
        `}
      >
        <span
          className={`
            absolute
            left-1
            top-1/2
            h-5
            w-5
            -translate-y-1/2
            rounded-full
            bg-white
            shadow-md
            transition-transform
            duration-200

            ${boardAnimationEnabled ? "translate-x-5" : "translate-x-0"}
          `}
        />
      </button>
    </div>
  );
}
