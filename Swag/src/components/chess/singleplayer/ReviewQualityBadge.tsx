import { ui, useUiLanguage } from "@/i18n/ui";
import { qualityVisuals, type ReviewVisualQuality } from "./reviewQualityVisuals";

export function ReviewQualityIcon({ quality, size = 14 }: { quality: ReviewVisualQuality; size?: number }) {
  const { Icon } = qualityVisuals[quality];
  return <span className="relative inline-flex shrink-0" aria-hidden="true"><Icon size={size} strokeWidth={2.5} />{quality === "Blunder" && <span className="absolute inset-x-0 top-1/2 h-[2px] -rotate-45 bg-current" />}</span>;
}

export default function ReviewQualityBadge({ quality }: { quality: ReviewVisualQuality }) {
  useUiLanguage();
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] font-bold ${qualityVisuals[quality].classes}`}><ReviewQualityIcon quality={quality} />{ui(quality)}</span>;
}
