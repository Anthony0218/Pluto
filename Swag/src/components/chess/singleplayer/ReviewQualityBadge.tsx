import { useUiLanguage } from "@/i18n/ui";
import type { MoveQuality } from "@/utils/chessAnalysis";

export default function ReviewQualityBadge({ quality }: { quality: MoveQuality }) {
  useUiLanguage();
  const styles: Record<MoveQuality, string> = {
    Best: "border-emerald-400/30 bg-emerald-500/15 text-emerald-300",
    Excellent: "border-cyan-400/30 bg-cyan-500/15 text-cyan-300",
    Good: "border-blue-400/30 bg-blue-500/15 text-blue-300",
    Inaccuracy: "border-yellow-400/30 bg-yellow-500/15 text-yellow-300",
    Mistake: "border-orange-400/30 bg-orange-500/15 text-orange-300",
    Blunder: "border-red-400/30 bg-red-500/15 text-red-300",
  };

  return <span className={`inline-flex rounded-full border px-2 py-1 text-[8px] font-black uppercase ${styles[quality]}`}>{quality}</span>;
}
