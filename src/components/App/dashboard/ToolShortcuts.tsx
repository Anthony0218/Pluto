import { Link } from "react-router-dom";
import { ArrowRight, Grid2X2, Star } from "lucide-react";
import { toolApps, toolRoute } from "@/data/toolCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import { ui, useUiLanguage } from "@/i18n/ui";

export default function ToolShortcuts() {
  useUiLanguage();
  const { progress } = useLearningToolsProgress();
  const favorites = progress.favoriteTools.flatMap(id => toolApps.filter(tool => tool.id === id)).slice(0, 3);
  return <section className="dash-panel learn-panel" aria-labelledby="dashboard-tools-title">
    <div className="dash-section-heading"><div><h2 id="dashboard-tools-title">{ui("Your apps")}</h2><p>{ui("Keep useful tools close.")}</p></div><Link to="/tools" className="dash-text-link">{ui("All apps")}<ArrowRight size={14} aria-hidden /></Link></div>
    <div className="dashboard-learning-links">{favorites.length ? favorites.map(tool => <Link key={tool.id} to={toolRoute(tool.id)} className="dashboard-learning-link"><span className="dashboard-learning-icon"><Star size={19} aria-hidden /></span><span><strong>{ui(tool.title)}</strong><small>{ui(tool.status === "planned" ? "Coming soon" : tool.description)}</small></span><ArrowRight size={15} aria-hidden /></Link>) : <Link to="/tools" className="dashboard-learning-link"><span className="dashboard-learning-icon"><Grid2X2 size={19} aria-hidden /></span><span><strong>{ui("Explore your app library")}</strong><small>{ui("Favorite an app to find it here. New tools are coming soon.")}</small></span><ArrowRight size={15} aria-hidden /></Link>}</div>
  </section>;
}
