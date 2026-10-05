import { useEffect, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check, Star } from "lucide-react";
import { toolApps } from "@/data/toolCatalog";
import { learningPaths, pathRoute } from "@/data/learningCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import HubLayout from "@/components/learning/HubLayout";
import CatalogIcon from "@/components/learning/CatalogIcon";
import PercentageWorkbench from "@/components/tools/PercentageWorkbench";
import NumberSystemConverter from "@/components/tools/NumberSystemConverter";
import UnitConverter from "@/components/tools/UnitConverter";
import RecipeScaler from "@/components/tools/RecipeScaler";
import { ui, useUiLanguage } from "@/i18n/ui";
import NotFoundPage from "@/pages/general/NotFoundPage";

export default function ToolAppPage() {
  useUiLanguage();
  const { toolId } = useParams();
  const tool = toolApps.find(item => item.id === toolId);
  const { progress, loading, visitTool, toggleFavoriteTool } = useLearningToolsProgress();
  useEffect(() => { if (tool) visitTool(tool.id); }, [tool, visitTool]);
  if (!tool) return <NotFoundPage />;
  const app = tool.id === "percentage-calculator" ? <PercentageWorkbench /> : tool.id === "number-system-converter" ? <NumberSystemConverter /> : tool.id === "unit-converter" ? <UnitConverter /> : tool.id === "recipe-scaler" ? <RecipeScaler /> : null;
  const favorite = progress.favoriteTools.includes(tool.id);
  const related = learningPaths.find(path => path.subjectId === tool.relatedPath?.subjectId && path.id === tool.relatedPath?.id);
  return <HubLayout eyebrow={tool.category} title={tool.title} description={tool.description} breadcrumbs={[{ title: "Tools", route: "/tools" }, { title: tool.title }]}
    actions={<button type="button" className="lt-button" disabled={loading} aria-pressed={favorite} onClick={() => toggleFavoriteTool(tool.id)}><Star size={16} aria-hidden fill={favorite ? "currentColor" : "none"} />{ui(favorite ? "Favorited" : "Add to favorites")}</button>}>
    {app ?? <><section className="lt-panel lt-app-preview" style={{ "--lt-accent": tool.accent } as CSSProperties}><span className="lt-icon"><CatalogIcon id={tool.id} size={36} /></span><div><p className="lt-eyebrow">{ui("Coming soon")}</p><h2>{ui("Your app has a place here")}</h2><p>{ui("This is a preview of the planned app. Its features are not available yet. You can favorite it and explore what is coming.")}</p></div></section>
    <section className="lt-section" aria-labelledby="app-features-title"><div className="lt-section-heading"><h2 id="app-features-title">{ui("Planned features")}</h2></div><ul className="lt-feature-list">{tool.features.map(feature => <li key={feature}><Check size={18} aria-hidden /><span>{ui(feature)}</span></li>)}</ul></section></>}
    {related && <section className="lt-panel lt-related"><div><p className="lt-eyebrow">{ui("Learn the idea behind the app")}</p><h2>{ui(related.title)}</h2><p>{ui(related.description)}</p></div><Link className="lt-button" to={pathRoute(related)}>{ui("View learning path")}<ArrowRight size={16} aria-hidden /></Link></section>}
    <Link className="lt-text-link" to="/tools">{ui("Back to apps")}<ArrowRight size={15} aria-hidden /></Link>
  </HubLayout>;
}
