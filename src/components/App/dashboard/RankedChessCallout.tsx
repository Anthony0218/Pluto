import { ArrowRight, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function RankedChessCallout() {
  useUiLanguage();
  return <section className="dashboard-ranked-callout" aria-label={ui("Play Ranked")}>
    <Trophy size={27} className="shrink-0 text-amber-300" />
    <div className="min-w-0"><p className="dash-eyebrow">{ui("Ranked Chess")}</p><h2>{ui("Play Ranked & compete for the leaderboard!")}</h2></div>
    <Link to="/games/chess/ranked" className="dash-button primary">{ui("Play Ranked")}<ArrowRight size={16} /></Link>
  </section>;
}
