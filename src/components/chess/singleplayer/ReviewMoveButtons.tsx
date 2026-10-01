import { ui, useUiLanguage } from "@/i18n/ui";
import type { MoveQuality } from "@/utils/chessAnalysis";
import { ReviewQualityIcon } from "./ReviewQualityBadge";
import { qualityColor } from "./reviewQualityVisuals";

/** One engine alternative in the Game Review side panel; also used by the landing page preview. */
export function AlternativeMoveButton({
  index,
  san,
  evaluation,
  quality,
  active,
  played = false,
  onClick,
}: {
  index: number;
  san: string;
  evaluation: string;
  quality: MoveQuality;
  active: boolean;
  /** The alternative is the move that was played in the game. */
  played?: boolean;
  onClick: () => void;
}) {
  useUiLanguage();
  const color = qualityColor(quality);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group/quality flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition ${
        active ? "" : "border-white/5 bg-black/20 hover:bg-white/5"
      }`}
      style={active ? { borderColor: `${color}66`, background: `${color}1a` } : undefined}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-black"
          style={active ? { background: color, color: "#09090b" } : { background: `${color}1a`, color }}
        >
          {index + 1}
        </span>

        <div>
          <p className="flex items-center gap-2">
            <span className="font-mono font-bold text-zinc-100">{san}</span>
            <span className="inline-flex items-center gap-1 text-[9px] font-black" style={{ color }}>
              <ReviewQualityIcon quality={quality} size={12} />
              {ui(quality)}
            </span>
            {played && (
              <span className="rounded-md border border-amber-200/25 bg-amber-200/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-100">
                {ui("Played")}
              </span>
            )}
          </p>

          <p className="mt-0.5 text-[10px] text-zinc-600">
            {played
              ? active
                ? ui("Currently played · on the board")
                : ui("Currently played · click to show")
              : active
                ? ui("Highlighted on board")
                : ui("Click to highlight")}
          </p>
        </div>
      </div>

      <span className="text-xs text-zinc-500">{evaluation}</span>
    </button>
  );
}
