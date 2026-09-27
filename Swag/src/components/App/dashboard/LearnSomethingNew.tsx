import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";
import { learningResources } from "@/data/navigation";
import { featuredGames } from "@/data/dashboard";

export default function LearnSomethingNew() {
  useUiLanguage();
  return <section className="dash-panel learn-panel"><div className="dash-section-heading"><div><h2>{ui("Learn something new")}</h2><p>{ui("Small lessons. New perspectives. Your next move.")}</p></div><Link to="/learn" className="dash-text-link">{ui("View all")}<ArrowRight size={14} /></Link></div><div className="learning-row">{learningResources.slice(0, 3).map((resource, index) => <Link key={resource.route} to={resource.route} className="learning-card"><img src={featuredGames[index]?.image} alt="" /><div><h3>{ui(resource.title)}</h3><p>{ui(resource.description)}</p><span className="dash-text-link">{ui("Start learning")}<ArrowRight size={12} /></span></div></Link>)}</div></section>;
}
