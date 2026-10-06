import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Star } from "lucide-react";
import { toolApps, toolCategories, toolRoute } from "@/data/toolCatalog";
import { useLearningToolsProgress } from "@/hooks/useLearningToolsProgress";
import CatalogIcon from "@/components/learning/CatalogIcon";
import HubLayout from "@/components/learning/HubLayout";
import { ui, useUiLanguage } from "@/i18n/ui";

const views = ["All apps", "Favorites", "Recently viewed"] as const;

export default function ToolsPage() {
  useUiLanguage();
  const { progress, loading, toggleFavoriteTool } = useLearningToolsProgress();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [view, setView] = useState<typeof views[number]>("All apps");
  const search = query.trim().toLocaleLowerCase();
  const catalog = view === "Recently viewed" ? progress.recentTools.flatMap(id => toolApps.filter(tool => tool.id === id)) : toolApps;
  const visible = catalog.filter(tool => tool.id !== "subscription-tracker" && (view !== "Favorites" || progress.favoriteTools.includes(tool.id)) && (category === "All categories" || category === tool.category) && [tool.title, tool.description, tool.category, ...tool.features].some(value => `${value} ${ui(value)}`.toLocaleLowerCase().includes(search)));
  return <HubLayout eyebrow="Your everyday app library" title="A useful app for the task at hand." description="Open an app, keep your favorites close, and find tools for calculations, planning, fitness, and everyday life.">
    <div className="lt-launcher-controls"><div className="lt-search"><Search size={19} aria-hidden /><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={ui("Search apps")} placeholder={ui("Search apps...")} /></div><label className="lt-category-select"><span className="sr-only">{ui("App category")}</span><select value={category} onChange={event => setCategory(event.target.value)}>{["All categories", ...toolCategories].map(item => <option key={item} value={item}>{ui(item)}</option>)}</select></label></div>
    <div className="lt-section-heading lt-app-heading"><nav className="lt-view-switch" aria-label={ui("App collection")}>{views.map(item => <button type="button" key={item} aria-pressed={view === item} onClick={() => setView(item)}>{ui(item)}</button>)}</nav><span role="status">{visible.length} {ui(visible.length === 1 ? "app" : "apps")}</span></div>
    {visible.length > 0 ? <div className="lt-app-grid">{visible.map(tool => {
      const favorite = progress.favoriteTools.includes(tool.id);
      return <article key={tool.id} className="lt-app-card" style={{ "--lt-accent": tool.accent } as CSSProperties}>
        <button type="button" className="lt-favorite" disabled={loading} aria-pressed={favorite} aria-label={`${ui(favorite ? "Remove favorite" : "Add favorite")}: ${ui(tool.title)}`} onClick={() => toggleFavoriteTool(tool.id)}><Star size={17} aria-hidden fill={favorite ? "currentColor" : "none"} /></button>
        <Link to={toolRoute(tool.id)} className="lt-app-link"><span className="lt-icon"><CatalogIcon id={tool.id} size={27} /></span><h2>{ui(tool.title)}</h2><p>{ui(tool.description)}</p><div className="lt-card-footer"><span className="lt-badge">{ui(tool.status === "planned" ? "Coming soon" : "Available now")}</span><ArrowRight size={17} aria-hidden /></div></Link>
      </article>;
    })}</div> : <section className="lt-panel lt-empty"><CatalogIcon id="tools" size={32} /><h2>{ui(view === "Favorites" && !progress.favoriteTools.length ? "Your favorites belong here" : view === "Recently viewed" && !progress.recentTools.length ? "Your recently viewed apps belong here" : "No apps match your search")}</h2><p>{ui(view === "Favorites" && !progress.favoriteTools.length ? "Use the star on any app to add it to your favorites." : view === "Recently viewed" && !progress.recentTools.length ? "Open an app page to find it here next time." : "Try a different search or category.")}</p><button type="button" className="lt-button" onClick={() => { setView("All apps"); setQuery(""); setCategory("All categories"); }}>{ui("Show all apps")}</button></section>}
    <p className="lt-notice">{ui("All apps are available now.")}</p>
    <p className="lt-storage-note">{ui("Favorites and recently viewed apps are saved on this browser, separately for each account.")}</p>
  </HubLayout>;
}
