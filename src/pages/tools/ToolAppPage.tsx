import CalorieTracker from '@/components/tools/CalorieTracker';
import QrCodeCreator from '@/components/tools/QrCodeCreator';
import BirthdayReminder from '@/components/tools/BirthdayReminder';
import { useEffect, type CSSProperties } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Check, Star } from "lucide-react";
import { toolApps } from "@/data/toolCatalog";
import { learningPaths, pathRoute } from "@/data/learningCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import HubLayout from "@/components/learning/HubLayout";
import CatalogIcon from "@/components/learning/CatalogIcon";
import Calculator from "@/components/tools/Calculator";
import PercentageWorkbench from "@/components/tools/PercentageWorkbench";
import NumberSystemConverter from "@/components/tools/NumberSystemConverter";
import UnitConverter from "@/components/tools/UnitConverter";
import DayPlanner from '@/components/tools/DayPlanner';
import TimeZonePlanner from '@/components/tools/TimeZonePlanner';
import WorkoutTimer from '@/components/tools/WorkoutTimer';
import BillSplitter from '@/components/tools/BillSplitter';
import BudgetTracker from '@/components/tools/BudgetTracker';
import NotesApp from "@/components/tools/NotesApp";
import { ui, useUiLanguage } from "@/i18n/ui";
import NotFoundPage from "@/pages/general/NotFoundPage";

/** Apps that left the catalog: old links and bookmarks land somewhere useful instead of a 404. */
const retiredTools: Record<string, string> = { "subscription-tracker": "/tools/budget-tracker?section=subscriptions", "weather-explorer": "/tools", "function-plotter": "/learn/math/algebra-functions" };

export default function ToolAppPage() {
  useUiLanguage();
  const { toolId } = useParams();
  const tool = toolApps.find(item => item.id === toolId);
  const { progress, loading, visitTool, toggleFavoriteTool } = useLearningToolsProgress();
  useEffect(() => { if (tool) visitTool(tool.id); }, [tool, visitTool]);
  if (!tool) return toolId && retiredTools[toolId] ? <Navigate to={retiredTools[toolId]} replace /> : <NotFoundPage />;
  const app = tool.id === "qr-code-creator" ? <QrCodeCreator /> : tool.id === "birthday-reminders" ? <BirthdayReminder /> : tool.id === "calorie-tracker" ? <CalorieTracker /> : tool.id === "calculator" ? <Calculator /> : tool.id === "percentage-calculator" ? <PercentageWorkbench /> : tool.id === "number-system-converter" ? <NumberSystemConverter /> : tool.id === "unit-converter" ? <UnitConverter /> : tool.id === "notes" ? <NotesApp /> : tool.id === "day-planner" ? <DayPlanner /> : tool.id === "time-zone-planner" ? <TimeZonePlanner /> : tool.id === "workout-timer" ? <WorkoutTimer /> : tool.id === "bill-splitter" ? <BillSplitter /> : tool.id === "budget-tracker" ? <BudgetTracker /> : null;
  const favorite = progress.favoriteTools.includes(tool.id);
  const related = learningPaths.filter(path => path.subjectId === tool.relatedPath?.subjectId && path.id === tool.relatedPath?.id);
  return <HubLayout eyebrow={tool.category} title={tool.title} description={tool.description} breadcrumbs={[{ title: "Tools", route: "/tools" }, { title: tool.title }]}
    actions={<button type="button" className="lt-button" disabled={loading} aria-pressed={favorite} onClick={() => toggleFavoriteTool(tool.id)}><Star size={16} aria-hidden fill={favorite ? "currentColor" : "none"} />{ui(favorite ? "Favorited" : "Add to favorites")}</button>}>
    {app ?? <><section className="lt-panel lt-app-preview" style={{ "--lt-accent": tool.accent } as CSSProperties}><span className="lt-icon"><CatalogIcon id={tool.id} size={36} /></span><div><p className="lt-eyebrow">{ui("Coming soon")}</p><h2>{ui("Your app has a place here")}</h2><p>{ui("This is a preview of the planned app. Its features are not available yet. You can favorite it and explore what is coming.")}</p></div></section>
    <section className="lt-section" aria-labelledby="app-features-title"><div className="lt-section-heading"><h2 id="app-features-title">{ui("Planned features")}</h2></div><ul className="lt-feature-list">{tool.features.map(feature => <li key={feature}><Check size={18} aria-hidden /><span>{ui(feature)}</span></li>)}</ul></section></>}
    {related.length > 0 && <details className="lt-tool-learning"><summary>{ui("Learn the idea behind the app")}</summary>{related.map(path => <section key={path.id} className="lt-panel lt-related"><div><p className="lt-eyebrow">{ui("Learn the idea behind the app")}</p><h2>{ui(path.title)}</h2><p>{ui(path.description)}</p></div><Link className="lt-button" to={pathRoute(path)}>{ui("View learning path")}<ArrowRight size={16} aria-hidden /></Link></section>)}</details>}
    <Link className="lt-text-link" to="/tools">{ui("Back to apps")}<ArrowRight size={15} aria-hidden /></Link>
  </HubLayout>;
}
