import { gameUi } from "../../i18n/gameUi.ts";
import { Crown } from "lucide-react";
import { ui, useUiLanguage } from "@/i18n/ui";

/** Animated golden medallion for players currently in the ranked top 10. */
export default function TopRankBadge({ rank, size = "md", className = "" }: { rank: number; size?: "sm" | "md"; className?: string }) {
  useUiLanguage();
  return <span role="img" aria-label={gameUi(`${ui("Top 10")} · #${rank}`)} title={gameUi(`${ui("Ranked leaderboard")} #${rank}`)} className={`top-rank-badge${rank <= 3 ? " is-podium" : ""}${size === "sm" ? " is-small" : ""} ${className}`}>
    <Crown size={size === "sm" ? 11 : 16} strokeWidth={2.4} aria-hidden="true" />
    <span className="top-rank-badge-number">#{gameUi(rank)}</span>
    <span className="top-rank-badge-label">{ui("Top 10")}</span>
  </span>;
}
