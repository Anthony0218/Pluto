import { ArrowRight, BarChart3, BookOpen, Puzzle, Shuffle } from "lucide-react";
import { Link } from "react-router-dom";
import { ui, useUiLanguage } from "@/i18n/ui";

const lessons = [
  { title: "Chess Analysis", description: "Review your saved games and improve move by move.", route: "/games/chess/analysis", Icon: BarChart3 },
  { title: "Chess puzzles", description: "Practice tactics one move at a time.", route: "/games/chess/rules?tab=puzzles", Icon: Puzzle },
  { title: "Watten rules", description: "Learn the cards, trump and scoring.", route: "/games/watten/rules", Icon: BookOpen },
  { title: "Chess variants", description: "Explore new ways to play chess.", route: "/games/chess/variants", Icon: Shuffle },
];

export default function LearnSomethingNew() {
  useUiLanguage();
  return <section className="dash-panel learn-panel" aria-labelledby="dashboard-learn-title">
    <div className="dash-section-heading"><div><h2 id="dashboard-learn-title">{ui("Learn")}</h2><p>{ui("Pick something new to try.")}</p></div><Link to="/learn" className="dash-text-link">{ui("View all")}<ArrowRight size={14} /></Link></div>
    <div className="dashboard-learning-links">{lessons.map(({ title, description, route, Icon }) => <Link key={route} to={route} className="dashboard-learning-link"><span className="dashboard-learning-icon"><Icon size={19} /></span><span className="min-w-0 flex-1"><strong>{ui(title)}</strong><small>{ui(description)}</small></span><ArrowRight size={15} className="text-indigo-300" /></Link>)}</div>
  </section>;
}
