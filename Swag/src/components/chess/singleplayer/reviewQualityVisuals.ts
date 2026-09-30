import { ChevronsUp, Compass, Crown, Gem, ShieldX, Target, type LucideIcon } from "lucide-react";
import type { MoveQuality } from "@/utils/chessAnalysis";

// "Missed Win" is derived in the game review from the evaluation swing.
export type ReviewVisualQuality = MoveQuality | "Missed Win";

export const qualityVisuals: Record<ReviewVisualQuality, { Icon: LucideIcon; color: string; classes: string }> = {
  Best: { Icon: Crown, color: "#31e794", classes: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" },
  Excellent: { Icon: Gem, color: "#31dff3", classes: "border-cyan-400/40 bg-cyan-400/15 text-cyan-300" },
  Good: { Icon: ChevronsUp, color: "#389eff", classes: "border-blue-400/40 bg-blue-400/15 text-blue-300" },
  Inaccuracy: { Icon: Compass, color: "#ffc64c", classes: "border-amber-400/40 bg-amber-400/15 text-amber-300" },
  Mistake: { Icon: ShieldX, color: "#ff863f", classes: "border-orange-400/40 bg-orange-400/15 text-orange-300" },
  Blunder: { Icon: Crown, color: "#ff4d67", classes: "border-rose-400/40 bg-rose-400/15 text-rose-300" },
  "Missed Win": { Icon: Target, color: "#b862ff", classes: "border-violet-400/40 bg-violet-400/15 text-violet-300" },
};

export const qualityColor = (quality: ReviewVisualQuality) => qualityVisuals[quality].color;
