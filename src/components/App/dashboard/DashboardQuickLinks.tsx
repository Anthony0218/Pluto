import { ArrowRight, BookOpen, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function DashboardQuickLinks() {
  useUiLanguage();
  return <>
    <section className="dash-panel dashboard-quick-links">
      <div className="dash-section-heading"><h2>{ui("Explore games")}</h2><Search size={19} className="text-sky-300" /></div>
      <p>{ui("Find a new game or learn how to play Watten.")}</p>
      <Link to="/games"><Search size={16} />{ui("All games")}<ArrowRight size={14} /></Link>
      <Link to="/games/watten/rules"><BookOpen size={16} />{ui("Watten rules")}<ArrowRight size={14} /></Link>
    </section>
  </>;
}
