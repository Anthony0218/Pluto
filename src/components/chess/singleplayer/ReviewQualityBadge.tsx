import { ui, useUiLanguage } from "@/i18n/ui";
import { qualityVisuals, type ReviewVisualQuality } from "./reviewQualityVisuals";

/** Glows in its own color; hovering the icon or a `group/quality` parent gives it a small lift and tilt. */
export function ReviewQualityIcon({ quality, size = 14 }: { quality: ReviewVisualQuality; size?: number }) {
  const { Icon } = qualityVisuals[quality];
  return (
    <span
      className="relative inline-flex shrink-0 drop-shadow-[0_0_3px_currentColor] transition-[transform,filter] duration-200 ease-out hover:-rotate-6 hover:scale-125 hover:drop-shadow-[0_0_6px_currentColor] group-hover/quality:-rotate-6 group-hover/quality:scale-125 group-hover/quality:drop-shadow-[0_0_6px_currentColor] motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:group-hover/quality:transform-none"
      aria-hidden="true"
    >
      <Icon size={size} strokeWidth={2.5} />
      {quality === "Blunder" && <span className="absolute inset-x-0 top-1/2 h-[2px] -rotate-45 bg-current" />}
    </span>
  );
}

export default function ReviewQualityBadge({ quality }: { quality: ReviewVisualQuality }) {
  useUiLanguage();
  return <span className={`group/quality inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold ${qualityVisuals[quality].classes}`}><ReviewQualityIcon quality={quality} />{ui(quality)}</span>;
}
